//! bilibili 垂直切片（架构文档 §3）。样板期逐阶段生长：
//! Stage 2 意图/注册表/adapter；Stage 5 commands 薄壳与原生扫码登录回迁。

pub mod adapter;
pub mod commands;
pub mod login;
pub mod registry;
pub mod types;
