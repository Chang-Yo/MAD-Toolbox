//! network（yt-dlp）参数注册表（架构文档 §6）。

pub use crate::core::registry::{Kind, Level};

pub type ParamMeta = crate::core::registry::ParamMeta<Condition>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Condition {
    Always,
    /// 仅 mode = audio 时生效。
    ModeAudio,
    /// 仅 mode = subtitles 时生效。
    ModeSubtitles,
}

impl Condition {
    pub fn describe(self) -> Option<&'static str> {
        match self {
            Condition::Always => None,
            Condition::ModeAudio => Some("仅在下载音频模式下生效"),
            Condition::ModeSubtitles => Some("仅在下载字幕模式下生效"),
        }
    }
}

const fn meta(
    field: &'static str,
    flag: &'static str,
    kind: Kind,
    level: Level,
    help: &'static str,
) -> ParamMeta {
    ParamMeta {
        field,
        flag,
        kind,
        sensitive: false,
        level,
        condition: Condition::Always,
        help,
    }
}

pub const REGISTRY: &[ParamMeta] = &[
    meta(
        "url",
        "",
        Kind::Positional,
        Level::Common,
        "视频/播放列表地址",
    ),
    meta(
        "mode",
        "",
        Kind::Enum(&[
            ("video", ""),
            ("audio", "-x"),
            ("thumbnail", "--write-thumbnail"),
            ("subtitles", "--write-subs"),
        ]),
        Level::Common,
        "下载内容：视频 / 仅音频 / 仅封面 / 仅字幕",
    ),
    meta(
        "outputTemplate",
        "-o",
        Kind::Value,
        Level::Common,
        "输出文件名模板（yt-dlp 模板语法）",
    ),
    meta(
        "outputDirectory",
        "-P",
        Kind::Value,
        Level::Common,
        "下载输出目录",
    ),
    ParamMeta {
        field: "proxy",
        flag: "--proxy",
        kind: Kind::Value,
        sensitive: true,
        level: Level::Common,
        condition: Condition::Always,
        help: "代理地址（可能含账号密码，持久化时脱敏）",
    },
    meta(
        "format",
        "-f",
        Kind::Value,
        Level::Advanced,
        "格式选择表达式，如 bv*+ba/b",
    ),
    ParamMeta {
        field: "audioFormat",
        flag: "--audio-format",
        kind: Kind::Value,
        sensitive: false,
        level: Level::Common,
        condition: Condition::ModeAudio,
        help: "音频输出格式（best/mp3/m4a/flac 等）",
    },
    ParamMeta {
        field: "subtitleLanguages",
        flag: "--sub-langs",
        kind: Kind::Value,
        sensitive: false,
        level: Level::Common,
        condition: Condition::ModeSubtitles,
        help: "字幕语言匹配，如 zh.*,en.*",
    },
    meta(
        "cookiesBrowser",
        "--cookies-from-browser",
        Kind::Value,
        Level::Common,
        "从指定浏览器读取 Cookie；仅在站点要求登录时作为兜底自动启用",
    ),
    meta(
        "playlistItems",
        "-I",
        Kind::Value,
        Level::Advanced,
        "播放列表选集，如 1,3-5",
    ),
    meta(
        "retries",
        "--retries",
        Kind::Value,
        Level::Advanced,
        "重试次数",
    ),
    meta(
        "concurrentFragments",
        "--concurrent-fragments",
        Kind::Value,
        Level::Advanced,
        "并行分片数",
    ),
    meta(
        "noPlaylist",
        "--no-playlist",
        Kind::Switch,
        Level::Common,
        "仅下载单个视频（忽略播放列表）",
    ),
    meta(
        "embedMetadata",
        "--embed-metadata",
        Kind::Switch,
        Level::Common,
        "内嵌元数据",
    ),
    meta(
        "embedThumbnail",
        "--embed-thumbnail",
        Kind::Switch,
        Level::Common,
        "内嵌封面",
    ),
    meta(
        "embedSubtitles",
        "--embed-subs",
        Kind::Switch,
        Level::Common,
        "内嵌字幕",
    ),
    meta(
        "writeInfoJson",
        "--write-info-json",
        Kind::Switch,
        Level::Advanced,
        "输出 info.json",
    ),
    meta(
        "verbose",
        "--verbose",
        Kind::Switch,
        Level::Advanced,
        "输出详细日志",
    ),
];

/// 脱敏 flag 集合（§4.5）。
pub fn sensitive_flags() -> impl Iterator<Item = &'static str> {
    REGISTRY.iter().filter(|m| m.sensitive).map(|m| m.flag)
}
