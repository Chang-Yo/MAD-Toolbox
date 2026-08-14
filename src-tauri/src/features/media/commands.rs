//! media（FFmpeg）的 tauri command 薄壳。
//! 目录/多选展开与 ffprobe 探测在此完成（IO 边界），参数决策全在 adapter 纯函数。
//! inspect_media / expand_media_inputs / ffmpeg_encoders 是查询（§4.1），沿用 lib.rs 既有实现。

use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tokio::sync::OnceCell;

use super::adapter::{self, MediaCtx, PrProbe};
use crate::core::adapter::{preview_result, PreviewResult};
use crate::core::task::types::{CwdPolicy, Feature, TaskIntent};
use crate::core::task::{TaskHub, TaskSpec};

/// copy+滤镜冲突时的兜底编码器优先序（与旧前端一致，libx264 系优先）。
const FALLBACK_PREFERENCE: [&str; 7] = [
    "libx264",
    "libopenh264",
    "h264_videotoolbox",
    "h264_amf",
    "h264_nvenc",
    "h264_qsv",
    "mpeg4",
];

/// 编码器探测进程级缓存：预览随表单高频刷新，不能每次跑 ffmpeg -encoders。
static ENCODER_FALLBACK: OnceCell<Option<String>> = OnceCell::const_new();

async fn media_ctx(app: &AppHandle) -> MediaCtx {
    let fallback = ENCODER_FALLBACK
        .get_or_init(|| async {
            let encoders = crate::ffmpeg_encoders(app.clone())
                .await
                .unwrap_or_default();
            FALLBACK_PREFERENCE
                .iter()
                .find(|name| encoders.iter().any(|e| e == *name))
                .map(|s| s.to_string())
        })
        .await;
    MediaCtx {
        encoder_fallback: fallback.clone(),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSubmitResult {
    pub task_ids: Vec<String>,
}

#[tauri::command]
pub async fn media_preview(app: AppHandle, intent: TaskIntent) -> Result<PreviewResult, String> {
    let ctx = media_ctx(&app).await;
    let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
    Ok(preview_result(&plan))
}

fn ffmpeg_spec(
    plan: crate::core::adapter::AdapterPlan,
    tool_path: PathBuf,
    intent: TaskIntent,
) -> TaskSpec {
    let cwd = match plan.cwd {
        CwdPolicy::Inherit => None,
        CwdPolicy::ExeDir => tool_path.parent().map(|p| p.to_path_buf()),
    };
    TaskSpec {
        feature: Feature::Media,
        pool: plan.pool,
        title: plan.title,
        tool: plan.tool.to_string(),
        tool_path,
        tool_version: None,
        argv: plan.argv,
        argv_redacted: plan.argv_redacted,
        cwd,
        env_path: Some(crate::command_path()),
        intent, // media 无敏感字段，intent 无需 sanitize
        parser: None,
        on_failure: None,
    }
}

/// 常规媒体处理提交：inputs（文件/目录）后端展开，每个文件一个任务。
#[tauri::command]
pub async fn media_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    inputs: Vec<String>,
    intent: TaskIntent,
) -> Result<BatchSubmitResult, String> {
    let TaskIntent::Form(data) = &intent else {
        // 专家模式：argv 原文单任务提交
        let ctx = media_ctx(&app).await;
        let plan = adapter::plan(&intent, &ctx).map_err(|e| e.to_string())?;
        let (tool_path, _) = crate::resolve_tool(&app, &crate::ToolName::Ffmpeg)
            .ok_or_else(|| "未找到 FFmpeg，请先在依赖页安装".to_string())?;
        let id = hub.submit(ffmpeg_spec(plan, tool_path, intent.clone()));
        return Ok(BatchSubmitResult { task_ids: vec![id] });
    };

    let include_subtitles = data
        .get("operation")
        .and_then(|v| v.as_str())
        .is_some_and(|op| op == "subtitle-extract");
    let expanded = crate::expand_media_inputs(inputs, Some(include_subtitles))?;
    if expanded.is_empty() {
        return Err("没有可处理的媒体文件".into());
    }

    let ctx = media_ctx(&app).await;
    let (tool_path, _) = crate::resolve_tool(&app, &crate::ToolName::Ffmpeg)
        .ok_or_else(|| "未找到 FFmpeg，请先在依赖页安装".to_string())?;

    let mut task_ids = Vec::new();
    for input in expanded {
        // 每文件一个意图：重跑语义精确到单文件
        let mut file_data = data.clone();
        if let Some(map) = file_data.as_object_mut() {
            map.insert("input".into(), serde_json::Value::String(input.clone()));
        }
        let file_intent = TaskIntent::Form(file_data);
        let plan = adapter::plan(&file_intent, &ctx).map_err(|e| e.to_string())?;
        task_ids.push(hub.submit(ffmpeg_spec(plan, tool_path.clone(), file_intent)));
    }
    Ok(BatchSubmitResult { task_ids })
}

/// PR 兼容转码提交（旧 run_pr_compatible 的任务系统化）：探测每个文件后按编排规则提交。
#[tauri::command]
pub async fn media_pr_submit(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    input: String,
    output_directory: Option<String>,
) -> Result<BatchSubmitResult, String> {
    let (tool_path, _) = crate::resolve_tool(&app, &crate::ToolName::Ffmpeg)
        .ok_or_else(|| "未找到 FFmpeg，请先在依赖页安装".to_string())?;
    let (ffprobe, _) = crate::resolve_tool(&app, &crate::ToolName::Ffprobe)
        .ok_or_else(|| "未找到 ffprobe，请先在依赖页安装".to_string())?;

    let input_path = PathBuf::from(&input);
    let inputs = if input_path.is_dir() {
        crate::media_files_in(&input_path)?
    } else if input_path.is_file() {
        vec![input_path]
    } else {
        return Err("输入文件或目录不存在".into());
    };

    let mut task_ids = Vec::new();
    for path in inputs {
        let (video, audio, subtitles) = crate::probe_streams(&ffprobe, &path).await?;
        let probe = PrProbe {
            video,
            audio,
            subtitles,
        };
        let (plan, output) = adapter::pr_plan(&path, &probe, output_directory.as_deref())?;
        if let Some(parent) = output.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let intent = TaskIntent::Form(serde_json::json!({
            "prCompatible": true,
            "input": path.to_string_lossy(),
            "outputDirectory": output_directory,
        }));
        task_ids.push(hub.submit(ffmpeg_spec(plan, tool_path.clone(), intent)));
    }
    Ok(BatchSubmitResult { task_ids })
}
