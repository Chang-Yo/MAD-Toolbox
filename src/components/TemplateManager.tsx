import { Check, FolderInput, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SelectInput, TextInput } from "./Field";

interface SavedTemplate<T> {
  id: string;
  name: string;
  updatedAt: string;
  value: T;
}

interface TemplateManagerProps<T> {
  featureKey: string;
  value: T;
  onApply: (value: T) => void;
}

const STORAGE_PREFIX = "mad-toolbox.setting-templates.v1.";
const LAST_SETTINGS_PREFIX = "mad-toolbox.last-settings.v1.";

function parseTemplates<T>(raw: string | null): SavedTemplate<T>[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        "value" in item
    ) as SavedTemplate<T>[];
  } catch {
    return [];
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function TemplateManager<T>({
  featureKey,
  value,
  onApply
}: TemplateManagerProps<T>) {
  const [templates, setTemplates] = useState<SavedTemplate<T>[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const restoring = useRef(true);
  const loaded = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const latestValue = useRef(value);
  latestValue.current = value;
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    let cancelled = false;
    restoring.current = true;
    loaded.current = false;
    void (async () => {
      try {
        const templatesKey = `${featureKey}.templates`;
        const lastKey = `${featureKey}.last`;
        let rawTemplates = await invoke<string | null>("secure_settings_read", {
          key: templatesKey
        });
        let rawLast = await invoke<string | null>("secure_settings_read", {
          key: lastKey
        });
        const legacyTemplates = window.localStorage.getItem(
          `${STORAGE_PREFIX}${featureKey}`
        );
        const legacyLast = window.localStorage.getItem(
          `${LAST_SETTINGS_PREFIX}${featureKey}`
        );
        if (rawTemplates === null && legacyTemplates !== null) {
          rawTemplates = legacyTemplates;
          await invoke("secure_settings_write", {
            key: templatesKey,
            value: legacyTemplates
          });
        }
        if (rawLast === null && legacyLast !== null) {
          rawLast = legacyLast;
          await invoke("secure_settings_write", {
            key: lastKey,
            value: legacyLast
          });
        }
        window.localStorage.removeItem(`${STORAGE_PREFIX}${featureKey}`);
        window.localStorage.removeItem(`${LAST_SETTINGS_PREFIX}${featureKey}`);
        if (cancelled) return;
        const stored = parseTemplates<T>(rawTemplates);
        setTemplates(stored);
        setSelectedId(stored[0]?.id ?? "");
        setName("");
        setFeedback(null);
        if (rawLast) onApplyRef.current(JSON.parse(rawLast) as T);
        loaded.current = true;
        restoring.current = false;
      } catch {
        if (cancelled) return;
        loaded.current = true;
        restoring.current = false;
        setFeedback("无法读取加密设置，已使用默认值");
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
      if (loaded.current) {
        void invoke("secure_settings_write", {
          key: `${featureKey}.last`,
          value: JSON.stringify(latestValue.current)
        });
      }
    };
  }, [featureKey]);

  useEffect(() => {
    if (restoring.current || !loaded.current) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void invoke("secure_settings_write", {
        key: `${featureKey}.last`,
        value: JSON.stringify(latestValue.current)
      }).catch(() => setFeedback("无法加密保存上次设置"));
      saveTimer.current = null;
    }, 500);
  }, [featureKey, value]);

  const persist = (next: SavedTemplate<T>[]) => {
    setTemplates(next);
    void invoke("secure_settings_write", {
      key: `${featureKey}.templates`,
      value: JSON.stringify(next)
    }).catch(() => setFeedback("无法将模板加密保存到系统凭据管理器"));
  };

  const save = () => {
    const templateName = name.trim();
    if (!templateName) {
      setFeedback("请填写模板名称");
      return;
    }
    const existing = templates.find(
      (item) => item.name.toLocaleLowerCase() === templateName.toLocaleLowerCase()
    );
    const saved: SavedTemplate<T> = {
      id:
        existing?.id ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: templateName,
      updatedAt: new Date().toISOString(),
      value: cloneValue(value)
    };
    const next = existing
      ? templates.map((item) => (item.id === existing.id ? saved : item))
      : [...templates, saved];
    persist(next);
    setSelectedId(saved.id);
    setName("");
    setFeedback(existing ? "已更新同名模板" : "模板已保存");
  };

  const load = () => {
    if (!selected) {
      setFeedback("请先选择模板");
      return;
    }
    onApply(cloneValue(selected.value));
    setFeedback(`已载入“${selected.name}”`);
  };

  const remove = () => {
    if (!selected) return;
    const next = templates.filter((item) => item.id !== selected.id);
    persist(next);
    setSelectedId(next[0]?.id ?? "");
    setFeedback(`已删除“${selected.name}”`);
  };

  return (
    <section className="template-manager">
      <div className="template-heading">
        <div>
          <strong>设置模板</strong>
          <span>上次参数和多个模板均加密保存在系统凭据管理器，可包含 Cookie；不会保存链接或输入文件。</span>
        </div>
        {feedback && (
          <span className="template-feedback">
            <Check size={13} />
            {feedback}
          </span>
        )}
      </div>
      <div className="template-controls">
        <SelectInput
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          aria-label="选择设置模板"
        >
          <option value="">选择已保存模板</option>
          {templates.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </SelectInput>
        <button
          className="secondary-button"
          type="button"
          disabled={!selected}
          onClick={load}
        >
          <FolderInput size={15} />
          载入
        </button>
        <button
          className="icon-button"
          type="button"
          title="删除当前模板"
          disabled={!selected}
          onClick={remove}
        >
          <Trash2 size={15} />
        </button>
        <TextInput
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
          placeholder="新模板名称"
          aria-label="新模板名称"
        />
        <button className="primary-button" type="button" onClick={save}>
          <Save size={15} />
          保存当前设置
        </button>
      </div>
    </section>
  );
}
