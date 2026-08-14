/**
 * bilibili 表单状态 = 后端 BilibiliIntent 的 TS 镜像
 * （真相源：src-tauri/src/features/bilibili/types.rs）。
 * 默认值与 Rust Default 一致：开关全 false = 不传 flag = BBDown 自身默认行为。
 */

export type BilibiliApi = "web" | "tv" | "app" | "intl";
export type BilibiliMode =
  "video" | "video-only" | "audio" | "cover" | "subtitle" | "danmaku" | "info";

export interface BilibiliFormState {
  url: string;
  api: BilibiliApi;
  mode: BilibiliMode;
  pages: string;
  encodingPriority: string;
  qualityPriority: string;
  filePattern: string;
  multiFilePattern: string;
  outputDirectory: string;
  useMp4box: boolean;
  useAria2c: boolean;
  showAll: boolean;
  hideStreams: boolean;
  skipMux: boolean;
  skipSubtitle: boolean;
  skipCover: boolean;
  skipAi: boolean;
  multiThread: boolean;
  forceHttp: boolean;
  downloadDanmaku: boolean;
  videoAscending: boolean;
  audioAscending: boolean;
  allowPcdn: boolean;
  forceReplaceHost: boolean;
  saveArchive: boolean;
  debug: boolean;
  language: string;
  userAgent: string;
  cookie: string;
  accessToken: string;
  aria2cArgs: string;
  mp4boxPath: string;
  aria2cPath: string;
  uposHost: string;
  delayPerPage: string;
  host: string;
  epHost: string;
  area: string;
  configFile: string;
  extraArgs: string;
}

export const defaultBilibiliForm: BilibiliFormState = {
  url: "",
  api: "web",
  mode: "video",
  pages: "",
  encodingPriority: "",
  qualityPriority: "",
  filePattern: "",
  multiFilePattern: "",
  outputDirectory: "",
  useMp4box: false,
  useAria2c: false,
  showAll: false,
  hideStreams: false,
  skipMux: false,
  skipSubtitle: false,
  skipCover: false,
  skipAi: false,
  multiThread: false,
  forceHttp: false,
  downloadDanmaku: false,
  videoAscending: false,
  audioAscending: false,
  allowPcdn: false,
  forceReplaceHost: false,
  saveArchive: false,
  debug: false,
  language: "",
  userAgent: "",
  cookie: "",
  accessToken: "",
  aria2cArgs: "",
  mp4boxPath: "",
  aria2cPath: "",
  uposHost: "",
  delayPerPage: "",
  host: "",
  epHost: "",
  area: "",
  configFile: "",
  extraArgs: ""
};
