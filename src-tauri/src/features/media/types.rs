//! media（FFmpeg）feature 的结构化意图。
//! 字段集与旧前端 `MediaOptions`（src/lib/commands.ts）对应，两点差异：
//! - `input` 为单文件：目录/多选在提交时展开，每个文件一个任务（重跑语义精确到文件）；
//! - `pr-compatible` 不在 operation 里：它是探测驱动的独立编排，走专用 command。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum Operation {
    Remux,
    #[default]
    Transcode,
    VideoExtract,
    Audio,
    SubtitleExtract,
    Thumbnail,
    Gif,
    Frames,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MediaIntent {
    pub input: String,
    pub output_directory: String,
    pub operation: Operation,
    pub container: String,
    pub video_codec: String,
    pub audio_codec: String,
    pub map_all: bool,
    pub preserve_metadata: bool,
    pub overwrite: bool,
    pub start_time: String,
    pub duration: String,
    pub video_stream_index: String,
    pub audio_stream_index: String,
    pub subtitle_stream_index: String,
    pub video_bitrate: String,
    pub crf: String,
    pub frame_rate: String,
    pub width: String,
    pub height: String,
    pub scaling_algorithm: String,
    pub pixel_format: String,
    pub preset: String,
    pub video_profile: String,
    pub aspect_ratio: String,
    pub crop: String,
    pub rotation: String,
    pub flip_horizontal: bool,
    pub flip_vertical: bool,
    pub deinterlace: bool,
    pub fast_start: bool,
    pub speed: f64,
    pub audio_bitrate: String,
    pub sample_rate: String,
    pub channels: String,
    pub volume: String,
    pub loudness_normalization: bool,
    pub gif_fps: u32,
    pub gif_width: u32,
}

impl Default for MediaIntent {
    fn default() -> Self {
        // 与旧前端 initialOptions 一致的语义默认值（operation 除外——pr 独立）
        MediaIntent {
            input: String::new(),
            output_directory: String::new(),
            operation: Operation::Transcode,
            container: "mov".into(),
            video_codec: "copy".into(),
            audio_codec: "copy".into(),
            map_all: true,
            preserve_metadata: true,
            overwrite: false,
            start_time: String::new(),
            duration: String::new(),
            video_stream_index: "0".into(),
            audio_stream_index: "0".into(),
            subtitle_stream_index: "0".into(),
            video_bitrate: String::new(),
            crf: "20".into(),
            frame_rate: String::new(),
            width: String::new(),
            height: String::new(),
            scaling_algorithm: "lanczos".into(),
            pixel_format: String::new(),
            preset: "medium".into(),
            video_profile: String::new(),
            aspect_ratio: String::new(),
            crop: String::new(),
            rotation: "none".into(),
            flip_horizontal: false,
            flip_vertical: false,
            deinterlace: false,
            fast_start: true,
            speed: 1.0,
            audio_bitrate: "192k".into(),
            sample_rate: String::new(),
            channels: String::new(),
            volume: String::new(),
            loudness_normalization: false,
            gif_fps: 12,
            gif_width: 720,
        }
    }
}
