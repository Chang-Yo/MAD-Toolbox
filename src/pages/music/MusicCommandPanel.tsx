import { Code, Divider, Stack, Text } from "@mantine/core";
import type { MusicSessionPhase } from "../../stores/music-session";

interface MusicCommandPanelProps {
  preview: string | null;
  previewError: string | null;
  sessionPhase: MusicSessionPhase;
  sourceCount: number;
  withDivider?: boolean;
}

export function MusicCommandPanel({
  preview,
  previewError,
  sessionPhase,
  sourceCount,
  withDivider
}: MusicCommandPanelProps) {
  const searchInProgress =
    sessionPhase === "starting" || sessionPhase === "searching" || sessionPhase === "canceling";

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        等效命令预览
      </Text>
      <Text size="xs" c="dimmed">
        实际执行由 musicdl 适配器接管；这里仅展示当前配置对应的等效命令。
      </Text>
      {previewError ? (
        <Text size="sm" c="red">
          {previewError}
        </Text>
      ) : (
        <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {preview ?? "…"}
        </Code>
      )}
      {searchInProgress && (
        <Text size="sm" c="dimmed">
          {sessionPhase === "starting"
            ? "正在启动新搜索；旧结果会保留到后端确认新会话。"
            : sessionPhase === "canceling"
              ? "正在停止搜索……"
              : `正在通过 ${sourceCount} 个音乐源搜索……结果将陆续显示。`}
        </Text>
      )}
      {withDivider && <Divider my={4} />}
    </Stack>
  );
}
