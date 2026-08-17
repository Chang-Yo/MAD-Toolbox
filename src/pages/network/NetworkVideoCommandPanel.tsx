import { Button, Divider, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconPencil, IconRotate } from "@tabler/icons-react";
import type { PreviewResult } from "./api";
import { CommandPreview } from "../../components/common/CommandPreview";

interface NetworkVideoCommandPanelProps {
  expertText: string | null;
  preview: PreviewResult | null;
  previewError: string | null;
  onEnterExpert: () => void;
  onExitExpert: () => void;
  onExpertTextChange: (value: string) => void;
  withDivider?: boolean;
}

export function NetworkVideoCommandPanel({
  expertText,
  preview,
  previewError,
  onEnterExpert,
  onExitExpert,
  onExpertTextChange,
  withDivider
}: NetworkVideoCommandPanelProps) {
  const expertMode = expertText !== null;

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {expertMode ? "命令（可编辑，每行一个参数）" : "命令预览"}
        </Text>
        {expertMode ? (
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<IconRotate size={14} />}
            onClick={onExitExpert}
          >
            还原为表单
          </Button>
        ) : (
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<IconPencil size={14} />}
            onClick={onEnterExpert}
            disabled={!preview}
          >
            编辑命令
          </Button>
        )}
      </Group>
      {expertMode ? (
        <>
          <Text size="xs" c="yellow">
            专家模式：表单已锁定，提交将按下方命令原文执行（yt-dlp 本体不可更换）
          </Text>
          <Textarea
            autosize
            minRows={4}
            value={expertText}
            onChange={(event) => onExpertTextChange(event.currentTarget.value)}
            styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
          />
        </>
      ) : (
        <CommandPreview display={preview?.display ?? null} error={previewError} />
      )}
      {withDivider && <Divider my={4} />}
    </Stack>
  );
}
