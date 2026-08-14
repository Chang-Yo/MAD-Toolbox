//! SQLite 持久化（架构文档 §4.5）：一张 `tasks` 表 = 信封 schema。
//! 日志不进库（只存路径）；落库的 argv 只有脱敏版（信封本身就不含完整 argv）。
//! 写频率 = 状态转移级，`Mutex<Connection>` 足够，不引入 async-sqlite 机械。

use super::types::{TaskEnvelope, TaskStatus};
use rusqlite::{params, Connection};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  feature       TEXT NOT NULL,
  pool          TEXT NOT NULL,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  started_at    TEXT,
  finished_at   TEXT,
  tool          TEXT NOT NULL,
  tool_version  TEXT,
  argv_redacted TEXT NOT NULL,
  working_dir   TEXT,
  output_paths  TEXT NOT NULL,
  exit_code     INTEGER,
  log_path      TEXT,
  intent        TEXT NOT NULL
);
";

pub struct TaskStore {
    conn: Mutex<Connection>,
}

/// serde 字符串枚举 → 裸字符串（"queued" 而非 "\"queued\""）。
fn enum_str<T: Serialize>(value: &T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .expect("枚举应序列化为字符串")
}

fn parse_enum<T: DeserializeOwned>(s: &str) -> rusqlite::Result<T> {
    serde_json::from_value(serde_json::Value::String(s.to_owned())).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })
}

fn json_str<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).expect("JSON 序列化不应失败")
}

fn parse_json<T: DeserializeOwned>(s: &str) -> rusqlite::Result<T> {
    serde_json::from_str(s).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })
}

/// 时间戳存 RFC3339（与 serde 输出同格式）；排序/比较在 Rust 侧解析后进行，
/// 不依赖字符串字典序（变长小数精度下字典序不可靠）。
fn time_str(t: &chrono::DateTime<chrono::Utc>) -> String {
    t.to_rfc3339_opts(chrono::SecondsFormat::AutoSi, true)
}

fn parse_time(s: &str) -> rusqlite::Result<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|t| t.with_timezone(&chrono::Utc))
        .map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
        })
}

impl TaskStore {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        Self::init(Connection::open(path)?)
    }

    fn init(conn: Connection) -> rusqlite::Result<Self> {
        conn.execute_batch(SCHEMA)?;
        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version == 0 {
            conn.execute_batch("PRAGMA user_version = 1")?;
        }
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn upsert(&self, e: &TaskEnvelope) -> rusqlite::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT OR REPLACE INTO tasks
             (id, feature, pool, title, status, created_at, started_at, finished_at,
              tool, tool_version, argv_redacted, working_dir, output_paths, exit_code, log_path, intent)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
            params![
                e.id,
                enum_str(&e.feature),
                enum_str(&e.pool),
                e.title,
                enum_str(&e.status),
                time_str(&e.created_at),
                e.started_at.as_ref().map(time_str),
                e.finished_at.as_ref().map(time_str),
                e.tool,
                e.tool_version,
                json_str(&e.argv_redacted),
                e.working_dir,
                json_str(&e.output_paths),
                e.exit_code,
                e.log_path,
                json_str(&e.intent),
            ],
        )?;
        Ok(())
    }

    pub fn all(&self) -> rusqlite::Result<Vec<TaskEnvelope>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM tasks")?;
        let mut rows = stmt.query([])?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            out.push(row_to_envelope(row)?);
        }
        Ok(out)
    }

    pub fn delete(&self, id: &str) -> rusqlite::Result<()> {
        self.conn
            .lock()
            .unwrap()
            .execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// 启动对账（§4.3）：上次会话遗留的 queued/running/canceling 统一翻成 interrupted。
    /// 不自动续跑。queued 遗留者 started_at 保持 NULL——UI 由此推导"排队中未执行"，
    /// 不新增备注字段（能推导的数据不落库）。
    pub fn reconcile(&self) -> rusqlite::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE tasks SET status = 'interrupted'
             WHERE status IN ('queued', 'running', 'canceling')",
            [],
        )?;
        Ok(())
    }
}

fn row_to_envelope(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskEnvelope> {
    let started_at: Option<String> = row.get("started_at")?;
    let finished_at: Option<String> = row.get("finished_at")?;
    Ok(TaskEnvelope {
        id: row.get("id")?,
        feature: parse_enum(&row.get::<_, String>("feature")?)?,
        pool: parse_enum(&row.get::<_, String>("pool")?)?,
        title: row.get("title")?,
        status: parse_enum::<TaskStatus>(&row.get::<_, String>("status")?)?,
        created_at: parse_time(&row.get::<_, String>("created_at")?)?,
        started_at: started_at.as_deref().map(parse_time).transpose()?,
        finished_at: finished_at.as_deref().map(parse_time).transpose()?,
        tool: row.get("tool")?,
        tool_version: row.get("tool_version")?,
        argv_redacted: parse_json(&row.get::<_, String>("argv_redacted")?)?,
        working_dir: row.get("working_dir")?,
        output_paths: parse_json(&row.get::<_, String>("output_paths")?)?,
        exit_code: row.get("exit_code")?,
        log_path: row.get("log_path")?,
        intent: parse_json(&row.get::<_, String>("intent")?)?,
        progress: None,
    })
}
