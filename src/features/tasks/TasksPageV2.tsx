/**
 * 新任务中心（样板最小版）：读全局任务 store，池槽位指示 + 任务卡片列表。
 * 池定义一次性拉取；占用数从任务事件推导（§8：不新增实时同步接口）。
 */

import { Group, Stack, Text, Title } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { PoolIndicator, type PoolDefinition } from "../../components/PoolIndicator";
import { TaskCard } from "../../components/TaskCard";
import type { TaskEnvelope } from "../../contracts/types";
import { poolOccupancy, sortedTasks } from "../../stores/tasks.reducer";
import { useTasksStore } from "../../stores/tasks";

interface TasksPageV2Props {
  onRerun: (task: TaskEnvelope) => void;
}

export function TasksPageV2({ onRerun }: TasksPageV2Props) {
  const tasks = useTasksStore((s) => s.tasks);
  const logs = useTasksStore((s) => s.logs);
  const cancel = useTasksStore((s) => s.cancel);
  const promote = useTasksStore((s) => s.promote);
  const [definitions, setDefinitions] = useState<PoolDefinition[]>([]);

  useEffect(() => {
    void invoke<PoolDefinition[]>("pool_definitions")
      .then(setDefinitions)
      .catch(() => {});
  }, []);

  const state = useMemo(() => ({ tasks, logs }), [tasks, logs]);
  const sorted = useMemo(() => sortedTasks(state), [state]);

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={3}>任务中心</Title>
        <PoolIndicator definitions={definitions} occupancy={(pool) => poolOccupancy(state, pool)} />
      </Group>
      {sorted.length === 0 ? (
        <Text c="dimmed" size="sm">
          还没有任务。从功能页提交下载后会出现在这里。
        </Text>
      ) : (
        <Stack gap="xs">
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              logs={logs[task.id]}
              onCancel={cancel}
              onPromote={promote}
              onRerun={task.feature === "music" ? undefined : onRerun}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
