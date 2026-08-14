/**
 * 开源许可页（Mantine 版）：保留所有内置项目的原始许可证、版权信息与源码地址。
 */

import { Card, Stack, Text, Title } from "@mantine/core";

const LICENSES: Array<{ name: string; meta: string; note?: string }> = [
  {
    name: "BBDown",
    meta: "MIT License · Copyright © 2020 nilaoda",
    note: "当前项目已归档。MAD Toolbox 分发的是固定、经过校验的非官方内置副本。"
  },
  {
    name: "FFmpeg",
    meta: "8.1.2 · LGPL-2.1-or-later",
    note: "Full 版未启用 GPL/nonfree 组件，并随应用附带精确源码、构建资料和 LGPL 文本；Windows 版使用 BtbN 的 MIT 构建脚本。"
  },
  {
    name: "yt-dlp / yt-dlp-ejs",
    meta: "2026.07.04 · Unlicense，发行程序同时包含其他第三方许可"
  },
  {
    name: "MediaInfo",
    meta: "26.05 · BSD-2-Clause 形式许可及可选替代许可",
    note: "Windows 版同时附带 MediaInfo 官方 CLI 所需的 libcurl DLL，并保留 curl 许可文本。"
  },
  {
    name: "Deno",
    meta: "2.9.4 · MIT License 及第三方组件许可"
  },
  {
    name: "musicdl（可选外部依赖，不随应用分发）",
    meta: "Copyright © 2018–2026 CharlesPikachu · PolyForm Noncommercial 1.0.0",
    note: "MAD Toolbox 只调用用户自行安装的 musicdl，不复制或捆绑其软件；仅可按其许可证和各音乐平台条款使用。"
  }
];

export function LicensesPageV2() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>开源软件许可</Title>
        <Text size="sm" c="dimmed">
          MAD Toolbox 保留所有内置项目的原始许可证、版权信息与源码地址。
        </Text>
      </div>
      <Stack gap="xs">
        {LICENSES.map(({ name, meta, note }) => (
          <Card withBorder padding="sm" key={name}>
            <Text size="sm" fw={600}>
              {name}
            </Text>
            <Text size="xs" c="dimmed">
              {meta}
            </Text>
            {note && (
              <Text size="xs" mt={4}>
                {note}
              </Text>
            )}
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
