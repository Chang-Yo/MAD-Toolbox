import { Group, TextInput } from "@mantine/core";
import type { MediaFormState } from "../pages/media/form";

interface MediaTimeRangeFieldsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTimeRangeFields({ form, disabled, onUpdate }: MediaTimeRangeFieldsProps) {
  return (
    <Group grow>
      <TextInput
        label="起始时间"
        placeholder="如 00:01:30"
        value={form.startTime}
        onChange={(event) => onUpdate({ startTime: event.currentTarget.value })}
        disabled={disabled}
      />
      <TextInput
        label="持续时长"
        placeholder="如 00:00:10"
        value={form.duration}
        onChange={(event) => onUpdate({ duration: event.currentTarget.value })}
        disabled={disabled}
      />
    </Group>
  );
}
