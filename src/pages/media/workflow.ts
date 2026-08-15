import type { MediaPageId } from "../../app/route";
import type { MediaOperation } from "./form";

export type MediaPageOperation = MediaOperation | "pr-compatible";

export interface MediaPageConfig {
  operations: readonly MediaPageOperation[];
}

export const MEDIA_PAGE_CONFIG: Record<MediaPageId, MediaPageConfig> = {
  "pr-compatible": { operations: ["pr-compatible"] },
  transcode: { operations: ["transcode"] },
  remux: { operations: ["remux"] },
  extract: { operations: ["audio", "video-extract", "subtitle-extract"] },
  gif: { operations: ["gif"] },
  "image-export": { operations: ["thumbnail", "frames"] }
};

export const MEDIA_OPERATION_OPTIONS: ReadonlyArray<{
  value: MediaPageOperation;
  label: string;
}> = [
  { value: "pr-compatible", label: "PR 兼容转码" },
  { value: "transcode", label: "转码" },
  { value: "remux", label: "重新封装" },
  { value: "audio", label: "提取音频" },
  { value: "video-extract", label: "抽取视频流" },
  { value: "subtitle-extract", label: "抽取字幕" },
  { value: "thumbnail", label: "截取封面" },
  { value: "gif", label: "生成 GIF" },
  { value: "frames", label: "逐帧导出" }
];

export const CONTAINER_BY_OPERATION: Partial<Record<MediaPageOperation, string[]>> = {
  transcode: ["mov", "mp4", "mkv", "webm"],
  remux: ["mov", "mp4", "mkv", "webm"],
  audio: ["wav", "m4a", "mp3", "flac", "aiff", "ogg"],
  "video-extract": ["mp4", "mkv", "mov"],
  "subtitle-extract": ["srt", "ass"]
};

export const VIDEO_CODECS = [
  "copy",
  "libx264",
  "libx265",
  "libopenh264",
  "h264_amf",
  "hevc_amf",
  "h264_nvenc",
  "hevc_nvenc",
  "h264_qsv",
  "hevc_qsv",
  "prores_ks",
  "mpeg4",
  "libvpx-vp9",
  "libsvtav1"
];

export const AUDIO_CODECS = [
  "copy",
  "aac",
  "libmp3lame",
  "flac",
  "libopus",
  "pcm_s16le",
  "pcm_s24le"
];
