//! musicdl 原生 CLI 的等效预览。
//!
//! 实际执行仍由 Python adapter 接管；这里仅镜像前端原有 `buildMusicdlArgs` +
//! `commandPreview` 规则，供用户理解配置对应的 musicdl 命令。

use crate::core::adapter::quote;

use super::types::MusicdlPreviewRequest;

fn js_trim(value: &str) -> &str {
    value.trim_matches(|character: char| {
        matches!(
            character,
            '\u{0009}' | '\u{000b}' | '\u{000c}' | '\u{0020}' | '\u{00a0}' | '\u{1680}' | '\u{2000}'
                ..='\u{200a}'
                    | '\u{202f}'
                    | '\u{205f}'
                    | '\u{3000}'
                    | '\u{feff}'
                    | '\u{000a}'
                    | '\u{000d}'
                    | '\u{2028}'
                    | '\u{2029}'
        )
    })
}

fn push_json_object(
    args: &mut Vec<String>,
    flag: &str,
    value: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    if !value.is_empty() {
        args.push(flag.to_string());
        args.push(serde_json::to_string(value).map_err(|error| error.to_string())?);
    }
    Ok(())
}

fn equivalent_args(request: &MusicdlPreviewRequest) -> Result<Vec<String>, String> {
    let mut args = Vec::new();
    let keyword = js_trim(&request.keyword);
    if !keyword.is_empty() {
        args.push("-k".into());
        args.push(keyword.into());
    }
    let playlist_url = js_trim(&request.playlist_url);
    if !playlist_url.is_empty() {
        args.push("-p".into());
        args.push(playlist_url.into());
    }
    if !request.music_sources.is_empty() {
        args.push("-m".into());
        args.push(request.music_sources.join(","));
    }
    push_json_object(&mut args, "-i", &request.init_music_clients_cfg)?;
    push_json_object(&mut args, "-r", &request.requests_overrides)?;
    push_json_object(&mut args, "-c", &request.clients_threadings)?;
    push_json_object(&mut args, "-s", &request.search_rules)?;
    Ok(args)
}

fn redact_proxy(value: &str) -> String {
    let Ok(mut parsed) = reqwest::Url::parse(value) else {
        return value.to_string();
    };
    if parsed.username().is_empty() && parsed.password().is_none() {
        return value.to_string();
    }
    let _ = parsed.set_username("***");
    let _ = parsed.set_password(Some("***"));
    parsed.to_string()
}

fn preview_display(args: &[String]) -> String {
    let mut shown = Vec::with_capacity(args.len());
    let mut redact_next = false;
    for arg in args {
        if redact_next {
            shown.push(quote("***"));
            redact_next = false;
            continue;
        }
        if matches!(
            arg.as_str(),
            "-i" | "--init-music-clients-cfg" | "-r" | "--requests-overrides"
        ) {
            shown.push(arg.clone());
            redact_next = true;
            continue;
        }
        if let Some(proxy) = arg.strip_prefix("--proxy=") {
            shown.push(quote(&format!("--proxy={}", redact_proxy(proxy))));
            continue;
        }
        shown.push(quote(arg));
    }
    std::iter::once("musicdl".to_string())
        .chain(shown)
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn equivalent_preview(request: &MusicdlPreviewRequest) -> Result<String, String> {
    equivalent_args(request).map(|args| preview_display(&args))
}
