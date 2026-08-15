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

export interface JobState {
  jobId: string;
  tool: ToolName;
  state: "running" | "completed" | "failed" | "canceled";
  exitCode: number | null;
  message: string;
}

export interface RunResult {
  jobId: string;
}

export interface TaskSubmitResult {
  taskId: string;
}

export interface AppSettings {
  defaultOutputDirectory: string | null;
  dependencyPreference: "bundled" | "system";
  proxy: string | null;
}

export interface MusicdlSearchRequest {
  keyword: string;
  musicSources: string[];
  initMusicClientsCfg: Record<string, unknown>;
  requestsOverrides: Record<string, unknown>;
  clientsThreadings: Record<string, unknown>;
  searchRules: Record<string, unknown>;
  outputDirectory: string | null;
  searchSizePerSource: number;
}

export interface MusicdlPlaylistRequest {
  playlistUrl: string;
  musicSources: string[];
  initMusicClientsCfg: Record<string, unknown>;
  requestsOverrides: Record<string, unknown>;
  clientsThreadings: Record<string, unknown>;
  searchRules: Record<string, unknown>;
  outputDirectory: string | null;
}

export interface MusicdlSearchResult {
  index: number;
  songName: string;
  singers: string;
  album: string;
  extension: string;
  fileSize: string;
  duration: string;
  bitrate: number | null;
  codec: string;
  sampleRate: number | null;
  channels: number | null;
  source: string;
  rootSource: string;
  coverUrl: string | null;
  lossless: boolean;
}

export interface MusicdlSearchResponse {
  sessionId: string;
  results: MusicdlSearchResult[];
}
