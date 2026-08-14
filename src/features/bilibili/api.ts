/**
 * bilibili 后端契约的类型化 invoke 封装——页面不裸写 invoke 字符串。
 */

import { invoke } from "@tauri-apps/api/core";
import type { TaskIntent } from "../../contracts/types";

export interface PreviewResult {
  /** 脱敏展示文本。 */
  display: string;
  argvRedacted: string[];
  /** 完整 argv：仅作专家模式编辑起点，绝不直接上屏。 */
  argv: string[];
}

export interface SubmitResult {
  taskId: string;
}

export function bilibiliPreview(intent: TaskIntent): Promise<PreviewResult> {
  return invoke<PreviewResult>("bilibili_preview", { intent });
}

export function bilibiliSubmit(intent: TaskIntent): Promise<SubmitResult> {
  return invoke<SubmitResult>("bilibili_submit", { intent });
}
