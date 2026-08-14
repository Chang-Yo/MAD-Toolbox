//! 任务日志落盘与保留清理（架构文档 §4.5）。
//! 日志写 `logs/<task_id>.log`；落盘行由调用方先行脱敏（脱敏是持久化的前置条件）。
//! 保留 15 天：终态且超期的任务连库记录带日志文件一起清；非终态永不清理。

use super::store::TaskStore;
use super::types::LogStream;
use chrono::{DateTime, Duration, Utc};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

/// 默认保留期：15 天。
pub fn default_retention() -> Duration {
    Duration::days(15)
}

pub struct TaskLogWriter {
    out: BufWriter<File>,
    pub path: PathBuf,
}

impl TaskLogWriter {
    pub fn create(logs_dir: &Path, task_id: &str) -> std::io::Result<Self> {
        std::fs::create_dir_all(logs_dir)?;
        let path = logs_dir.join(format!("{task_id}.log"));
        Ok(Self {
            out: BufWriter::new(File::create(&path)?),
            path,
        })
    }

    /// 写一行（调用方保证已脱敏）。逐行 flush：崩溃时日志即最后证词。
    pub fn write_line(&mut self, stream: LogStream, line: &str) {
        let tag = match stream {
            LogStream::Stdout => "stdout",
            LogStream::Stderr => "stderr",
            LogStream::System => "system",
        };
        let _ = writeln!(
            self.out,
            "[{}][{tag}] {line}",
            chrono::Local::now().format("%H:%M:%S")
        );
        let _ = self.out.flush();
    }
}

/// 保留清理。时钟缝 = `now` 参数（不做 Clock trait——trait 只留给真多态）。
pub fn cleanup_expired(store: &TaskStore, now: DateTime<Utc>, retention: Duration) {
    let cutoff = now - retention;
    for envelope in store.all().unwrap_or_default() {
        if envelope.status.is_terminal() && envelope.created_at < cutoff {
            if let Some(log_path) = &envelope.log_path {
                // 日志文件缺失容忍：手动删过不算错
                let _ = std::fs::remove_file(log_path);
            }
            let _ = store.delete(&envelope.id);
        }
    }
}
