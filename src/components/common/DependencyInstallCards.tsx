import { ActionIcon, Card, Code, Divider, Group, Stack, Text, Tooltip } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconExternalLink, IconWorld } from "@tabler/icons-react";
import type { DependencyStatus, ToolName } from "../../contracts/dependency";
import { isWindows, pipCommand, toolInstallCommands } from "../../lib/platform";
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

const INSTALL_DESCRIPTIONS: Partial<Record<ToolName, string>> = {
  ffmpeg: "转码、剪辑、GIF 等媒体处理任务的必需工具。",
  "yt-dlp": "网络视频下载的必需工具。",
  mediainfo: "媒体检视（读取编码与容器信息）使用，缺失时回落到 ffprobe。",
  deno: "部分站点的解析脚本依赖 Deno。",
  python: "运行 musicdl 所需的 Python 3 解释器。",
  musicdl:
    "音乐下载的核心工具，需要 Python 3；两者不随 MAD Toolbox 分发（musicdl 为 PolyForm Noncommercial 许可，禁止捆绑）。"
};

interface DependencyInstallCardsProps {
  dependencies: DependencyStatus[];
}

const tooltipEvents = { hover: true, focus: true, touch: false } as const;

/**
 * 缺失依赖的安装引导卡：仅渲染 !available 且有安装命令的工具；
 * musicdl 卡附带 pip 镜像配置（自 Music 页安装引导迁入）。
 */
export function DependencyInstallCards({ dependencies }: DependencyInstallCardsProps) {
  const missing = dependencies.filter((item) => !item.available && toolInstallCommands[item.tool]);
  if (missing.length === 0) return null;

  return (
    <Stack gap="md">
      {missing.map((dependency) => {
        const command = toolInstallCommands[dependency.tool] as string;
        return (
          <Card key={dependency.tool} withBorder padding="md">
            <Stack gap="xs">
              <Group gap="xs">
                <Text fw={500}>{dependency.label}</Text>
                {dependency.tool === "musicdl" && (
                  <Text span size="xs" c="dimmed">
                    （可选）
                  </Text>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {INSTALL_DESCRIPTIONS[dependency.tool]}
              </Text>
              {dependency.tool === "musicdl" && (
                <Text size="sm" c="dimmed">
                  推荐通过{isWindows ? " winget " : " Homebrew "}安装 Python，并使用 pipx
                  创建隔离环境。
                </Text>
              )}
              <Group gap={6} wrap="nowrap" align="flex-start">
                <Code
                  block
                  style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {command}
                </Code>
                <CopyIconButton value={command} label="复制安装命令" />
              </Group>
              {dependency.tool === "musicdl" && (
                <>
                  <Divider
                    my={4}
                    label={
                      <Group gap={4} wrap="nowrap">
                        <IconWorld size={14} />
                        <Text size="sm">中国大陆网络：配置 pip 镜像（可选）</Text>
                      </Group>
                    }
                    labelPosition="left"
                  />
                  <Text size="sm" c="dimmed">
                    如果 PyPI 下载缓慢，先执行其一，再运行上面的安装命令。
                  </Text>
                  {PIP_MIRRORS.map((mirror) => {
                    const mirrorCommand = `${pipCommand} config set global.index-url ${mirror.url}`;
                    return (
                      <Group key={mirror.id} justify="space-between" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm">{mirror.name}</Text>
                          <Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                            {mirrorCommand}
                          </Code>
                        </div>
                        <Group gap={4} wrap="nowrap">
                          <CopyIconButton value={mirrorCommand} label="复制命令" />
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
                </>
              )}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
