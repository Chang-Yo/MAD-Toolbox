import { ActionIcon, Tooltip, useMantineColorScheme } from "@mantine/core";
import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import type { ComponentType } from "react";

type ColorScheme = "light" | "auto" | "dark";

const COLOR_SCHEME_LABELS: Record<ColorScheme, string> = {
  light: "浅色",
  auto: "跟随系统",
  dark: "深色"
};

const COLOR_SCHEME_ICONS: Record<ColorScheme, ComponentType<{ size: number; style?: object }>> = {
  light: IconSun,
  dark: IconMoon,
  auto: IconDeviceDesktop
};

// 点击循环：浅色 → 深色 → 跟随系统 → 浅色
const NEXT_COLOR_SCHEME: Record<ColorScheme, ColorScheme> = {
  light: "dark",
  dark: "auto",
  auto: "light"
};

export function ThemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const selected = colorScheme as ColorScheme;

  return (
    <Tooltip
      label={`主题：${COLOR_SCHEME_LABELS[selected]}`}
      position="top"
      events={{ hover: true, focus: true, touch: false }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label={`切换界面主题，当前为${COLOR_SCHEME_LABELS[selected]}`}
        onClick={() => setColorScheme(NEXT_COLOR_SCHEME[selected])}
      >
        <span style={{ position: "relative", display: "block", width: 18, height: 18 }}>
          {(Object.keys(COLOR_SCHEME_ICONS) as ColorScheme[]).map((scheme) => {
            const Icon = COLOR_SCHEME_ICONS[scheme];
            return (
              <Icon
                key={scheme}
                size={18}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: selected === scheme ? 1 : 0,
                  transition: "opacity 160ms ease"
                }}
              />
            );
          })}
        </span>
      </ActionIcon>
    </Tooltip>
  );
}
