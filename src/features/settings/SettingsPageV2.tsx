/**
 * 设置页（Mantine 版）。§8 的 General/feature 分栏在设置项增多后展开；
 * 当前设置项只有两个横切项（默认导出目录、依赖来源偏好），单栏即可。
 */

import {
  Button,
  Card,
  Code,
  Group,
  Radio,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconDeviceFloppy, IconExternalLink, IconFolderOpen } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../lib/types";
import {
  isWindows,
  liteInstallCommand,
  musicdlInstallCommand,
  platformLabel
} from "../../lib/platform";

interface SettingsPageV2Props {
  settings: AppSettings;
  distributionMode: "Lite" | "Full";
  onSave: (settings: AppSettings) => Promise<AppSettings>;
}

export function SettingsPageV2({ settings, distributionMode, onSave }: SettingsPageV2Props) {
  const [directory, setDirectory] = useState(settings.defaultOutputDirectory || "");
  const [dependencyPreference, setDependencyPreference] = useState(settings.dependencyPreference);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDirectory(settings.defaultOutputDirectory || "");
    setDependencyPreference(settings.dependencyPreference);
  }, [settings.defaultOutputDirectory, settings.dependencyPreference]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        defaultOutputDirectory: directory.trim() || null,
        dependencyPreference
      });
      notifications.show({ message: "设置已保存", color: "teal" });
    } catch (error) {
      notifications.show({ message: `保存失败：${String(error)}`, color: "red" });
    } finally {
      setSaving(false);
    }
  };

  const pickDirectory = async () => {
    const dir = await openDialog({ directory: true });
    if (typeof dir === "string") setDirectory(dir);
  };

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>设置</Title>
        <Text size="sm" c="dimmed">
          当前构建：{platformLabel} {distributionMode === "Full" ? "全内置版" : "轻量版"}
        </Text>
      </div>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <div>
            <Text fw={500}>默认导出目录</Text>
            <Text size="xs" c="dimmed">
              用于哔哩哔哩下载、网络视频下载和媒体处理；每个任务仍可单独覆盖。
            </Text>
          </div>
          <TextInput
            placeholder="留空使用各工具默认目录"
            value={directory}
            onChange={(e) => setDirectory(e.currentTarget.value)}
            rightSection={
              <Tooltip label="选择目录">
                <IconFolderOpen
                  size={16}
                  style={{ cursor: "pointer" }}
                  onClick={() => void pickDirectory()}
                />
              </Tooltip>
            }
          />

          <div>
            <Text fw={500}>工具版本来源</Text>
            <Text size="xs" c="dimmed">
              决定运行任务时优先使用哪个版本；找不到首选版本时自动回退。
            </Text>
          </div>
          <Radio.Group
            value={dependencyPreference}
            onChange={(value) =>
              setDependencyPreference(value as AppSettings["dependencyPreference"])
            }
          >
            <Stack gap="xs">
              <Radio
                value="bundled"
                label="应用内置版本优先（默认）"
                description={
                  distributionMode === "Full"
                    ? "使用随应用审计和校验过的依赖，版本稳定；当前安装包含 FFmpeg、MediaInfo、yt-dlp、Deno 与 BBDown。"
                    : "轻量版会在缺少内置依赖时自动使用系统版本。"
                }
              />
              <Radio
                value="system"
                label={isWindows ? "系统安装版本优先" : "系统 / Homebrew 优先"}
                description="优先使用自行安装的版本，适合希望及时使用最新版的用户。"
              />
            </Stack>
          </Radio.Group>
          {dependencyPreference === "system" && <Code block>{liteInstallCommand}</Code>}

          <Group justify="end">
            <Button
              leftSection={<IconDeviceFloppy size={15} />}
              loading={saving}
              onClick={() => void save()}
            >
              保存设置
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text fw={500}>可选音乐下载依赖</Text>
          <Text size="sm" c="dimmed">
            musicdl 和 Python 不随 MAD Toolbox 分发。推荐通过{isWindows ? " winget" : " Homebrew"}
            安装 Python，再用 pipx 隔离安装 musicdl；音乐下载页提供换源指引。
          </Text>
          <Code block>{musicdlInstallCommand}</Code>
          <Group gap="xs">
            {[
              ["musicdl 项目与许可", "https://github.com/CharlesPikachu/musicdl"],
              ["USTC PyPI 镜像帮助", "https://mirrors.ustc.edu.cn/help/pypi.html"],
              ["TUNA PyPI 镜像帮助", "https://mirrors.tuna.tsinghua.edu.cn/help/pypi/"]
            ].map(([label, url]) => (
              <Button
                key={url}
                size="compact-xs"
                variant="subtle"
                rightSection={<IconExternalLink size={12} />}
                onClick={() => void openUrl(url)}
              >
                {label}
              </Button>
            ))}
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text fw={500}>
            {isWindows ? "Windows FFmpeg 构建与依赖来源" : "macOS FFmpeg 版本与构建"}
          </Text>
          <Text size="sm" c="dimmed">
            {isWindows
              ? "Full 版内置 BtbN Windows x64 LGPL 构建；也可切换到自行安装的最新版或旧主版本。"
              : "Apple Silicon 推荐 Homebrew 当前版；仅在旧项目或插件明确要求时安装旧主版本。"}
          </Text>
          <Group gap="xs">
            {(isWindows
              ? [
                  ["FFmpeg 官方下载", "https://ffmpeg.org/download.html"],
                  ["BtbN Windows 构建", "https://github.com/BtbN/FFmpeg-Builds/releases"],
                  ["Gyan Windows 构建", "https://www.gyan.dev/ffmpeg/builds/"],
                  ["yt-dlp 发行版", "https://github.com/yt-dlp/yt-dlp/releases"],
                  ["MediaInfo CLI", "https://mediaarea.net/MediaInfo/Download/Windows"],
                  ["Deno 发行版", "https://github.com/denoland/deno/releases"]
                ]
              : [
                  ["FFmpeg（Homebrew）", "https://formulae.brew.sh/formula/ffmpeg"],
                  ["FFmpeg 官方下载", "https://ffmpeg.org/download.html"],
                  ["Evermeet 静态构建", "https://evermeet.cx/ffmpeg/"]
                ]
            ).map(([label, url]) => (
              <Button
                key={url}
                size="compact-xs"
                variant="subtle"
                rightSection={<IconExternalLink size={12} />}
                onClick={() => void openUrl(url)}
              >
                {label}
              </Button>
            ))}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
