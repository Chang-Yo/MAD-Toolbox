/**
 * 任务系统契约的 TS 镜像（架构文档 §4.2）。
 * Rust 侧真相源：src-tauri/src/core/task/types.rs。
 * 接口稳定后评估 tauri-specta 自动生成，替代本文件的手工维护。
 */

export type Feature = "bilibili" | "network" | "media" | "music";

export type Pool = "download" | "local";

/** 状态字符串同时是 SQLite 行值与前端判别式。 */
export type TaskStatus =
  "queued" | "running" | "canceling" | "success" | "failed" | "canceled" | "interrupted";

/** 表单/手改二态：`form` 灌回表单，`manual` 灌回专家模式文本框。 */
export type TaskIntent =
  { type: "form"; data: Record<string, unknown> } | { type: "manual"; data: { argv: string[] } };

export interface TaskProgress {
  percent: number | null;
  detail: string | null;
}

export interface TaskEnvelope {
  id: string;
  feature: Feature;
  pool: Pool;
  title: string;
  status: TaskStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  tool: string;
  toolVersion: string | null;
  /** 脱敏后的 argv——前端只会见到这个版本。 */
  argvRedacted: string[];
  workingDir: string | null;
  outputPaths: string[];
  exitCode: number | null;
  logPath: string | null;
  intent: TaskIntent;
  /** 运行期内存态，终态信封不携带。 */
  progress?: TaskProgress;
}

export type LogStream = "stdout" | "stderr" | "system";

export type TaskEvent =
  | { type: "changed"; data: TaskEnvelope }
  | { type: "log"; data: { taskId: string; stream: LogStream; line: string; seq: number } }
  | { type: "progress"; data: { taskId: string; progress: TaskProgress } }
  | { type: "custom"; data: { taskId: string; name: string; payload: unknown } };
