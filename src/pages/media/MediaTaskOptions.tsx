import { Group, Switch } from "@mantine/core";
import type { MediaFormState } from "./form";

interface MediaTaskOptionsProps {
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaTaskOptions({ form, disabled, onUpdate }: MediaTaskOptionsProps) {
  return (
    <Group gap="lg">
      <Switch
        label="保留全部流"
        checked={form.mapAll}
        onChange={(event) => onUpdate({ mapAll: event.currentTarget.checked })}
        disabled={disabled}
      />
      <Switch
        label="保留元数据与章节"
        checked={form.preserveMetadata}
        onChange={(event) => onUpdate({ preserveMetadata: event.currentTarget.checked })}
        disabled={disabled}
      />
      <Switch
        label="覆盖已存在文件"
        checked={form.overwrite}
        onChange={(event) => onUpdate({ overwrite: event.currentTarget.checked })}
        disabled={disabled}
      />
    </Group>
  );
}
