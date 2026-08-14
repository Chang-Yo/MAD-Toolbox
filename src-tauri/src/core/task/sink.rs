//! core/task 与 Tauri 的接触点收敛为 TauriSink 一个实现。

use super::types::TaskEvent;

pub trait EventSink: Send + Sync {
    fn emit(&self, event: &TaskEvent);
}

/// 生产实现：全部任务事件走单一 Tauri 通道 `task-event`，前端单点订阅。
pub struct TauriSink {
    app: tauri::AppHandle,
}

impl TauriSink {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }
}

impl EventSink for TauriSink {
    fn emit(&self, event: &TaskEvent) {
        use tauri::Emitter;
        let _ = self.app.emit("task-event", event);
    }
}
