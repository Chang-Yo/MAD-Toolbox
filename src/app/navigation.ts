import {
  IconBrandBilibili,
  IconGauge,
  IconMovie,
  IconMusic,
  IconSettings,
  IconWorldDownload,
  type Icon as TablerIcon
} from "@tabler/icons-react";
import type { AppSection, MediaPageId, SettingsPageId } from "./route";

export interface L1NavigationItem {
  section: AppSection;
  label: string;
  icon: TablerIcon;
}

export interface L2NavigationItem<
  PageId extends MediaPageId | SettingsPageId = MediaPageId | SettingsPageId
> {
  page: PageId;
  label: string;
  icon?: TablerIcon;
}

export const L1_NAVIGATION = [
  { section: "tasks", label: "任务中心", icon: IconGauge },
  { section: "bilibili", label: "哔哩哔哩下载", icon: IconBrandBilibili },
  { section: "network", label: "网络视频下载", icon: IconWorldDownload },
  { section: "media", label: "媒体处理", icon: IconMovie },
  { section: "music", label: "音乐下载", icon: IconMusic },
  { section: "settings", label: "设置", icon: IconSettings }
] as const satisfies readonly L1NavigationItem[];

export const MEDIA_L2_NAVIGATION = [
  { page: "pr-compatible", label: "PR 智能兼容" },
  { page: "transcode", label: "转码" },
  { page: "remux", label: "重新封装" },
  { page: "extract", label: "流提取" },
  { page: "gif", label: "GIF" },
  { page: "image-export", label: "图片与帧导出" }
] as const satisfies readonly L2NavigationItem<MediaPageId>[];

export const SETTINGS_L2_NAVIGATION = [
  { page: "general", label: "通用" },
  { page: "dependencies", label: "依赖" },
  { page: "about", label: "关于" }
] as const satisfies readonly L2NavigationItem<SettingsPageId>[];

export const L2_NAVIGATION = {
  media: MEDIA_L2_NAVIGATION,
  settings: SETTINGS_L2_NAVIGATION
} as const;
