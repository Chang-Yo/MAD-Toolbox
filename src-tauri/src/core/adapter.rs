//! adapter 翻译产物的共享形状（架构文档 §2）：TaskSpec 的前身。
//! 各 feature 的 adapter 纯函数产出它，feature 的 commands.rs 补上工具路径等
//! 运行时材料后交给 core/task。

use crate::core::task::types::{CwdPolicy, Pool};
use serde::Serialize;

#[derive(Debug, Clone)]
pub struct AdapterPlan {
    pub tool: &'static str,
    /// 完整 argv——只进 TaskSpec，永不落库/上屏。
    pub argv: Vec<String>,
    /// 脱敏 argv——落库与展示的唯一版本。
    pub argv_redacted: Vec<String>,
    pub title: String,
    pub pool: Pool,
    pub cwd: CwdPolicy,
}

// ---- feature command 层共用的 DTO 与展示规则 ----

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitResult {
    pub task_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResult {
    /// 展示用命令行文本（脱敏）。
    pub display: String,
    pub argv_redacted: Vec<String>,
    /// 完整 argv：仅供专家模式编辑起点（表单密钥本在前端内存，回传不扩大暴露面）。
    pub argv: Vec<String>,
}

/// 展示用引用规则（与旧前端 shellQuote 同规则：安全字符集裸放，其余单引号包裹）。
pub fn quote(value: &str) -> String {
    let safe = !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_./:@%+=,-".contains(c));
    if safe {
        value.to_string()
    } else {
        format!("'{}'", value.replace('\'', "'\\''"))
    }
}

pub fn preview_display(tool: &str, argv_redacted: &[String]) -> String {
    std::iter::once(tool.to_string())
        .chain(argv_redacted.iter().map(|a| quote(a)))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 预览与提交共用同一 AdapterPlan——§5"所见即所执行"的结构性保证。
pub fn preview_result(plan: &AdapterPlan) -> PreviewResult {
    PreviewResult {
        display: preview_display(plan.tool, &plan.argv_redacted),
        argv_redacted: plan.argv_redacted.clone(),
        argv: plan.argv.clone(),
    }
}
