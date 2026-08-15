/**
 * music 参数模板（v2）。剔除可能含登录凭证的字段后入库：
 * cookies（明文登录态）、rawInit（-i，musicdl 侧同样承载 cookie）、rawRequests（-r，可含认证头）。
 * 旧 v1 键随旧页面退役，不迁移。
 */

export interface MusicTemplateSource {
  mode: "search" | "playlist";
  sources: string[];
  outputDirectory: string;
  searchSize: number;
  threadCount: number;
  proxy: string;
  cookies: string;
  rawInit: string;
  rawRequests: string;
  rawThreadings: string;
  rawSearchRules: string;
}

export const SENSITIVE_FIELDS = ["cookies", "rawInit", "rawRequests"] as const;

export type TemplateValue = Omit<MusicTemplateSource, (typeof SENSITIVE_FIELDS)[number]>;

export interface SavedTemplate {
  id: string;
  name: string;
  updatedAt: string;
  value: TemplateValue;
}

const STORAGE_KEY = "mad-toolbox.templates.v2.music";

export function sanitizeTemplateValue(source: MusicTemplateSource): TemplateValue {
  const { cookies: _cookies, rawInit: _rawInit, rawRequests: _rawRequests, ...rest } = source;
  return rest;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadTemplates(storage: StorageLike): SavedTemplate[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveTemplate(
  storage: StorageLike,
  name: string,
  source: MusicTemplateSource,
  now: () => string = () => new Date().toISOString()
): SavedTemplate[] {
  const next = [
    ...loadTemplates(storage).filter((t) => t.name !== name),
    { id: crypto.randomUUID(), name, updatedAt: now(), value: sanitizeTemplateValue(source) }
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
