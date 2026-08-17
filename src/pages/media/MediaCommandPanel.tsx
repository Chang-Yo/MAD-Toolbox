import { Button, Divider, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconPencil, IconRotate } from "@tabler/icons-react";
import type { PreviewResult } from "./api";
import { CommandPreview } from "../../components/common/CommandPreview";

interface MediaCommandPanelProps {
  isPr: boolean;
  expertMode: boolean;
  expertText: string | null;
  preview: PreviewResult | null;
  previewError: string | null;
  onEnterExpert: () => void;
  onExitExpert: () => void;
  onExpertTextChange: (value: string) => void;
  withDivider?: boolean;
}

export function MediaCommandPanel({
  isPr,
  expertMode,
  expertText,
  preview,
  previewError,
  onEnterExpert,
  onExitExpert,
  onExpertTextChange,
  withDivider
}: MediaCommandPanelProps) {
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {isPr
            ? "PR 兼容转码"
            : expertMode
              ? "命令（可编辑，每行一个参数）"
              : "命令预览（首个文件）"}
        </Text>
        {!isPr &&
          (expertMode ? (
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
          ))}
      </Group>
      {isPr ? (
        <Text size="sm" c="dimmed">
          逐文件探测流信息后自动决定容器与编码（H.264/HEVC → MP4 直拷，其余转 ProRes/MOV；
          纯音频按无损/有损选 WAV/M4A）。命令由探测结果决定，提交后可在任务详情查看。
        </Text>
      ) : expertMode ? (
        <>
          <Text size="xs" c="yellow">
            专家模式：表单已锁定，提交将按下方命令原文执行（ffmpeg 本体不可更换）
          </Text>
          <Textarea
            autosize
            minRows={4}
            value={expertText ?? ""}
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
