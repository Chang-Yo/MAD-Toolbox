import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { IconCircleCheck, IconRefresh } from "@tabler/icons-react";
import type { DependencyStatus } from "../lib/types";

interface DependencyStatusPanelProps {
  dependencies: DependencyStatus[];
  loading: boolean;
  onRefresh: () => void;
}

/** 状态列表：汇总徽标 + 重新检测 + 逐工具来源/版本/路径；缺失工具的安装引导由 DependencyInstallCards 承担。 */
export function DependencyStatusPanel({
  dependencies,
  loading,
  onRefresh
}: DependencyStatusPanelProps) {
  const missing = dependencies.filter((item) => item.required && !item.available);

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        {missing.length > 0 ? (
          <Badge variant="light" color="yellow">
            {missing.length} 个必要工具未就绪
          </Badge>
        ) : (
          <Badge variant="light" color="teal" leftSection={<IconCircleCheck size={12} />}>
            必要工具均已就绪
          </Badge>
        )}
        <Button
          size="compact-sm"
          variant="subtle"
          leftSection={<IconRefresh size={14} />}
          loading={loading}
          onClick={onRefresh}
        >
          重新检测
        </Button>
      </Group>
      <Stack gap="xs">
        {dependencies.map((dependency) => (
          <Card key={dependency.tool} withBorder padding="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <Group gap="xs">
                  <Text size="sm" fw={600}>
                    {dependency.label}
                  </Text>
                  {!dependency.required && (
                    <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                      可选
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" truncate>
                  {dependency.available
                    ? [dependency.version, dependency.path].filter(Boolean).join(" · ") || "已检测"
                    : dependency.installHint || "未找到可用版本"}
                </Text>
              </div>
              <Badge
                color={dependency.available ? "teal" : "yellow"}
                variant="light"
                style={{ flexShrink: 0 }}
              >
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
    </Stack>
  );
}
