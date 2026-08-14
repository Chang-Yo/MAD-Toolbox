//! 子进程输出解码（架构文档 §9）：Windows 控制台工具输出 GBK/UTF-8 混杂。
//! 策略：严格 UTF-8 优先 → GBK 回退 → lossy 兜底，逐行判定（行内不混编码）。

/// 解码一行子进程输出（不含行尾符）。
pub fn decode_line(bytes: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    let (text, _, had_errors) = encoding_rs::GBK.decode(bytes);
    if had_errors {
        String::from_utf8_lossy(bytes).into_owned()
    } else {
        text.into_owned()
    }
}
