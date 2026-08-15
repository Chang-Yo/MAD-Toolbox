import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import type { TaskEnvelope, TaskIntent } from "../contracts/types";
import { bilibiliPreview, bilibiliSubmit, type PreviewResult } from "../pages/bilibili/api";
import { defaultBilibiliForm, type BilibiliFormState } from "../pages/bilibili/form";
import { loadTemplates, saveTemplate, type SavedTemplate } from "../pages/bilibili/templates";
import { resolveDefaultOutputDirectory } from "../lib/platform";
import { useBilibiliLoginStore } from "../stores/bilibili-login";

export interface BilibiliPageProps {
  active: boolean;
  seed?: TaskEnvelope | null;
  onSeedConsumed?: () => void;
  onRetain?: () => void;
  onSubmitted?: () => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

interface RevisionedPreview {
  revision: number;
  result: PreviewResult | null;
  error: string | null;
}

export function useBilibiliWorkspace({
  active,
  seed,
  onSeedConsumed,
  onRetain,
  onSubmitted
}: BilibiliPageProps) {
  const [form, setForm] = useState<BilibiliFormState>(defaultBilibiliForm);
  const [advancedOpen, advanced] = useDisclosure(false);
  const [expertText, setExpertTextState] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [previewState, setPreviewState] = useState<RevisionedPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templateMenuOpened, setTemplateMenuOpened] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadTemplates(localStorage));
  const loginQr = useBilibiliLoginStore((state) => state.qrDataUrl);
  const loginPhase = useBilibiliLoginStore((state) => state.phase);
  const startLogin = useBilibiliLoginStore((state) => state.start);
  const dismissLoginQr = useBilibiliLoginStore((state) => state.dismissQr);
  const draftRevisionRef = useRef(0);
  const previewStateRef = useRef<RevisionedPreview | null>(null);
  previewStateRef.current = previewState;

  const reviseDraft = () => {
    const nextRevision = draftRevisionRef.current + 1;
    draftRevisionRef.current = nextRevision;
    setDraftRevision(nextRevision);
    onRetain?.();
  };

  const update = (patch: Partial<BilibiliFormState>) => {
    reviseDraft();
    setForm((current) => ({ ...current, ...patch }));
  };

  // 输出目录默认统一到 系统「下载」/MADToolbox；程序预填不算用户编辑，不推进草稿版本
  useEffect(() => {
    let canceled = false;
    void resolveDefaultOutputDirectory().then((directory) => {
      if (canceled || !directory) return;
      setForm((current) =>
        current.outputDirectory ? current : { ...current, outputDirectory: directory }
      );
    });
    return () => {
      canceled = true;
    };
  }, []);

  const setExpertText = (value: string | null) => {
    reviseDraft();
    setExpertTextState(value);
  };

  useEffect(() => {
    if (!seed) return;
    setPreviewState(null);
    if (seed.intent.type === "form") {
      setExpertTextState(null);
      setForm({ ...defaultBilibiliForm, ...(seed.intent.data as Partial<BilibiliFormState>) });
    } else {
      setExpertTextState(seed.intent.data.argv.join("\n"));
      if (seed.intent.data.argv.some((argument) => argument === "***")) {
        notifications.show({
          color: "yellow",
          message: "手改命令中的敏感值（***）未被保存，请重新填写后再运行"
        });
      }
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

  useEffect(() => {
    if (!active) setTemplateMenuOpened(false);
  }, [active]);

  useEffect(() => {
    if (!active || expertText !== null) return;
    let canceled = false;
    const revision = draftRevision;
    const handle = window.setTimeout(() => {
      const intent: TaskIntent = { type: "form", data: { ...form } };
      bilibiliPreview(intent)
        .then((result) => {
          if (canceled) return;
          setPreviewState({ revision, result, error: null });
        })
        .catch((error) => {
          if (canceled) return;
          setPreviewState({ revision, result: null, error: String(error) });
        });
    }, 150);
    return () => {
      canceled = true;
      window.clearTimeout(handle);
    };
  }, [active, draftRevision, form, expertText]);

  const beginLogin = () => {
    void startLogin().catch((error) =>
      notifications.show({ color: "red", message: String(error) })
    );
  };

  const enterExpert = () => {
    const currentPreview = previewStateRef.current;
    if (currentPreview?.revision === draftRevisionRef.current && currentPreview.result !== null) {
      setExpertText(currentPreview.result.argv.join("\n"));
    }
  };

  const pickOutputDirectory = async () => {
    const directory = await openDialog({ directory: true });
    if (typeof directory === "string") update({ outputDirectory: directory });
  };

  const submit = async () => {
    const submittedRevision = draftRevisionRef.current;
    const intent: TaskIntent =
      expertText !== null
        ? {
            type: "manual",
            data: {
              argv: expertText
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
            }
          }
        : { type: "form", data: { ...form } };
    onRetain?.();
    setSubmitting(true);
    try {
      await bilibiliSubmit(intent);
      notifications.show({ color: "green", message: "任务已加入队列" });
      if (draftRevisionRef.current === submittedRevision) onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplate = (template: SavedTemplate) => {
    reviseDraft();
    setForm((current) => ({ ...current, ...template.value, url: current.url }));
    notifications.show({ message: `已应用模板「${template.name}」` });
  };

  const saveAsTemplate = () => {
    const name = window.prompt("模板名称");
    if (!name?.trim()) return;
    setTemplates(saveTemplate(localStorage, name.trim(), form));
    notifications.show({ message: `模板「${name.trim()}」已保存（不含登录凭证）` });
  };

  const preview = previewState?.revision === draftRevision ? previewState.result : null;
  const previewError = previewState?.revision === draftRevision ? previewState.error : null;

  return {
    active,
    form,
    update,
    advancedOpen,
    toggleAdvanced: advanced.toggle,
    expertMode: expertText !== null,
    expertText,
    setExpertText,
    enterExpert,
    preview,
    previewError,
    submitting,
    submit,
    templateMenuOpened,
    setTemplateMenuOpened,
    templates,
    applyTemplate,
    saveAsTemplate,
    loginQr,
    loginPhase,
    beginLogin,
    dismissLoginQr,
    pickOutputDirectory
  };
}
