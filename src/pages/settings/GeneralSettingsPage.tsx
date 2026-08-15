import { Button, Card, Group, Radio, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { IconDeviceFloppy, IconFolderOpen } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../lib/types";
import { isWindows } from "../../lib/platform";

interface GeneralSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
}

export function GeneralSettingsPage({ settings, onSave }: GeneralSettingsPageProps) {
  const [directory, setDirectory] = useState(settings.defaultOutputDirectory || "");
  const [dependencyPreference, setDependencyPreference] = useState(settings.dependencyPreference);
  const [proxy, setProxy] = useState(settings.proxy || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDirectory(settings.defaultOutputDirectory || "");
    setDependencyPreference(settings.dependencyPreference);
    setProxy(settings.proxy || "");
  }, [settings.defaultOutputDirectory, settings.dependencyPreference, settings.proxy]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        defaultOutputDirectory: directory.trim() || null,
        dependencyPreference,
        proxy: proxy.trim() || null
      });
      notifications.show({ message: "设置已保存", color: "teal" });
    } catch (error) {
      notifications.show({ message: `保存失败：${String(error)}`, color: "red" });
    } finally {
      setSaving(false);
    }
  };

  const pickDirectory = async () => {
    const selected = await openDialog({ directory: true });
    if (typeof selected === "string") setDirectory(selected);
  };

  return (
    <Stack gap="md" p="md" maw={760}>
      <div>
        <Title order={3}>通用设置</Title>
        <Text size="sm" c="dimmed">
          管理所有工具共享的默认值；每个任务仍可单独覆盖。
        </Text>
      </div>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <div>
            <Text fw={500}>默认导出目录</Text>
            <Text size="xs" c="dimmed">
              用于哔哩哔哩、网络视频、音乐下载和媒体处理。
            </Text>
          </div>
          <TextInput
            placeholder="留空时各功能页默认使用系统「下载」目录下的 MADToolbox"
            value={directory}
            onChange={(event) => setDirectory(event.currentTarget.value)}
            leftSection={
              <Tooltip label="选择目录">
                <IconFolderOpen
                  size={16}
                  style={{ cursor: "pointer" }}
                  onClick={() => void pickDirectory()}
                />
              </Tooltip>
            }
          />

          <div>
            <Text fw={500}>全局代理</Text>
            <Text size="xs" c="dimmed">
              格式：http://127.0.0.1:7890，留空则不使用代理。
            </Text>
          </div>
          <TextInput
            placeholder="http://127.0.0.1:7890"
            value={proxy}
            onChange={(event) => setProxy(event.currentTarget.value)}
          />

          <div>
            <Text fw={500}>工具版本来源</Text>
            <Text size="xs" c="dimmed">
              找不到首选来源时自动回退；安装说明与当前状态位于“依赖管理”。
            </Text>
          </div>
          <Radio.Group
            value={dependencyPreference}
            onChange={(value) =>
              setDependencyPreference(value as AppSettings["dependencyPreference"])
            }
          >
            <Stack gap="xs">
              <Radio value="bundled" label="应用内置版本优先（默认）" />
              <Radio
                value="system"
                label={isWindows ? "系统安装版本优先" : "系统 / Homebrew 优先"}
              />
            </Stack>
          </Radio.Group>

          <Group justify="end">
            <Button
              leftSection={<IconDeviceFloppy size={15} />}
              loading={saving}
              onClick={() => void save()}
            >
              保存设置
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
