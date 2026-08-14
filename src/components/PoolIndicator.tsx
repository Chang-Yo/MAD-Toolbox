/**
 * 池占用槽位指示器（架构文档 §8）：离散槽位点，不用连续容量条——
 * 容量是 2、3 这类小整数，槽位点直接回答"几个在跑、还剩几个坑"。
 * 占用数由前端从任务事件推导，不依赖后端实时同步接口。
 */

import { Group, Text } from "@mantine/core";
import type { Pool } from "../contracts/types";

export interface PoolDefinition {
  pool: Pool;
  capacity: number;
}

const POOL_LABELS: Record<Pool, string> = {
  download: "下载",
  local: "处理"
};

interface PoolIndicatorProps {
  definitions: PoolDefinition[];
  occupancy: (pool: Pool) => number;
}

function slots(used: number, capacity: number): string {
  const filled = Math.min(used, capacity);
  return "●".repeat(filled) + "○".repeat(Math.max(0, capacity - filled));
}

export function PoolIndicator({ definitions, occupancy }: PoolIndicatorProps) {
  return (
    <Group gap="lg">
      {definitions.map(({ pool, capacity }) => {
        const used = occupancy(pool);
        return (
          <Text key={pool} size="sm" c={used >= capacity ? "orange" : "dimmed"}>
            {POOL_LABELS[pool]} {slots(used, capacity)} {used}/{capacity}
          </Text>
        );
      })}
    </Group>
  );
}
