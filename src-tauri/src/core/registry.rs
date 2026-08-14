//! 参数注册表的元类型（架构文档 §6）。
//! 注册表数据（表）归各 feature 的 adapter；此处只放跨 feature 复用的类型定义。
//! `C` 为 feature 自定义的生效条件枚举。

/// 字段如何映射到 argv。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// 位置参数。
    Positional,
    /// 布尔开关：为 true 时发出 flag。
    Switch,
    /// 携带值的参数：值非空（trim 后）时发出 `flag value`。
    Value,
    /// 多值枚举：每个取值映射零或一个代表性 flag（恒等取值不发 flag）。
    Enum(&'static [(&'static str, &'static str)]),
    /// 专家逃生舱：文本按行拆分，每行原样进 argv。
    Freeform,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Level {
    /// 高频参数，表单直接渲染。
    Common,
    /// 长尾参数，折叠进高级区。
    Advanced,
}

#[derive(Debug, Clone, Copy)]
pub struct ParamMeta<C: 'static> {
    /// 意图字段名（camelCase，与 serde/TS 一致）。
    pub field: &'static str,
    /// CLI flag（Switch/Value 用；其余 Kind 为空串）。
    pub flag: &'static str,
    pub kind: Kind,
    pub sensitive: bool,
    pub level: Level,
    pub condition: C,
    pub help: &'static str,
}
