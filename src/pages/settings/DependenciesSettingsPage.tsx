import { SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DependencyInstallCards } from "../../components/DependencyInstallCards";
import { DependencyStatusPanel } from "../../components/DependencyStatusPanel";
import { isWindows } from "../../lib/platform";
import type { AppSettings, DependencyStatus } from "../../lib/types";

interface DependenciesSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
  dependencies: DependencyStatus[];
  loading: boolean;
  distributionMode: "Lite" | "Full";
  onRefresh: () => void;
}

export function DependenciesSettingsPage({
  settings,
  onSave,
  dependencies,
  loading,
  distributionMode,
  onRefresh
}: DependenciesSettingsPageProps) {
  const changePreference = async (value: string) => {
    const preference = value as AppSettings["dependencyPreference"];
    if (preference === settings.dependencyPreference) return;
    try {
      await onSave({ ...settings, dependencyPreference: preference });
      onRefresh();
    } catch (error) {
      notifications.show({ message: `保存失败：${String(error)}`, color: "red" });
    }
  };

  return (
    <Stack gap="md" maw={900}>
      <Text size="sm" c="dimmed">
        各命令行工具的来源、版本与安装状态；当前为 {isWindows ? "Windows" : "macOS"}{" "}
        {distributionMode} 构建。
      </Text>
      <div>
        <Text fw={500}>工具版本来源</Text>
        <Text size="xs" c="dimmed">
          找不到首选来源时自动回退到另一来源，切换后立即重新检测。
        </Text>
        <SegmentedControl
          mt="sm"
          w="100%"
          radius="md"
          value={settings.dependencyPreference}
          onChange={(value) => void changePreference(value)}
          data={[
            { value: "bundled", label: "内置版本优先" },
            { value: "system", label: isWindows ? "系统版本优先" : "系统 / Homebrew 优先" }
          ]}
        />
      </div>
      <DependencyStatusPanel dependencies={dependencies} loading={loading} onRefresh={onRefresh} />
      <DependencyInstallCards dependencies={dependencies} />
    </Stack>
  );
}
