import { TextInput } from "@mantine/core";
import type { MediaFormState } from "./form";
import type { MediaPageOperation } from "./workflow";

interface MediaExtractFieldsProps {
  operation: MediaPageOperation;
  form: MediaFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaExtractFields({
  operation,
  form,
  disabled,
  onUpdate
}: MediaExtractFieldsProps) {
  if (operation !== "video-extract" && operation !== "audio" && operation !== "subtitle-extract") {
    return null;
  }

  const value =
    operation === "audio"
      ? form.audioStreamIndex
      : operation === "video-extract"
        ? form.videoStreamIndex
        : form.subtitleStreamIndex;

  const update = (nextValue: string) => {
    if (operation === "audio") onUpdate({ audioStreamIndex: nextValue });
    else if (operation === "video-extract") onUpdate({ videoStreamIndex: nextValue });
    else onUpdate({ subtitleStreamIndex: nextValue });
  };

  return (
    <TextInput
      label="流序号"
      description="同类型流的序号，从 0 开始"
      value={value}
      onChange={(event) => update(event.currentTarget.value)}
      disabled={disabled}
    />
  );
}
