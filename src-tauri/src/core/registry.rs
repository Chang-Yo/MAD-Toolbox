//! 参数注册表的元类型（架构文档 §6）。
//! 注册表数据（表）归各 feature 的 adapter；此处只放跨 feature 复用的类型定义。

#[derive(Debug, Clone, Copy)]
pub struct ParamMeta {
    /// 意图字段名（camelCase，与 serde/TS 一致）。
    pub field: &'static str,
    /// CLI flag。
    pub flag: &'static str,
    pub sensitive: bool,
}
