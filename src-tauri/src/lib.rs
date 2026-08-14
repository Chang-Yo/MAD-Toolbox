mod core;
mod features;

use crate::features::bilibili::login as bilibili_login;

use chrono::Local;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    ffi::OsString,
    fmt::Write as _,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{
    process::Command,
    time::{sleep, timeout, Duration},
};
use uuid::Uuid;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hide_async_command_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

fn hide_std_command_window(command: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

fn background_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    hide_async_command_window(&mut command);
    command
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum ToolName {
    Bbdown,
    YtDlp,
    Musicdl,
    Ffmpeg,
    Ffprobe,
    Mediainfo,
    Deno,
    Python,
}

impl ToolName {
    fn executable(&self) -> &'static str {
        match self {
            Self::Bbdown => "BBDown",
            Self::YtDlp => "yt-dlp",
            Self::Musicdl => "musicdl",
            Self::Ffmpeg => "ffmpeg",
            Self::Ffprobe => "ffprobe",
            Self::Mediainfo => "mediainfo",
            Self::Deno => "deno",
            Self::Python => {
                if cfg!(target_os = "windows") {
                    "python"
                } else {
                    "python3"
                }
            }
        }
    }

    fn label(&self) -> &'static str {
        match self {
            Self::Bbdown => "BBDown",
            Self::YtDlp => "yt-dlp",
            Self::Musicdl => "musicdl",
            Self::Ffmpeg => "FFmpeg",
            Self::Ffprobe => "ffprobe",
            Self::Mediainfo => "MediaInfo CLI",
            Self::Deno => "Deno",
            Self::Python => "Python 3",
        }
    }

    fn required(&self) -> bool {
        !matches!(self, Self::Ffprobe | Self::Musicdl | Self::Python)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DependencyStatus {
    tool: ToolName,
    label: String,
    available: bool,
    bundled: bool,
    bundled_available: bool,
    system_available: bool,
    source: Option<String>,
    path: Option<String>,
    version: Option<String>,
    required: bool,
    install_hint: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RunResult {
    pub(crate) job_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobState {
    job_id: String,
    tool: ToolName,
    state: &'static str,
    exit_code: Option<i32>,
    message: String,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum DependencyPreference {
    #[default]
    Bundled,
    System,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    default_output_directory: Option<String>,
    #[serde(default)]
    dependency_preference: DependencyPreference,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginQr {
    job_id: String,
    data_url: String,
}

#[derive(Serialize)]
struct MediaInspection {
    path: String,
    summary: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlSearchRequest {
    keyword: String,
    music_sources: Vec<String>,
    init_music_clients_cfg: serde_json::Value,
    requests_overrides: serde_json::Value,
    clients_threadings: serde_json::Value,
    search_rules: serde_json::Value,
    output_directory: Option<String>,
    search_size_per_source: usize,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlPlaylistRequest {
    playlist_url: String,
    music_sources: Vec<String>,
    init_music_clients_cfg: serde_json::Value,
    requests_overrides: serde_json::Value,
    clients_threadings: serde_json::Value,
    search_rules: serde_json::Value,
    output_directory: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlSearchResult {
    index: usize,
    song_name: String,
    singers: String,
    album: String,
    extension: String,
    file_size: String,
    duration: String,
    bitrate: Option<u64>,
    codec: String,
    sample_rate: Option<u64>,
    channels: Option<u64>,
    source: String,
    root_source: String,
    cover_url: Option<String>,
    lossless: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MusicdlSearchResponse {
    session_id: String,
    results: Vec<MusicdlSearchResult>,
}

#[derive(Debug, Deserialize)]
struct MusicdlAdapterOutput {
    results: Vec<MusicdlSearchResult>,
}

pub(crate) fn command_path() -> OsString {
    let inherited = env::var_os("PATH").unwrap_or_default();
    let mut paths = Vec::new();
    #[cfg(target_os = "macos")]
    paths.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/opt/homebrew/sbin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
        PathBuf::from("/usr/sbin"),
        PathBuf::from("/sbin"),
    ]);
    #[cfg(target_os = "windows")]
    {
        if cfg!(debug_assertions) {
            paths.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources"));
        }
        if let Some(profile) = env::var_os("USERPROFILE") {
            let profile = PathBuf::from(profile);
            paths.push(profile.join(".local").join("bin"));
            paths.push(profile.join("scoop").join("shims"));
        }
        if let Some(local) = env::var_os("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            let python_root = local.join("Programs").join("Python");
            paths.push(python_root.join("Scripts"));
            if let Ok(entries) = std::fs::read_dir(&python_root) {
                for entry in entries.flatten().filter(|entry| entry.path().is_dir()) {
                    paths.push(entry.path());
                    paths.push(entry.path().join("Scripts"));
                }
            }
            paths.push(local.join("Microsoft").join("WinGet").join("Links"));
            paths.push(local.join("pipx").join("bin"));
            paths.push(local.join("Microsoft").join("WindowsApps"));
        }
        if let Some(app_data) = env::var_os("APPDATA") {
            let python_root = PathBuf::from(app_data).join("Python");
            if let Ok(entries) = std::fs::read_dir(python_root) {
                for entry in entries.flatten() {
                    paths.push(entry.path().join("Scripts"));
                }
            }
        }
        if let Some(program_data) = env::var_os("ProgramData") {
            paths.push(PathBuf::from(program_data).join("chocolatey").join("bin"));
        }
    }
    #[cfg(not(target_os = "windows"))]
    if let Some(home) = env::var_os("HOME") {
        paths.push(PathBuf::from(home).join(".local").join("bin"));
    }
    if let Ok(current) = env::current_exe() {
        if let Some(parent) = current.parent() {
            paths.push(parent.to_path_buf());
        }
    }
    paths.extend(env::split_paths(&inherited));
    env::join_paths(paths).unwrap_or(inherited)
}

fn executable_filename(name: &str) -> String {
    if cfg!(target_os = "windows") && !name.to_ascii_lowercase().ends_with(".exe") {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

fn find_system_binary(name: &str) -> Option<PathBuf> {
    let filename = executable_filename(name);
    for directory in env::split_paths(&command_path()) {
        let candidate = directory.join(&filename);
        #[cfg(target_os = "windows")]
        if matches!(name.to_ascii_lowercase().as_str(), "python" | "python3")
            && directory
                .file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("WindowsApps"))
        {
            continue;
        }
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn same_binary(left: &Path, right: &Path) -> bool {
    left == right
        || left
            .canonicalize()
            .ok()
            .zip(right.canonicalize().ok())
            .map(|(left, right)| left == right)
            .unwrap_or(false)
}

fn find_distinct_system_binary(name: &str, bundled: Option<&Path>) -> Option<PathBuf> {
    let filename = executable_filename(name);
    for directory in env::split_paths(&command_path()) {
        let candidate = directory.join(&filename);
        #[cfg(target_os = "windows")]
        if matches!(name.to_ascii_lowercase().as_str(), "python" | "python3")
            && directory
                .file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("WindowsApps"))
        {
            continue;
        }
        if candidate.is_file()
            && !bundled
                .map(|bundled| same_binary(&candidate, bundled))
                .unwrap_or(false)
        {
            return Some(candidate);
        }
    }
    None
}

fn bundled_binary(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let target_name = executable_filename(name);
    let target = env::var("TARGET").unwrap_or_else(|_| {
        if cfg!(target_os = "windows") {
            "x86_64-pc-windows-msvc".into()
        } else {
            "aarch64-apple-darwin".into()
        }
    });
    let dev_binary = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(format!(
            "{name}-{target}{}",
            if cfg!(target_os = "windows") {
                ".exe"
            } else {
                ""
            }
        ));
    let mut candidates = Vec::new();
    if cfg!(debug_assertions) {
        candidates.push(dev_binary);
    }
    if let Ok(current) = env::current_exe() {
        if let Some(parent) = current.parent() {
            candidates.push(parent.join(&target_name));
        }
    }
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join(&target_name));
        candidates.push(resources.join("binaries").join(&target_name));
    }
    candidates.into_iter().find(|path| path.is_file())
}

pub(crate) fn resolve_tool(app: &AppHandle, tool: &ToolName) -> Option<(PathBuf, bool)> {
    let bundled = bundled_binary(app, tool.executable()).map(|path| (path, true));
    let system = find_distinct_system_binary(
        tool.executable(),
        bundled.as_ref().map(|(path, _)| path.as_path()),
    )
    .map(|path| (path, false));

    if matches!(tool, ToolName::Bbdown) {
        // Full/Lite both ship BBDown. Never silently switch to a separately
        // installed copy: BBDown must read and write the data file beside the
        // executable included in this app.
        bundled
    } else if matches!(
        load_app_settings(app).dependency_preference,
        DependencyPreference::System
    ) {
        system.or(bundled)
    } else {
        bundled.or(system)
    }
}

#[cfg(not(target_os = "windows"))]
fn musicdl_launcher_python(script: &str) -> Option<PathBuf> {
    // pipx can generate a shell/Python polyglot launcher. In that form the
    // shebang is /bin/sh and the real virtualenv interpreter is quoted on the
    // following exec line, so inspect quoted executable paths first.
    for line in script.lines().take(12) {
        for quoted in line.split('"').skip(1).step_by(2) {
            let candidate = PathBuf::from(quoted);
            if candidate
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("python"))
            {
                return Some(candidate);
            }
        }
    }
    let shebang = script
        .lines()
        .next()
        .and_then(|line| line.strip_prefix("#!"))
        .map(str::trim)?;
    let fields = shebang.split_whitespace().collect::<Vec<_>>();
    if fields.first() == Some(&"/usr/bin/env") {
        fields
            .get(1)
            .filter(|name| name.starts_with("python"))
            .map(PathBuf::from)
    } else {
        fields.first().and_then(|value| {
            let candidate = PathBuf::from(value);
            candidate
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("python"))
                .then_some(candidate)
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
    let script = std::fs::read_to_string(executable)
        .map_err(|error| format!("无法读取 musicdl 启动脚本：{error}"))?;
    let hint = musicdl_launcher_python(&script)
        .ok_or_else(|| "无法识别 musicdl 使用的 Python 环境，请使用 pipx 重新安装".to_string())?;
    let interpreter = if hint.is_absolute() {
        hint
    } else {
        find_system_binary(
            hint.to_str()
                .ok_or_else(|| "musicdl 的 Python 启动信息无效".to_string())?,
        )
        .ok_or_else(|| "找不到 musicdl 使用的 Python 解释器".to_string())?
    };
    interpreter
        .is_file()
        .then_some(interpreter)
        .ok_or_else(|| "musicdl 使用的 Python 解释器不存在，请使用 pipx 重新安装".to_string())
}

#[cfg(target_os = "windows")]
fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Some(python_root) = executable.parent().and_then(Path::parent) {
        candidates.push(python_root.join("python.exe"));
    }
    if let Some(pipx_home) = env::var_os("PIPX_HOME") {
        candidates.push(
            PathBuf::from(pipx_home)
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
    }
    if let Some(profile) = env::var_os("USERPROFILE") {
        let profile = PathBuf::from(profile);
        candidates.push(
            profile
                .join("pipx")
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
        candidates.push(
            profile
                .join(".local")
                .join("share")
                .join("pipx")
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
    }
    if let Some(local) = env::var_os("LOCALAPPDATA") {
        candidates.push(
            PathBuf::from(local)
                .join("pipx")
                .join("venvs")
                .join("musicdl")
                .join("Scripts")
                .join("python.exe"),
        );
    }
    if let Some(pipx) = find_system_binary("pipx") {
        let mut command = std::process::Command::new(pipx);
        hide_std_command_window(&mut command);
        if let Ok(output) = command
            .args(["environment", "--value", "PIPX_LOCAL_VENVS"])
            .output()
        {
            if output.status.success() {
                let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !root.is_empty() {
                    candidates.push(
                        PathBuf::from(root)
                            .join("musicdl")
                            .join("Scripts")
                            .join("python.exe"),
                    );
                }
            }
        }
    }
    if let Some(system) = find_system_binary("python") {
        candidates.push(system);
    }
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| "找不到 musicdl 使用的 Python 环境，请使用 pipx 重新安装".into())
}

fn musicdl_adapter(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if cfg!(debug_assertions) {
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("musicdl-adapter.py"),
        );
    }
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join("musicdl-adapter.py"));
    }
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| "找不到 MAD Toolbox musicdl 适配器".to_string())
}

fn musicdl_sessions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app_data_dir(app)?.join("musicdl-sessions");
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
    }
    Ok(path)
}

async fn tool_version(path: &Path, tool: &ToolName) -> Option<String> {
    let mut command = Command::new(path);
    hide_async_command_window(&mut command);
    command.env("PATH", command_path());
    command.kill_on_drop(true);
    command.arg(if matches!(tool, ToolName::Bbdown) {
        "--help"
    } else {
        "--version"
    });
    let output = timeout(Duration::from_secs(3), command.output())
        .await
        .ok()?
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let text = if stdout.trim().is_empty() {
        stderr
    } else {
        stdout
    };
    let first_line = if matches!(tool, ToolName::Bbdown) {
        text.lines()
            .find(|line| line.contains("BBDown version"))
            .or_else(|| text.lines().find(|line| !line.trim().is_empty()))?
            .trim()
    } else {
        text.lines().find(|line| !line.trim().is_empty())?.trim()
    };
    let shortened = if matches!(tool, ToolName::Ffmpeg | ToolName::Ffprobe) {
        first_line
            .split_whitespace()
            .take(3)
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        first_line.chars().take(100).collect()
    };
    Some(shortened)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

#[tauri::command]
fn app_settings(app: AppHandle) -> AppSettings {
    load_app_settings(&app)
}

fn load_app_settings(app: &AppHandle) -> AppSettings {
    settings_path(app)
        .ok()
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_app_settings(app: AppHandle, mut settings: AppSettings) -> Result<AppSettings, String> {
    settings.default_output_directory = settings
        .default_output_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if let Some(directory) = &settings.default_output_directory {
        if !Path::new(directory).is_dir() {
            return Err("默认导出目录不存在或不是目录".into());
        }
    }
    let path = settings_path(&app)?;
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(&settings).map_err(|error| error.to_string())?;
    std::fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    std::fs::rename(&temporary, &path).map_err(|error| error.to_string())?;
    Ok(settings)
}

/// BBDown's own `Program.APP_DIR` is the directory containing the executable.
/// Run it from that directory so its native `BBDown.data`, config, archive and
/// QR files stay exactly where the original CLI expects them.
pub(crate) fn bbdown_directory(executable: &Path) -> Result<PathBuf, String> {
    executable
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法确定 BBDown 所在目录".to_string())
}

#[derive(Debug)]
enum BbdownLoginError {
    Failed(String),
}

async fn run_bbdown_login(
    app: &AppHandle,
    job_id: &str,
    data_path: &Path,
) -> Result<(), BbdownLoginError> {
    let client = Client::builder()
        .user_agent(bilibili_login::BBDOWN_USER_AGENT)
        .build()
        .map_err(|error| BbdownLoginError::Failed(format!("初始化 B站登录请求失败：{error}")))?;

    let (url, qrcode_key) = bilibili_login::generate_bbdown_qr(&client)
        .await
        .map_err(BbdownLoginError::Failed)?;
    let data_url = bilibili_login::bbdown_qr_data_url(&url).map_err(BbdownLoginError::Failed)?;
    let _ = app.emit(
        "bbdown-login-qr",
        LoginQr {
            job_id: job_id.to_string(),
            data_url,
        },
    );
    for _ in 0..180 {
        sleep(Duration::from_secs(1)).await;
        let (status, cookies, _url) = bilibili_login::poll_bbdown_qr(&client, &qrcode_key)
            .await
            .map_err(BbdownLoginError::Failed)?;
        match status {
            86101 | 86090 => {}
            86038 => {
                return Err(BbdownLoginError::Failed("二维码已过期，请重新扫码".into()));
            }
            0 => {
                bilibili_login::validate_and_save_bbdown_data(&client, data_path, &cookies)
                    .await
                    .map_err(BbdownLoginError::Failed)?;
                return Ok(());
            }
            other => {
                return Err(BbdownLoginError::Failed(format!(
                    "B站登录失败，二维码状态码 {other}"
                )));
            }
        }
    }
    Err(BbdownLoginError::Failed("二维码登录超时".into()))
}

async fn spawn_bbdown_login_job(app: AppHandle, working_dir: PathBuf) -> Result<RunResult, String> {
    std::fs::create_dir_all(&working_dir).map_err(|error| error.to_string())?;
    let data_path = working_dir.join("BBDown.data");
    let _ = std::fs::remove_file(working_dir.join("qrcode.png"));
    let job_id = Uuid::new_v4().to_string();
    let tool = ToolName::Bbdown;
    let _ = app.emit(
        "job-state",
        JobState {
            job_id: job_id.clone(),
            tool: tool.clone(),
            state: "running",
            exit_code: None,
            message: "BBDown 正在运行".into(),
        },
    );

    let task_app = app.clone();
    let task_job_id = job_id.clone();
    tauri::async_runtime::spawn(async move {
        let outcome = run_bbdown_login(&task_app, &task_job_id, &data_path).await;
        let (state_name, exit_code, message) = match outcome {
            Ok(()) => (
                "completed",
                Some(0),
                "BBDown Cookie 数据已补全并验证登录成功".to_string(),
            ),
            Err(BbdownLoginError::Failed(error)) => {
                ("failed", None, format!("BBDown 账号未登录：{error}"))
            }
        };
        let _ = task_app.emit(
            "job-state",
            JobState {
                job_id: task_job_id,
                tool: ToolName::Bbdown,
                state: state_name,
                exit_code,
                message,
            },
        );
    });
    Ok(RunResult { job_id })
}

fn strip_ansi_codes(line: &str) -> String {
    let mut output = String::with_capacity(line.len());
    let mut characters = line.chars().peekable();
    while let Some(character) = characters.next() {
        if character == '\u{1b}' && characters.peek() == Some(&'[') {
            characters.next();
            for code in characters.by_ref() {
                if code.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            output.push(character);
        }
    }
    output
}

pub(crate) fn redact_output_line(line: &str) -> String {
    let mut redacted = strip_ansi_codes(line);
    for key in [
        "SESSDATA",
        "bili_jct",
        "access_token",
        "refresh_token",
        "authorization",
        "proxy-authorization",
        "password",
        "passwd",
        "api_key",
        "api-key",
        "cookies",
        "cookie",
        "token",
    ] {
        let mut search_from = 0;
        while let Some(offset) = redacted[search_from..]
            .to_ascii_lowercase()
            .find(&key.to_ascii_lowercase())
        {
            let label_end = search_from + offset + key.len();
            let mut delimiter = label_end;
            while redacted[delimiter..].starts_with('"')
                || redacted[delimiter..].starts_with('\'')
                || redacted[delimiter..].starts_with(char::is_whitespace)
            {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            if !redacted[delimiter..].starts_with('=') && !redacted[delimiter..].starts_with(':') {
                search_from = label_end;
                continue;
            }
            delimiter += 1;
            while redacted[delimiter..].starts_with(char::is_whitespace) {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            let quote = redacted[delimiter..]
                .chars()
                .next()
                .filter(|character| *character == '"' || *character == '\'');
            let start = delimiter + quote.map(char::len_utf8).unwrap_or(0);
            let hide_remainder = matches!(
                key,
                "authorization" | "proxy-authorization" | "cookie" | "cookies"
            ) && quote.is_none();
            let end = if hide_remainder {
                redacted.len()
            } else {
                redacted[start..]
                    .find(|character: char| {
                        quote
                            .map(|quote| character == quote)
                            .unwrap_or_else(|| character.is_whitespace() || character == ';')
                    })
                    .map(|value_offset| start + value_offset)
                    .unwrap_or(redacted.len())
            };
            redacted.replace_range(start..end, "***");
            search_from = start + 3;
        }
    }
    redacted
}

fn redact_urls(line: &str) -> String {
    let mut redacted = line.to_string();
    loop {
        let http = redacted.find("http://");
        let https = redacted.find("https://");
        let start = match (http, https) {
            (Some(left), Some(right)) => left.min(right),
            (Some(value), None) | (None, Some(value)) => value,
            (None, None) => break,
        };
        let end = redacted[start..]
            .find(char::is_whitespace)
            .map(|offset| start + offset)
            .unwrap_or(redacted.len());
        redacted.replace_range(start..end, "<URL_REDACTED>");
    }
    redacted
}

fn sanitize_diagnostic_text(line: &str, redact_personal_data: bool, home: Option<&str>) -> String {
    let mut sanitized = redact_output_line(line);
    if redact_personal_data {
        sanitized = redact_urls(&sanitized);
        if let Some(home) = home.filter(|value| !value.is_empty()) {
            sanitized = sanitized.replace(home, "$HOME");
        }
    }
    sanitized
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

#[tauri::command]
async fn dependency_status(app: AppHandle) -> Vec<DependencyStatus> {
    let tools = [
        ToolName::Bbdown,
        ToolName::YtDlp,
        ToolName::Musicdl,
        ToolName::Ffmpeg,
        ToolName::Ffprobe,
        ToolName::Mediainfo,
        ToolName::Deno,
        ToolName::Python,
    ];
    let mut statuses = Vec::new();
    for tool in tools {
        let bundled_path = bundled_binary(&app, tool.executable());
        let mut system_path =
            find_distinct_system_binary(tool.executable(), bundled_path.as_deref());
        if matches!(tool, ToolName::Python) && system_path.is_none() {
            system_path = resolve_tool(&app, &ToolName::Musicdl)
                .and_then(|(musicdl, _)| musicdl_python(&musicdl).ok());
        }
        let resolved = if matches!(tool, ToolName::Python) {
            system_path.clone().map(|path| (path, false))
        } else {
            resolve_tool(&app, &tool)
        };
        let version = if let Some((path, _)) = &resolved {
            tool_version(path, &tool).await
        } else {
            None
        };
        statuses.push(DependencyStatus {
            label: tool.label().into(),
            available: resolved.is_some(),
            bundled: resolved
                .as_ref()
                .map(|(_, bundled)| *bundled)
                .unwrap_or(false),
            bundled_available: bundled_path.is_some(),
            system_available: system_path.is_some(),
            source: resolved.as_ref().map(|(_, bundled)| {
                if *bundled {
                    "bundled".into()
                } else {
                    "system".into()
                }
            }),
            path: resolved
                .as_ref()
                .map(|(path, _)| path.to_string_lossy().into_owned()),
            version,
            required: tool.required(),
            install_hint: if resolved.is_none() {
                match tool {
                    ToolName::Musicdl => Some(if cfg!(target_os = "windows") {
                        "py -m pip install --user --upgrade pipx; py -m pipx ensurepath; py -m pipx install musicdl"
                            .into()
                    } else {
                        "brew install python pipx && pipx ensurepath && pipx install musicdl"
                            .into()
                    }),
                    ToolName::Python => Some(if cfg!(target_os = "windows") {
                        "winget install --id Python.Python.3.13 -e --accept-package-agreements --accept-source-agreements".into()
                    } else {
                        "brew install python".into()
                    }),
                    ToolName::Bbdown => None,
                    _ => Some(if cfg!(target_os = "windows") {
                        "请在 PowerShell 中分别使用 winget 安装 FFmpeg、yt-dlp、MediaInfo CLI 和 Deno"
                            .into()
                    } else {
                        "brew install ffmpeg yt-dlp media-info deno".into()
                    }),
                }
            } else {
                None
            },
            tool,
        });
    }
    statuses
}

#[tauri::command]
async fn ffmpeg_encoders(app: AppHandle) -> Result<Vec<String>, String> {
    let (ffmpeg, _) =
        resolve_tool(&app, &ToolName::Ffmpeg).ok_or_else(|| "未找到 FFmpeg".to_string())?;
    let output = background_command(ffmpeg)
        .args(["-hide_banner", "-encoders"])
        .env("PATH", command_path())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("无法读取 FFmpeg 编码器列表".into());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut encoders = text
        .lines()
        .filter_map(|line| {
            let fields = line.split_whitespace().collect::<Vec<_>>();
            if fields.len() >= 2
                && fields[0].len() == 6
                && fields[0]
                    .chars()
                    .all(|character| ".VASDFTIXB".contains(character))
            {
                Some(fields[1].to_string())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    encoders.sort();
    encoders.dedup();
    Ok(encoders)
}

fn media_info_value<'a>(track: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    track
        .get(key)
        .and_then(|value| value.as_str())
        .filter(|value| !value.is_empty())
}

fn media_info_number(track: &serde_json::Value, key: &str) -> Option<f64> {
    track.get(key).and_then(|value| {
        value
            .as_f64()
            .or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok()))
    })
}

fn human_duration(seconds: f64) -> String {
    let total = seconds.max(0.0).round() as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    let seconds = total % 60;
    if hours > 0 {
        format!("{hours:02}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes:02}:{seconds:02}")
    }
}

fn media_info_summary(document: &serde_json::Value, path: &str) -> Result<String, String> {
    let tracks = document
        .pointer("/media/track")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "MediaInfo JSON 中缺少轨道信息".to_string())?;
    let mut summary = String::new();
    writeln!(summary, "文件信息").unwrap();
    writeln!(summary, "路径：{path}").unwrap();

    if let Some(general) = tracks
        .iter()
        .find(|track| media_info_value(track, "@type") == Some("General"))
    {
        if let Some(format) = media_info_value(general, "Format") {
            writeln!(summary, "封装格式：{format}").unwrap();
        }
        if let Some(profile) = media_info_value(general, "Format_Profile") {
            writeln!(summary, "格式配置：{profile}").unwrap();
        }
        if let Some(size) = media_info_number(general, "FileSize") {
            writeln!(summary, "文件大小：{:.2} MiB", size / 1_048_576.0).unwrap();
        }
        if let Some(duration) = media_info_number(general, "Duration") {
            writeln!(summary, "时长：{}", human_duration(duration)).unwrap();
        }
        if let Some(bitrate) = media_info_number(general, "OverallBitRate") {
            writeln!(summary, "总码率：{:.0} kb/s", bitrate / 1000.0).unwrap();
        }
        if let Some(title) = media_info_value(general, "Title") {
            writeln!(summary, "标题：{title}").unwrap();
        }
        if let Some(performer) = media_info_value(general, "Performer") {
            writeln!(summary, "作者/艺术家：{performer}").unwrap();
        }
    }

    let mut counters: HashMap<&str, usize> = HashMap::new();
    for track in tracks {
        let kind = media_info_value(track, "@type").unwrap_or("Other");
        if kind == "General" {
            continue;
        }
        let counter = counters.entry(kind).or_insert(0);
        *counter += 1;
        let localized = match kind {
            "Video" => "视频轨道",
            "Audio" => "音频轨道",
            "Text" => "字幕轨道",
            "Image" => "图片/封面轨道",
            "Menu" => "章节轨道",
            _ => "其他轨道",
        };
        writeln!(summary, "\n{localized} {}", *counter).unwrap();
        if let Some(format) = media_info_value(track, "Format") {
            let profile = media_info_value(track, "Format_Profile")
                .map(|value| format!(" / {value}"))
                .unwrap_or_default();
            writeln!(summary, "编码格式：{format}{profile}").unwrap();
        }
        if let Some(codec) = media_info_value(track, "CodecID") {
            writeln!(summary, "编码标识：{codec}").unwrap();
        }
        if let (Some(width), Some(height)) = (
            media_info_number(track, "Width"),
            media_info_number(track, "Height"),
        ) {
            writeln!(summary, "分辨率：{} × {}", width as u64, height as u64).unwrap();
        }
        if let Some(frame_rate) = media_info_number(track, "FrameRate") {
            writeln!(summary, "帧率：{frame_rate:.3} fps").unwrap();
        }
        if let Some(bitrate) = media_info_number(track, "BitRate") {
            writeln!(summary, "码率：{:.0} kb/s", bitrate / 1000.0).unwrap();
        }
        if let Some(bit_depth) = media_info_number(track, "BitDepth") {
            writeln!(summary, "位深：{} bit", bit_depth as u64).unwrap();
        }
        if let Some(color) = media_info_value(track, "ColorSpace") {
            let chroma = media_info_value(track, "ChromaSubsampling")
                .map(|value| format!(" / {value}"))
                .unwrap_or_default();
            writeln!(summary, "色彩：{color}{chroma}").unwrap();
        }
        if let Some(channels) = media_info_number(track, "Channels") {
            writeln!(summary, "声道数：{}", channels as u64).unwrap();
        }
        if let Some(layout) = media_info_value(track, "ChannelLayout") {
            writeln!(summary, "声道布局：{layout}").unwrap();
        }
        if let Some(sample_rate) = media_info_number(track, "SamplingRate") {
            writeln!(summary, "采样率：{:.1} kHz", sample_rate / 1000.0).unwrap();
        }
        if let Some(language) = media_info_value(track, "Language") {
            writeln!(summary, "语言：{language}").unwrap();
        }
        if let Some(title) = media_info_value(track, "Title") {
            writeln!(summary, "轨道标题：{title}").unwrap();
        }
    }
    Ok(summary.trim().to_string())
}

#[tauri::command]
async fn inspect_media(app: AppHandle, path: String) -> Result<MediaInspection, String> {
    let input = PathBuf::from(&path);
    if input.is_dir() {
        let count = media_files_in(&input)?.len();
        return Ok(MediaInspection {
            path,
            summary: format!("目录\n可处理的媒体文件：{count} 个\n默认递归子目录并忽略隐藏文件。"),
        });
    }
    if !input.is_file() {
        return Err("文件不存在".into());
    }
    let (executable, args, use_media_info_json) =
        if let Some((mediainfo, _)) = resolve_tool(&app, &ToolName::Mediainfo) {
            (
                mediainfo,
                vec!["--Output=JSON".to_string(), path.clone()],
                true,
            )
        } else if let Some((ffprobe, _)) = resolve_tool(&app, &ToolName::Ffprobe) {
            (
                ffprobe,
                vec![
                    "-hide_banner".into(),
                    "-of".into(),
                    "json".into(),
                    "-show_format".into(),
                    "-show_streams".into(),
                    path.clone(),
                ],
                false,
            )
        } else {
            return Err("未找到 MediaInfo 或 ffprobe".into());
        };
    let output = background_command(executable)
        .args(args)
        .env("PATH", command_path())
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        let reason = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("媒体信息读取失败：{reason}"));
    }
    let mut summary = String::from_utf8_lossy(&output.stdout).into_owned();
    if summary.trim().is_empty() {
        summary = String::from_utf8_lossy(&output.stderr).into_owned();
    } else if use_media_info_json {
        let document: serde_json::Value =
            serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
        summary = media_info_summary(&document, &path)?;
    }
    Ok(MediaInspection { path, summary })
}

pub(crate) fn media_files_in(directory: &Path) -> Result<Vec<PathBuf>, String> {
    const EXTENSIONS: &[&str] = &[
        // Video containers and elementary streams commonly handled by FFmpeg.
        "mp4", "mkv", "mov", "avi", "webm", "flv", "f4v", "m4v", "3gp", "3g2", "asf", "wmv", "vob",
        "ogv", "rm", "rmvb", "divx", "mpg", "mpeg", "mpe", "m1v", "m2v", "ts", "mts", "m2ts",
        "m2t", "mxf", "mod", "tod", "dat", "y4m", "ivf", "roq", "nsv", "nut", "dv", "qt", "ogm",
        "wtv", "dvr-ms", "gxf", "lxf", "evo", "m2p", "ps", "trp", "tp", "amv", "bik", "smk", "swf",
        "mve", "mvi", "svi", "viv", "vivo", "h264", "264", "avc", "h265", "265", "hevc", "av1",
        "vp8", "vp9", "mjpg", "mjpeg",
        // Lossless, lossy and professional audio formats.
        "mp3", "mp2", "mpa", "m4a", "aac", "flac", "wav", "wave", "ogg", "oga", "opus", "aiff",
        "aif", "aifc", "alac", "ape", "wv", "wma", "ac3", "eac3", "dts", "mka", "amr", "au", "snd",
        "caf", "tta", "dsf", "dff", "mlp", "thd", "spx", "ra", "ram", "voc", "gsm", "tak", "shn",
        "xm", "it", "s3m",
        // Text subtitle formats that FFmpeg can normally convert to SubRip.
        "srt", "ass", "ssa", "vtt", "webvtt", "sub", "mpl2", "jss", "rt", "sbv", "smi", "sami",
        "ttml", "dfxp", "lrc",
    ];
    fn visit(directory: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
        for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            let hidden = path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with('.'))
                .unwrap_or(false);
            if hidden || path.is_symlink() {
                continue;
            }
            if path.is_dir() {
                visit(&path, output)?;
            } else if path
                .extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
                .unwrap_or(false)
            {
                output.push(path);
            }
        }
        Ok(())
    }
    let mut output = Vec::new();
    visit(directory, &mut output)?;
    Ok(output)
}

fn is_text_subtitle_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            [
                "srt", "ass", "ssa", "vtt", "webvtt", "sub", "mpl2", "jss", "rt", "sbv", "smi",
                "sami", "ttml", "dfxp", "lrc",
            ]
            .iter()
            .any(|candidate| extension.eq_ignore_ascii_case(candidate))
        })
}

fn expand_media_inputs(
    paths: Vec<String>,
    include_subtitles: Option<bool>,
) -> Result<Vec<String>, String> {
    let include_subtitles = include_subtitles.unwrap_or(false);
    let mut output = Vec::new();
    for value in paths {
        let path = PathBuf::from(value);
        if path.is_dir() {
            output.extend(
                media_files_in(&path)?
                    .into_iter()
                    .filter(|item| include_subtitles || !is_text_subtitle_file(item))
                    .map(|item| item.to_string_lossy().into_owned()),
            );
        } else if path.is_file() {
            if is_text_subtitle_file(&path) && !include_subtitles {
                return Err(
                    "字幕文件请在「PR 原生兼容」中统一转为 SRT，或在「封装与抽流」中处理。".into(),
                );
            }
            output.push(path.to_string_lossy().into_owned());
        } else {
            return Err(format!("输入不存在：{}", path.to_string_lossy()));
        }
    }
    output.sort();
    output.dedup();
    Ok(output)
}

pub(crate) async fn probe_streams(
    ffprobe: &Path,
    input: &Path,
) -> Result<(Vec<String>, Vec<String>, Vec<String>), String> {
    let output = background_command(ffprobe)
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name:stream_disposition=attached_pic",
            "-of",
            "json",
        ])
        .arg(input)
        .env("PATH", command_path())
        .output()
        .await
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "无法识别媒体文件 {}：{}",
            input.to_string_lossy(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let value: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    Ok(streams_from_probe(&value))
}

