//! network（yt-dlp）的 tauri command 薄壳。
//! 作业（下载）经 core/task；formats/metadata 按 §4.1 走查询通路：
//! 超时 + 内部并发上限（不可见小信号量），错误就地返回发起页。

use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, State};
use tokio::sync::Semaphore;

use super::adapter::{self, NetworkCtx, ProbeKind, NEEDS_BROWSER_COOKIES_SIGNAL};
use crate::core::adapter::{preview_result, PreviewResult, SubmitResult};
use crate::core::deps::{command_path, resolve_tool, ToolName};
use crate::core::task::types::{CwdPolicy, Feature, TaskIntent};
use crate::core::task::{FailureAdvisor, ParsedSignal, TaskHub, TaskSpec};

fn resolve_ctx(app: &AppHandle) -> NetworkCtx {
    NetworkCtx {
        deno_path: resolve_tool(app, &ToolName::Deno)
            .map(|(p, _)| p.to_string_lossy().into_owned()),
        ffmpeg_location: resolve_tool(app, &ToolName::Ffmpeg)
            .map(|(p, _)| p.to_string_lossy().into_owned()),
    }
}

#[tauri::command]
pub fn network_preview(app: AppHandle, intent: TaskIntent) -> Result<PreviewResult, String> {
    let plan = adapter::plan(&intent, &resolve_ctx(&app)).map_err(|e| e.to_string())?;
    Ok(preview_result(&plan))
}

#[tauri::command]
pub fn network_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    intent: TaskIntent,
) -> Result<SubmitResult, String> {
    let ctx = resolve_ctx(&app);
    let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
    let (tool_path, _) = resolve_tool(&app, &ToolName::YtDlp)
        .ok_or_else(|| "未找到 yt-dlp，请先在依赖页安装".to_string())?;
    let cwd = match plan.cwd {
        CwdPolicy::Inherit => None,
        CwdPolicy::ExeDir => tool_path.parent().map(|p| p.to_path_buf()),
        CwdPolicy::Explicit(dir) => Some(std::path::PathBuf::from(dir)),
    };

    // 失败兜底（§2）：解析器发信号，顾问按预先算好的重试计划决定是否重试
    let parser = Some(Arc::new(|line: &str| {
        if adapter::browser_cookie_fallback_requested(line) {
            vec![ParsedSignal::Custom {
                name: NEEDS_BROWSER_COOKIES_SIGNAL.into(),
                payload: serde_json::json!({}),
            }]
        } else {
            Vec::new()
        }
    }) as _);
    let on_failure: Option<FailureAdvisor> = adapter::retry_plan(&intent, &ctx).map(|retry| {
        Arc::new(move |report: &crate::core::task::FailureReport| {
            report
                .signals
                .iter()
                .any(|s| s == NEEDS_BROWSER_COOKIES_SIGNAL)
                .then(|| retry.clone())
        }) as FailureAdvisor
    });

    let spec = TaskSpec {
        feature: Feature::Network,
        pool: plan.pool,
        title: plan.title,
        tool: plan.tool.to_string(),
        tool_path,
        tool_version: None,
        argv: plan.argv,
        argv_redacted: plan.argv_redacted,
        cwd,
        output_paths: plan.output_paths,
        env_path: Some(command_path()),
        intent: adapter::sanitize_intent(&intent),
        parser,
        on_failure,
        cleanup_dir: None,
    };
    Ok(SubmitResult {
        task_id: hub.submit(spec),
    })
}

/// 查询并发上限（§4.1）：防重复点击堆积解析进程。
static PROBE_PERMITS: Semaphore = Semaphore::const_new(2);
const PROBE_TIMEOUT: Duration = Duration::from_secs(90);

#[tauri::command]
pub async fn network_probe(
    app: AppHandle,
    intent: TaskIntent,
    kind: ProbeKind,
) -> Result<String, String> {
    let ctx = resolve_ctx(&app);
    let argv = adapter::probe_argv(&intent, &ctx, kind).map_err(|e| e.to_string())?;
    let (tool_path, _) = resolve_tool(&app, &ToolName::YtDlp)
        .ok_or_else(|| "未找到 yt-dlp，请先在依赖页安装".to_string())?;

    let _permit = PROBE_PERMITS
        .acquire()
        .await
        .map_err(|_| "查询通道已关闭".to_string())?;
    let mut cmd = tokio::process::Command::new(&tool_path);
    cmd.args(&argv)
        .env("PATH", command_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    crate::core::process::hide_window(&mut cmd);

    let output = tokio::time::timeout(PROBE_TIMEOUT, cmd.output())
        .await
        .map_err(|_| "解析超时（90 秒），请检查网络或代理".to_string())?
        .map_err(|e| format!("启动 yt-dlp 失败：{e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: Vec<&str> = stderr.lines().rev().take(8).collect();
        Err(tail.into_iter().rev().collect::<Vec<_>>().join("\n"))
    }
}
