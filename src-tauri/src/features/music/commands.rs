//! music（musicdl）的 tauri command（自 lib.rs 归位）。
//! - 搜索 = 查询（§4.1）：结果经 musicdl-search-result 事件流式回填页面，自带 30 分钟超时，
//!   完成信号沿用 job-state 事件；
//! - 下载/歌单 = 作业：产出 TaskSpec 进任务系统。
//! python/musicdl 解析辅助（musicdl_python 等）留在 lib.rs——工具解析属未来 deps 域。

use std::process::Stdio;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::oneshot;
use tokio::time::sleep;
use uuid::Uuid;

use crate::core::task::types::{Feature, Pool, TaskIntent};
use crate::core::task::{TaskHub, TaskSpec};
use crate::{
    background_command, command_path, musicdl_adapter, musicdl_python, musicdl_sessions_dir,
    resolve_tool, JobState, MusicdlAdapterOutput, MusicdlPlaylistRequest, MusicdlSearchRequest,
    MusicdlSearchResponse, RunResult, ToolName,
};

#[tauri::command]
pub(crate) async fn musicdl_search(
    app: AppHandle,
    mut request: MusicdlSearchRequest,
) -> Result<RunResult, String> {
    request.keyword = request.keyword.trim().to_string();
    request.music_sources = request
        .music_sources
        .into_iter()
        .map(|source| source.trim().to_string())
        .filter(|source| !source.is_empty())
        .collect();
    if request.keyword.is_empty() {
        return Err("请填写歌曲、歌手或专辑关键词".into());
    }
    if request.music_sources.is_empty() {
        return Err("请至少选择一个音乐源".into());
    }
    if request.music_sources.len() > 60 {
        return Err("音乐源数量超过安全限制".into());
    }
    request.search_size_per_source = request.search_size_per_source.clamp(1, 100);
    for (label, value) in [
        ("客户端设置", &request.init_music_clients_cfg),
        ("请求设置", &request.requests_overrides),
        ("线程设置", &request.clients_threadings),
        ("搜索规则", &request.search_rules),
    ] {
        if !value.is_object() {
            return Err(format!("{label}必须是 JSON 对象"));
        }
    }
    request.output_directory = request
        .output_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if request.output_directory.is_none() {
        request.output_directory = app.path().download_dir().ok().map(|directory| {
            directory
                .join("MAD Toolbox")
                .join("Music")
                .to_string_lossy()
                .into_owned()
        });
    }
    if let Some(directory) = &request.output_directory {
        std::fs::create_dir_all(directory)
            .map_err(|error| format!("无法创建音乐下载目录：{error}"))?;
    }

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请先按照页面提示安装".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = musicdl_adapter(&app)?;
    let session_id = Uuid::new_v4().to_string();
    let session_directory = musicdl_sessions_dir(&app)?.join(&session_id);
    std::fs::create_dir_all(&session_directory).map_err(|error| error.to_string())?;
    let request_path = session_directory.join("request.json");
    let state_path = session_directory.join("results.pickle");
    let bytes = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    std::fs::write(&request_path, bytes).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&request_path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }

    let mut child = background_command(python)
        .arg(adapter)
        .arg("search")
        .arg(&request_path)
        .arg(&state_path)
        .env("PATH", command_path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| format!("无法启动 musicdl 搜索：{error}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let source_count = request.music_sources.len();
    let _ = app.emit(
        "job-state",
        JobState {
            job_id: session_id.clone(),
            tool: ToolName::Musicdl,
            state: "running",
            exit_code: None,
            message: format!("musicdl 正在搜索 {source_count} 个音乐源"),
        },
    );

    let task_app = app.clone();
    let task_job_id = session_id.clone();
    tauri::async_runtime::spawn(async move {
        let (payload_tx, payload_rx) = oneshot::channel::<MusicdlAdapterOutput>();
        let stdout_task = stdout.map(|stdout| {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                let mut payload_tx = Some(payload_tx);
                while let Ok(Some(line)) = lines.next_line().await {
                    if let Ok(payload) = serde_json::from_str::<MusicdlAdapterOutput>(&line) {
                        if let Some(sender) = payload_tx.take() {
                            let _ = sender.send(payload);
                        }
                    }
                }
            })
        });
        let stderr_task = stderr.map(|stderr| {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(_)) = lines.next_line().await {}
            })
        });

        let (state_name, exit_code, mut message) = tokio::select! {
            status = child.wait() => match status {
                Ok(status) if status.success() => (
                    "completed",
                    status.code(),
                    "musicdl 搜索完成".to_string(),
                ),
                Ok(status) => (
                    "failed",
                    status.code(),
                    "musicdl 搜索失败".to_string(),
                ),
                Err(error) => (
                    "failed",
                    None,
                    format!("无法等待 musicdl 搜索：{error}"),
                ),
            },
            _ = sleep(Duration::from_secs(1800)) => {
                let _ = child.kill().await;
                (
                    "failed",
                    None,
                    "musicdl 搜索超过 30 分钟，已停止；请减少音乐源或检查网络".to_string(),
                )
            },
        };
        if let Some(task) = stdout_task {
            let _ = task.await;
        }
        if let Some(task) = stderr_task {
            let _ = task.await;
        }

        if state_name == "completed" {
            match payload_rx.await {
                Ok(payload) => {
                    let count = payload.results.len();
                    let response = MusicdlSearchResponse {
                        session_id: task_job_id.clone(),
                        results: payload.results,
                    };
                    let _ = task_app.emit("musicdl-search-result", response);
                    message = format!("musicdl 搜索完成，共 {count} 项结果");
                }
                Err(_) => {
                    message = "无法解析 musicdl 搜索结果，请升级或重新安装 musicdl".into();
                }
            }
        }
        let final_state = if state_name == "completed" && message.starts_with("无法解析") {
            "failed"
        } else {
            state_name
        };
        let _ = task_app.emit(
            "job-state",
            JobState {
                job_id: task_job_id,
                tool: ToolName::Musicdl,
                state: final_state,
                exit_code,
                message,
            },
        );
    });
    Ok(RunResult { job_id: session_id })
}

