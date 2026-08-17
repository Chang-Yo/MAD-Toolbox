/**
 * 常驻命令预览（架构文档 §5）：表单为源、命令为影。
 * 只读态展示后端 adapter 返回的脱敏文本（所见即所执行）；
 * 编辑态（专家模式）由父组件切换为文本域，本组件只负责只读展示。
 */

import { Code, Text } from "@mantine/core";

interface CommandPreviewProps {
  display: string | null;
  error?: string | null;
}

export function CommandPreview({ display, error }: CommandPreviewProps) {
  if (error) {
    return (
      <Text size="sm" c="red">
        {error}
      </Text>
    );
  }
  return (
    <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {display ?? "…"}
    </Code>
  );
}
