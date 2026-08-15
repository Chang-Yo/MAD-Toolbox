import { Box, Group, Paper, SegmentedControl, Stack, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { SETTINGS_L2_NAVIGATION } from "../../app/navigation";
import type { SettingsPageId } from "../../app/route";

interface SettingsShellProps {
  page: SettingsPageId;
  onNavigatePage: (page: SettingsPageId) => void;
  children: ReactNode;
}

/**
 * 设置区框架：「设置」标题 + 悬浮竖排 SegmentedControl + 右侧内容。
 * 与媒体页同款 SegmentedControl（切换时指示条平滑滑动）；Shell 常驻不随子页重挂载。
 */
export function SettingsShell({ page, onNavigatePage, children }: SettingsShellProps) {
  return (
    <Stack gap="md" p="md">
      <Title order={3}>设置</Title>
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Paper shadow="sm" withBorder radius="sm" p={6}>
          <SegmentedControl
            orientation="vertical"
            radius="sm"
            w={120}
            value={page}
            onChange={(value) => onNavigatePage(value as SettingsPageId)}
            data={SETTINGS_L2_NAVIGATION.map(({ page: value, label }) => ({ value, label }))}
            aria-label="选择设置分区"
            styles={{ label: { paddingBlock: 8 } }}
          />
        </Paper>
        <Box style={{ flex: "1 1 auto", minWidth: 0 }}>{children}</Box>
      </Group>
    </Stack>
  );
}
