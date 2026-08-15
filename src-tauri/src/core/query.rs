use serde::Serialize;

use super::deps::ToolName;

/// 长查询启动结果；查询本身通过事件通道持续回传状态。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RunResult {
    pub(crate) job_id: String,
}

/// Bilibili 登录与 musicdl 搜索共享的长查询生命周期事件。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct JobState {
    pub(crate) job_id: String,
    pub(crate) tool: ToolName,
    pub(crate) state: &'static str,
    pub(crate) exit_code: Option<i32>,
    pub(crate) message: String,
}
