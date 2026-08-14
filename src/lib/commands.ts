import type { ToolName } from "./types";

const SECRET_FLAGS = new Set([
  "--cookie",
  "-c",
  "--access-token",
  "-token",
  "--proxy",
  "--username",
  "--password",
  "--video-password",
  "--cookies-from-browser"
]);

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function redactProxy(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "***";
      return parsed.toString();
    }
  } catch {
    // Keep non-URL proxy strings visible.
  }
  return value;
}

export function commandPreview(tool: ToolName, args: string[]): string {
  const shown: string[] = [];
  let redactNext = false;

  for (const arg of args) {
    if (redactNext) {
      shown.push(shellQuote("***"));
      redactNext = false;
      continue;
    }
    const secretFlag =
      tool === "musicdl"
        ? ["-i", "--init-music-clients-cfg", "-r", "--requests-overrides"].includes(arg)
        : SECRET_FLAGS.has(arg);
    if (secretFlag) {
      shown.push(arg);
      redactNext = true;
      continue;
    }
    if (arg.startsWith("--proxy=")) {
      shown.push(shellQuote(`--proxy=${redactProxy(arg.slice(8))}`));
      continue;
    }
    shown.push(shellQuote(arg));
  }

  return [tool, ...shown].join(" ");
}

export interface MusicdlCliOptions {
  keyword: string;
  playlistUrl: string;
  musicSources: string[];
  initMusicClientsCfg: Record<string, unknown>;
  requestsOverrides: Record<string, unknown>;
  clientsThreadings: Record<string, unknown>;
  searchRules: Record<string, unknown>;
}

function hasKeys(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

export function buildMusicdlArgs(options: MusicdlCliOptions): string[] {
  const args: string[] = [];
  if (options.keyword.trim()) args.push("-k", options.keyword.trim());
  if (options.playlistUrl.trim()) args.push("-p", options.playlistUrl.trim());
  if (options.musicSources.length) args.push("-m", options.musicSources.join(","));
  if (hasKeys(options.initMusicClientsCfg)) {
    args.push("-i", JSON.stringify(options.initMusicClientsCfg));
  }
  if (hasKeys(options.requestsOverrides)) {
    args.push("-r", JSON.stringify(options.requestsOverrides));
  }
  if (hasKeys(options.clientsThreadings)) {
    args.push("-c", JSON.stringify(options.clientsThreadings));
  }
  if (hasKeys(options.searchRules)) {
    args.push("-s", JSON.stringify(options.searchRules));
  }
  return args;
}
