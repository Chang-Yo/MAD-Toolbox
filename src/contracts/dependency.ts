/**
 * 依赖检测契约的 TS 镜像。
 * Rust 侧真相源：src-tauri/src/core/deps.rs。
 */

export type ToolName =
  "bbdown" | "yt-dlp" | "musicdl" | "ffmpeg" | "ffprobe" | "mediainfo" | "deno" | "python";

export interface DependencyStatus {
  tool: ToolName;
  label: string;
  available: boolean;
  bundled: boolean;
  bundledAvailable: boolean;
  systemAvailable: boolean;
  source: "bundled" | "system" | null;
  path: string | null;
  version: string | null;
  required: boolean;
  installHint: string | null;
}