fn streams_from_probe(value: &serde_json::Value) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut video = Vec::new();
    let mut audio = Vec::new();
    let mut subtitles = Vec::new();
    if let Some(streams) = value["streams"].as_array() {
        for stream in streams {
            let codec_type = stream["codec_type"].as_str().unwrap_or_default();
            let codec = stream["codec_name"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let attached_picture = stream["disposition"]["attached_pic"].as_i64() == Some(1);
            if codec_type == "video" && !attached_picture && video.is_empty() {
                video.push(codec);
            } else if codec_type == "audio" {
                audio.push(codec);
            } else if codec_type == "subtitle" {
                subtitles.push(codec);
            }
        }
    }
    (video, audio, subtitles)
}

pub(crate) fn pr_output_path(
    input: &Path,
    output_directory: Option<&str>,
    extension: &str,
) -> PathBuf {
    let directory = output_directory
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| input.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."));
    let stem = input
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("output");
    directory.join(format!("{stem}.pr.{extension}"))
}

pub(crate) fn pr_container(video: &[String], audio_only: bool) -> &'static str {
    if audio_only {
        "wav"
    } else if !video.is_empty()
        && video
            .iter()
            .all(|codec| ["h264", "hevc"].contains(&codec.as_str()))
    {
        "mp4"
    } else {
        "mov"
    }
}

