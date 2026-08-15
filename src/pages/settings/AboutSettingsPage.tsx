import { ActionIcon, Card, Divider, Group, Image, Stack, Text, Tooltip } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconExternalLink } from "@tabler/icons-react";
import { Fragment, type ReactNode } from "react";
import organizationLogo from "../../assets/organization_logo.png";
import appIcon from "../../../src-tauri/icons/icon.png";
import packageInfo from "../../../package.json";

const TEAM_LINKS = [
  { name: "开发者名单", url: "https://github.com/MAD-Producer/MAD-Toolbox/graphs/contributors" },
  { name: "在 GitHub 查看源码", url: "https://github.com/MAD-Producer/MAD-Toolbox" },
  { name: "关于 MAD Producer Studio", url: "https://madproducer.cn/about#module-2339" }
] as const;

const CREDITS = [
  {
    name: "FFmpeg",
    note: "媒体转码与处理核心",
    url: "https://www.ffmpeg.org/"
  },
  {
    name: "yt-dlp",
    note: "提供YouTube视频和大多数网页媒体下载功能",
    url: "https://github.com/yt-dlp/yt-dlp"
  },
  { name: "BBDown", note: "提供Bilibili视频下载功能", url: "https://github.com/nilaoda/BBDown" },
  {
    name: "Musicdl",
    note: "提供多平台音乐搜索与下载功能",
    url: "https://pypi.org/project/musicdl/2.6.1/"
  },
  { name: "Deno", note: "为部分 JavaScript 提供运行时支撑", url: "https://deno.com/" },
  {
    name: "MediaInfo",
    note: "提供媒体元数据探测功能",
    url: "https://github.com/mediaarea/mediainfo"
  }
] as const;

interface AboutListRowProps {
  primary: string;
  secondary?: string;
  leading?: ReactNode;
  href?: string;
}

function AboutListRow({ primary, secondary, leading, href }: AboutListRowProps) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" py="sm">
      <Group gap="sm" wrap="nowrap" style={{ flex: "1 1 auto", minWidth: 0 }}>
        {leading}
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={500}>
            {primary}
          </Text>
          {secondary && (
            <Text size="xs" c="dimmed">
              {secondary}
            </Text>
          )}
        </div>
      </Group>
      {href && (
        <Tooltip
          label={href}
          position="top"
          openDelay={200}
          events={{ hover: true, focus: true, touch: false }}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`打开 ${primary}`}
            onClick={() => void openUrl(href)}
          >
            <IconExternalLink size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

function AboutSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        {title}
      </Text>
      <Card withBorder>{children}</Card>
    </Stack>
  );
}

export function AboutSettingsPage() {
  return (
    <Stack gap="lg" maw={760}>
      <AboutSection title="关于">
        <Group justify="center" align="center" wrap="nowrap" gap="md" py="xs">
          <Image src={appIcon} alt="MAD Toolbox" w={48} h={48} radius="sm" flex="0 0 auto" />
          <Text fz="xl" fw={600}>
            MAD Toolbox
          </Text>
        </Group>
        <Divider />
        <Group justify="space-between" wrap="nowrap" py="sm">
          <Text size="sm" fw={500}>
            版本
          </Text>
          <Text size="sm" c="dimmed">
            v{packageInfo.version}
          </Text>
        </Group>
      </AboutSection>

      <AboutSection title="开发团队">
        <Image
          src={organizationLogo}
          alt="MAD Producer Studio"
          w="80%"
          h="auto"
          mx="auto"
          my="2rem"
        />
        <Divider />
        {TEAM_LINKS.map((link, index) => (
          <Fragment key={link.url}>
            {index > 0 && <Divider />}
            <AboutListRow primary={link.name} href={link.url} />
          </Fragment>
        ))}
      </AboutSection>

      <AboutSection title="致谢">
        {CREDITS.map((item, index) => (
          <Fragment key={item.name}>
            {index > 0 && <Divider />}
            <AboutListRow primary={item.name} secondary={item.note} href={item.url} />
          </Fragment>
        ))}
      </AboutSection>

      <AboutSection title="法律信息">
        <AboutListRow primary="版权" secondary="Copyright © 2026 MAD Producer Studio" />
        <Divider />
        <AboutListRow primary="开源协议" secondary="MIT License" />
      </AboutSection>

      <Stack align="center" gap="xs" mt="xl">
        <Text fs="italic" ta="center" fz="lg" lh={1.8} c="dimmed">
          <span className="quote-hero-quote">“</span>
          There are many toolboxes
          <br />
          {"\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0"}but this one is for you,{" "}
          <span className="quote-hero-mark">MADer</span>
          <span className="quote-hero-quote">”</span>
        </Text>
        <Group gap="xs" wrap="nowrap">
          <span className="quote-hero-rule" />
          <Text size="sm" c="dimmed">
            -- MAD Producer Studio --
          </Text>
        </Group>
      </Stack>
    </Stack>
  );
}
