import { Group, SegmentedControl, Select, Switch, Text, TextInput } from "@mantine/core";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import type { BilibiliFormState } from "./form";

const MODE_OPTIONS = [
  { value: "video", label: "完整视频" },
  { value: "video-only", label: "仅视频轨" },
  { value: "audio", label: "仅音频" },
  { value: "cover", label: "仅封面" },
  { value: "subtitle", label: "仅字幕" },
  { value: "danmaku", label: "仅弹幕" },
  { value: "info", label: "仅解析信息" }
];

const API_OPTIONS = [
  { value: "web", label: "Web" },
  { value: "tv", label: "TV" },
  { value: "app", label: "APP" },
  { value: "intl", label: "国际版" }
];

const COMMON_SWITCHES: Array<[keyof BilibiliFormState, string]> = [
  ["downloadDanmaku", "同时下载弹幕"],
  ["skipSubtitle", "跳过字幕"],
  ["skipCover", "跳过封面"],
  ["skipAi", "跳过 AI 字幕"]
];

interface BilibiliDownloadFieldsProps {
  form: BilibiliFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<BilibiliFormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
}

export function BilibiliDownloadFields({
  form,
  disabled,
  onUpdate,
  onPickOutputDirectory
}: BilibiliDownloadFieldsProps) {
  return (
    <>
      <TextInput
        label="视频地址"
        placeholder="https://www.bilibili.com/video/BV… 或 BV/av/ep/ss 号"
        value={form.url}
        onChange={(event) => onUpdate({ url: event.currentTarget.value })}
        disabled={disabled}
      />
      <Group grow align="end">
        <Select
          label="下载内容"
          data={MODE_OPTIONS}
          value={form.mode}
          onChange={(value) => value && onUpdate({ mode: value as BilibiliFormState["mode"] })}
          disabled={disabled}
          allowDeselect={false}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            解析接口
          </Text>
          <SegmentedControl
            data={API_OPTIONS}
            value={form.api}
            onChange={(value) => onUpdate({ api: value as BilibiliFormState["api"] })}
            disabled={disabled}
            fullWidth
          />
        </div>
      </Group>
      <Group grow>
        <TextInput
          label="选集"
          placeholder="如 1,3-5 或 ALL"
          value={form.pages}
          onChange={(event) => onUpdate({ pages: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label="画质优先级"
          placeholder="如 8K 超高清,1080P 高清"
          value={form.qualityPriority}
          onChange={(event) => onUpdate({ qualityPriority: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label="编码优先级"
          placeholder="如 hevc,av1,avc"
          value={form.encodingPriority}
          onChange={(event) => onUpdate({ encodingPriority: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      <OutputDirectoryField
        value={form.outputDirectory}
        disabled={disabled}
        placeholder="留空使用 BBDown 默认目录"
        onChange={(outputDirectory) => onUpdate({ outputDirectory })}
        onBrowse={onPickOutputDirectory}
      />
      <Group gap="lg">
        {COMMON_SWITCHES.map(([key, label]) => (
          <Switch
            key={key}
            label={label}
            checked={form[key] as boolean}
            onChange={(event) => onUpdate({ [key]: event.currentTarget.checked })}
            disabled={disabled}
          />
        ))}
      </Group>
    </>
  );
}
