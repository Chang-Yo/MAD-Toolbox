/**
 * 旧 job 体系契约的 TS 镜像：bilibili 登录与 musicdl 搜索仍走 job-state
 * 单次事件回执（未迁移到任务系统）。Rust 侧真相源：
 * src-tauri/src/features/bilibili/login.rs、src-tauri/src/features/music/commands.rs。
 */

import type { ToolName } from "./dependency";

export interface JobState {
  jobId: string;
  tool: ToolName;
  state: "running" | "completed" | "failed" | "canceled";
  exitCode: number | null;
  message: string;
}

export interface RunResult {
  jobId: string;
}
