use std::{env, fmt::Write as _, path::PathBuf};

use chrono::Local;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::core::deps::hide_std_command_window;
use crate::core::redaction::sanitize_diagnostic_text;

use super::scheduler::{self, PoolCaps, PoolDefinition};
use super::types::TaskEnvelope;
use super::TaskHub;

#[tauri::command]
pub(crate) fn task_cancel(hub: State<'_, TaskHub>, task_id: String) {
    hub.cancel(&task_id);
}

#[tauri::command]
pub(crate) fn task_promote(hub: State<'_, TaskHub>, task_id: String) {
    hub.promote(&task_id);
}

/// 删除终态任务；返回实际删除的 id（活动任务被跳过，由前端只移除确认过的条目）。
#[tauri::command]
pub(crate) async fn task_delete(
    hub: State<'_, TaskHub>,
    task_ids: Vec<String>,
) -> Result<Vec<String>, String> {
    Ok(hub.delete(task_ids).await)
}

#[tauri::command]
pub(crate) async fn tasks_snapshot(hub: State<'_, TaskHub>) -> Result<Vec<TaskEnvelope>, String> {
    Ok(hub.snapshot().await)
}

fn system_command_text(program: &str, args: &[&str]) -> Option<String> {
    let mut command = std::process::Command::new(program);
    hide_std_command_window(&mut command);
    let output = command.args(args).output().ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty())
}

fn platform_system_info() -> (String, String, String, String) {
    #[cfg(target_os = "macos")]
    {
        let version = system_command_text("/usr/bin/sw_vers", &["-productVersion"])
            .unwrap_or_else(|| "未知".into());
        let build = system_command_text("/usr/bin/sw_vers", &["-buildVersion"])
            .unwrap_or_else(|| "未知".into());
        let cpu = system_command_text("/usr/sbin/sysctl", &["-n", "machdep.cpu.brand_string"])
            .unwrap_or_else(|| "未知".into());
        let memory = system_command_text("/usr/sbin/sysctl", &["-n", "hw.memsize"])
            .and_then(|value| value.parse::<u64>().ok())
            .map(|bytes| format!("{:.1} GiB", bytes as f64 / 1_073_741_824.0))
            .unwrap_or_else(|| "未知".into());
        (version, build, cpu, memory)
    }
    #[cfg(target_os = "windows")]
    {
        let version = system_command_text("cmd.exe", &["/C", "ver"])
            .unwrap_or_else(|| "Windows 10/11".into());
        let build = env::var("OS").unwrap_or_else(|_| "Windows_NT".into());
        let cpu = env::var("PROCESSOR_IDENTIFIER").unwrap_or_else(|_| "未知".into());
        let memory = system_command_text(
            "powershell.exe",
            &[
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ],
        )
        .and_then(|value| value.parse::<u64>().ok())
        .map(|bytes| format!("{:.1} GiB", bytes as f64 / 1_073_741_824.0))
        .unwrap_or_else(|| "未知".into());
        (version, build, cpu, memory)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        (
            env::consts::OS.into(),
            "未知".into(),
            "未知".into(),
            "未知".into(),
        )
    }
}

/// 任务诊断导出（基于新任务系统重建）：信封 + 日志文件 → 单个脱敏文本文件。
/// 信封与日志在记录时已过凭据脱敏；此处再叠加个人信息脱敏（家目录、URL 等）。
#[tauri::command]
pub(crate) async fn task_export_diagnostics(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    task_id: String,
    target_path: String,
) -> Result<String, String> {
    let output = PathBuf::from(target_path.trim());
    let parent = output
        .parent()
        .filter(|path| path.is_dir())
        .ok_or_else(|| "导出目录不存在".to_string())?;
    let envelope = hub
        .snapshot()
        .await
        .into_iter()
        .find(|e| e.id == task_id)
        .ok_or_else(|| "任务不存在或已被保留策略清理".to_string())?;

    let home = env::var(if cfg!(target_os = "windows") {
        "USERPROFILE"
    } else {
        "HOME"
    })
    .ok();
    let sanitize = |value: &str| sanitize_diagnostic_text(value, true, home.as_deref());
    let (os_version, os_build, cpu, memory) = platform_system_info();
    let status = serde_json::to_value(envelope.status)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .unwrap_or_default();
    let time = |value: &Option<chrono::DateTime<chrono::Utc>>| {
        value.map(|t| t.to_rfc3339()).unwrap_or_else(|| "—".into())
    };

    let mut text = format!(
        "MAD Toolbox 任务诊断\n\n\
         创建时间：{}\n应用版本：{}\n系统：{} {} ({}) / {}\nCPU：{}\n内存：{}\n\n\
         任务 ID：{}\n标题：{}\n状态：{}\n工具：{} {}\n退出码：{}\n\
         创建：{}\n开始：{}\n结束：{}\n工作目录：{}\n命令（脱敏）：{}\n输出文件：{}\n\n\
         说明：本文件由 MAD Toolbox 在本机生成，不会自动上传。Cookie、Token、密码等凭据在记录时\n\
         即被隐藏；脱敏为尽力而为，提交给开发者前请自行检查内容。\n\n\
         ===== 任务日志 =====\n",
        Local::now().to_rfc3339(),
        app.package_info().version,
        env::consts::OS,
        os_version,
        os_build,
        format!("{} · {} · {}", env::consts::ARCH, cpu, memory),
        cpu,
        memory,
        envelope.id,
        sanitize(&envelope.title),
        status,
        envelope.tool,
        envelope.tool_version.as_deref().unwrap_or(""),
        envelope
            .exit_code
            .map(|c| c.to_string())
            .unwrap_or_else(|| "无".into()),
        envelope.created_at.to_rfc3339(),
        time(&envelope.started_at),
        time(&envelope.finished_at),
        envelope
            .working_dir
            .as_deref()
            .map(&sanitize)
            .unwrap_or_else(|| "—".into()),
        sanitize(&envelope.argv_redacted.join(" ")),
        if envelope.output_paths.is_empty() {
            "—".into()
        } else {
            sanitize(&envelope.output_paths.join("; "))
        },
    );
    match envelope.log_path.as_deref().map(std::fs::read_to_string) {
        Some(Ok(content)) => {
            for line in content.lines() {
                text.push_str(&sanitize(line));
                text.push('\n');
            }
        }
        Some(Err(error)) => {
            let _ = write!(text, "（日志文件读取失败：{error}）\n");
        }
        None => text.push_str("（该任务没有日志文件）\n"),
    }

    let temporary = parent.join(format!(".mad-toolbox-diag-{}.tmp", Uuid::new_v4()));
    std::fs::write(&temporary, text).map_err(|error| format!("无法写入诊断文件：{error}"))?;
    if output.is_file() {
        std::fs::remove_file(&output).map_err(|error| format!("无法覆盖诊断文件：{error}"))?;
    }
    std::fs::rename(&temporary, &output).map_err(|error| format!("无法保存诊断文件：{error}"))?;
    Ok(output.to_string_lossy().into_owned())
}

#[tauri::command]
pub(crate) fn pool_definitions(caps: State<'_, PoolCaps>) -> Vec<PoolDefinition> {
    scheduler::definitions(*caps.inner())
}
