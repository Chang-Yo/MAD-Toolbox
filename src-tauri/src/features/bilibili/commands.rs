//! bilibili 的 tauri command 薄壳（架构文档 §3 纪律：只做反序列化 → 调 adapter → 返回，
//! 出现 if-else 即业务逻辑外漏）。
//! 预览与提交走同一个 `adapter::plan` 调用——§5"所见即所执行"的结构性保证。

use tauri::{AppHandle, State};

use super::adapter;
use crate::core::adapter::{preview_result, PreviewResult, SubmitResult};
use crate::core::task::types::{CwdPolicy, Feature, TaskIntent};
use crate::core::task::{TaskHub, TaskSpec};

/// 原生扫码登录入口（旧 run_tool 的 ["login"] 特判归位为显式 command）。
/// 登录是"带自定义事件的长时查询"（§4.2 实施期修正），不进任务系统；
/// 生命周期事件沿用 job-state/bbdown-login-qr 通道。
#[tauri::command]
pub(crate) async fn bilibili_login_start(app: AppHandle) -> Result<crate::RunResult, String> {
    let (executable, _) = crate::resolve_tool(&app, &crate::ToolName::Bbdown)
        .ok_or_else(|| "未找到 BBDown，请先在依赖页安装".to_string())?;
    let working_dir = crate::bbdown_directory(&executable)?;
    crate::spawn_bbdown_login_job(app, working_dir).await
}

#[tauri::command]
pub fn bilibili_preview(intent: TaskIntent) -> Result<PreviewResult, String> {
    let plan = adapter::plan(&intent).map_err(|e| e.to_string())?;
    Ok(preview_result(&plan))
}

#[tauri::command]
pub fn bilibili_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    intent: TaskIntent,
) -> Result<SubmitResult, String> {
    let plan = adapter::plan(&intent).map_err(|e| e.to_string())?;
    let (tool_path, _bundled) = crate::resolve_tool(&app, &crate::ToolName::Bbdown)
        .ok_or_else(|| "未找到 BBDown，请先在依赖页安装".to_string())?;
    let cwd = match plan.cwd {
        CwdPolicy::ExeDir => Some(crate::bbdown_directory(&tool_path)?),
        CwdPolicy::Inherit => None,
    };
    let spec = TaskSpec {
        feature: Feature::Bilibili,
        pool: plan.pool,
        title: plan.title,
        tool: plan.tool.to_string(),
        tool_path,
        tool_version: None, // deps 阶段接入版本缓存后补充
        argv: plan.argv,
        argv_redacted: plan.argv_redacted,
        cwd,
        env_path: Some(crate::command_path()),
        // 落库的意图必须先脱敏（§4.5）；本次执行用的完整 argv 不受影响
        intent: adapter::sanitize_intent(&intent),
        parser: None,     // BBDown 进度解析待样板后接入
        on_failure: None, // BBDown 无失败兜底语义（yt-dlp 专属）
    };
    Ok(SubmitResult {
        task_id: hub.submit(spec),
    })
}
