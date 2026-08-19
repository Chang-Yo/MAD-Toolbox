import {
  ActionIcon,
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
import {
  IconDeviceDesktop,
  IconBookDownload,
  IconFolderOpen,
  IconMoon,
  IconSun
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { FieldWithActions } from "../../components/common/FieldWithActions";
import type { AppSettings } from "./api";

interface GeneralSettingsPageProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<AppSettings>;
}

/** 主题选项的「图标 + 文案」标签：inline-flex 随 label 的 text-align:center 整体居中 */
function themeOptionLabel(icon: ReactNode, text: string) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      {text}
    </span>
  );
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
        <Text size="xs" c="dimmed">
          下载与导出任务的默认存放位置，各功能页未单独指定时使用。
        </Text>
        <FieldWithActions
          mt="sm"
          actions={
            <Tooltip label="选择目录">
              <ActionIcon
                variant="default"
                size="input-sm"
                aria-label="选择默认导出目录"
                onClick={() => void pickDirectory()}
              >
                <IconFolderOpen size={16} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          }
        >
          <TextInput
            placeholder="系统「下载」目录下的 MADToolbox"
            value={directory}
            onChange={(event) => setDirectory(event.currentTarget.value)}
          />
        </FieldWithActions>
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
          w={320}
          radius="md"
          value={colorScheme}
          onChange={(value) => setColorScheme(value as MantineColorScheme)}
          data={[
            {
              value: "light",
              label: themeOptionLabel(<IconSun size={15} stroke={1.7} />, "浅色")
            },
            {
              value: "dark",
              label: themeOptionLabel(<IconMoon size={15} stroke={1.7} />, "深色")
            },
            {
              value: "auto",
              label: themeOptionLabel(<IconDeviceDesktop size={15} stroke={1.7} />, "跟随系统")
            }
          ]}
        />
      </div>

      <Group justify="end">
        <Button
          leftSection={<IconBookDownload size={15} />}
          loading={saving}
          onClick={() => void save()}
        >
          保存设置
        </Button>
      </Group>
    </Stack>
  );
}
