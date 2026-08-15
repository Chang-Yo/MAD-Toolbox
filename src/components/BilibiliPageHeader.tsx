import { Button, Group, Menu, Title } from "@mantine/core";
import { IconChevronDown, IconDeviceFloppy, IconPlayerPlay, IconQrcode } from "@tabler/icons-react";
import type { SavedTemplate } from "../pages/bilibili/templates";
import { DependencyMissingBadge } from "./DependencyMissingBadge";

interface BilibiliPageHeaderProps {
  active: boolean;
  loginPhase: "idle" | "starting" | "running";
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  templateMenuOpened: boolean;
  templates: SavedTemplate[];
  onTemplateMenuChange: (opened: boolean) => void;
  onBeginLogin: () => void;
  onSaveTemplate: () => void;
  onApplyTemplate: (template: SavedTemplate) => void;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function BilibiliPageHeader({
  active,
  loginPhase,
  submitting,
  submitDisabled,
  onSubmit,
  templateMenuOpened,
  templates,
  onTemplateMenuChange,
  onBeginLogin,
  onSaveTemplate,
  onApplyTemplate,
  dependencyLabels,
  onOpenDependencies
}: BilibiliPageHeaderProps) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Title order={3}>哔哩哔哩下载</Title>
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          添加到任务队列
        </Button>
        <Button
          variant="light"
          leftSection={<IconQrcode size={16} />}
          loading={loginPhase === "starting"}
          disabled={loginPhase !== "idle"}
          onClick={onBeginLogin}
        >
          {loginPhase === "running" ? "等待扫码" : "扫码登录"}
        </Button>
        <Menu opened={active && templateMenuOpened} onChange={onTemplateMenuChange}>
          <Menu.Target>
            <Button variant="default" rightSection={<IconChevronDown size={14} />}>
              模板
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={onSaveTemplate}>
              保存当前设置为模板
            </Menu.Item>
            {templates.length > 0 && <Menu.Divider />}
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
