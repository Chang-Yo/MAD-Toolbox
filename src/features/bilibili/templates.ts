/**
 * bilibili 参数模板（v2）。与旧 TemplateManager（v1 键）无关：
 * v1 模板含明文 cookie/accessToken，不迁移，随旧页面一起退役。
 * v2 保存时剔除敏感字段与 url（url 是每次任务都不同的输入，不属于模板）。
 */

import type { BilibiliFormState } from "./form";

const STORAGE_KEY = "mad-toolbox.templates.v2.bilibili";

/** 与后端注册表的 sensitive 字段保持同步。 */
export const SENSITIVE_FIELDS = ["cookie", "accessToken"] as const;

export type TemplateValue = Omit<BilibiliFormState, "cookie" | "accessToken" | "url">;

export interface SavedTemplate {
  id: string;
  name: string;
  updatedAt: string;
  value: TemplateValue;
}

/** 纯函数：表单值 → 可入库的模板值（敏感字段与 url 被剔除）。 */
export function sanitizeTemplateValue(form: BilibiliFormState): TemplateValue {
  const { cookie: _cookie, accessToken: _accessToken, url: _url, ...rest } = form;
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
  form: BilibiliFormState,
  now: () => string = () => new Date().toISOString()
): SavedTemplate[] {
  const templates = loadTemplates(storage);
  const template: SavedTemplate = {
    id: crypto.randomUUID(),
    name,
    updatedAt: now(),
    value: sanitizeTemplateValue(form)
  };
  const next = [...templates.filter((t) => t.name !== name), template];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteTemplate(storage: StorageLike, id: string): SavedTemplate[] {
  const next = loadTemplates(storage).filter((t) => t.id !== id);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
