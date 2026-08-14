/**
 * 应用壳（Mantine）：侧栏导航 + 内容区。
 * 窗口为 Overlay 标题栏（tauri.conf titleBarStyle），侧栏顶部与内容区顶部
 * 各保留 data-tauri-drag-region 拖拽条。
 * 视觉基调：清爽——留白充足、细边框、少色彩，主色 teal 只出现在激活态与主按钮。
 */

import {
  Badge,
  Group,
  NavLink,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  useMantineColorScheme
} from "@mantine/core";
import { IconDeviceDesktop, IconMoon, IconSun, type Icon as TablerIcon } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { NavPage } from "../lib/types";
import appIcon from "../assets/app-icon.png";
import { platformLabel } from "../lib/platform";
import packageInfo from "../../package.json";

export interface NavEntry {
  page: NavPage;
  label: string;
  icon: TablerIcon;
}

interface AppShellV2Props {
  navItems: NavEntry[];
  utilityItems: NavEntry[];
  active: NavPage;
  onNavigate: (page: NavPage) => void;
  distributionMode: "Lite" | "Full";
  children: ReactNode;
}

/** 明暗主题切换：浅色 / 跟随系统 / 深色，选择持久化在 localStorage（Mantine 默认行为）。 */
function ThemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <SegmentedControl
      mt="sm"
      size="xs"
      fullWidth
      value={colorScheme}
      onChange={(value) => setColorScheme(value as "light" | "auto" | "dark")}
      data={[
        {
          value: "light",
          label: (
            <Tooltip label="浅色">
              <IconSun size={14} />
            </Tooltip>
          )
        },
        {
          value: "auto",
          label: (
            <Tooltip label="跟随系统">
              <IconDeviceDesktop size={14} />
            </Tooltip>
          )
        },
        {
          value: "dark",
          label: (
            <Tooltip label="深色">
              <IconMoon size={14} />
            </Tooltip>
          )
        }
      ]}
    />
  );
}

export function AppShellV2({
  navItems,
  utilityItems,
  active,
  onNavigate,
  distributionMode,
  children
}: AppShellV2Props) {
  const renderLinks = (items: NavEntry[]) =>
    items.map(({ page, label, icon: Icon }) => (
      <NavLink
        key={page}
        label={label}
        leftSection={<Icon size={17} stroke={1.7} />}
        active={active === page}
        onClick={() => onNavigate(page)}
        variant="light"
        style={{ borderRadius: "var(--mantine-radius-md)" }}
      />
    ));

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Stack
        component="aside"
        gap={0}
        p="sm"
        w={224}
        style={{
          flexShrink: 0,
          borderRight: "1px solid var(--mantine-color-default-border)",
          background: "var(--mantine-color-body)"
        }}
      >
        <div data-tauri-drag-region style={{ height: 28 }} />
        <Group gap="sm" px="xs" pb="md" data-tauri-drag-region>
          <img src={appIcon} alt="" width={30} height={30} style={{ borderRadius: 8 }} />
          <div>
            <Text size="sm" fw={600} lh={1.2}>
              MAD Toolbox
            </Text>
            <Text size="xs" c="dimmed" lh={1.2}>
              v{packageInfo.version} · {distributionMode}
            </Text>
          </div>
        </Group>
        <Stack gap={2}>{renderLinks(navItems)}</Stack>
        <div style={{ flex: 1 }} />
        <Stack gap={2}>{renderLinks(utilityItems)}</Stack>
        <ThemeSwitch />
        <Badge variant="light" color="gray" mt="sm" style={{ textTransform: "none" }}>
          {platformLabel}
        </Badge>
      </Stack>
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div data-tauri-drag-region style={{ height: 28, flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 980, margin: "0 auto" }}>{children}</div>
        </div>
      </main>
    </div>
  );
}