#[tauri::command]
pub(crate) async fn musicdl_download(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    session_id: String,
    indices: Vec<usize>,
) -> Result<RunResult, String> {
    Uuid::parse_str(&session_id).map_err(|_| "无效的 musicdl 搜索会话".to_string())?;
    if indices.is_empty() {
        return Err("请至少选择一首音乐".into());
    }
    if indices.len() > 1000 {
        return Err("一次选择的音乐数量超过限制".into());
    }
    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请重新检测依赖".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = musicdl_adapter(&app)?;
    let state_path = musicdl_sessions_dir(&app)?
        .join(&session_id)
        .join("results.pickle");
    if !state_path.is_file() {
        return Err("musicdl 搜索结果已失效，请重新搜索".into());
    }
    let selected = serde_json::to_string(&indices).map_err(|error| error.to_string())?;
    // 音乐下载作业进任务系统（§3：musicdl 旁路取消）；搜索维持查询语义
    let argv = vec![
        adapter.to_string_lossy().into_owned(),
        "download".into(),
        state_path.to_string_lossy().into_owned(),
        selected,
    ];
    let task_id = hub.submit(TaskSpec {
        feature: Feature::Music,
        pool: Pool::Download,
        title: format!("音乐下载（{} 首）", indices.len()),
        tool: "musicdl".into(),
        tool_path: python,
        tool_version: None,
        argv_redacted: argv.clone(),
        argv,
        cwd: None,
        env_path: Some(command_path()),
        intent: TaskIntent::Form(serde_json::json!({
            "musicdl": "download",
            "sessionId": session_id,
            "indices": indices,
        })),
        parser: None,
        on_failure: None,
    });
    Ok(RunResult { job_id: task_id })
}

#[tauri::command]
pub(crate) async fn musicdl_playlist(
    app: AppHandle,
    hub: State<'_, TaskHub>,
    mut request: MusicdlPlaylistRequest,
) -> Result<RunResult, String> {
    request.playlist_url = request.playlist_url.trim().to_string();
    request.music_sources = request
        .music_sources
        .into_iter()
        .map(|source| source.trim().to_string())
        .filter(|source| !source.is_empty())
        .collect();
    if request.playlist_url.is_empty() {
        return Err("请填写歌单链接".into());
    }
    if request.music_sources.is_empty() || request.music_sources.len() > 60 {
        return Err("请选择 1–60 个音乐源".into());
    }
    for (label, value) in [
        ("客户端设置", &request.init_music_clients_cfg),
        ("请求设置", &request.requests_overrides),
        ("线程设置", &request.clients_threadings),
        ("搜索规则", &request.search_rules),
    ] {
        if !value.is_object() {
            return Err(format!("{label}必须是 JSON 对象"));
        }
    }
    request.output_directory = request
        .output_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            app.path().download_dir().ok().map(|directory| {
                directory
                    .join("MAD Toolbox")
                    .join("Music")
                    .to_string_lossy()
                    .into_owned()
            })
        });
    let output_directory = request
        .output_directory
        .as_ref()
        .ok_or_else(|| "无法确定音乐导出目录".to_string())?;
    std::fs::create_dir_all(output_directory)
        .map_err(|error| format!("无法创建音乐导出目录：{error}"))?;

    let (musicdl, _) = resolve_tool(&app, &ToolName::Musicdl)
        .ok_or_else(|| "未安装 musicdl，请重新检测依赖".to_string())?;
    let python = musicdl_python(&musicdl)?;
    let adapter = musicdl_adapter(&app)?;
    let session_directory = musicdl_sessions_dir(&app)?.join(Uuid::new_v4().to_string());
    std::fs::create_dir_all(&session_directory).map_err(|error| error.to_string())?;
    let request_path = session_directory.join("playlist-request.json");
    std::fs::write(
        &request_path,
        serde_json::to_vec(&request).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&request_path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    // 歌单下载作业进任务系统（§3：musicdl 旁路取消）
    let argv = vec![
        adapter.to_string_lossy().into_owned(),
        "playlist".into(),
        request_path.to_string_lossy().into_owned(),
    ];
    let task_id = hub.submit(TaskSpec {
        feature: Feature::Music,
        pool: Pool::Download,
        title: format!("歌单下载 {}", request.playlist_url),
        tool: "musicdl".into(),
        tool_path: python,
        tool_version: None,
        argv_redacted: argv.clone(),
        argv,
        cwd: None,
        env_path: Some(command_path()),
        intent: TaskIntent::Form(serde_json::json!({
            "musicdl": "playlist",
            "playlistUrl": request.playlist_url,
        })),
        parser: None,
        on_failure: None,
    });
    Ok(RunResult { job_id: task_id })
}
