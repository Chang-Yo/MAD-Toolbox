/**
 * 应用级窗口控制封装。
 */

import { getCurrentWindow } from "@tauri-apps/api/window";

export async function syncNativeWindowTheme(scheme: "light" | "dark" | "auto"): Promise<void> {
  try {
    await getCurrentWindow().setTheme(scheme === "auto" ? null : scheme);
  } catch {
    // 非 Tauri 环境忽略
  }
}
