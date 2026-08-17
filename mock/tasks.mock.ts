/**
 * 浏览器预览专用任务 mock（不在 src 内，不进生产构建）。
 * 仅当 DEV 且无 Tauri internals 时由 stores/tasks.ts 动态加载，
 * 覆盖四种关键状态：成功 / 失败 / 运行中 / 中断；
 * 另附资源池定义（后端拉不到）与若干往日任务用于历史折叠区。
 */

import type { PoolDefinition } from "../src/pages/tasks/api";
import type { TaskEnvelope } from "../src/contracts/types";
import { useTasksStore } from "../src/stores/tasks";
import type { TaskLogLine } from "../src/stores/tasks.reducer";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const MOCK_POOLS: PoolDefinition[] = [
  { pool: "download", capacity: 3 },
  { pool: "local", capacity: 10 }
];

const MOCK_TASKS: TaskEnvelope[] = [
  {
    id: "mock-bili-success",
    feature: "bilibili",
    pool: "download",
    title: "【4K HDR】某个演示视频",
    status: "success",
    createdAt: minutesAgo(42),
    startedAt: minutesAgo(42),
    finishedAt: minutesAgo(38),
    tool: "BBDown",
    toolVersion: "1.6.2",
    argvRedacted: [
      "BBDown",
      "https://www.bilibili.com/video/BV1xx411c7mD",
      "--work-dir",
      "D:\\Media\\Bilibili",
      "-q",
      "8K 超高清",
      "--subtitle",
      "--danmaku"
    ],
    workingDir: "D:\\Media\\Bilibili",
    outputPaths: ["D:\\Media\\Bilibili\\【4K HDR】某个演示视频.mp4"],
    exitCode: 0,
    logPath: "C:\\Users\\demo\\AppData\\Roaming\\MAD-Toolbox\\logs\\mock-bili-success.log",
    progress: { percent: 100, detail: null },
    intent: {
      type: "form",
      data: { url: "https://www.bilibili.com/video/BV1xx411c7mD", qualityPriority: "8K 超高清" }
    }
  },
  {
    id: "mock-ytdlp-failed",
    feature: "network",
    pool: "download",
    title: "yt-dlp 演示下载（登录受限视频）",
    status: "failed",
    createdAt: minutesAgo(25),
    startedAt: minutesAgo(25),
    finishedAt: minutesAgo(24),
    tool: "yt-dlp",
    toolVersion: "2026.07.04",
    argvRedacted: [
      "yt-dlp",
      "https://www.youtube.com/watch?v=demo",
      "-f",
      "bv*+ba/b",
      "-o",
      "D:\\Media\\Network\\%(title)s.%(ext)s",
      "--ffmpeg-location",
      "…/bin/ffmpeg.exe"
    ],
    workingDir: "D:\\Media\\Network",
    outputPaths: [],
    exitCode: 1,
    logPath: "C:\\Users\\demo\\AppData\\Roaming\\MAD-Toolbox\\logs\\mock-ytdlp-failed.log",
    progress: { percent: 62, detail: null },
    intent: { type: "form", data: { url: "https://www.youtube.com/watch?v=demo" } }
  },
  {
    id: "mock-ffmpeg-running",
    feature: "media",
    pool: "local",
    title: "转码 demo_clip.mov → H.264 MP4",
    status: "running",
    createdAt: minutesAgo(6),
    startedAt: minutesAgo(6),
    finishedAt: null,
    tool: "ffmpeg",
    toolVersion: "8.1.2",
    argvRedacted: [
      "ffmpeg",
      "-i",
      "E:\\Footage\\demo_clip.mov",
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "E:\\Output\\demo_clip.mp4"
    ],
    workingDir: null,
    outputPaths: ["E:\\Output\\demo_clip.mp4"],
    exitCode: null,
    logPath: "C:\\Users\\demo\\AppData\\Roaming\\MAD-Toolbox\\logs\\mock-ffmpeg-running.log",
    intent: {
      type: "form",
      data: { input: "E:\\Footage\\demo_clip.mov", operation: "transcode", videoCodec: "libx264" }
    },
    progress: { percent: 46, detail: "frame= 4120 fps=118 q=28.0 size=   51344kB time=00:02:17" }
  },
  {
    id: "mock-musicdl-interrupted",
    feature: "music",
    pool: "download",
    title: "搜索「演示歌手」批量下载（3 首）",
    status: "interrupted",
    createdAt: minutesAgo(180),
    startedAt: minutesAgo(180),
    finishedAt: minutesAgo(176),
    tool: "musicdl",
    toolVersion: null,
    argvRedacted: [
      "musicdl",
      "-k",
      "演示歌手",
      "-s",
      "migu,netease,qqmusic",
      "-c",
      "E:\\Music\\downloads",
      "-e",
      "flac,mp3"
    ],
    workingDir: "E:\\Music\\downloads",
    outputPaths: ["E:\\Music\\downloads\\演示歌手 - 示例曲目.flac"],
    exitCode: null,
    logPath: "C:\\Users\\demo\\AppData\\Roaming\\MAD-Toolbox\\logs\\mock-musicdl-interrupted.log",
    progress: { percent: 34, detail: null },
    intent: { type: "form", data: { keyword: "演示歌手", sources: ["migu", "netease", "qqmusic"] } }
  },
  // —— 往日任务（昨日及以前，收进历史折叠区）——
  {
    id: "mock-music-playlist-history",
    feature: "music",
    pool: "download",
    title: "下载歌单「深夜写作」全部曲目",
    status: "success",
    createdAt: daysAgo(1),
    startedAt: daysAgo(1),
    finishedAt: daysAgo(1),
    tool: "musicdl",
    toolVersion: null,
    argvRedacted: ["musicdl", "-k", "深夜写作", "-c", "E:\\Music\\playlists"],
    workingDir: "E:\\Music\\playlists",
    outputPaths: ["E:\\Music\\playlists\\深夜写作.m3u"],
    exitCode: 0,
    logPath:
      "C:\\Users\\demo\\AppData\\Roaming\\MAD-Toolbox\\logs\\mock-music-playlist-history.log",
    progress: { percent: 100, detail: null },
    intent: { type: "form", data: { keyword: "深夜写作" } }
  },
  {
    id: "mock-bili-uploader-history",
    feature: "bilibili",
    pool: "download",
    title: "下载 UP 主「演示工作室」最新投稿（3P）",
    status: "success",
    createdAt: daysAgo(2),
    startedAt: daysAgo(2),
    finishedAt: daysAgo(2),
    tool: "BBDown",
    toolVersion: "1.6.2",
    argvRedacted: [
      "BBDown",
      "https://space.bilibili.com/1234567",
      "--work-dir",
      "D:\\Media\\Bilibili"
    ],
    workingDir: "D:\\Media\\Bilibili",
    outputPaths: ["D:\\Media\\Bilibili\\演示工作室合集"],
    exitCode: 0,
    logPath: "C:\\Users\\demo\\AppData\\Roaming\\MAD-Toolbox\\logs\\mock-bili-uploader-history.log",
    progress: { percent: 100, detail: null },
    intent: { type: "form", data: { url: "https://space.bilibili.com/1234567" } }
  },
  {
    id: "mock-ytdlp-mv-history",
    feature: "network",
    pool: "download",
    title: "下载 demo 现场版 MV",
    status: "canceled",
    createdAt: daysAgo(4),
    startedAt: daysAgo(4),
    finishedAt: daysAgo(4),
    tool: "yt-dlp",
    toolVersion: "2026.07.04",
    argvRedacted: [
      "yt-dlp",
      "https://www.youtube.com/watch?v=demo-live",
      "-o",
      "D:\\Media\\Network"
    ],
    workingDir: "D:\\Media\\Network",
    outputPaths: [],
    exitCode: null,
    logPath: "C:\\Users\\demo\\AppData\\Roaming\\MAD-Toolbox\\logs\\mock-ytdlp-mv-history.log",
    progress: { percent: 18, detail: null },
    intent: { type: "form", data: { url: "https://www.youtube.com/watch?v=demo-live" } }
  }
];

