/**
 * 设置页后端契约的类型化 invoke 封装：应用设置与依赖检测/安装为跨 feature 应用级命令。
 */

import { invoke } from "@tauri-apps/api/core";
import type { DependencyStatus, ToolName } from "../../contracts/dependency";

export interface AppSettings {
  defaultOutputDirectory: string | null;
  dependencyPreference: "bundled" | "system";
  proxy: string | null;
}

export function fetchAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("app_settings");
}

export function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("save_app_settings", { settings });
}

// TODO(临时 mock)：伪造“所有依赖缺失”的状态，用于目视依赖列表与一键安装按钮的布局
// （纯浏览器 dev 下 invoke 不可用，列表恒为空）。验证完成后删除本数组，
// 并恢复 fetchDependencyStatus 为直接 invoke。
const MOCK_DEPENDENCIES: DependencyStatus[] = [
  {
    tool: "bbdown",
    label: "BBDown",
    available: false,
    bundled: true,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: true,
    installHint: "内置副本缺失，请重新安装应用"
  },
  {
    tool: "yt-dlp",
    label: "yt-dlp",
    available: false,
    bundled: false,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: true,
    installHint: "未在系统 PATH 中找到"
  },
  {
    tool: "musicdl",
    label: "musicdl",
    available: false,
    bundled: true,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: false,
    installHint: "内置副本缺失，请重新安装应用"
  },
  {
    tool: "ffmpeg",
    label: "FFmpeg",
    available: false,
    bundled: true,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: true,
    installHint: "未在系统 PATH 中找到"
  },
  {
    tool: "ffprobe",
    label: "ffprobe",
    available: false,
    bundled: true,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: false,
    installHint: "随 FFmpeg 分发"
  },
  {
    tool: "mediainfo",
    label: "MediaInfo CLI",
    available: false,
    bundled: false,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: true,
    installHint: "未在系统 PATH 中找到"
  },
  {
    tool: "deno",
    label: "Deno",
    available: false,
    bundled: true,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: true,
    installHint: "未在系统 PATH 中找到"
  },
  {
    tool: "python",
    label: "Python 3",
    available: false,
    bundled: false,
    bundledAvailable: false,
    systemAvailable: false,
    source: null,
    path: null,
    version: null,
    required: false,
    installHint: "未在系统 PATH 中找到"
  }
];

export function fetchDependencyStatus(): Promise<DependencyStatus[]> {
  // TODO(临时 mock)：见上，验证后恢复为 invoke<DependencyStatus[]>("dependency_status")
  return Promise.resolve(MOCK_DEPENDENCIES);
}

export function installDependency(tool: ToolName): Promise<void> {
  return invoke<void>("dependency_install", { tool });
}
