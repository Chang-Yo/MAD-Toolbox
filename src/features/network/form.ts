/**
 * network（yt-dlp）表单状态 = 后端 NetworkIntent 的 TS 镜像
 * （真相源：src-tauri/src/features/network/types.rs）。
 */

export type NetworkMode = "video" | "audio" | "thumbnail" | "subtitles";

export interface NetworkFormState {
  url: string;
  mode: NetworkMode;
  outputTemplate: string;
  outputDirectory: string;
  proxy: string;
  format: string;
  audioFormat: string;
  subtitleLanguages: string;
  cookiesBrowser: string;
  playlistItems: string;
  retries: number;
  concurrentFragments: number;
  embedMetadata: boolean;
  embedThumbnail: boolean;
  embedSubtitles: boolean;
  writeInfoJson: boolean;
  noPlaylist: boolean;
  verbose: boolean;
}

export const defaultNetworkForm: NetworkFormState = {
  url: "",
  mode: "video",
  outputTemplate: "%(title)s [%(id)s].%(ext)s",
  outputDirectory: "",
  proxy: "",
  format: "",
  audioFormat: "best",
  subtitleLanguages: "zh.*,en.*",
  cookiesBrowser: "",
  playlistItems: "",
  retries: 10,
  concurrentFragments: 4,
  embedMetadata: true,
  embedThumbnail: false,
  embedSubtitles: false,
  writeInfoJson: false,
  noPlaylist: false,
  verbose: false
};
