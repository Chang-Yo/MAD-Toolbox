import { Alert, Badge, Button, Card, Code, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCopy,
  IconExternalLink,
  IconRefresh
} from "@tabler/icons-react";
import type { DependencyStatus } from "../lib/types";
import { isWindows, liteInstallCommand, musicdlInstallCommand } from "../lib/platform";
import { CollapsibleSection } from "./CollapsibleSection";
import { CopyIconButton } from "./CopyIconButton";

interface DependencyStatusPanelProps {
  dependencies: DependencyStatus[];
  loading: boolean;
  distributionMode: "Lite" | "Full";
  onRefresh: () => void;
}

const RESOURCE_LINKS = [
  ["musicdl 项目与许可", "https://github.com/CharlesPikachu/musicdl"],
  ["FFmpeg 官方下载", "https://ffmpeg.org/download.html"],
  ["yt-dlp 发行版", "https://github.com/yt-dlp/yt-dlp/releases"],
  ["MediaInfo CLI", "https://mediaarea.net/MediaInfo/Download"]
] as const;

export function DependencyStatusPanel({
  dependencies,
  loading,
  distributionMode,
  onRefresh
}: DependencyStatusPanelProps) {
  const [open, setOpen] = useState(false);
  const missing = dependencies.filter((item) => item.required && !item.available);

  const copyInstallCommand = async () => {
    try {
      await navigator.clipboard.writeText(liteInstallCommand);
      notifications.show({ message: "已复制安装命令", color: "teal" });
    } catch {
      notifications.show({ message: "复制失败", color: "red" });
    }
  };

  return (
    <Stack gap="md">
      <CollapsibleSection
        title={
          missing.length > 0 ? (
            <Badge variant="light" color="yellow">
              {missing.length} 个必要工具未就绪
            </Badge>
          ) : (
            <Badge variant="light" color="teal" leftSection={<IconCircleCheck size={12} />}>
              必要工具均已就绪
            </Badge>
          )
        }
        opened={open}
        onToggle={() => setOpen((value) => !value)}
        action={
          <Button
            size="compact-sm"
            variant="subtle"
            leftSection={<IconRefresh size={14} />}
            loading={loading}
            onClick={onRefresh}
          >
            重新检测
          </Button>
        }
      >
        <Stack gap="xs">
          {missing.length > 0 && (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
              <Stack gap="xs">
                <Text size="sm">缺少：{missing.map((item) => item.label).join("、")}</Text>
                <Code block>{liteInstallCommand}</Code>
                <Group gap="xs">
                  <Button
                    size="compact-sm"
                    variant="default"
                    leftSection={<IconCopy size={14} />}
                    onClick={() => void copyInstallCommand()}
                  >
                    复制安装命令
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}
          {dependencies.map((dependency) => (
            <Card key={dependency.tool} withBorder padding="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div>
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {dependency.label}
                    </Text>
                    {!dependency.required && (
                      <Badge size="xs" variant="light" color="gray">
                        可选
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {dependency.available
                      ? [dependency.version, dependency.path].filter(Boolean).join(" · ") ||
                        "已检测"
                      : dependency.installHint || "未找到可用版本"}
                  </Text>
                </div>
                <Badge color={dependency.available ? "teal" : "yellow"} variant="light">
                  {dependency.available
                    ? dependency.source === "bundled"
                      ? "应用内置"
                      : "系统"
                    : "未就绪"}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      </CollapsibleSection>

      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text fw={500}>musicdl（可选）</Text>
          <Text size="sm" c="dimmed">
            musicdl 和 Python 不随 MAD Toolbox 分发。请先安装 Python，再独立安装 musicdl。
          </Text>
          <Group gap={6} wrap="nowrap" align="flex-start">
            <Code
              block
              style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {musicdlInstallCommand}
            </Code>
            <CopyIconButton value={musicdlInstallCommand} label="复制安装命令" />
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text fw={500}>安装来源</Text>
          <Text size="sm" c="dimmed">
            当前为 {isWindows ? "Windows" : "macOS"} {distributionMode} 构建。
          </Text>
          <Group gap="xs">
            {RESOURCE_LINKS.map(([label, url]) => (
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
