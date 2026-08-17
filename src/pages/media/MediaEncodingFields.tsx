import { Group, Select } from "@mantine/core";
import type { MediaFormState } from "./form";
import type { MediaPageOperation } from "./workflow";

interface MediaEncodingFieldsProps {
  operation: MediaPageOperation;
  form: MediaFormState;
  containers: string[] | undefined;
  videoCodecs: string[];
  audioCodecs: string[];
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaEncodingFields({
  operation,
  form,
  containers,
  videoCodecs,
  audioCodecs,
  disabled,
  onUpdate
}: MediaEncodingFieldsProps) {
  const showCodecs = operation === "transcode" || operation === "remux";

  return (
    <Group grow>
      {containers && (
        <Select
          label="输出容器"
          data={containers}
          value={containers.includes(form.container) ? form.container : containers[0]}
          onChange={(value) => value && onUpdate({ container: value })}
          disabled={disabled}
          allowDeselect={false}
        />
      )}
      {showCodecs && (
        <Select
          label="视频编码"
          data={videoCodecs}
          value={form.videoCodec}
          onChange={(value) => value && onUpdate({ videoCodec: value })}
          disabled={disabled}
          allowDeselect={false}
        />
      )}
      {(showCodecs || operation === "audio") && (
        <Select
          label="音频编码"
          data={audioCodecs}
          value={form.audioCodec}
          onChange={(value) => value && onUpdate({ audioCodec: value })}
          disabled={disabled}
          allowDeselect={false}
        />
      )}
    </Group>
  );
}
