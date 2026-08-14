//! bilibili 原生扫码登录（自 lib.rs 回迁）。
//! 注意：这不是 spawn BBDown 进程——QR 生成/轮询/凭证校验是 Rust 原生 reqwest 流，
//! QR 以 SVG dataUrl 经事件推送（架构文档 §4.2 扩展点的实际形态）。
//! 事件编排层（run_bbdown_login / spawn_bbdown_login_job）仍在 lib.rs，调用本模块。
//! BBDown.data 写入路径保持为参数，为 deps 阶段“登录态迁出 exe 目录”铺路。

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use qrcode::QrCode;
use reqwest::{
    header::{COOKIE, REFERER},
    Client, Url,
};
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

const BBDOWN_QR_GENERATE_URL: &str =
    "https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main-fe-header";
const BBDOWN_QR_POLL_URL: &str = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll";
const BILIBILI_NAV_URL: &str = "https://api.bilibili.com/x/web-interface/nav";
pub(crate) const BBDOWN_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BBDOWN_COOKIE_KEYS: [&str; 7] = [
    "SESSDATA",
    "bili_jct",
    "DedeUserID",
    "DedeUserID__ckMd5",
    "sid",
    "buvid3",
    "buvid4",
];

fn merge_cookie_fields(target: &mut HashMap<String, String>, source: HashMap<String, String>) {
    for key in BBDOWN_COOKIE_KEYS {
        if let Some(value) = source.get(key).filter(|value| !value.is_empty()) {
            target.insert(key.to_string(), value.clone());
        }
    }
}

pub(crate) fn has_required_bbdown_cookie(fields: &HashMap<String, String>) -> bool {
    ["SESSDATA", "bili_jct", "DedeUserID"]
        .iter()
        .all(|key| fields.get(*key).is_some_and(|value| !value.is_empty()))
}

pub(crate) fn cookie_header(fields: &HashMap<String, String>) -> String {
    BBDOWN_COOKIE_KEYS
        .iter()
        .filter_map(|key| {
            fields
                .get(*key)
                .map(|value| format!("{key}={}", value.replace(',', "%2C")))
        })
        .collect::<Vec<_>>()
        .join(";")
}

fn merge_cookie_url(target: &mut HashMap<String, String>, value: &str) {
    if let Ok(url) = Url::parse(value) {
        let fields = url
            .query_pairs()
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
        merge_cookie_fields(target, fields);
    }
}

async fn validate_bbdown_cookie(client: &Client, cookie: &str) -> Result<(), String> {
    let response = client
        .get(BILIBILI_NAV_URL)
        .header(COOKIE, cookie)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("验证 BBDown Cookie 失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "验证 BBDown Cookie 失败：HTTP {}",
            response.status()
        ));
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("解析账号验证结果失败：{error}"))?;
    if body
        .pointer("/data/isLogin")
        .and_then(serde_json::Value::as_bool)
        == Some(true)
    {
        Ok(())
    } else {
        Err("BBDown Cookie 数据不完整或账号验证未通过".into())
    }
}

fn save_bbdown_data(data_path: &Path, completed: &str) -> Result<(), String> {
    let temporary = data_path.with_extension(format!("data.{}.tmp", Uuid::new_v4()));
    std::fs::write(&temporary, completed).map_err(|error| format!("写入登录数据失败：{error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("设置登录数据权限失败：{error}"))?;
    }
    std::fs::rename(&temporary, data_path)
        .map_err(|error| format!("保存完整 BBDown.data 失败：{error}"))?;
    Ok(())
}

pub(crate) async fn validate_and_save_bbdown_data(
    client: &Client,
    data_path: &Path,
    cookies: &HashMap<String, String>,
) -> Result<(), String> {
    if !has_required_bbdown_cookie(cookies) {
        return Err("B站二维码轮询没有返回完整 Cookie（SESSDATA、bili_jct、DedeUserID）".into());
    }
    let completed = cookie_header(cookies);
    validate_bbdown_cookie(client, &completed).await?;
    save_bbdown_data(data_path, &completed)
}

pub(crate) async fn generate_bbdown_qr(client: &Client) -> Result<(String, String), String> {
    let response = client
        .get(BBDOWN_QR_GENERATE_URL)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("获取 B站登录地址失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("获取 B站登录地址失败：HTTP {}", response.status()));
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("解析 B站登录地址失败：{error}"))?;
    if body.pointer("/code").and_then(serde_json::Value::as_i64) != Some(0) {
        return Err(format!(
            "B站登录地址接口失败：{}",
            body.pointer("/message")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("未知错误")
        ));
    }
    let url = body
        .pointer("/data/url")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "B站登录接口没有返回二维码地址".to_string())?;
    let qrcode_key = body
        .pointer("/data/qrcode_key")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "B站登录接口没有返回二维码密钥".to_string())?;
    Ok((url.to_string(), qrcode_key.to_string()))
}

pub(crate) fn bbdown_qr_data_url(url: &str) -> Result<String, String> {
    let code =
        QrCode::new(url.as_bytes()).map_err(|error| format!("生成登录二维码失败：{error}"))?;
    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(320, 320)
        .build();
    Ok(format!(
        "data:image/svg+xml;base64,{}",
        BASE64.encode(svg.as_bytes())
    ))
}

pub(crate) async fn poll_bbdown_qr(
    client: &Client,
    qrcode_key: &str,
) -> Result<(i64, HashMap<String, String>, Option<String>), String> {
    let mut poll_url =
        Url::parse(BBDOWN_QR_POLL_URL).map_err(|error| format!("解析 B站轮询地址失败：{error}"))?;
    poll_url
        .query_pairs_mut()
        .append_pair("qrcode_key", qrcode_key)
        .append_pair("source", "main-fe-header");
    let response = client
        .get(poll_url)
        .header(REFERER, "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|error| format!("轮询 B站登录状态失败：{error}"))?;
    if !response.status().is_success() {
        return Err(format!("轮询 B站登录状态失败：HTTP {}", response.status()));
    }

    // The current Bilibili response may intentionally leave the credentials
    // out of data.url and deliver them only as Set-Cookie headers. Keep these
    // values before consuming the response body, matching the behavior of
    // current Bilibili clients.
    let response_cookies = response
        .cookies()
        .map(|cookie| (cookie.name().to_string(), cookie.value().to_string()))
        .collect::<Vec<_>>();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("解析 B站登录状态失败：{error}"))?;
    let code = body
        .pointer("/data/code")
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| "B站登录状态响应缺少 data.code".to_string())?;
    let mut cookies = HashMap::new();
    merge_cookie_fields(
        &mut cookies,
        response_cookies.into_iter().collect::<HashMap<_, _>>(),
    );
    let url = body
        .pointer("/data/url")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    if let Some(value) = &url {
        merge_cookie_url(&mut cookies, value);
    }
    Ok((code, cookies, url))
}
