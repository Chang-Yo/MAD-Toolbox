//! media（FFmpeg）垂直切片：本地处理池任务 + PR 兼容编排。
//! 参数注册表待 Help 页阶段补齐（media 无敏感字段，注册表三个消费方中仅剩 UI 提示）。

pub mod adapter;
pub mod commands;
pub mod types;
