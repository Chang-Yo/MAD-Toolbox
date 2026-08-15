//! 通用文本脱敏：任务日志与诊断导出共享同一套规则。

fn strip_ansi_codes(line: &str) -> String {
    let mut output = String::with_capacity(line.len());
    let mut characters = line.chars().peekable();
    while let Some(character) = characters.next() {
        if character == '\u{1b}' && characters.peek() == Some(&'[') {
            characters.next();
            for code in characters.by_ref() {
                if code.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            output.push(character);
        }
    }
    output
}

pub(crate) fn redact_output_line(line: &str) -> String {
    let mut redacted = strip_ansi_codes(line);
    for key in [
        "SESSDATA",
        "bili_jct",
        "access_token",
        "refresh_token",
        "authorization",
        "proxy-authorization",
        "password",
        "passwd",
        "api_key",
        "api-key",
        "cookies",
        "cookie",
        "token",
    ] {
        let mut search_from = 0;
        while let Some(offset) = redacted[search_from..]
            .to_ascii_lowercase()
            .find(&key.to_ascii_lowercase())
        {
            let label_end = search_from + offset + key.len();
            let mut delimiter = label_end;
            while redacted[delimiter..].starts_with('"')
                || redacted[delimiter..].starts_with('\'')
                || redacted[delimiter..].starts_with(char::is_whitespace)
            {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            if !redacted[delimiter..].starts_with('=') && !redacted[delimiter..].starts_with(':') {
                search_from = label_end;
                continue;
            }
            delimiter += 1;
            while redacted[delimiter..].starts_with(char::is_whitespace) {
                delimiter += redacted[delimiter..].chars().next().unwrap().len_utf8();
            }
            let quote = redacted[delimiter..]
                .chars()
                .next()
                .filter(|character| *character == '"' || *character == '\'');
            let start = delimiter + quote.map(char::len_utf8).unwrap_or(0);
            let hide_remainder = matches!(
                key,
                "authorization" | "proxy-authorization" | "cookie" | "cookies"
            ) && quote.is_none();
            let end = if hide_remainder {
                redacted.len()
            } else {
                redacted[start..]
                    .find(|character: char| {
                        quote
                            .map(|quote| character == quote)
                            .unwrap_or_else(|| character.is_whitespace() || character == ';')
                    })
                    .map(|value_offset| start + value_offset)
                    .unwrap_or(redacted.len())
            };
            redacted.replace_range(start..end, "***");
            search_from = start + 3;
        }
    }
    redacted
}

fn redact_urls(line: &str) -> String {
    let mut redacted = line.to_string();
    loop {
        let http = redacted.find("http://");
        let https = redacted.find("https://");
        let start = match (http, https) {
            (Some(left), Some(right)) => left.min(right),
            (Some(value), None) | (None, Some(value)) => value,
            (None, None) => break,
        };
        let end = redacted[start..]
            .find(char::is_whitespace)
            .map(|offset| start + offset)
            .unwrap_or(redacted.len());
        redacted.replace_range(start..end, "<URL_REDACTED>");
    }
    redacted
}

pub(crate) fn sanitize_diagnostic_text(
    line: &str,
    redact_personal_data: bool,
    home: Option<&str>,
) -> String {
    let mut sanitized = redact_output_line(line);
    if redact_personal_data {
        sanitized = redact_urls(&sanitized);
        if let Some(home) = home.filter(|value| !value.is_empty()) {
            sanitized = sanitized.replace(home, "$HOME");
        }
    }
    sanitized
}
