import { Group, PasswordInput, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import type { BilibiliFormState } from "../pages/bilibili/form";

const ADVANCED_SWITCHES: Array<[keyof BilibiliFormState, string]> = [
  ["useMp4box", "使用 MP4Box 混流"],
  ["useAria2c", "使用 aria2c 下载"],
  ["showAll", "展示所有分 P"],
  ["hideStreams", "不显示流信息"],
  ["skipMux", "跳过混流"],
  ["multiThread", "多线程下载"],
  ["forceHttp", "强制 HTTP"],
  ["videoAscending", "视频流升序"],
  ["audioAscending", "音频流升序"],
  ["allowPcdn", "允许 PCDN"],
  ["forceReplaceHost", "强制替换 host"],
  ["saveArchive", "记录下载存档"],
  ["debug", "调试日志"]
];

const ADVANCED_VALUES: Array<[keyof BilibiliFormState, string, string]> = [
  ["filePattern", "单集文件名模板", ""],
  ["multiFilePattern", "多集文件名模板", ""],
  ["language", "语言偏好", ""],
  ["userAgent", "User-Agent", ""],
  ["aria2cArgs", "aria2c 参数", ""],
  ["mp4boxPath", "MP4Box 路径", ""],
  ["aria2cPath", "aria2c 路径", ""],
  ["uposHost", "upos 服务器", ""],
  ["delayPerPage", "分 P 间隔秒数", ""],
  ["host", "API host", ""],
  ["epHost", "番剧 API host", ""],
  ["area", "番剧地区", "hk / tw / th"],
  ["configFile", "配置文件路径", ""]
];

interface BilibiliAdvancedFieldsProps {
  form: BilibiliFormState;
  disabled: boolean;
  onUpdate: (patch: Partial<BilibiliFormState>) => void;
}

export function BilibiliAdvancedFields({ form, disabled, onUpdate }: BilibiliAdvancedFieldsProps) {
  return (
    <Stack gap="sm">
      <Group gap="lg">
        {ADVANCED_SWITCHES.map(([key, label]) => (
          <Switch
            key={key}
            label={label}
            checked={form[key] as boolean}
            onChange={(event) => onUpdate({ [key]: event.currentTarget.checked })}
            disabled={disabled}
          />
        ))}
      </Group>
      <Group grow>
        <PasswordInput
          label="Cookie"
          description="扫码登录后通常无需手填"
          value={form.cookie}
          onChange={(event) => onUpdate({ cookie: event.currentTarget.value })}
          disabled={disabled}
        />
        <PasswordInput
          label="Access Token"
          description="仅 TV/APP/国际版接口需要"
          value={form.accessToken}
          onChange={(event) => onUpdate({ accessToken: event.currentTarget.value })}
          disabled={disabled}
        />
      </Group>
      {chunk(ADVANCED_VALUES, 3).map((row, index) => (
        <Group grow key={index}>
          {row.map(([key, label, placeholder]) => (
            <TextInput
              key={key}
              label={label}
              placeholder={placeholder}
              value={form[key] as string}
              onChange={(event) => onUpdate({ [key]: event.currentTarget.value })}
              disabled={disabled}
            />
          ))}
        </Group>
      ))}
      <Textarea
        label="附加参数"
        description="每行一条，原样传给 BBDown"
        autosize
        minRows={2}
        value={form.extraArgs}
        onChange={(event) => onUpdate({ extraArgs: event.currentTarget.value })}
        disabled={disabled}
      />
    </Stack>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}
