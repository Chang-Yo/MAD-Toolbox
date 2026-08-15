import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Stack,
  Text,
  Title,
  Tooltip
} from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconRefresh,
  IconWorld
} from "@tabler/icons-react";
import type { DependencyStatus } from "../lib/types";
import { isWindows, musicdlInstallCommand, pipCommand } from "../lib/platform";
import { CopyIconButton } from "./CopyIconButton";

const PIP_MIRRORS = [
  {
    id: "ustc",
    name: "USTC 中国科学技术大学",
    url: "https://mirrors.ustc.edu.cn/pypi/simple",
    help: "https://mirrors.ustc.edu.cn/help/pypi.html"
  },
  {
    id: "tuna",
    name: "TUNA 清华大学",
    url: "https://pypi.tuna.tsinghua.edu.cn/simple",
    help: "https://mirrors.tuna.tsinghua.edu.cn/help/pypi/"
  }
] as const;

interface MusicDependencySetupProps {
  dependency: DependencyStatus | null;
  pythonDependency: DependencyStatus | null;
  onRefresh: () => Promise<unknown>;
}

const tooltipEvents = { hover: true, focus: true, touch: false } as const;

export function MusicDependencySetup({
  dependency,
  pythonDependency,
  onRefresh
}: MusicDependencySetupProps) {
  const musicdlInstalled = dependency?.available ?? false;
  const pythonInstalled = pythonDependency?.available ?? false;

  return (
    <Stack gap="md" p="md">
      <Title order={3}>音乐下载</Title>
      <Alert
        color="yellow"
        icon={<IconAlertTriangle size={18} />}
        title={!pythonInstalled ? "尚未检测到 Python 3" : "尚未检测到 musicdl"}
      >
        <Stack gap="xs">
          <Text size="sm">
            musicdl 需要 Python 3。推荐通过{isWindows ? " winget" : " Homebrew"}安装 Python，并使用
            pipx 创建隔离环境；两者不随 MAD Toolbox 分发（musicdl 为 PolyForm Noncommercial
            许可，禁止捆绑）。
          </Text>
          <Group gap="xs">
            <Badge color={pythonInstalled ? "teal" : "yellow"} variant="light">
              Python 3 {pythonDependency?.version ?? "需要安装"}
            </Badge>
            <Badge color={musicdlInstalled ? "teal" : "yellow"} variant="light">
              musicdl {dependency?.version ?? "需要安装"}
            </Badge>
          </Group>
          <Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {musicdlInstallCommand}
          </Code>
          <Group gap="xs">
            <CopyButton value={musicdlInstallCommand} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip
                  label="已复制"
                  position="bottom"
                  radius="xl"
                  transitionProps={{ duration: 100, transition: "slide-down" }}
                  opened={copied}
                >
                  <Button
                    variant="light"
                    radius="xl"
                    size="sm"
                    rightSection={
                      copied ? (
                        <IconCheck size={16} stroke={1.5} />
                      ) : (
                        <IconCopy size={16} stroke={1.5} />
                      )
                    }
                    onClick={copy}
                  >
                    复制安装命令
                  </Button>
                </Tooltip>
              )}
            </CopyButton>
            <Button
              size="sm"
              variant="light"
              leftSection={<IconRefresh size={15} />}
              onClick={() => void onRefresh()}
            >
              重新检测
            </Button>
            <Button
              size="sm"
              variant="subtle"
              leftSection={<IconExternalLink size={15} />}
              onClick={() => void openUrl("https://github.com/CharlesPikachu/musicdl")}
            >
              musicdl 项目
            </Button>
          </Group>
        </Stack>
      </Alert>

      <Alert
        color="blue"
        icon={<IconWorld size={18} />}
        title="中国大陆网络：配置 pip 镜像（可选）"
      >
        <Stack gap="xs">
          <Text size="sm">如果 PyPI 下载缓慢，先执行其一，再运行上面的安装命令。</Text>
          {PIP_MIRRORS.map((mirror) => {
            const command = `${pipCommand} config set global.index-url ${mirror.url}`;
            return (
              <Group key={mirror.id} justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm">{mirror.name}</Text>
                  <Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {command}
                  </Code>
                </div>
                <Group gap={4} wrap="nowrap">
                  <CopyIconButton value={command} label="复制命令" />
                  <Tooltip label="镜像站官方帮助" position="top" events={tooltipEvents}>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="lg"
                      aria-label={`${mirror.name}官方帮助`}
                      onClick={() => void openUrl(mirror.help)}
                    >
                      <IconExternalLink size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            );
          })}
          <Text size="xs">
            恢复官方源：
            <Code style={{ overflowWrap: "anywhere" }}>
              {`${pipCommand} config unset global.index-url`}
            </Code>
          </Text>
        </Stack>
      </Alert>
    </Stack>
  );
}
