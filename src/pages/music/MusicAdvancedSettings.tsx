import { Group, Stack, Text, Textarea } from "@mantine/core";
import type { MusicFormPatch, MusicFormState } from "./configuration";

interface MusicAdvancedSettingsProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
}

export function MusicAdvancedSettings({ form, onChange }: MusicAdvancedSettingsProps) {
  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        以下四项对应 musicdl 的全部高级 CLI 参数；上方的目录、Cookie、代理、结果数与线程数会与 JSON
        合并。
      </Text>
      <Group grow align="start">
        <Textarea
          label="-i 客户端初始化设置（JSON）"
          autosize
          minRows={3}
          value={form.rawInit}
          onChange={(event) => onChange({ rawInit: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
        <Textarea
          label="-r 请求覆盖设置（JSON）"
          autosize
          minRows={3}
          value={form.rawRequests}
          onChange={(event) => onChange({ rawRequests: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
      </Group>
      <Group grow align="start">
        <Textarea
          label="-c 客户端线程设置（JSON）"
          autosize
          minRows={3}
          value={form.rawThreadings}
          onChange={(event) => onChange({ rawThreadings: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
        <Textarea
          label="-s 搜索规则（JSON）"
          autosize
          minRows={3}
          value={form.rawSearchRules}
          onChange={(event) => onChange({ rawSearchRules: event.currentTarget.value })}
          styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
        />
      </Group>
    </Stack>
  );
}
