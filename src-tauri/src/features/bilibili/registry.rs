//! bilibili 参数注册表（架构文档 §6）：一份数据喂三张嘴——
//! ① 表单字段内联提示 ② 功能页 Help 参数总表 ③ 持久化脱敏（敏感 flag 集合由此派生）。
//! 元数据只管语义，不驱动表单布局。

pub use crate::core::registry::{Kind, Level};

/// bilibili 注册表条目：生效条件为本 feature 的类型化枚举。
pub type ParamMeta = crate::core::registry::ParamMeta<Condition>;

/// 生效条件使用类型化枚举而非自由文本。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Condition {
    Always,
    /// 仅 api ≠ web 时生效。
    ApiNotWeb,
}

impl Condition {
    /// UI 展示用描述；Always 无需展示。
    pub fn describe(self) -> Option<&'static str> {
        match self {
            Condition::Always => None,
            Condition::ApiNotWeb => Some("仅在 API 为 TV/APP/国际版时生效"),
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
        "视频地址，或 BV/av/ep/ss 号",
    ),
    meta(
        "api",
        "",
        Kind::Enum(&[
            ("web", ""),
            ("tv", "--use-tv-api"),
            ("app", "--use-app-api"),
            ("intl", "--use-intl-api"),
        ]),
        Level::Common,
        "解析接口：web 为默认；TV/APP 可获取杜比视界等独占流",
    ),
    meta(
        "mode",
        "",
        Kind::Enum(&[
            ("video", ""),
            ("video-only", "--video-only"),
            ("audio", "--audio-only"),
            ("cover", "--cover-only"),
            ("subtitle", "--sub-only"),
            ("danmaku", "--danmaku-only"),
            ("info", "--only-show-info"),
        ]),
        Level::Common,
        "下载内容：完整视频 / 仅视频轨 / 仅音频 / 封面 / 字幕 / 弹幕 / 仅解析信息",
    ),
    meta(
        "pages",
        "--select-page",
        Kind::Value,
        Level::Common,
        "选集，如 1,3-5 或 ALL",
    ),
    meta(
        "encodingPriority",
        "--encoding-priority",
        Kind::Value,
        Level::Common,
        "编码优先级，如 hevc,av1,avc",
    ),
    meta(
        "qualityPriority",
        "--dfn-priority",
        Kind::Value,
        Level::Common,
        "画质优先级，如 8K 超高清,1080P 高清",
    ),
    meta(
        "filePattern",
        "--file-pattern",
        Kind::Value,
        Level::Advanced,
        "单集文件名模板",
    ),
    meta(
        "multiFilePattern",
        "--multi-file-pattern",
        Kind::Value,
        Level::Advanced,
        "多集文件名模板",
    ),
    meta(
        "outputDirectory",
        "--work-dir",
        Kind::Value,
        Level::Common,
        "下载输出目录",
    ),
    meta(
        "useMp4box",
        "--use-mp4box",
        Kind::Switch,
        Level::Advanced,
        "使用 MP4Box 混流",
    ),
    meta(
        "useAria2c",
        "--use-aria2c",
        Kind::Switch,
        Level::Advanced,
        "使用 aria2c 下载",
    ),
    meta(
        "showAll",
        "--show-all",
        Kind::Switch,
        Level::Advanced,
        "展示所有分 P 标题",
    ),
    meta(
        "hideStreams",
        "--hide-streams",
        Kind::Switch,
        Level::Advanced,
        "不显示可用流信息",
    ),
    meta(
        "skipMux",
        "--skip-mux",
        Kind::Switch,
        Level::Advanced,
        "跳过混流步骤",
    ),
    meta(
        "skipSubtitle",
        "--skip-subtitle",
        Kind::Switch,
        Level::Common,
        "跳过字幕下载",
    ),
    meta(
        "skipCover",
        "--skip-cover",
        Kind::Switch,
        Level::Common,
        "跳过封面下载",
    ),
    meta(
        "skipAi",
        "--skip-ai",
        Kind::Switch,
        Level::Common,
        "跳过 AI 生成字幕",
    ),
    meta(
        "multiThread",
        "--multi-thread",
        Kind::Switch,
        Level::Advanced,
        "多线程下载（BBDown 默认已启用）",
    ),
    meta(
        "forceHttp",
        "--force-http",
        Kind::Switch,
        Level::Advanced,
        "下载使用 HTTP 替代 HTTPS（BBDown 默认已启用）",
    ),
    meta(
        "downloadDanmaku",
        "--download-danmaku",
        Kind::Switch,
        Level::Common,
        "同时下载弹幕",
    ),
    meta(
        "videoAscending",
        "--video-ascending",
        Kind::Switch,
        Level::Advanced,
        "视频流按画质升序（最低优先）",
    ),
    meta(
        "audioAscending",
        "--audio-ascending",
        Kind::Switch,
        Level::Advanced,
        "音频流按音质升序（最低优先）",
    ),
    meta(
        "allowPcdn",
        "--allow-pcdn",
        Kind::Switch,
        Level::Advanced,
        "允许 PCDN 节点（可能不稳定）",
    ),
    meta(
        "forceReplaceHost",
        "--force-replace-host",
        Kind::Switch,
        Level::Advanced,
        "强制替换下载服务器 host（BBDown 默认已启用）",
    ),
    meta(
        "saveArchive",
        "--save-archives-to-file",
        Kind::Switch,
        Level::Advanced,
        "将已下载记录写入存档文件，重复下载时跳过",
    ),
    meta(
        "debug",
        "--debug",
        Kind::Switch,
        Level::Advanced,
        "输出调试日志",
    ),
    meta(
        "language",
        "--language",
        Kind::Value,
        Level::Advanced,
        "语言偏好",
    ),
    meta(
        "userAgent",
        "--user-agent",
        Kind::Value,
        Level::Advanced,
        "自定义 User-Agent",
    ),
    ParamMeta {
        field: "cookie",
        flag: "--cookie",
        kind: Kind::Value,
        sensitive: true,
        level: Level::Advanced,
        condition: Condition::Always,
        help: "登录 Cookie（SESSDATA 等）；扫码登录后通常无需手填",
    },
    ParamMeta {
        field: "accessToken",
        flag: "--access-token",
        kind: Kind::Value,
        sensitive: true,
        level: Level::Advanced,
        condition: Condition::ApiNotWeb,
        help: "TV/APP/国际版接口所需的登录凭证",
    },
    meta(
        "aria2cArgs",
        "--aria2c-args",
        Kind::Value,
        Level::Advanced,
        "透传给 aria2c 的附加参数",
    ),
    meta(
        "mp4boxPath",
        "--mp4box-path",
        Kind::Value,
        Level::Advanced,
        "MP4Box 可执行文件路径",
    ),
    meta(
        "aria2cPath",
        "--aria2c-path",
        Kind::Value,
        Level::Advanced,
        "aria2c 可执行文件路径",
    ),
    meta(
        "uposHost",
        "--upos-host",
        Kind::Value,
        Level::Advanced,
        "自定义 upos 下载服务器",
    ),
    meta(
        "delayPerPage",
        "--delay-per-page",
        Kind::Value,
        Level::Advanced,
        "多分 P 下载的间隔秒数",
    ),
    meta(
        "host",
        "--host",
        Kind::Value,
        Level::Advanced,
        "自定义 API host",
    ),
    meta(
        "epHost",
        "--ep-host",
        Kind::Value,
        Level::Advanced,
        "自定义番剧 API host",
    ),
    meta(
        "area",
        "--area",
        Kind::Value,
        Level::Advanced,
        "番剧解析地区（hk/tw/th）",
    ),
    meta(
        "configFile",
        "--config-file",
        Kind::Value,
        Level::Advanced,
        "BBDown 配置文件路径",
    ),
    meta(
        "extraArgs",
        "",
        Kind::Freeform,
        Level::Advanced,
        "附加参数：每行一条，原样传给 BBDown",
    ),
];

/// 脱敏 flag 集合——持久化与展示前必须遮蔽其值的 flag（§4.5）。唯一真相源。
pub fn sensitive_flags() -> impl Iterator<Item = &'static str> {
    REGISTRY.iter().filter(|m| m.sensitive).map(|m| m.flag)
}
