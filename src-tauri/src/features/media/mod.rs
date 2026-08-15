//! media（FFmpeg）垂直切片：即时查询、输入展开、本地处理池任务与 PR 兼容策略。
//! 参数注册表待 Help 页阶段补齐（media 无敏感字段，注册表三个消费方中仅剩 UI 提示）。

pub mod adapter;
pub mod commands;
pub(crate) mod policy;
pub(crate) mod query;
pub mod types;
