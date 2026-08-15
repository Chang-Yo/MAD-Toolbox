//! bilibili 参数注册表（架构文档 §6）。
//! 字段→flag 映射记录 CLI 参数面；脱敏（§4.5）的敏感集合由此派生（唯一真相源）。

use crate::core::registry::ParamMeta;

const fn meta(field: &'static str, flag: &'static str) -> ParamMeta {
    ParamMeta {
        field,
        flag,
        sensitive: false,
    }
}

pub const REGISTRY: &[ParamMeta] = &[
    meta("url", ""),
    meta("api", ""),
    meta("mode", ""),
    meta("pages", "--select-page"),
    meta("encodingPriority", "--encoding-priority"),
    meta("qualityPriority", "--dfn-priority"),
    meta("filePattern", "--file-pattern"),
    meta("multiFilePattern", "--multi-file-pattern"),
    meta("outputDirectory", "--work-dir"),
    meta("useMp4box", "--use-mp4box"),
    meta("useAria2c", "--use-aria2c"),
    meta("showAll", "--show-all"),
    meta("hideStreams", "--hide-streams"),
    meta("skipMux", "--skip-mux"),
    meta("skipSubtitle", "--skip-subtitle"),
    meta("skipCover", "--skip-cover"),
    meta("skipAi", "--skip-ai"),
    meta("multiThread", "--multi-thread"),
    meta("forceHttp", "--force-http"),
    meta("downloadDanmaku", "--download-danmaku"),
    meta("videoAscending", "--video-ascending"),
    meta("audioAscending", "--audio-ascending"),
    meta("allowPcdn", "--allow-pcdn"),
    meta("forceReplaceHost", "--force-replace-host"),
    meta("saveArchive", "--save-archives-to-file"),
    meta("debug", "--debug"),
    meta("language", "--language"),
    meta("userAgent", "--user-agent"),
    ParamMeta {
        field: "cookie",
        flag: "--cookie",
        sensitive: true,
    },
    ParamMeta {
        field: "accessToken",
        flag: "--access-token",
        sensitive: true,
    },
    meta("aria2cArgs", "--aria2c-args"),
    meta("mp4boxPath", "--mp4box-path"),
    meta("aria2cPath", "--aria2c-path"),
    meta("uposHost", "--upos-host"),
    meta("delayPerPage", "--delay-per-page"),
    meta("host", "--host"),
    meta("epHost", "--ep-host"),
    meta("area", "--area"),
    meta("configFile", "--config-file"),
    meta("extraArgs", ""),
];

/// 脱敏 flag 集合——持久化与展示前必须遮蔽其值的 flag（§4.5）。唯一真相源。
pub fn sensitive_flags() -> impl Iterator<Item = &'static str> {
    REGISTRY.iter().filter(|m| m.sensitive).map(|m| m.flag)
}
