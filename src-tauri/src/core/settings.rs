use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum DependencyPreference {
    #[default]
    Bundled,
    System,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppSettings {
    pub(crate) default_output_directory: Option<String>,
    #[serde(default)]
    pub(crate) dependency_preference: DependencyPreference,
    #[serde(default)]
    pub(crate) proxy: Option<String>,
}

pub(crate) fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

/// 各功能页统一的默认输出目录：系统「下载」/MADToolbox（前端 src/lib/platform.ts 同名常量）。
/// 返回前确保目录存在，下载器与 ffmpeg 都不会自建该目录。
pub(crate) fn unified_output_directory(app: &AppHandle) -> Option<String> {
    let directory = app.path().download_dir().ok()?.join("MADToolbox");
    std::fs::create_dir_all(&directory).ok()?;
    Some(directory.to_string_lossy().into_owned())
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

#[tauri::command]
pub(crate) fn app_settings(app: AppHandle) -> AppSettings {
    load_app_settings(&app)
}

pub(crate) fn load_app_settings(app: &AppHandle) -> AppSettings {
    settings_path(app)
        .ok()
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) fn save_app_settings(
    app: AppHandle,
    mut settings: AppSettings,
) -> Result<AppSettings, String> {
    settings.default_output_directory = settings
        .default_output_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    settings.proxy = settings
        .proxy
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
