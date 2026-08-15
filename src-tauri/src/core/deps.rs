use std::{
    env,
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::{
    process::Command,
    time::{timeout, Duration},
};

use super::settings::{load_app_settings, DependencyPreference};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub(crate) fn hide_async_command_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

pub(crate) fn hide_std_command_window(command: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = command;
}

pub(crate) fn background_command(program: impl AsRef<OsStr>) -> Command {
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
pub(crate) struct DependencyStatus {
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
pub(crate) fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
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
pub(crate) fn musicdl_python(executable: &Path) -> Result<PathBuf, String> {
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

#[tauri::command]
pub(crate) async fn dependency_status(app: AppHandle) -> Vec<DependencyStatus> {
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
pub(crate) async fn ffmpeg_encoders(app: AppHandle) -> Result<Vec<String>, String> {
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
