import { Group, NumberInput, Select, Stack, Switch, TextInput } from "@mantine/core";
import type { MediaFormState } from "./form";

interface MediaAdvancedFieldsProps {
  form: MediaFormState;
  onUpdate: (patch: Partial<MediaFormState>) => void;
}

export function MediaAdvancedFields({ form, onUpdate }: MediaAdvancedFieldsProps) {
  return (
    <Stack gap="sm">
      <Group grow>
        <TextInput
          label="缩放宽度"
          placeholder="留空保持"
          value={form.width}
          onChange={(event) => onUpdate({ width: event.currentTarget.value })}
        />
        <TextInput
          label="缩放高度"
          placeholder="留空保持"
          value={form.height}
          onChange={(event) => onUpdate({ height: event.currentTarget.value })}
        />
        <TextInput
          label="帧率"
          value={form.frameRate}
          onChange={(event) => onUpdate({ frameRate: event.currentTarget.value })}
        />
        <NumberInput
          label="倍速"
          step={0.25}
          min={0.25}
          value={form.speed}
          onChange={(value) => onUpdate({ speed: typeof value === "number" ? value : 1 })}
        />
      </Group>
      <Group grow>
        <TextInput
          label="视频码率"
          placeholder="如 8M"
          value={form.videoBitrate}
          onChange={(event) => onUpdate({ videoBitrate: event.currentTarget.value })}
        />
        <TextInput
          label="CRF"
          value={form.crf}
          onChange={(event) => onUpdate({ crf: event.currentTarget.value })}
        />
        <TextInput
          label="音频码率"
          value={form.audioBitrate}
          onChange={(event) => onUpdate({ audioBitrate: event.currentTarget.value })}
        />
        <TextInput
          label="采样率"
          placeholder="如 48000"
          value={form.sampleRate}
          onChange={(event) => onUpdate({ sampleRate: event.currentTarget.value })}
        />
      </Group>
      <Group grow align="end">
        <Select
          label="旋转"
          data={[
            { value: "none", label: "不旋转" },
            { value: "90cw", label: "顺时针 90°" },
            { value: "90ccw", label: "逆时针 90°" },
            { value: "180", label: "180°" }
          ]}
          value={form.rotation}
          onChange={(value) => value && onUpdate({ rotation: value })}
          allowDeselect={false}
        />
        <TextInput
          label="裁剪"
          placeholder="如 1920:800:0:140"
          value={form.crop}
          onChange={(event) => onUpdate({ crop: event.currentTarget.value })}
        />
        <TextInput
          label="音量"
          placeholder="如 1.5 或 -3dB"
          value={form.volume}
          onChange={(event) => onUpdate({ volume: event.currentTarget.value })}
        />
      </Group>
      <Group gap="lg">
        <Switch
          label="去隔行"
          checked={form.deinterlace}
          onChange={(event) => onUpdate({ deinterlace: event.currentTarget.checked })}
        />
        <Switch
          label="水平翻转"
          checked={form.flipHorizontal}
          onChange={(event) => onUpdate({ flipHorizontal: event.currentTarget.checked })}
        />
        <Switch
          label="垂直翻转"
          checked={form.flipVertical}
          onChange={(event) => onUpdate({ flipVertical: event.currentTarget.checked })}
        />
        <Switch
          label="响度归一化"
          checked={form.loudnessNormalization}
          onChange={(event) => onUpdate({ loudnessNormalization: event.currentTarget.checked })}
        />
        <Switch
          label="faststart"
          checked={form.fastStart}
          onChange={(event) => onUpdate({ fastStart: event.currentTarget.checked })}
        />
      </Group>
    </Stack>
  );
}
