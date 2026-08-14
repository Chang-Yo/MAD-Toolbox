/**
 * bilibili 新页面（样板）：结构化意图 → 后端 adapter → 任务系统 的前端半边。
 * - 命令预览由后端 adapter 返回（§5 所见即所执行），前端零 argv 拼装；
 * - 专家模式：表单为源、命令为影，单向绑定 + 显式分叉，无反向解析；
 * - 表单只渲染高频层，长尾折叠进高级区，更长尾由专家模式承接；
 * - 登录复用原生扫码 command 与 bbdown-login-qr 事件，不做日志字符串刮取。
 */

import {
  Button,
  Card,
  Collapse,
  Group,
  Menu,
  Modal,
  PasswordInput,
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
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  IconChevronDown,
  IconDeviceFloppy,
  IconFolderOpen,
  IconPencil,
  IconQrcode,
  IconRotate
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { CommandPreview } from "../../components/CommandPreview";
import type { TaskEnvelope, TaskIntent } from "../../contracts/types";
import { bilibiliPreview, bilibiliSubmit, type PreviewResult } from "./api";
import { defaultBilibiliForm, type BilibiliFormState } from "./form";
import { loadTemplates, saveTemplate, type SavedTemplate } from "./templates";

const MODE_OPTIONS = [
  { value: "video", label: "完整视频" },
  { value: "video-only", label: "仅视频轨" },
  { value: "audio", label: "仅音频" },
  { value: "cover", label: "仅封面" },
  { value: "subtitle", label: "仅字幕" },
  { value: "danmaku", label: "仅弹幕" },
  { value: "info", label: "仅解析信息" }
];

const API_OPTIONS = [
  { value: "web", label: "Web" },
  { value: "tv", label: "TV" },
  { value: "app", label: "APP" },
  { value: "intl", label: "国际版" }
];

const COMMON_SWITCHES: Array<[keyof BilibiliFormState, string]> = [
  ["downloadDanmaku", "同时下载弹幕"],
  ["skipSubtitle", "跳过字幕"],
  ["skipCover", "跳过封面"],
  ["skipAi", "跳过 AI 字幕"]
];

const ADVANCED_SWITCHES: Array<[keyof BilibiliFormState, string]> = [
  ["useMp4box", "使用 MP4Box 混流"],
  ["useAria2c", "使用 aria2c 下载"],
  ["showAll", "展示所有分 P"],
  ["hideStreams", "不显示流信息"],
  ["skipMux", "跳过混流"],
  ["multiThread", "多线程下载"],
  ["forceHttp", "强制 HTTP"],
  ["videoAscending", "视频流升序"],
  ["audioAscending", "音频流升序"],
  ["allowPcdn", "允许 PCDN"],
  ["forceReplaceHost", "强制替换 host"],
  ["saveArchive", "记录下载存档"],
  ["debug", "调试日志"]
];

const ADVANCED_VALUES: Array<[keyof BilibiliFormState, string, string]> = [
  ["filePattern", "单集文件名模板", ""],
  ["multiFilePattern", "多集文件名模板", ""],
  ["language", "语言偏好", ""],
  ["userAgent", "User-Agent", ""],
  ["aria2cArgs", "aria2c 参数", ""],
  ["mp4boxPath", "MP4Box 路径", ""],
  ["aria2cPath", "aria2c 路径", ""],
  ["uposHost", "upos 服务器", ""],
  ["delayPerPage", "分 P 间隔秒数", ""],
  ["host", "API host", ""],
  ["epHost", "番剧 API host", ""],
  ["area", "番剧地区", "hk / tw / th"],
  ["configFile", "配置文件路径", ""]
];

interface LoginQrPayload {
  jobId: string;
  dataUrl: string;
}

interface JobStatePayload {
  jobId: string;
  tool: string;
  state: string;
  message: string;
}

interface BilibiliPageV2Props {
  /** [基于此任务新建]/[再次运行] 的种子：Form 灌回表单，Manual 灌回专家文本框（§4.2）。 */
  seed?: TaskEnvelope | null;
  onSeedConsumed?: () => void;
  onSubmitted?: () => void;
}

export function BilibiliPageV2({ seed, onSeedConsumed, onSubmitted }: BilibiliPageV2Props) {
  const [form, setForm] = useState<BilibiliFormState>(defaultBilibiliForm);
  const [advancedOpen, advanced] = useDisclosure(false);
  /** null = 表单模式；string = 专家模式文本（每行一个参数）。 */
  const [expertText, setExpertText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loginQr, setLoginQr] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadTemplates(localStorage));
  const previewRef = useRef<PreviewResult | null>(null);
  previewRef.current = preview;

  const update = (patch: Partial<BilibiliFormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  // 种子灌回：Form → 表单；Manual → 专家文本框（脱敏后的 *** 需重填，予以提示）
  useEffect(() => {
    if (!seed) return;
    if (seed.intent.type === "form") {
      setExpertText(null);
      setForm({ ...defaultBilibiliForm, ...(seed.intent.data as Partial<BilibiliFormState>) });
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

  // 常驻只读预览：防抖调后端 adapter（表单模式才跟随）
  useEffect(() => {
    if (expertText !== null) return;
    const handle = window.setTimeout(() => {
      const intent: TaskIntent = { type: "form", data: { ...form } };
      bilibiliPreview(intent)
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

  // 登录二维码事件 + 登录任务结束时收起二维码
  useEffect(() => {
    const unlistenQr = listen<LoginQrPayload>("bbdown-login-qr", (event) => {
      setLoginQr(event.payload.dataUrl);
    });
    const unlistenState = listen<JobStatePayload>("job-state", (event) => {
      const { tool, state, message } = event.payload;
      if (tool === "bbdown" && state !== "running") {
        setLoginQr((current) => {
          if (current !== null) {
            notifications.show({
              color: state === "completed" ? "green" : "red",
              message
            });
          }
          return null;
        });
      }
    });
    return () => {
      void unlistenQr.then((fn) => fn());
      void unlistenState.then((fn) => fn());
    };
  }, []);

  const beginLogin = () => {
    void invoke("bilibili_login_start").catch((error) =>
      notifications.show({ color: "red", message: String(error) })
    );
  };

  const enterExpert = () => {
    if (previewRef.current) {
      setExpertText(previewRef.current.argv.join("\n"));
    }
  };

  const pickOutputDirectory = async () => {
    const dir = await openDialog({ directory: true });
    if (typeof dir === "string") update({ outputDirectory: dir });
  };

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
      await bilibiliSubmit(intent);
      notifications.show({ color: "green", message: "任务已加入队列" });
      onSubmitted?.();
    } catch (error) {
      notifications.show({ color: "red", message: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplate = (template: SavedTemplate) => {
    setForm((current) => ({ ...current, ...template.value, url: current.url }));
    notifications.show({ message: `已应用模板「${template.name}」` });
  };

  const saveAsTemplate = () => {
    const name = window.prompt("模板名称");
    if (!name?.trim()) return;
    setTemplates(saveTemplate(localStorage, name.trim(), form));
    notifications.show({ message: `模板「${name.trim()}」已保存（不含登录凭证）` });
  };

  const expertMode = expertText !== null;

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={3}>哔哩哔哩下载</Title>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconQrcode size={16} />} onClick={beginLogin}>
            扫码登录
          </Button>
          <Menu>
            <Menu.Target>
              <Button variant="default" rightSection={<IconChevronDown size={14} />}>
                模板
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={saveAsTemplate}>
                保存当前设置为模板
              </Menu.Item>
              {templates.length > 0 && <Menu.Divider />}
              {templates.map((template) => (
                <Menu.Item key={template.id} onClick={() => applyTemplate(template)}>
                  {template.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <TextInput
            label="视频地址"
            placeholder="https://www.bilibili.com/video/BV… 或 BV/av/ep/ss 号"
            value={form.url}
            onChange={(e) => update({ url: e.currentTarget.value })}
            disabled={expertMode}
          />
          <Group grow align="end">
            <Select
              label="下载内容"
              data={MODE_OPTIONS}
              value={form.mode}
              onChange={(value) => value && update({ mode: value as BilibiliFormState["mode"] })}
              disabled={expertMode}
              allowDeselect={false}
            />
            <div>
              <Text size="sm" fw={500} mb={4}>
                解析接口
              </Text>
              <SegmentedControl
                data={API_OPTIONS}
                value={form.api}
                onChange={(value) => update({ api: value as BilibiliFormState["api"] })}
                disabled={expertMode}
                fullWidth
              />
            </div>
          </Group>
          <Group grow>
            <TextInput
              label="选集"
              placeholder="如 1,3-5 或 ALL"
              value={form.pages}
              onChange={(e) => update({ pages: e.currentTarget.value })}
              disabled={expertMode}
            />
            <TextInput
              label="画质优先级"
              placeholder="如 8K 超高清,1080P 高清"
              value={form.qualityPriority}
              onChange={(e) => update({ qualityPriority: e.currentTarget.value })}
              disabled={expertMode}
            />
            <TextInput
              label="编码优先级"
              placeholder="如 hevc,av1,avc"
              value={form.encodingPriority}
              onChange={(e) => update({ encodingPriority: e.currentTarget.value })}
              disabled={expertMode}
            />
          </Group>
          <TextInput
            label="输出目录"
            placeholder="留空使用 BBDown 默认目录"
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
          <Group gap="lg">
            {COMMON_SWITCHES.map(([key, label]) => (
              <Switch
                key={key}
                label={label}
                checked={form[key] as boolean}
                onChange={(e) => update({ [key]: e.currentTarget.checked })}
                disabled={expertMode}
              />
            ))}
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
              <Group gap="lg">
                {ADVANCED_SWITCHES.map(([key, label]) => (
                  <Switch
                    key={key}
                    label={label}
                    checked={form[key] as boolean}
                    onChange={(e) => update({ [key]: e.currentTarget.checked })}
                    disabled={expertMode}
                  />
                ))}
              </Group>
              <Group grow>
                <PasswordInput
                  label="Cookie"
                  description="扫码登录后通常无需手填"
                  value={form.cookie}
                  onChange={(e) => update({ cookie: e.currentTarget.value })}
                  disabled={expertMode}
                />
                <PasswordInput
                  label="Access Token"
                  description="仅 TV/APP/国际版接口需要"
                  value={form.accessToken}
                  onChange={(e) => update({ accessToken: e.currentTarget.value })}
                  disabled={expertMode}
                />
              </Group>
              {chunk(ADVANCED_VALUES, 3).map((row, index) => (
                <Group grow key={index}>
                  {row.map(([key, label, placeholder]) => (
                    <TextInput
                      key={key}
                      label={label}
                      placeholder={placeholder}
                      value={form[key] as string}
                      onChange={(e) => update({ [key]: e.currentTarget.value })}
                      disabled={expertMode}
                    />
                  ))}
                </Group>
              ))}
              <Textarea
                label="附加参数"
                description="每行一条，原样传给 BBDown"
                autosize
                minRows={2}
                value={form.extraArgs}
                onChange={(e) => update({ extraArgs: e.currentTarget.value })}
                disabled={expertMode}
              />
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
                onClick={enterExpert}
                disabled={!preview}
              >
                编辑命令
              </Button>
            )}
          </Group>
          {expertMode ? (
            <>
              <Text size="xs" c="yellow">
                专家模式：表单已锁定，提交将按下方命令原文执行（bbdown 本体不可更换）
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
        opened={loginQr !== null}
        onClose={() => setLoginQr(null)}
        title="扫码登录哔哩哔哩"
        centered
      >
        <Stack align="center" gap="sm">
          {loginQr && <img src={loginQr} alt="登录二维码" width={280} height={280} />}
          <Text size="sm" c="dimmed">
            使用哔哩哔哩手机客户端扫码并确认
          </Text>
        </Stack>
      </Modal>
    </Stack>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}
