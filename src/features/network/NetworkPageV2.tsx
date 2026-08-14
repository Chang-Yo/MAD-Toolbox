/**
 * network（yt-dlp）新页面：与 bilibili 样板同构。
 * 差异点：格式/元数据是查询（结果就地弹窗展示，不进任务系统，§4.1）；
 * 浏览器 Cookie 是"要求登录时的自动兜底"（主跑不带，失败重试带上，§2）。
 */

import {
  Button,
  Card,
  Collapse,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  IconFolderOpen,
  IconInfoCircle,
  IconListDetails,
  IconPencil,
  IconRotate
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { CommandPreview } from "../../components/CommandPreview";
import type { TaskEnvelope, TaskIntent } from "../../contracts/types";
import { browserCookieOptions } from "../../lib/platform";
import {
  networkPreview,
  networkProbe,
  networkSubmit,
  type PreviewResult,
  type ProbeKind
} from "./api";
import { defaultNetworkForm, type NetworkFormState } from "./form";

const MODE_OPTIONS = [
  { value: "video", label: "视频" },
  { value: "audio", label: "仅音频" },
  { value: "thumbnail", label: "仅封面" },
  { value: "subtitles", label: "仅字幕" }
];

interface NetworkPageV2Props {
  seed?: TaskEnvelope | null;
  onSeedConsumed?: () => void;
  onSubmitted?: () => void;
}

export function NetworkPageV2({ seed, onSeedConsumed, onSubmitted }: NetworkPageV2Props) {
  const [form, setForm] = useState<NetworkFormState>(defaultNetworkForm);
  const [advancedOpen, advanced] = useDisclosure(false);
  const [expertText, setExpertText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [probeResult, setProbeResult] = useState<{ title: string; text: string } | null>(null);
  const [probing, setProbing] = useState<ProbeKind | null>(null);
  const previewRef = useRef<PreviewResult | null>(null);
  previewRef.current = preview;

  const update = (patch: Partial<NetworkFormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (!seed) return;
    if (seed.intent.type === "form") {
      setExpertText(null);
      setForm({ ...defaultNetworkForm, ...(seed.intent.data as Partial<NetworkFormState>) });
    } else {
      setExpertText(seed.intent.data.argv.join("\n"));
      if (seed.intent.data.argv.some((a) => a === "***")) {
        notifications.show({
          color: "yellow",
          message: "手改命令中的敏感值（***）未被保存，请重新填写后再运行"
        });
      }
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

  useEffect(() => {
    if (expertText !== null) return;
    const handle = window.setTimeout(() => {
      const intent: TaskIntent = { type: "form", data: { ...form } };
      networkPreview(intent)
        .then((result) => {
          setPreview(result);
          setPreviewError(null);
        })
        .catch((error) => {
          setPreview(null);
          setPreviewError(String(error));
        });
    }, 150);
    return () => window.clearTimeout(handle);
  }, [form, expertText]);

  const submit = async () => {
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
    setSubmitting(true);
    try {
      await networkSubmit(intent);
      notifications.show({ color: "green", message: "任务已加入队列" });
      onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const probe = async (kind: ProbeKind) => {
    setProbing(kind);
    try {
      const text = await networkProbe({ type: "form", data: { ...form } }, kind);
      setProbeResult({ title: kind === "formats" ? "可用格式" : "元数据", text });
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setProbing(null);
    }
  };

  const pickOutputDirectory = async () => {
    const dir = await openDialog({ directory: true });
    if (typeof dir === "string") update({ outputDirectory: dir });
  };

  const expertMode = expertText !== null;

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={3}>网络视频下载</Title>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconListDetails size={16} />}
            loading={probing === "formats"}
            disabled={!form.url.trim() || expertMode}
            onClick={() => void probe("formats")}
          >
            查看格式
          </Button>
          <Button
            variant="default"
            leftSection={<IconInfoCircle size={16} />}
            loading={probing === "metadata"}
            disabled={!form.url.trim() || expertMode}
            onClick={() => void probe("metadata")}
          >
            查看元数据
          </Button>
        </Group>
      </Group>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <TextInput
            label="视频地址"
            placeholder="https://…（YouTube 及 yt-dlp 支持的站点）"
            value={form.url}
            onChange={(e) => update({ url: e.currentTarget.value })}
            disabled={expertMode}
          />
          <Group grow align="end">
            <div>
              <Text size="sm" fw={500} mb={4}>
                下载内容
              </Text>
              <SegmentedControl
                data={MODE_OPTIONS}
                value={form.mode}
                onChange={(value) => update({ mode: value as NetworkFormState["mode"] })}
                disabled={expertMode}
                fullWidth
              />
            </div>
            <Select
              label="浏览器 Cookie（站点要求登录时自动兜底）"
              data={browserCookieOptions}
              value={form.cookiesBrowser}
              onChange={(value) => update({ cookiesBrowser: value ?? "" })}
              disabled={expertMode}
              allowDeselect={false}
            />
          </Group>
          {form.mode === "audio" && (
            <TextInput
              label="音频格式"
              placeholder="best / mp3 / m4a / flac …"
              value={form.audioFormat}
              onChange={(e) => update({ audioFormat: e.currentTarget.value })}
              disabled={expertMode}
            />
          )}
          {form.mode === "subtitles" && (
            <TextInput
              label="字幕语言"
              placeholder="如 zh.*,en.*"
              value={form.subtitleLanguages}
              onChange={(e) => update({ subtitleLanguages: e.currentTarget.value })}
              disabled={expertMode}
            />
          )}
          <TextInput
            label="输出目录"
            value={form.outputDirectory}
            onChange={(e) => update({ outputDirectory: e.currentTarget.value })}
            disabled={expertMode}
            rightSection={
              <Tooltip label="选择目录">
                <IconFolderOpen
                  size={16}
                  style={{ cursor: "pointer" }}
                  onClick={() => void pickOutputDirectory()}
                />
              </Tooltip>
            }
          />
          <Group grow>
            <TextInput
              label="代理"
              placeholder="留空使用系统代理"
              value={form.proxy}
              onChange={(e) => update({ proxy: e.currentTarget.value })}
              disabled={expertMode}
            />
            <TextInput
              label="播放列表选集"
              placeholder="如 1,3-5"
              value={form.playlistItems}
              onChange={(e) => update({ playlistItems: e.currentTarget.value })}
              disabled={expertMode}
            />
          </Group>
          <Group gap="lg">
            <Switch
              label="仅下载单个视频"
              checked={form.noPlaylist}
              onChange={(e) => update({ noPlaylist: e.currentTarget.checked })}
              disabled={expertMode}
            />
            <Switch
              label="内嵌元数据"
              checked={form.embedMetadata}
              onChange={(e) => update({ embedMetadata: e.currentTarget.checked })}
              disabled={expertMode}
            />
            <Switch
              label="内嵌封面"
              checked={form.embedThumbnail}
              onChange={(e) => update({ embedThumbnail: e.currentTarget.checked })}
              disabled={expertMode}
            />
            <Switch
              label="内嵌字幕"
              checked={form.embedSubtitles}
              onChange={(e) => update({ embedSubtitles: e.currentTarget.checked })}
              disabled={expertMode}
            />
          </Group>

          <Button
            variant="subtle"
            size="compact-sm"
            onClick={advanced.toggle}
            disabled={expertMode}
          >
            {advancedOpen ? "收起高级参数" : "展开高级参数"}
          </Button>
          <Collapse expanded={advancedOpen && !expertMode}>
            <Stack gap="sm">
              <Group grow>
                <TextInput
                  label="输出文件名模板"
                  value={form.outputTemplate}
                  onChange={(e) => update({ outputTemplate: e.currentTarget.value })}
                  disabled={expertMode}
                />
                <TextInput
                  label="格式选择表达式"
                  placeholder="如 bv*+ba/b"
                  value={form.format}
                  onChange={(e) => update({ format: e.currentTarget.value })}
                  disabled={expertMode}
                />
              </Group>
              <Group grow>
                <NumberInput
                  label="重试次数"
                  min={0}
                  value={form.retries}
                  onChange={(value) => update({ retries: typeof value === "number" ? value : 10 })}
                  disabled={expertMode}
                />
                <NumberInput
                  label="并行分片数"
                  min={1}
                  value={form.concurrentFragments}
                  onChange={(value) =>
                    update({ concurrentFragments: typeof value === "number" ? value : 4 })
                  }
                  disabled={expertMode}
                />
              </Group>
              <Group gap="lg">
                <Switch
                  label="输出 info.json"
                  checked={form.writeInfoJson}
                  onChange={(e) => update({ writeInfoJson: e.currentTarget.checked })}
                  disabled={expertMode}
                />
                <Switch
                  label="详细日志"
                  checked={form.verbose}
                  onChange={(e) => update({ verbose: e.currentTarget.checked })}
                  disabled={expertMode}
                />
              </Group>
            </Stack>
          </Collapse>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {expertMode ? "命令（可编辑，每行一个参数）" : "命令预览"}
            </Text>
            {expertMode ? (
              <Button
                size="compact-sm"
                variant="light"
                leftSection={<IconRotate size={14} />}
                onClick={() => setExpertText(null)}
              >
                还原为表单
              </Button>
            ) : (
              <Button
                size="compact-sm"
                variant="light"
                leftSection={<IconPencil size={14} />}
                onClick={() =>
                  previewRef.current && setExpertText(previewRef.current.argv.join("\n"))
                }
                disabled={!preview}
              >
                编辑命令
              </Button>
            )}
          </Group>
          {expertMode ? (
            <>
              <Text size="xs" c="yellow">
                专家模式：表单已锁定，提交将按下方命令原文执行（yt-dlp 本体不可更换）
              </Text>
              <Textarea
                autosize
                minRows={4}
                value={expertText ?? ""}
                onChange={(e) => setExpertText(e.currentTarget.value)}
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </>
          ) : (
            <CommandPreview display={preview?.display ?? null} error={previewError} />
          )}
          <Group justify="end">
            <Button
              onClick={() => void submit()}
              loading={submitting}
              disabled={!expertMode && !preview}
            >
              添加到任务队列
            </Button>
          </Group>
        </Stack>
      </Card>

      <Modal
        opened={probeResult !== null}
        onClose={() => setProbeResult(null)}
        title={probeResult?.title}
        size="xl"
      >
        <ScrollArea h={420}>
          <Text
            size="xs"
            component="pre"
            style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
          >
            {probeResult?.text}
          </Text>
        </ScrollArea>
      </Modal>
    </Stack>
  );
}
