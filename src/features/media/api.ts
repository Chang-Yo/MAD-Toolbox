/**
 * media 后端契约的类型化 invoke 封装。
 */

import { invoke } from "@tauri-apps/api/core";
import type { TaskIntent } from "../../contracts/types";

export interface PreviewResult {
  display: string;
  argvRedacted: string[];
  argv: string[];
}

export interface BatchSubmitResult {
  taskIds: string[];
}

export function mediaPreview(intent: TaskIntent): Promise<PreviewResult> {
  return invoke<PreviewResult>("media_preview", { intent });
}

export function mediaSubmit(inputs: string[], intent: TaskIntent): Promise<BatchSubmitResult> {
  return invoke<BatchSubmitResult>("media_submit", { inputs, intent });
}

export function mediaPrSubmit(
  input: string,
  outputDirectory: string | null
): Promise<BatchSubmitResult> {
  return invoke<BatchSubmitResult>("media_pr_submit", { input, outputDirectory });
}

/** 查询（§4.1，沿用既有 command）。 */
export function ffmpegEncoders(): Promise<string[]> {
  return invoke<string[]>("ffmpeg_encoders");
}

export interface MediaInspection {
  path: string;
  summary: string;
}

export function inspectMedia(path: string): Promise<MediaInspection> {
  return invoke<MediaInspection>("inspect_media", { path });
}