pub(crate) fn is_lossless_audio(audio: &[String]) -> bool {
    !audio.is_empty()
        && audio.iter().all(|codec| {
            codec.starts_with("pcm_")
                || codec.starts_with("dsd_")
                || [
                    "flac",
                    "alac",
                    "ape",
                    "wavpack",
                    "tta",
                    "tak",
                    "shorten",
                    "truehd",
                    "mlp",
                    "wmalossless",
                ]
                .contains(&codec.as_str())
        })
}

pub(crate) fn pr_audio_container(audio: &[String]) -> &'static str {
    if is_lossless_audio(audio) {
        "wav"
    } else if !audio.is_empty() && audio.iter().all(|codec| codec == "mp3") {
        "mp3"
    } else {
        "m4a"
    }
}

// ---- 任务系统通用 command（core/task 的前端入口，feature 无关） ----

#[tauri::command]
fn task_cancel(hub: State<'_, crate::core::task::TaskHub>, task_id: String) {
    hub.cancel(&task_id);
}

#[tauri::command]
fn task_promote(hub: State<'_, crate::core::task::TaskHub>, task_id: String) {
    hub.promote(&task_id);
}

#[tauri::command]
async fn tasks_snapshot(
    hub: State<'_, crate::core::task::TaskHub>,
) -> Result<Vec<crate::core::task::types::TaskEnvelope>, String> {
    Ok(hub.snapshot().await)
}

