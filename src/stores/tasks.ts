/**
 * 任务全局 store（Zustand）：Tauri 单通道事件 `task-event` → 纯 reducer → 各页面订阅。
 * 任务页、首页回顾条、池指示器共读同一份数据。
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { TaskEnvelope, TaskEvent } from "../contracts/types";
import { applySnapshot, applyTaskEvent, emptyTasksState, removeTasks, type TasksState } from "./tasks.reducer";

interface TasksStore extends TasksState {
  ready: boolean;
  init: () => Promise<void>;
  cancel: (taskId: string) => void;
  promote: (taskId: string) => void;
  remove: (taskIds: string[]) => Promise<void>;
}

let initStarted = false;

export const useTasksStore = create<TasksStore>((set, get) => ({
  ...emptyTasksState,
  ready: false,

  // 顺序要点：先订阅、后拉快照——快照可能比订阅后到达的事件旧，合并时本地优先
  init: async () => {
    if (initStarted) return;
    initStarted = true;
    // 浏览器预览（无 Tauri 后端）时注入 mock 任务便于观察 UI；
    // 生产构建中该分支被常量折叠剔除，mock 文件不进 bundle
    if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
      const { injectTaskMocks } = await import("../../mock/tasks.mock");
      injectTaskMocks();
      return;
    }
    await listen<TaskEvent>("task-event", (event) => {
      set((state) => applyTaskEvent(state, event.payload));
    });
    const snapshot = await invoke<TaskEnvelope[]>("tasks_snapshot");
    set((state) => ({ ...applySnapshot(state, snapshot), ready: true }));
  },

  cancel: (taskId) => {
    void invoke("task_cancel", { taskId });
  },
  // 置顶只改后端调度顺序；样板期列表按创建时间倒序展示，不做队列顺序可视化
  promote: (taskId) => {
    void invoke("task_promote", { taskId });
  },

  // 后端只删终态任务并回传实际删除的 id，本地只移除确认过的条目
  remove: async (taskIds) => {
    if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
      set((state) => removeTasks(state, taskIds));
      return;
    }
    const deleted = await invoke<string[]>("task_delete", { taskIds });
    set((state) => removeTasks(state, deleted));
  }
}));

export { poolOccupancy, sortedTasks } from "./tasks.reducer";
