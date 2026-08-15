import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconExternalLink } from "@tabler/icons-react";
import { DependencyInstallCards } from "../../components/DependencyInstallCards";
import { DependencyStatusPanel } from "../../components/DependencyStatusPanel";
import { isWindows } from "../../lib/platform";
import type { DependencyStatus } from "../../lib/types";

const RESOURCE_LINKS = [
  ["musicdl 项目与许可", "https://github.com/CharlesPikachu/musicdl"],
  ["FFmpeg 官方下载", "https://ffmpeg.org/download.html"],
  ["yt-dlp 发行版", "https://github.com/yt-dlp/yt-dlp/releases"],
  ["MediaInfo CLI", "https://mediaarea.net/MediaInfo/Download"]
] as const;

interface DependenciesSettingsPageProps {
  dependencies: DependencyStatus[];
  loading: boolean;
  distributionMode: "Lite" | "Full";
  onRefresh: () => void;
}

export function DependenciesSettingsPage(props: DependenciesSettingsPageProps) {
  return (
    <Stack gap="md" p="md" maw={900}>
      <div>
        <Title order={3}>依赖管理</Title>
        <Text size="sm" c="dimmed">
          查看各命令行工具的来源、版本和安装状态。
        </Text>
      </div>
      <DependencyStatusPanel
        dependencies={props.dependencies}
        loading={props.loading}
        onRefresh={props.onRefresh}
      />
      <DependencyInstallCards dependencies={props.dependencies} />
      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text fw={500}>安装来源</Text>
          <Text size="sm" c="dimmed">
            当前为 {isWindows ? "Windows" : "macOS"} {props.distributionMode} 构建。
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
