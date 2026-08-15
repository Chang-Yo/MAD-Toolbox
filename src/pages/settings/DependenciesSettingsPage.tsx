import { Stack, Text, Title } from "@mantine/core";
import { DependencyStatusPanel } from "../../components/DependencyStatusPanel";
import type { DependencyStatus } from "../../lib/types";

interface DependenciesSettingsPageProps {
  dependencies: DependencyStatus[];
  loading: boolean;
  distributionMode: "Lite" | "Full";
  onRefresh: () => void;
}

export function DependenciesSettingsPage(props: DependenciesSettingsPageProps) {
  return (
    <Stack gap="md" p="md" maw={900}>
      <div>
        <Title order={3}>依赖管理</Title>
        <Text size="sm" c="dimmed">
          查看各命令行工具的来源、版本和安装状态。
        </Text>
      </div>
      <DependencyStatusPanel {...props} />
    </Stack>
  );
}