/// 任务诊断导出（基于新任务系统重建）：信封 + 日志文件 → 单个脱敏文本文件。
/// 信封与日志在记录时已过凭据脱敏；此处再叠加个人信息脱敏（家目录、URL 等）。
#[tauri::command]
async fn task_export_diagnostics(
    app: AppHandle,
    hub: State<'_, crate::core::task::TaskHub>,
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
fn pool_definitions(
    caps: State<'_, crate::core::task::scheduler::PoolCaps>,
) -> Vec<crate::core::task::scheduler::PoolDefinition> {
    crate::core::task::scheduler::definitions(*caps.inner())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 任务枢纽：库文件与日志目录在应用数据目录；启动时先做保留清理，
            // TaskHub::new 内部随后执行遗留任务对账（§4.3/§4.5）
            let handle = app.handle().clone();
            let data_dir = app_data_dir(&handle).map_err(std::io::Error::other)?;
            let store = crate::core::task::store::TaskStore::open(&data_dir.join("tasks.db"))?;
            let _ = crate::core::task::logfile::cleanup_expired(
                &store,
                chrono::Utc::now(),
                crate::core::task::logfile::default_retention(),
            );
            let caps = crate::core::task::scheduler::PoolCaps {
                download: 3,
                local: std::thread::available_parallelism()
                    .map(|n| n.get())
                    .unwrap_or(4),
            };
            let sink = std::sync::Arc::new(crate::core::task::sink::TauriSink::new(handle));
            let logs_dir = data_dir.join("logs");
            let hub = tauri::async_runtime::block_on(async move {
                crate::core::task::TaskHub::new(store, sink, caps, logs_dir)
            });
            app.manage(hub);
            app.manage(caps);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_settings,
            save_app_settings,
            dependency_status,
            task_export_diagnostics,
            ffmpeg_encoders,
            features::music::commands::musicdl_search,
            features::music::commands::musicdl_download,
            features::music::commands::musicdl_playlist,
            inspect_media,
            task_cancel,
            task_promote,
            tasks_snapshot,
            pool_definitions,
            features::bilibili::commands::bilibili_submit,
            features::bilibili::commands::bilibili_preview,
            features::bilibili::commands::bilibili_login_start,
            features::network::commands::network_submit,
            features::network::commands::network_preview,
            features::network::commands::network_probe,
            features::media::commands::media_submit,
            features::media::commands::media_preview,
            features::media::commands::media_pr_submit
        ])
        .run(tauri::generate_context!())
        .expect("error while running MAD Toolbox");
}
