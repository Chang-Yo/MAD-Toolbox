import {
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Textarea,
  TextInput,
  Tooltip
} from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import type { MusicFormPatch, MusicFormState, MusicMode } from "./configuration";

interface MusicConfigurationPanelProps {
  form: MusicFormState;
  onChange: (patch: MusicFormPatch) => void;
  onPickOutputDirectory: () => void;
  /** 设置页的全局代理；已设置时作为占位提示，留空提交即使用它 */
  globalProxy?: string | null;
}

export function MusicConfigurationPanel({
  form,
  onChange,
  onPickOutputDirectory,
  globalProxy
}: MusicConfigurationPanelProps) {
  return (
    <Stack gap="sm">
      <SegmentedControl
        data={[
          { value: "search", label: "搜索音乐" },
          { value: "playlist", label: "下载歌单" }
        ]}
        value={form.mode}
        onChange={(mode) => onChange({ mode: mode as MusicMode })}
      />
      {form.mode === "search" ? (
        <TextInput
          label="搜索关键词"
          placeholder="歌曲、歌手或专辑"
          value={form.keyword}
          onChange={(event) => onChange({ keyword: event.currentTarget.value })}
        />
      ) : (
        <TextInput
          label="歌单链接"
          description="链接必须由所选 musicdl 客户端支持"
          placeholder="https://music.163.com/#/playlist?id=..."
          value={form.playlistUrl}
          onChange={(event) => onChange({ playlistUrl: event.currentTarget.value })}
        />
      )}
      <Group grow>
        <TextInput
          label="下载目录"
          description="默认保存到系统「下载」目录下的 MADToolbox 文件夹"
          placeholder="留空保存到 下载/MADToolbox"
          value={form.outputDirectory}
          onChange={(event) => onChange({ outputDirectory: event.currentTarget.value })}
          leftSection={
            <Tooltip label="选择目录">
              <IconFolderOpen
                size={16}
                style={{ cursor: "pointer" }}
                onClick={onPickOutputDirectory}
              />
            </Tooltip>
          }
        />
        <NumberInput
          label="每源结果数"
          description="每个音乐源返回的搜索结果条数"
          min={1}
          max={100}
          value={form.searchSize}
          onChange={(value) => onChange({ searchSize: typeof value === "number" ? value : 5 })}
        />
        <NumberInput
          label="每源线程数"
          description="单个源内的并发请求数，搜索与下载共用"
          min={1}
          max={50}
          value={form.threadCount}
          onChange={(value) => onChange({ threadCount: typeof value === "number" ? value : 5 })}
        />
        <TextInput
          label="代理服务器"
          description="访问海外源（如 Spotify）时通常需要"
          placeholder={globalProxy ?? "http://127.0.0.1:7890"}
          value={form.proxy}
          onChange={(event) => onChange({ proxy: event.currentTarget.value })}
        />
      </Group>
      <Textarea
        label="登录 Cookie（可选）"
        description="应用到所选全部音乐源；会员音质取决于对应平台账户权限"
        autosize
        minRows={1}
        value={form.cookies}
        onChange={(event) => onChange({ cookies: event.currentTarget.value })}
      />
    </Stack>
  );
}
