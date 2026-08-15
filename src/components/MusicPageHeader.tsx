import { Button, Group, Menu, Title } from "@mantine/core";
import {
  IconChevronDown,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconPlayerStop
} from "@tabler/icons-react";
import type { MusicMode } from "../pages/music/configuration";
import type { SavedTemplate } from "../pages/music/templates";

interface MusicPageHeaderProps {
  active: boolean;
  mode: MusicMode;
  runLoading: boolean;
  runDisabled: boolean;
  onRun: () => void;
  searching: boolean;
  stopping: boolean;
  onStopSearch: () => void;
  templateMenuOpened: boolean;
  templates: SavedTemplate[];
  onTemplateMenuChange: (opened: boolean) => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (template: SavedTemplate) => void;
}

export function MusicPageHeader({
  active,
  mode,
  runLoading,
  runDisabled,
  onRun,
  searching,
  stopping,
  onStopSearch,
  templateMenuOpened,
  templates,
  onTemplateMenuChange,
  onSaveTemplate,
  onApplyTemplate
}: MusicPageHeaderProps) {
  const promptToSave = () => {
    const name = window.prompt("模板名称");
    if (name?.trim()) onSaveTemplate(name.trim());
  };

  return (
    <Group justify="space-between" wrap="nowrap">
      <Title order={3}>音乐下载</Title>
      <Group gap="xs" wrap="nowrap">
        {searching && (
          <Button
            color="red"
            variant="light"
            leftSection={<IconPlayerStop size={16} />}
            loading={stopping}
            onClick={onStopSearch}
          >
            停止搜索
          </Button>
        )}
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          loading={runLoading}
          disabled={runDisabled}
          onClick={onRun}
        >
          {mode === "search" ? "开始搜索" : "下载歌单"}
        </Button>
        <Menu opened={active && templateMenuOpened} onChange={onTemplateMenuChange}>
          <Menu.Target>
            <Button variant="default" rightSection={<IconChevronDown size={14} />}>
              模板
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={promptToSave}>
              保存当前设置为模板
            </Menu.Item>
            {templates.length > 0 ? <Menu.Divider /> : null}
            {templates.map((template) => (
              <Menu.Item key={template.id} onClick={() => onApplyTemplate(template)}>
                {template.name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
