/**
 * 池占用指示条（架构文档 §8）：每池一行（名称 + 计数 + 通栏矩形条），
 * 填充表示占用比例，未满绿色、满载红色。占用数由前端从任务事件推导，
 * 不依赖后端实时同步接口。
 */

import { Box, Group, Stack, Text } from "@mantine/core";
import type { Pool } from "../contracts/types";

export interface PoolDefinition {
  pool: Pool;
  capacity: number;
}

const POOL_LABELS: Record<Pool, string> = {
  download: "下载资源池",
  local: "处理资源池"
};

interface PoolIndicatorProps {
  definitions: PoolDefinition[];
  occupancy: (pool: Pool) => number;
}

export function PoolIndicator({ definitions, occupancy }: PoolIndicatorProps) {
  if (definitions.length === 0) return null;
  return (
    <Stack gap="sm">
      {definitions.map(({ pool, capacity }) => {
        const used = occupancy(pool);
        const full = used >= capacity;
        const filled = capacity > 0 ? Math.min(used / capacity, 1) : 0;
        return (
          <Box key={pool}>
            <Group justify="space-between" mb={5} wrap="nowrap">
              <Text size="xs" c="dimmed">
                {POOL_LABELS[pool]}
              </Text>
              <Text size="xs" c={full ? "red" : "dimmed"}>
                {used}/{capacity}
              </Text>
            </Group>
            <Box
              h={6}
              style={{
                borderRadius: "var(--mantine-radius-sm)",
                background: "var(--mantine-color-default-hover)",
                overflow: "hidden"
              }}
            >
              <Box
                h="100%"
                w={`${filled * 100}%`}
                style={{
                  background: full
                    ? "var(--mantine-color-red-filled)"
                    : "var(--mantine-color-green-filled)"
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
