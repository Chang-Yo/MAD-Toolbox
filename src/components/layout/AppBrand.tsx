import { Text } from "@mantine/core";

// 顶栏标题：样式（字体/字号/主题协调色）集中在 animations.css 的 .app-title
export function AppBrand() {
  return (
    <Text component="span" className="app-title">
      MAD Toolbox
    </Text>
  );
}
