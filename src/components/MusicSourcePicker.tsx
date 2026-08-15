import { Badge, Button, Chip, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { DEFAULT_MUSIC_SOURCES, MUSIC_SOURCE_GROUPS } from "../pages/music/configuration";
import { CollapsibleSection } from "./CollapsibleSection";

interface MusicSourcePickerProps {
  sources: string[];
  onChange: (sources: string[]) => void;
}

export function MusicSourcePicker({ sources, onChange }: MusicSourcePickerProps) {
  const [open, setOpen] = useState(true);

  return (
    <CollapsibleSection
      title={
        <>
          <Text size="sm" fw={500}>
            音乐源
          </Text>
          <Badge size="xs" variant="light" color="gray">
            已选 {sources.length}
          </Badge>
        </>
      }
      opened={open}
      onToggle={() => setOpen((value) => !value)}
      action={
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => onChange([...DEFAULT_MUSIC_SOURCES])}
        >
          恢复默认
        </Button>
      }
    >
      <Chip.Group multiple value={sources} onChange={onChange}>
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            同时搜索过多音乐源会明显变慢并产生重复结果
          </Text>
          {MUSIC_SOURCE_GROUPS.map(([group, entries]) => (
            <div key={group}>
              <Text size="xs" c="dimmed" mb={4}>
                {group}
              </Text>
              <Group gap={6}>
                {entries.map(([source, label]) => (
                  <Chip key={source} value={source} size="xs" variant="light">
                    {label}
                  </Chip>
                ))}
              </Group>
            </div>
          ))}
        </Stack>
      </Chip.Group>
    </CollapsibleSection>
  );
}
