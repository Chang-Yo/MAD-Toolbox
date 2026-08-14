/**
 * 任务 store 的纯 reducer 层：无 Tauri、无 DOM、无 Zustand。
 * Zustand 壳（tasks.ts）只做订阅接线。
 */

import type { Pool, TaskEnvelope, TaskEvent } from "../contracts/types";

export interface TaskLogLine {
  stream: string;
  line: string;
  seq: number;
}

export interface TasksState {
  /** id → 信封（事件到达即覆盖，事件比快照新）。 */
  tasks: Record<string, TaskEnvelope>;
  /** id → 最近日志行，每任务封顶 MAX_LOG_LINES（内存上限）。 */
  logs: Record<string, TaskLogLine[]>;
}

export const MAX_LOG_LINES = 200;

export const emptyTasksState: TasksState = { tasks: {}, logs: {} };

export function applyTaskEvent(state: TasksState, event: TaskEvent): TasksState {
  switch (event.type) {
    case "changed": {
      const envelope = event.data;
      return { ...state, tasks: { ...state.tasks, [envelope.id]: envelope } };
    }
    case "log": {
      const { taskId, stream, line, seq } = event.data;
      if (!state.tasks[taskId]) return state; // 未知任务的日志事件忽略
      const existing = state.logs[taskId] ?? [];
      const appended = [...existing, { stream, line, seq }];
      const capped = appended.length > MAX_LOG_LINES ? appended.slice(-MAX_LOG_LINES) : appended;
      return { ...state, logs: { ...state.logs, [taskId]: capped } };
    }
    case "progress": {
      const { taskId, progress } = event.data;
      const task = state.tasks[taskId];
      if (!task) return state;
      return { ...state, tasks: { ...state.tasks, [taskId]: { ...task, progress } } };
    }
    case "custom":
      // 自定义事件是 feature 私有语义（如扫码登录），由发起页面自行订阅，store 不掺和
      return state;
  }
}

/**
 * 初始快照合并。订阅先于快照建立，因此本地已有的条目（事件更新过）比快照新——保留本地，
 * 只补进快照独有的（历史/归档任务）。
 */
export function applySnapshot(state: TasksState, snapshot: TaskEnvelope[]): TasksState {
  const tasks = { ...state.tasks };
  for (const envelope of snapshot) {
    if (!tasks[envelope.id]) {
      tasks[envelope.id] = envelope;
    }
  }
  return { ...state, tasks };
}

/** 池占用：从任务状态推导（canceling 仍占槽位），不依赖后端同步接口（§8）。 */
export function poolOccupancy(state: TasksState, pool: Pool): number {
  return Object.values(state.tasks).filter(
    (t) => t.pool === pool && (t.status === "running" || t.status === "canceling")
  ).length;
}

/** 展示顺序：创建时间倒序。 */
export function sortedTasks(state: TasksState): TaskEnvelope[] {
  return Object.values(state.tasks).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
