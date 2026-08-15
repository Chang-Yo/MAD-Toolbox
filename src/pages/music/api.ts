import { invoke } from "@tauri-apps/api/core";
import type { MusicdlCliOptions } from "./configuration";

export function previewMusicCommand(request: MusicdlCliOptions): Promise<string> {
  return invoke<string>("musicdl_preview", { request });
}
