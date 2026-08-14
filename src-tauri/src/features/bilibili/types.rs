//! bilibili feature 的结构化意图（架构文档 §2）。
//! 字段集与旧前端 `BilibiliOptions`（src/lib/commands.ts）一一对应：表单只渲染高频层，
//! 但意图结构保持全集超集，重跑与模板才不丢字段。
//! 刻意不加 deny_unknown_fields：旧版本存库的 intent 在字段删除后仍应能被新版 adapter 重放。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Api {
    #[default]
    Web,
    Tv,
    App,
    Intl,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum Mode {
    #[default]
    Video,
    VideoOnly,
    Audio,
    Cover,
    Subtitle,
    Danmaku,
    Info,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct BilibiliIntent {
    pub url: String,
    pub api: Api,
    pub mode: Mode,
    pub pages: String,
    pub encoding_priority: String,
    pub quality_priority: String,
    pub file_pattern: String,
    pub multi_file_pattern: String,
    pub output_directory: String,
    pub use_mp4box: bool,
    pub use_aria2c: bool,
    pub show_all: bool,
    pub hide_streams: bool,
    pub skip_mux: bool,
    pub skip_subtitle: bool,
    pub skip_cover: bool,
    pub skip_ai: bool,
    pub multi_thread: bool,
    pub force_http: bool,
    pub download_danmaku: bool,
    pub video_ascending: bool,
    pub audio_ascending: bool,
    pub allow_pcdn: bool,
    pub force_replace_host: bool,
    pub save_archive: bool,
    pub debug: bool,
    pub language: String,
    pub user_agent: String,
    pub cookie: String,
    pub access_token: String,
    pub aria2c_args: String,
    pub mp4box_path: String,
    pub aria2c_path: String,
    pub upos_host: String,
    pub delay_per_page: String,
    pub host: String,
    pub ep_host: String,
    pub area: String,
    pub config_file: String,
    pub extra_args: String,
}
