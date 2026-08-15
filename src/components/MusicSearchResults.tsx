import { Badge, Button, Checkbox, Group, Stack, Table, Text } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { MusicdlSearchResponse } from "../lib/types";
import { musicSourceLabel } from "../pages/music/configuration";
import type { MusicSessionPhase } from "../stores/music-session";

interface MusicSearchResultsProps {
  response: MusicdlSearchResponse;
  selected: number[];
  queuedIndices: number[];
  sessionPhase: MusicSessionPhase;
  taskSubmitting: boolean;
  onSelectedChange: Dispatch<SetStateAction<number[]>>;
  onDownload: () => void;
  onEndSession: () => void;
}

export function MusicSearchResults({
  response,
  selected,
  queuedIndices,
  sessionPhase,
  taskSubmitting,
  onSelectedChange,
  onDownload,
  onEndSession
}: MusicSearchResultsProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const queuedSet = useMemo(() => new Set(queuedIndices), [queuedIndices]);

  const toggleResult = (index: number) => {
    onSelectedChange((current) =>
      current.includes(index) ? current.filter((value) => value !== index) : [...current, index]
    );
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={500}>
          搜索结果
          <Text span size="xs" c="dimmed" ml={8}>
            {response.results.length} 项 · 已选 {selected.length} 项 · 已入队 {queuedIndices.length}{" "}
            项
          </Text>
        </Text>
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="subtle"
            color="red"
            loading={sessionPhase === "releasing"}
            disabled={sessionPhase !== "ready" || taskSubmitting}
            onClick={onEndSession}
          >
            结束本次搜索
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            onClick={() =>
              onSelectedChange(
                selected.length === response.results.length
                  ? []
                  : response.results.map((result) => result.index)
              )
            }
          >
            {selected.length === response.results.length ? "取消全选" : "全选"}
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            onClick={() =>
              onSelectedChange(
                response.results.filter((result) => result.lossless).map((result) => result.index)
              )
            }
          >
            只选无损
          </Button>
          <Button
            size="compact-sm"
            leftSection={<IconDownload size={14} />}
            disabled={!selected.length || taskSubmitting || sessionPhase !== "ready"}
            loading={taskSubmitting}
            onClick={onDownload}
          >
            下载所选
          </Button>
        </Group>
      </Group>
      {response.results.length === 0 ? (
        <Text size="sm" c="dimmed">
          没有找到音乐，请更换关键词、音乐源或登录 Cookie。
        </Text>
      ) : (
        <Table highlightOnHover verticalSpacing={6}>
          <Table.Tbody>
            {response.results.map((result) => {
              const checked = selectedSet.has(result.index);
              const queued = queuedSet.has(result.index);
              return (
                <Table.Tr
                  key={`${result.source}-${result.index}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleResult(result.index)}
                >
                  <Table.Td w={36}>
                    <Checkbox checked={checked} readOnly tabIndex={-1} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500}>
                        {result.songName}
                      </Text>
                      {queued ? (
                        <Badge size="xs" variant="light" color="blue">
                          已入队
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {result.singers}
                      {result.album ? ` · ${result.album}` : ""}
                    </Text>
                  </Table.Td>
                  <Table.Td w={140}>
                    <Badge
                      variant="light"
                      color={result.lossless ? "teal" : "gray"}
                      style={{ textTransform: "none" }}
                    >
                      {result.extension || result.codec || "未知格式"}
                      {result.bitrate ? ` · ${Math.round(result.bitrate / 1000)}k` : ""}
                    </Badge>
                  </Table.Td>
                  <Table.Td w={160}>
                    <Text size="xs">{musicSourceLabel(result.source)}</Text>
                    <Text size="xs" c="dimmed">
                      {[result.fileSize, result.duration].filter(Boolean).join(" · ")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
