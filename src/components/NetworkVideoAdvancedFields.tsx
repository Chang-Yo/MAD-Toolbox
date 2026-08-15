import { Group, NumberInput, Stack, Switch, TextInput } from "@mantine/core";
import type { NetworkFormState } from "../pages/network/form";

interface NetworkVideoAdvancedFieldsProps {
  form: NetworkFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<NetworkFormState>) => void;
}

export function NetworkVideoAdvancedFields({
  form,
  disabled,
  onUpdate
}: NetworkVideoAdvancedFieldsProps) {
  return (
    <Stack gap="sm">
      <Group grow>
        <TextInput
          label="输出文件名模板"
          value={form.outputTemplate}
          onChange={(event) => onUpdate({ outputTemplate: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label="格式选择表达式"
          placeholder="如 bv*+ba/b"
          value={form.format}
          onChange={(event) => onUpdate({ format: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      <Group grow>
        <NumberInput
          label="重试次数"
          min={0}
          value={form.retries}
          onChange={(value) => onUpdate({ retries: typeof value === "number" ? value : 10 })}
          disabled={disabled}
        />
        <NumberInput
          label="并行分片数"
          min={1}
          value={form.concurrentFragments}
          onChange={(value) =>
            onUpdate({ concurrentFragments: typeof value === "number" ? value : 4 })
          }
          disabled={disabled}
        />
      </Group>
      <Group gap="lg">
        <Switch
          label="输出 info.json"
          checked={form.writeInfoJson}
          onChange={(event) => onUpdate({ writeInfoJson: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label="详细日志"
          checked={form.verbose}
          onChange={(event) => onUpdate({ verbose: event.currentTarget.checked })}
          disabled={disabled}
        />
      </Group>
    </Stack>
  );
}
