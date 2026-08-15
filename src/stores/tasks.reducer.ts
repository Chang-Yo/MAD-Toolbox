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
  tasks: Record<string, TaskEnvelope>;

  logs: Record<string, TaskLogLine[]>;
}

export const MAX_LOG_LINES = 200;

export const emptyTasksState: TasksState = { tasks: {}, logs: {} };

export function applyTaskEvent(state: TasksState, event: TaskEvent): TasksState {
  switch (event.type) {
    case "changed": {
      const envelope = event.data;
      // 终态信封不携带 progress，保留内存中最后已知进度（失败时进度条停在原地变红）
      const lastProgress = envelope.progress ?? state.tasks[envelope.id]?.progress;
      const merged = lastProgress ? { ...envelope, progress: lastProgress } : envelope;
      return { ...state, tasks: { ...state.tasks, [envelope.id]: merged } };
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

/**
 * 删除任务（后端已确认的 id 列表）；内存日志随任务一并清出。
 */
export function removeTasks(state: TasksState, ids: string[]): TasksState {
  if (ids.length === 0) return state;
  const removing = new Set(ids);
  const tasks: TasksState["tasks"] = {};
  const logs: TasksState["logs"] = {};
  for (const [id, envelope] of Object.entries(state.tasks)) {
    if (!removing.has(id)) tasks[id] = envelope;
  }
  for (const [id, lines] of Object.entries(state.logs)) {
    if (!removing.has(id)) logs[id] = lines;
  }
  return { tasks, logs };
}

export function poolOccupancy(state: TasksState, pool: Pool): number {
  return Object.values(state.tasks).filter(
    (t) => t.pool === pool && (t.status === "running" || t.status === "canceling")
  ).length;
}

export function sortedTasks(state: TasksState): TaskEnvelope[] {
  return Object.values(state.tasks).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function splitByDay(tasks: TaskEnvelope[]): {
  today: TaskEnvelope[];
  history: TaskEnvelope[];
} {
  const todayKey = new Date().toDateString();
  const today: TaskEnvelope[] = [];
  const history: TaskEnvelope[] = [];
  for (const task of tasks) {
    (new Date(task.createdAt).toDateString() === todayKey ? today : history).push(task);
  }
  return { today, history };
}
