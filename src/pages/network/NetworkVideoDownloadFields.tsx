import { Group, SegmentedControl, Select, Switch, Text, TextInput } from "@mantine/core";
import { OutputDirectoryField } from "../../components/common/OutputDirectoryField";
import { browserCookieOptions } from "../../lib/platform";
import type { NetworkFormState } from "./form";

const MODE_OPTIONS = [
  { value: "video", label: "视频" },
  { value: "audio", label: "仅音频" },
  { value: "thumbnail", label: "仅封面" },
  { value: "subtitles", label: "仅字幕" }
];

interface NetworkVideoDownloadFieldsProps {
  form: NetworkFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<NetworkFormState>) => void;
  onPickOutputDirectory: () => Promise<void>;
  /** 设置页的全局代理；已设置时作为占位提示，留空提交即使用它 */
  globalProxy?: string | null;
}

export function NetworkVideoDownloadFields({
  form,
  disabled,
  onUpdate,
  onPickOutputDirectory,
  globalProxy
}: NetworkVideoDownloadFieldsProps) {
  return (
    <>
      <TextInput
        label="视频地址"
        placeholder="https://…（YouTube 及 yt-dlp 支持的站点）"
        value={form.url}
        onChange={(event) => onUpdate({ url: event.currentTarget.value })}
        disabled={disabled}
      />
      <Group grow align="end">
        <div>
          <Text size="sm" fw={500} mb={4}>
            下载内容
          </Text>
          <SegmentedControl
            data={MODE_OPTIONS}
            value={form.mode}
            onChange={(value) => onUpdate({ mode: value as NetworkFormState["mode"] })}
            disabled={disabled}
            fullWidth
          />
        </div>
        <Select
          label="浏览器 Cookie（站点要求登录时自动兜底）"
          data={browserCookieOptions}
          value={form.cookiesBrowser}
          onChange={(value) => onUpdate({ cookiesBrowser: value ?? "" })}
          disabled={disabled}
          allowDeselect={false}
        />
      </Group>
      {form.mode === "audio" && (
        <TextInput
          label="音频格式"
          placeholder="best / mp3 / m4a / flac …"
          value={form.audioFormat}
          onChange={(event) => onUpdate({ audioFormat: event.currentTarget.value })}
          disabled={disabled}
        />
      )}
      {form.mode === "subtitles" && (
        <TextInput
          label="字幕语言"
          placeholder="如 zh.*,en.*"
          value={form.subtitleLanguages}
          onChange={(event) => onUpdate({ subtitleLanguages: event.currentTarget.value })}
          disabled={disabled}
        />
      )}
      <OutputDirectoryField
        value={form.outputDirectory}
        disabled={disabled}
        onChange={(outputDirectory) => onUpdate({ outputDirectory })}
        onBrowse={onPickOutputDirectory}
      />
      <Group grow>
        <TextInput
          label="代理"
          placeholder={globalProxy ?? "留空使用系统代理"}
          value={form.proxy}
          onChange={(event) => onUpdate({ proxy: event.currentTarget.value })}
          disabled={disabled}
        />
        <TextInput
          label="播放列表选集"
          placeholder="如 1,3-5"
          value={form.playlistItems}
          onChange={(event) => onUpdate({ playlistItems: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      <Group gap="lg">
        <Switch
          label="仅下载单个视频"
          checked={form.noPlaylist}
          onChange={(event) => onUpdate({ noPlaylist: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label="内嵌元数据"
          checked={form.embedMetadata}
          onChange={(event) => onUpdate({ embedMetadata: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label="内嵌封面"
          checked={form.embedThumbnail}
          onChange={(event) => onUpdate({ embedThumbnail: event.currentTarget.checked })}
          disabled={disabled}
        />
        <Switch
          label="内嵌字幕"
          checked={form.embedSubtitles}
          onChange={(event) => onUpdate({ embedSubtitles: event.currentTarget.checked })}
          disabled={disabled}
        />
      </Group>
    </>
  );
}
