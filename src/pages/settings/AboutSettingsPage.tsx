import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconBook, IconBrandGithub, IconExternalLink } from "@tabler/icons-react";
import { LicenseList } from "../../components/LicenseList";
import { platformLabel } from "../../lib/platform";
import packageInfo from "../../../package.json";

interface AboutSettingsPageProps {
  distributionMode: "Lite" | "Full";
}

const PROJECT_URL = "https://github.com/MAD-Producer/MAD-Toolbox";

export function AboutSettingsPage({ distributionMode }: AboutSettingsPageProps) {
  return (
    <Stack gap="md" p="md" maw={900}>
      <div>
        <Title order={3}>关于 MAD Toolbox</Title>
        <Text size="sm" c="dimmed">
          面向 Windows 与 macOS 的多媒体下载和处理工具箱。
        </Text>
      </div>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <Group gap="xs">
            <Badge variant="light">v{packageInfo.version}</Badge>
            <Badge variant="light" color="gray">
              {platformLabel}
            </Badge>
            <Badge variant="light" color="gray">
              {distributionMode}
            </Badge>
          </Group>
          <Text size="sm">
            MAD Toolbox 把结构化配置交给后端转换为 BBDown、yt-dlp、FFmpeg 与 musicdl
            的参数，并通过统一任务中心执行和观察。
          </Text>
          <Group gap="xs">
            <Button
              variant="light"
              leftSection={<IconBrandGithub size={16} />}
              rightSection={<IconExternalLink size={13} />}
              onClick={() => void openUrl(PROJECT_URL)}
            >
              GitHub
            </Button>
            <Button
              variant="default"
              leftSection={<IconBook size={16} />}
              rightSection={<IconExternalLink size={13} />}
              onClick={() => void openUrl(`${PROJECT_URL}#readme`)}
            >
              使用说明
            </Button>
          </Group>
        </Stack>
      </Card>

      <LicenseList />
    </Stack>
  );
}
