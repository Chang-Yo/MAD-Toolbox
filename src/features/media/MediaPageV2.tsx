/**
 * media 新页面：合并旧"媒体转换/封装与抽流"双入口为单页多操作（旧双入口是 §0 批评的冗余导航）。
 * PR 兼容是探测驱动的编排（专用提交通道，无命令预览——每个文件的命令由探测结果决定）；
 * 其余操作走标准 意图 → adapter → 任务 通路，本地处理池。
 */

import {
  Badge,
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
  IconPencil,
  IconRotate,
  IconVideo,
  IconX
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { CommandPreview } from "../../components/CommandPreview";
import type { TaskEnvelope, TaskIntent } from "../../contracts/types";
import {
  ffmpegEncoders,
  inspectMedia,
  mediaPreview,
  mediaPrSubmit,
  mediaSubmit,
  type PreviewResult
} from "./api";
import { defaultMediaForm, type MediaFormState, type MediaOperation } from "./form";

type PageOperation = MediaOperation | "pr-compatible";

const OPERATION_OPTIONS: Array<{ value: PageOperation; label: string }> = [
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

const CONTAINER_BY_OPERATION: Partial<Record<PageOperation, string[]>> = {
  transcode: ["mov", "mp4", "mkv", "webm"],
  remux: ["mov", "mp4", "mkv", "webm"],
  audio: ["wav", "m4a", "mp3", "flac", "aiff", "ogg"],
  "video-extract": ["mp4", "mkv", "mov"],
  "subtitle-extract": ["srt", "ass"]
};

const VIDEO_CODECS = [
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
const AUDIO_CODECS = ["copy", "aac", "libmp3lame", "flac", "libopus", "pcm_s16le", "pcm_s24le"];

interface MediaPageV2Props {
  seed?: TaskEnvelope | null;
  onSeedConsumed?: () => void;
  onSubmitted?: () => void;
}

export function MediaPageV2({ seed, onSeedConsumed, onSubmitted }: MediaPageV2Props) {
  const [inputs, setInputs] = useState<string[]>([]);
  const [operation, setOperation] = useState<PageOperation>("pr-compatible");
  const [form, setForm] = useState<MediaFormState>(defaultMediaForm);
  const [encoders, setEncoders] = useState<string[]>([]);
  const [advancedOpen, advanced] = useDisclosure(false);
  const [expertText, setExpertText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inspection, setInspection] = useState<string | null>(null);
  const previewRef = useRef<PreviewResult | null>(null);
  previewRef.current = preview;

  const update = (patch: Partial<MediaFormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    void ffmpegEncoders()
      .then(setEncoders)
      .catch(() => {});
  }, []);

  // 种子灌回（重跑）：pr 标记走 pr 通道，其余恢复表单
  useEffect(() => {
    if (!seed) return;
    if (seed.intent.type === "form") {
      const data = seed.intent.data as Record<string, unknown>;
      if (data.prCompatible === true) {
        setOperation("pr-compatible");
        setInputs(typeof data.input === "string" ? [data.input] : []);
        setForm((current) => ({
          ...current,
          outputDirectory: typeof data.outputDirectory === "string" ? data.outputDirectory : ""
        }));
      } else {
        const restored = { ...defaultMediaForm, ...(data as Partial<MediaFormState>) };
        setOperation(restored.operation);
        setForm(restored);
        setInputs(restored.input ? [restored.input] : []);
      }
      setExpertText(null);
    } else {
      setExpertText(seed.intent.data.argv.join("\n"));
    }
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);

  const firstInput = inputs[0] ?? "";
  const isPr = operation === "pr-compatible";

  // 常驻预览：首个输入文件的翻译结果（多文件时其余文件同参数、仅路径不同）
  useEffect(() => {
    if (expertText !== null || isPr) return;
    if (!firstInput) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const intent: TaskIntent = {
        type: "form",
        data: { ...form, operation, input: firstInput }
      };
      mediaPreview(intent)
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
  }, [form, operation, firstInput, expertText, isPr]);

  const addFiles = async () => {
    const selected = await openDialog({ multiple: true });
    const picked = Array.isArray(selected) ? selected : selected ? [selected] : [];
    if (picked.length) setInputs((current) => [...new Set([...current, ...picked])]);
  };

  const addDirectory = async () => {
    const selected = await openDialog({ directory: true });
    if (typeof selected === "string") setInputs((current) => [...new Set([...current, selected])]);
  };

  const pickOutputDirectory = async () => {
    const dir = await openDialog({ directory: true });
    if (typeof dir === "string") update({ outputDirectory: dir });
  };

  const inspectFirst = async () => {
    if (!firstInput) return;
    try {
      const result = await inspectMedia(firstInput);
      setInspection(result.summary);
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (expertText !== null) {
        const argv = expertText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        await mediaSubmit([], { type: "manual", data: { argv } });
      } else if (isPr) {
        for (const input of inputs) {
          await mediaPrSubmit(input, form.outputDirectory.trim() || null);
        }
      } else {
        await mediaSubmit(inputs, {
          type: "form",
          data: { ...form, operation, input: "" }
        });
      }
      notifications.show({ color: "green", message: "任务已加入队列" });
      onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const expertMode = expertText !== null;
  const containers = CONTAINER_BY_OPERATION[operation];
  const showCodecs = operation === "transcode" || operation === "remux";
  const availableVideoCodecs = VIDEO_CODECS.filter(
    (codec) => codec === "copy" || encoders.length === 0 || encoders.includes(codec)
  );
  const availableAudioCodecs = AUDIO_CODECS.filter(
    (codec) => codec === "copy" || encoders.length === 0 || encoders.includes(codec)
  );

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={3}>媒体处理</Title>
        <Button
          variant="default"
          leftSection={<IconInfoCircle size={16} />}
          disabled={!firstInput}
          onClick={() => void inspectFirst()}
        >
          检视首个文件
        </Button>
      </Group>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group>
            <Button
              variant="light"
              leftSection={<IconVideo size={16} />}
              onClick={() => void addFiles()}
            >
              添加文件
            </Button>
            <Button
              variant="light"
              leftSection={<IconFolderOpen size={16} />}
              onClick={() => void addDirectory()}
            >
              添加目录
            </Button>
            {inputs.length > 0 && (
              <Text size="sm" c="dimmed">
                共 {inputs.length} 项（目录提交时自动展开）
              </Text>
            )}
          </Group>
          {inputs.length > 0 && (
            <Stack gap={4}>
              {inputs.map((path) => (
                <Group key={path} gap="xs" wrap="nowrap">
                  <Badge
                    variant="light"
                    color="teal"
                    style={{ textTransform: "none", maxWidth: "85%" }}
                  >
                    {path}
                  </Badge>
                  <IconX
                    size={14}
                    style={{ cursor: "pointer" }}
                    onClick={() => setInputs((current) => current.filter((p) => p !== path))}
                  />
                </Group>
              ))}
            </Stack>
          )}

          <Select
            label="操作"
            data={OPERATION_OPTIONS}
            value={operation}
            onChange={(value) => value && setOperation(value as PageOperation)}
            disabled={expertMode}
            allowDeselect={false}
          />
          <TextInput
            label="输出目录"
            placeholder={isPr ? "留空则输出到源文件目录" : "留空则输出到源文件目录"}
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

          {!isPr && (
            <>
              <Group grow>
                {containers && (
                  <Select
                    label="输出容器"
                    data={containers}
                    value={containers.includes(form.container) ? form.container : containers[0]}
                    onChange={(value) => value && update({ container: value })}
                    disabled={expertMode}
                    allowDeselect={false}
                  />
                )}
                {showCodecs && (
                  <Select
                    label="视频编码"
                    data={availableVideoCodecs}
                    value={form.videoCodec}
                    onChange={(value) => value && update({ videoCodec: value })}
                    disabled={expertMode}
                    allowDeselect={false}
                  />
                )}
                {(showCodecs || operation === "audio") && (
                  <Select
                    label="音频编码"
                    data={availableAudioCodecs}
                    value={form.audioCodec}
                    onChange={(value) => value && update({ audioCodec: value })}
                    disabled={expertMode}
                    allowDeselect={false}
                  />
                )}
              </Group>
              <Group grow>
                <TextInput
                  label="起始时间"
                  placeholder="如 00:01:30"
                  value={form.startTime}
                  onChange={(e) => update({ startTime: e.currentTarget.value })}
                  disabled={expertMode}
                />
                <TextInput
                  label="持续时长"
                  placeholder="如 00:00:10"
                  value={form.duration}
                  onChange={(e) => update({ duration: e.currentTarget.value })}
                  disabled={expertMode}
                />
              </Group>
              {operation === "gif" && (
                <Group grow>
                  <NumberInput
                    label="GIF 帧率"
                    min={1}
                    value={form.gifFps}
                    onChange={(value) => update({ gifFps: typeof value === "number" ? value : 12 })}
                    disabled={expertMode}
                  />
                  <NumberInput
                    label="GIF 宽度"
                    min={16}
                    value={form.gifWidth}
                    onChange={(value) =>
                      update({ gifWidth: typeof value === "number" ? value : 720 })
                    }
                    disabled={expertMode}
                  />
                </Group>
              )}
              {(operation === "video-extract" ||
                operation === "audio" ||
                operation === "subtitle-extract") && (
                <TextInput
                  label="流序号"
                  description="同类型流的序号，从 0 开始"
                  value={
                    operation === "audio"
                      ? form.audioStreamIndex
                      : operation === "video-extract"
                        ? form.videoStreamIndex
                        : form.subtitleStreamIndex
                  }
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    if (operation === "audio") update({ audioStreamIndex: value });
                    else if (operation === "video-extract") update({ videoStreamIndex: value });
                    else update({ subtitleStreamIndex: value });
                  }}
                  disabled={expertMode}
                />
              )}
              <Group gap="lg">
                <Switch
                  label="保留全部流"
                  checked={form.mapAll}
                  onChange={(e) => update({ mapAll: e.currentTarget.checked })}
                  disabled={expertMode}
                />
                <Switch
                  label="保留元数据与章节"
                  checked={form.preserveMetadata}
                  onChange={(e) => update({ preserveMetadata: e.currentTarget.checked })}
                  disabled={expertMode}
                />
                <Switch
                  label="覆盖已存在文件"
                  checked={form.overwrite}
                  onChange={(e) => update({ overwrite: e.currentTarget.checked })}
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
                      label="缩放宽度"
                      placeholder="留空保持"
                      value={form.width}
                      onChange={(e) => update({ width: e.currentTarget.value })}
                    />
                    <TextInput
                      label="缩放高度"
                      placeholder="留空保持"
                      value={form.height}
                      onChange={(e) => update({ height: e.currentTarget.value })}
                    />
                    <TextInput
                      label="帧率"
                      value={form.frameRate}
                      onChange={(e) => update({ frameRate: e.currentTarget.value })}
                    />
                    <NumberInput
                      label="倍速"
                      step={0.25}
                      min={0.25}
                      value={form.speed}
                      onChange={(value) => update({ speed: typeof value === "number" ? value : 1 })}
                    />
                  </Group>
                  <Group grow>
                    <TextInput
                      label="视频码率"
                      placeholder="如 8M"
                      value={form.videoBitrate}
                      onChange={(e) => update({ videoBitrate: e.currentTarget.value })}
                    />
                    <TextInput
                      label="CRF"
                      value={form.crf}
                      onChange={(e) => update({ crf: e.currentTarget.value })}
                    />
                    <TextInput
                      label="音频码率"
                      value={form.audioBitrate}
                      onChange={(e) => update({ audioBitrate: e.currentTarget.value })}
                    />
                    <TextInput
                      label="采样率"
                      placeholder="如 48000"
                      value={form.sampleRate}
                      onChange={(e) => update({ sampleRate: e.currentTarget.value })}
                    />
                  </Group>
                  <Group grow align="end">
                    <Select
                      label="旋转"
                      data={[
                        { value: "none", label: "不旋转" },
                        { value: "90cw", label: "顺时针 90°" },
                        { value: "90ccw", label: "逆时针 90°" },
                        { value: "180", label: "180°" }
                      ]}
                      value={form.rotation}
                      onChange={(value) => value && update({ rotation: value })}
                      allowDeselect={false}
                    />
                    <TextInput
                      label="裁剪"
                      placeholder="如 1920:800:0:140"
                      value={form.crop}
                      onChange={(e) => update({ crop: e.currentTarget.value })}
                    />
                    <TextInput
                      label="音量"
                      placeholder="如 1.5 或 -3dB"
                      value={form.volume}
                      onChange={(e) => update({ volume: e.currentTarget.value })}
                    />
                  </Group>
                  <Group gap="lg">
                    <Switch
                      label="去隔行"
                      checked={form.deinterlace}
                      onChange={(e) => update({ deinterlace: e.currentTarget.checked })}
                    />
                    <Switch
                      label="水平翻转"
                      checked={form.flipHorizontal}
                      onChange={(e) => update({ flipHorizontal: e.currentTarget.checked })}
                    />
                    <Switch
                      label="垂直翻转"
                      checked={form.flipVertical}
                      onChange={(e) => update({ flipVertical: e.currentTarget.checked })}
                    />
                    <Switch
                      label="响度归一化"
                      checked={form.loudnessNormalization}
                      onChange={(e) => update({ loudnessNormalization: e.currentTarget.checked })}
                    />
                    <Switch
                      label="faststart"
                      checked={form.fastStart}
                      onChange={(e) => update({ fastStart: e.currentTarget.checked })}
                    />
                  </Group>
                </Stack>
              </Collapse>
            </>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {isPr
                ? "PR 兼容转码"
                : expertMode
                  ? "命令（可编辑，每行一个参数）"
                  : "命令预览（首个文件）"}
            </Text>
            {!isPr &&
              (expertMode ? (
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
              ))}
          </Group>
          {isPr ? (
            <Text size="sm" c="dimmed">
              逐文件探测流信息后自动决定容器与编码（H.264/HEVC → MP4 直拷，其余转 ProRes/MOV；
              纯音频按无损/有损选 WAV/M4A）。命令由探测结果决定，提交后可在任务详情查看。
            </Text>
          ) : expertMode ? (
            <>
              <Text size="xs" c="yellow">
                专家模式：表单已锁定，提交将按下方命令原文执行（ffmpeg 本体不可更换）
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
              disabled={expertMode ? false : inputs.length === 0}
            >
              添加到任务队列
            </Button>
          </Group>
        </Stack>
      </Card>

      <Modal
        opened={inspection !== null}
        onClose={() => setInspection(null)}
        title="媒体信息"
        size="lg"
      >
        <ScrollArea h={360}>
          <Text size="xs" component="pre" style={{ whiteSpace: "pre-wrap" }}>
            {inspection}
          </Text>
        </ScrollArea>
      </Modal>
    </Stack>
  );
}
