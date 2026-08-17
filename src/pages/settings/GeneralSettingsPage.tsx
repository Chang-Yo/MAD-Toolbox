import {
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
  useMantineColorScheme,
  type MantineColorScheme
} from "@mantine/core";
import { notifications } from "../../lib/notifications";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { IconDeviceFloppy, IconFolderOpen } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../lib/types";

interface GeneralSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
}

export function GeneralSettingsPage({ settings, onSave }: GeneralSettingsPageProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [directory, setDirectory] = useState(settings.defaultOutputDirectory || "");
  const [proxy, setProxy] = useState(settings.proxy || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDirectory(settings.defaultOutputDirectory || "");
    setProxy(settings.proxy || "");
  }, [settings.defaultOutputDirectory, settings.proxy]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        ...settings,
        defaultOutputDirectory: directory.trim() || null,
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
    <Stack gap="lg" maw={760}>
      <div>
        <Text fw={500}>默认导出目录</Text>
        <TextInput
          mt="sm"
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
      </div>

      <div>
        <Text fw={500}>全局代理</Text>
        <Text size="xs" c="dimmed">
          格式：http://127.0.0.1:7890，留空则不使用代理。
        </Text>
        <TextInput
          mt="sm"
          placeholder="http://127.0.0.1:7890"
          value={proxy}
          onChange={(event) => setProxy(event.currentTarget.value)}
        />
      </div>

      <div>
        <Text fw={500}>主题</Text>
        <SegmentedControl
          mt="sm"
          w="100%"
          radius="md"
          value={colorScheme}
          onChange={(value) => setColorScheme(value as MantineColorScheme)}
          data={[
            { value: "light", label: "浅色" },
            { value: "dark", label: "深色" },
            { value: "auto", label: "跟随系统" }
          ]}
        />
      </div>

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
  );
}
