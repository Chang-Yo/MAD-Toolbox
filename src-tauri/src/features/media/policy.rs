//! PR 兼容输出的容器与路径策略。

use std::path::{Path, PathBuf};

pub(crate) fn output_path(
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

pub(crate) fn container(video: &[String], audio_only: bool) -> &'static str {
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

pub(crate) fn audio_container(audio: &[String]) -> &'static str {
    if is_lossless_audio(audio) {
        "wav"
    } else if !audio.is_empty() && audio.iter().all(|codec| codec == "mp3") {
        "mp3"
    } else {
        "m4a"
    }
}
