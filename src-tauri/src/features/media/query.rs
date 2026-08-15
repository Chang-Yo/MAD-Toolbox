//! MediaInfo/ffprobe 即时查询与媒体输入展开。

use std::{
    collections::HashMap,
    fmt::Write as _,
    path::{Path, PathBuf},
    process::Output,
};

use serde::Serialize;
use tauri::AppHandle;
use tokio::{
    process::Command,
    sync::Semaphore,
    time::{timeout, Duration},
};

use crate::core::deps::{background_command, command_path, resolve_tool, ToolName};

const PROCESS_QUERY_CONCURRENCY: usize = 4;
const PROCESS_QUERY_TIMEOUT_SECONDS: u64 = 30;
const PROCESS_QUERY_TIMEOUT: Duration = Duration::from_secs(PROCESS_QUERY_TIMEOUT_SECONDS);
static PROCESS_QUERY_GATE: Semaphore = Semaphore::const_new(PROCESS_QUERY_CONCURRENCY);

#[derive(Serialize)]
pub(crate) struct MediaInspection {
    path: String,
    summary: String,
}

async fn run_external_query(mut command: Command, operation: &str) -> Result<Output, String> {
    let _permit = PROCESS_QUERY_GATE
        .acquire()
        .await
        .map_err(|_| "媒体查询并发控制已关闭".to_string())?;
    command.kill_on_drop(true);
    timeout(PROCESS_QUERY_TIMEOUT, command.output())
        .await
        .map_err(|_| format!("{operation}超时（{PROCESS_QUERY_TIMEOUT_SECONDS} 秒）"))?
        .map_err(|error| format!("无法启动{operation}：{error}"))
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
pub(crate) async fn inspect_media(app: AppHandle, path: String) -> Result<MediaInspection, String> {
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
    let mut command = background_command(executable);
    command.args(args).env("PATH", command_path());
    let output = run_external_query(command, "媒体信息读取").await?;
    if !output.status.success() {
        let reason = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("媒体信息读取失败：{reason}"));
    }
    let mut summary = String::from_utf8_lossy(&output.stdout).into_owned();
    if summary.trim().is_empty() {
        summary = String::from_utf8_lossy(&output.stderr).into_owned();
    } else if use_media_info_json {
        let document: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("无法解析 MediaInfo 输出：{error}"))?;
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
        let entries = std::fs::read_dir(directory).map_err(|error| {
            format!("无法读取媒体目录 {}：{error}", directory.to_string_lossy())
        })?;
        for entry in entries {
            let entry = entry.map_err(|error| {
                format!(
                    "无法读取媒体目录项 {}：{error}",
                    directory.to_string_lossy()
                )
            })?;
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

pub(crate) fn expand_media_inputs(
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
    let mut command = background_command(ffprobe);
    command
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name:stream_disposition=attached_pic",
            "-of",
            "json",
        ])
        .arg(input)
        .env("PATH", command_path());
    let operation = format!("媒体流探测 {}", input.to_string_lossy());
    let output = run_external_query(command, &operation).await?;
    if !output.status.success() {
        return Err(format!(
            "无法识别媒体文件 {}：{}",
            input.to_string_lossy(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("无法解析媒体流探测结果：{error}"))?;
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
