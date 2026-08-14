/**
 * 任务卡片：左边界按 feature 着色（颜色为冗余编码，状态徽章文字仍在）。
 * 失败任务内联日志尾部若干行（§8 已定），完整日志走 [打开日志]（shell 打开，壳不做查看器）。
 */

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Progress,
  Text,
  Tooltip
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  IconArrowUp,
  IconFileDownload,
  IconFileText,
  IconFolderOpen,
  IconX
} from "@tabler/icons-react";
import type { TaskEnvelope, TaskStatus } from "../contracts/types";
import type { TaskLogLine } from "../stores/tasks.reducer";

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  queued: { label: "排队中", color: "gray" },
  running: { label: "运行中", color: "blue" },
  canceling: { label: "取消中", color: "orange" },
  success: { label: "成功", color: "green" },
  failed: { label: "失败", color: "red" },
  canceled: { label: "已取消", color: "gray" },
  interrupted: { label: "中断", color: "yellow" }
};

const FEATURE_COLORS: Record<TaskEnvelope["feature"], string> = {
  bilibili: "var(--mantine-color-pink-5)",
  network: "var(--mantine-color-blue-5)",
  media: "var(--mantine-color-teal-5)",
  music: "var(--mantine-color-grape-5)"
};

const FAILED_TAIL_LINES = 10;

interface TaskCardProps {
  task: TaskEnvelope;
  logs?: TaskLogLine[];
  onCancel: (id: string) => void;
  onPromote: (id: string) => void;
  onRerun?: (task: TaskEnvelope) => void;
}

const TERMINAL_STATUSES = new Set(["success", "failed", "canceled", "interrupted"]);

export function TaskCard({ task, logs, onCancel, onPromote, onRerun }: TaskCardProps) {
  const status = STATUS_META[task.status];
  const cancellable = task.status === "queued" || task.status === "running";
  const failedTail =
    task.status === "failed" && logs?.length ? logs.slice(-FAILED_TAIL_LINES) : null;

  const exportDiagnostics = async () => {
    const target = await saveDialog({
      defaultPath: `MAD-诊断-${task.id.slice(0, 8)}.txt`,
      filters: [{ name: "文本文件", extensions: ["txt"] }]
    });
    if (!target) return;
    try {
      await invoke("task_export_diagnostics", { taskId: task.id, targetPath: target });
      notifications.show({ message: "诊断文件已导出", color: "teal" });
    } catch (error) {
      notifications.show({ message: String(error), color: "red" });
    }
  };

  return (
    <Card
      withBorder
      padding="sm"
      style={{ borderLeft: `3px solid ${FEATURE_COLORS[task.feature]}` }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Badge color={status.color} variant="light">
            {status.label}
          </Badge>
          <Text size="sm" fw={500} truncate>
            {task.title}
          </Text>
        </Group>
        <Group gap={4} wrap="nowrap">
          {task.status === "queued" && (
            <Tooltip label="置顶（移到队首）">
              <ActionIcon variant="subtle" onClick={() => onPromote(task.id)}>
                <IconArrowUp size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {cancellable && (
            <Tooltip label="取消">
              <ActionIcon variant="subtle" color="red" onClick={() => onCancel(task.id)}>
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {TERMINAL_STATUSES.has(task.status) && (
            <Tooltip label="导出诊断文件（脱敏）">
              <ActionIcon variant="subtle" onClick={() => void exportDiagnostics()}>
                <IconFileDownload size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {task.logPath && (
            <Tooltip label="打开日志文件">
              <ActionIcon variant="subtle" onClick={() => void openPath(task.logPath!)}>
                <IconFileText size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {(task.outputPaths[0] || task.workingDir) && (
            <Tooltip label="打开输出位置">
              <ActionIcon
                variant="subtle"
                onClick={() =>
                  task.outputPaths[0]
                    ? void revealItemInDir(task.outputPaths[0])
                    : void openPath(task.workingDir!)
                }
              >
                <IconFolderOpen size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Code block mt="xs" style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {task.tool} {task.argvRedacted.join(" ")}
      </Code>

      {task.status === "running" && task.progress?.percent != null && (
        <Progress mt="xs" value={task.progress.percent} size="sm" animated />
      )}

      {task.status === "interrupted" && onRerun && (
        <Group mt="xs">
          <Text size="xs" c="dimmed">
            {task.startedAt ? "上次会话中被中断" : "排队中未执行"}
          </Text>
          <Button size="compact-xs" variant="light" onClick={() => onRerun(task)}>
            再次运行
          </Button>
        </Group>
      )}

      {failedTail && (
        <Code block mt="xs" c="red" style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
          {failedTail.map((l) => l.line).join("\n")}
        </Code>
      )}
    </Card>
  );
}
