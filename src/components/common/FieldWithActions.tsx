import { Box, Group, type GroupProps } from "@mantine/core";
import type { ReactNode } from "react";

interface FieldWithActionsProps extends GroupProps {
  /** 内容（输入框 / 文本行），占满剩余宽度，过长时在内部截断不换行 */
  children: ReactNode;
  /** 尾部相邻的操作按钮（1~2 个 ActionIcon），固定尺寸、随组右对齐 */
  actions?: ReactNode;
}

/** 内容 + 尾部操作按钮的横向组合：按钮是分离的独立方块（不与内容贴合），
 * 内嵌图标式的入口不易被察觉，独立按钮的可供性（affordance）更强。
 * 固化“内容 flex:1、按钮与输入框同高、nowrap、间距 8px”的排版约定，
 * 供目录输入、设置页 About 行等复用。 */
export function FieldWithActions({ children, actions, ...groupProps }: FieldWithActionsProps) {
  return (
    <Group gap={8} wrap="nowrap" align="center" {...groupProps}>
      <Box style={{ flex: "1 1 auto", minWidth: 0 }}>
        {children}
      </Box>
      {actions}
    </Group>
  );
}