const MOCK_LOGS: Record<string, TaskLogLine[]> = {
  "mock-ytdlp-failed": [
    {
      stream: "stdout",
      line: "[youtube] Extracting URL: https://www.youtube.com/watch?v=demo",
      seq: 1
    },
    { stream: "stdout", line: "[youtube] demo: Downloading webpage", seq: 2 },
    { stream: "stdout", line: "[youtube] demo: Downloading ios player API JSON", seq: 3 },
    {
      stream: "stderr",
      line: "ERROR: [youtube] demo: Sign in to confirm you're not a bot.",
      seq: 4
    },
    {
      stream: "stderr",
      line: "This helps protect our community. Learn more at https://support.google.com/youtube",
      seq: 5
    },
    { stream: "stderr", line: "Hint: 使用「浏览器 Cookie」或登录后重试。", seq: 6 }
  ],
  "mock-ffmpeg-running": [
    {
      stream: "stderr",
      line: "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'E:\\Footage\\demo_clip.mov':",
      seq: 1
    },
    {
      stream: "stderr",
      line: "  Stream #0:0: Video: prores (apcn), yuv422p10le, 1920x1080, 29.97 fps",
      seq: 2
    },
    {
      stream: "stderr",
      line: "frame= 4120 fps=118 q=28.0 size=   51344kB time=00:02:17 bitrate=2049.1kbits/s speed=3.94x",
      seq: 3
    }
  ]
};

export function injectTaskMocks() {
  useTasksStore.setState({
    tasks: Object.fromEntries(MOCK_TASKS.map((task) => [task.id, task])),
    logs: MOCK_LOGS,
    ready: true
  });
}
