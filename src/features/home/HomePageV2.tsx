/**
 * 首页（架构文档 §8）：状态 + 起点，不是宣传页。四区：
 * ① 环境状态条（异常驱动：全就绪收敛一行，缺失放大为横幅）
 * ② 会话回顾条（interrupted 任务二次曝光——任务持久化的直接变现）
 * ③ 功能卡片（带说明的入口，非纯链接）
 * ④ 页脚链接
 */

import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton
} from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconAlertTriangle,
  IconBrandBilibili,
  IconCircleCheck,
  IconCopy,
  IconMovie,
  IconMusic,
  IconPlayerPlay,
  IconRefresh,
  IconWorldDownload
} from "@tabler/icons-react";
import { useMemo } from "react";
import { notifications } from "@mantine/notifications";
import type { DependencyStatus, NavPage } from "../../lib/types";
import { liteInstallCommand } from "../../lib/platform";
import { useTasksStore } from "../../stores/tasks";

const FEATURE_CARDS: Array<{
  page: NavPage;
  icon: typeof IconMovie;
  color: string;
  title: string;
  description: string;
}> = [
  {
    page: "bilibili",
    icon: IconBrandBilibili,
    color: "pink",
    title: "哔哩哔哩下载",
    description: "BBDown · 扫码登录 · 画质与编码优先级"
  },
  {
    page: "network",
    icon: IconWorldDownload,
    color: "blue",
    title: "网络视频下载",
    description: "yt-dlp · 格式探测 · 登录自动兜底"
  },
  {
    page: "media",
    icon: IconMovie,
    color: "teal",
    title: "媒体处理",
    description: "FFmpeg · PR 兼容转码 · 封装与抽流"
  },
  {
    page: "music",
    icon: IconMusic,
    color: "grape",
    title: "音乐下载",
    description: "musicdl · 多源搜索 · 需自行安装"
  }
];

interface HomePageV2Props {
  dependencies: DependencyStatus[];
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (page: NavPage) => void;
}

export function HomePageV2({ dependencies, loading, onRefresh, onNavigate }: HomePageV2Props) {
  const tasks = useTasksStore((s) => s.tasks);

  const missing = dependencies.filter((item) => item.required && !item.available);
  const readyCount = dependencies.filter((item) => item.available).length;

  const recap = useMemo(() => {
    const all = Object.values(tasks);
    return {
      interrupted: all.filter((t) => t.status === "interrupted").length,
      running: all.filter((t) => t.status === "running" || t.status === "canceling").length,
      queued: all.filter((t) => t.status === "queued").length
    };
  }, [tasks]);

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(liteInstallCommand);
      notifications.show({ message: "已复制安装命令", color: "teal" });
    } catch {
      notifications.show({ message: "复制失败", color: "red" });
    }
  };

  return (
    <Stack gap="md" p="md">
      <Title order={3}>首页</Title>

      {/* ① 环境状态：异常驱动 */}
      {missing.length > 0 ? (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={18} />}
          title={`${missing.length} 个工具未就绪`}
        >
          <Stack gap="xs">
            <Text size="sm">
              缺少：{missing.map((item) => item.label).join("、")}。安装完成后重新检测即可使用。
            </Text>
            <Code block>{liteInstallCommand}</Code>
            <Group gap="xs">
              <Button
                size="compact-sm"
                variant="default"
                leftSection={<IconCopy size={14} />}
                onClick={() => void copyInstall()}
              >
                复制安装命令
              </Button>
              <Button
                size="compact-sm"
                leftSection={<IconRefresh size={14} />}
                loading={loading}
                onClick={onRefresh}
              >
                重新检测
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : (
        <Group gap="xs">
          <Badge variant="light" color="teal" leftSection={<IconCircleCheck size={12} />}>
            环境就绪 · {readyCount} 个工具可用
          </Badge>
          <Button size="compact-xs" variant="subtle" loading={loading} onClick={onRefresh}>
            重新检测
          </Button>
        </Group>
      )}

      {/* ② 会话回顾：有内容才出现 */}
      {(recap.interrupted > 0 || recap.running > 0 || recap.queued > 0) && (
        <Card withBorder padding="sm">
          <Group justify="space-between">
            <Group gap="xs">
              {recap.running > 0 && (
                <Badge variant="light" color="blue">
                  {recap.running} 个运行中
                </Badge>
              )}
              {recap.queued > 0 && (
                <Badge variant="light" color="gray">
                  {recap.queued} 个排队中
                </Badge>
              )}
              {recap.interrupted > 0 && (
                <Badge variant="light" color="yellow">
                  {recap.interrupted} 个任务上次被中断
                </Badge>
              )}
            </Group>
            <Button
              size="compact-sm"
              variant="light"
              leftSection={<IconPlayerPlay size={14} />}
              onClick={() => onNavigate("tasks")}
            >
              去任务中心
            </Button>
          </Group>
        </Card>
      )}

      {/* ③ 功能卡片 */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {FEATURE_CARDS.map(({ page, icon: Icon, color, title, description }) => (
          <UnstyledButton key={page} onClick={() => onNavigate(page)}>
            <Card withBorder padding="md" style={{ height: "100%" }}>
              <Group gap="sm" wrap="nowrap">
                <Badge
                  variant="light"
                  color={color}
                  size="xl"
                  circle
                  style={{ width: 42, height: 42, flexShrink: 0 }}
                >
                  <Icon size={22} stroke={1.7} />
                </Badge>
                <div>
                  <Text fw={600} size="sm">
                    {title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {description}
                  </Text>
                </div>
              </Group>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>

      {/* ④ 页脚链接 */}
      <Group gap="lg" mt="auto">
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          onClick={() => void openUrl("https://github.com/Chang-Yo/MAD-Toolbox")}
        >
          项目主页
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          onClick={() => void openUrl("https://github.com/Chang-Yo/MAD-Toolbox#readme")}
        >
          使用说明
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          onClick={() => onNavigate("licenses")}
        >
          开源许可
        </Button>
      </Group>
    </Stack>
  );
}
