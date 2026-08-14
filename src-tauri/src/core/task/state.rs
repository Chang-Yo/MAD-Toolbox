//! 状态机（架构文档 §4.3）：纯函数转移表，枢纽循环只调用它，不自带判断。

use super::types::TaskStatus;

/// 驱动状态转移的事件。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransitionEvent {
    /// 调度器分派（池内有空位）。
    Dispatch,
    /// 用户取消。
    Cancel,
    /// 进程退出，携带退出码（被杀时可能无码）。
    Exit(Option<i32>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IllegalTransition {
    pub from: TaskStatus,
    pub event: TransitionEvent,
}

/// 状态转移。返回 Ok(新状态)；对无意义但无害的事件（如终态上的取消）返回原状态（幂等 no-op）；
/// 对暴露逻辑 bug 的事件（如非 queued 上的分派）返回 Err。
pub fn transition(
    from: TaskStatus,
    event: TransitionEvent,
) -> Result<TaskStatus, IllegalTransition> {
    use TaskStatus::*;
    use TransitionEvent::*;

    let illegal = || Err(IllegalTransition { from, event });

    match (from, event) {
        (Queued, Dispatch) => Ok(Running),
        (Queued, Cancel) => Ok(Canceled), // 未执行，直接出队（§4.3）
        (Queued, Exit(_)) => illegal(),   // 没启动过的任务不可能退出

        (Running, Dispatch) => illegal(),
        (Running, Cancel) => Ok(Canceling), // 杀进程树非瞬时，进入中间态
        (Running, Exit(Some(0))) => Ok(Success),
        (Running, Exit(_)) => Ok(Failed),

        (Canceling, Dispatch) => illegal(),
        (Canceling, Cancel) => Ok(Canceling), // 二次取消幂等
        // 用户意志赢竞态：即使进程赶在被杀前以 0 退出，也按 canceled 记（刻意钉死）
        (Canceling, Exit(_)) => Ok(Canceled),

        // 终态：取消为幂等 no-op；分派/退出暴露 bug
        (s, Cancel) if s.is_terminal() => Ok(s),
        (s, Dispatch | Exit(_)) if s.is_terminal() => illegal(),

        // 上面的分支已穷尽（编译器无法证明 guard 穷尽性，兜底到不可达）
        _ => unreachable!("状态转移表遗漏: {from:?} + {event:?}"),
    }
}
