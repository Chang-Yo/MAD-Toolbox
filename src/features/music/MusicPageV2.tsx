/**
 * music 新页面（Mantine 版，自旧 MusicPage 移植）。
 * 后端契约不变：musicdl_search / musicdl_download / musicdl_playlist +
 * musicdl-search-result 事件（搜索结果流式到达）+ job-state（搜索进程结束信号）。
 * 搜索是查询（结果就地消费）；下载/歌单作业已进任务系统。
 */

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  Code,
  Collapse,
  Group,
  Menu,
  NumberInput,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDeviceFloppy,
  IconDownload,
  IconExternalLink,
  IconFolderOpen,
  IconRefresh
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildMusicdlArgs, commandPreview, type MusicdlCliOptions } from "../../lib/commands";
import type {
  DependencyStatus,
  JobState,
  MusicdlPlaylistRequest,
  MusicdlSearchRequest,
  MusicdlSearchResponse,
  MusicdlSearchResult,
  RunResult
} from "../../lib/types";
import { isWindows, musicdlInstallCommand, pipCommand } from "../../lib/platform";
import {
  loadTemplates,
  saveTemplate,
  type MusicTemplateSource,
  type SavedTemplate
} from "./templates";

const DEFAULT_SOURCES = [
  "MiguMusicClient",
  "NeteaseMusicClient",
  "QQMusicClient",
  "KuwoMusicClient",
  "QianqianMusicClient"
];

const SOURCE_GROUPS: Array<[string, Array<[string, string]>]> = [
  [
    "中国大陆及华语平台",
    [
      ["MiguMusicClient", "咪咕音乐"],
      ["NeteaseMusicClient", "网易云音乐"],
      ["QQMusicClient", "QQ 音乐"],
      ["KuwoMusicClient", "酷我音乐"],
      ["QianqianMusicClient", "千千音乐"],
      ["KugouMusicClient", "酷狗音乐"],
      ["BilibiliMusicClient", "哔哩哔哩音乐"],
      ["BodianMusicClient", "波点音乐"],
      ["FiveSingMusicClient", "5SING"],
      ["SodaMusicClient", "汽水音乐"],
      ["StreetVoiceMusicClient", "街声"],
      ["MOOVMusicClient", "MOOV"]
    ]
  ],
  [
    "海外流媒体与独立音乐",
    [
      ["AppleMusicClient", "Apple Music"],
      ["DeezerMusicClient", "Deezer"],
      ["FMAMusicClient", "Free Music Archive"],
      ["JamendoMusicClient", "Jamendo"],
      ["JooxMusicClient", "JOOX"],
      ["JioSaavnMusicClient", "JioSaavn"],
      ["OpenGameArtMusicClient", "OpenGameArt"],
      ["QobuzMusicClient", "Qobuz"],
      ["SoundCloudMusicClient", "SoundCloud"],
      ["SpotifyMusicClient", "Spotify"],
      ["SunoMusicClient", "Suno"],
      ["TIDALMusicClient", "TIDAL"],
      ["YouTubeMusicClient", "YouTube Music"]
    ]
  ],
  [
    "播客、有声与电台",
    [
      ["ITunesMusicClient", "Apple Podcasts"],
      ["LizhiMusicClient", "荔枝 FM"],
      ["LRTSMusicClient", "懒人听书"],
      ["QingtingMusicClient", "蜻蜓 FM"],
      ["XimalayaMusicClient", "喜马拉雅"]
    ]
  ],
  [
    "聚合音乐源",
    [
      ["GDStudioMusicClient", "GD 音乐台"],
      ["JBSouMusicClient", "煎饼搜"],
      ["MP3JuiceMusicClient", "MP3 Juice"],
      ["MyFreeMP3MusicClient", "MyFreeMP3"],
      ["TuneHubMusicClient", "TuneHub"],
      ["XiaoBaiMusicClient", "小白音乐"]
    ]
  ],
  [
    "其他第三方音乐站",
    [
      ["BuguyyMusicClient", "布谷音乐"],
      ["FangpiMusicClient", "放屁音乐"],
      ["FiveSongMusicClient", "5Song"],
      ["FLMP3MusicClient", "凤梨音乐"],
      ["GequbaoMusicClient", "歌曲宝"],
      ["GequhaiMusicClient", "歌曲海"],
      ["HTQYYMusicClient", "好听轻音乐网"],
      ["ITingWaMusicClient", "听蛙"],
      ["KKWSMusicClient", "开开无损"],
      ["LivePOOMusicClient", "力音"],
      ["LiziYYMusicClient", "梨子音乐"],
      ["MituMusicClient", "米兔音乐"],
      ["MGMP3MusicClient", "木瓜音乐"],
      ["SgogoMusicClient", "搜歌网"],
      ["TwoT58MusicClient", "爱听音乐网"],
      ["XiagebaMusicClient", "下歌吧"],
      ["YinyuedaoMusicClient", "音乐岛"],
      ["ZhuolinMusicClient", "卓林音乐"]
    ]
  ]
];

const PIP_MIRRORS = [
  {
    id: "ustc",
    name: "USTC 中国科学技术大学",
    url: "https://mirrors.ustc.edu.cn/pypi/simple",
    help: "https://mirrors.ustc.edu.cn/help/pypi.html"
  },
  {
    id: "tuna",
    name: "TUNA 清华大学",
    url: "https://pypi.tuna.tsinghua.edu.cn/simple",
    help: "https://mirrors.tuna.tsinghua.edu.cn/help/pypi/"
  }
] as const;

function parseObject(text: string, label: string): Record<string, unknown> {
  const value = JSON.parse(text.trim() || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label}必须是 JSON 对象`);
  }
  return value as Record<string, unknown>;
}

/** 把页面上的目录/Cookie/代理/结果数/线程数合并进 musicdl 的 JSON 配置（与旧页逻辑一致）。 */
function buildConfigs(
  sources: string[],
  rawInit: Record<string, unknown>,
  rawRequests: Record<string, unknown>,
  rawThreadings: Record<string, unknown>,
  outputDirectory: string,
  searchSize: number,
  threadCount: number,
  proxy: string,
  cookies: string
) {
  const init = structuredClone(rawInit);
  const requests = structuredClone(rawRequests);
  const threadings = structuredClone(rawThreadings);
  for (const source of sources) {
    const sourceInit =
      init[source] && typeof init[source] === "object" && !Array.isArray(init[source])
        ? { ...(init[source] as Record<string, unknown>) }
        : {};
    sourceInit.search_size_per_source = searchSize;
    if (outputDirectory.trim()) sourceInit.work_dir = outputDirectory.trim();
    if (cookies.trim()) {
      sourceInit.default_search_cookies = cookies.trim();
      sourceInit.default_download_cookies = cookies.trim();
      sourceInit.default_parse_cookies = cookies.trim();
    }
    init[source] = sourceInit;
    if (proxy.trim()) {
      const sourceRequests =
        requests[source] && typeof requests[source] === "object" && !Array.isArray(requests[source])
          ? { ...(requests[source] as Record<string, unknown>) }
          : {};
      sourceRequests.proxies = { http: proxy.trim(), https: proxy.trim() };
      requests[source] = sourceRequests;
    }
    threadings[source] = threadCount;
  }
  return { init, requests, threadings };
}

function sourceLabel(source: string) {
  for (const [, entries] of SOURCE_GROUPS) {
    const match = entries.find(([value]) => value === source);
    if (match) return match[1];
  }
  return source.replace(/MusicClient$/, "");
}

interface MusicPageV2Props {
  dependency: DependencyStatus | null;
  pythonDependency: DependencyStatus | null;
  defaultOutputDirectory: string | null;
  onRefresh: () => Promise<unknown>;
  onSearch: (request: MusicdlSearchRequest) => Promise<RunResult>;
  onPlaylist: (request: MusicdlPlaylistRequest) => Promise<RunResult>;
  onDownload: (sessionId: string, indices: number[]) => Promise<unknown>;
}

export function MusicPageV2({
  dependency,
  pythonDependency,
  defaultOutputDirectory,
  onRefresh,
  onSearch,
  onPlaylist,
  onDownload
}: MusicPageV2Props) {
  const [mode, setMode] = useState<"search" | "playlist">("search");
  const [keyword, setKeyword] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const [outputDirectory, setOutputDirectory] = useState("");
  const [searchSize, setSearchSize] = useState(5);
  const [threadCount, setThreadCount] = useState(5);
  const [proxy, setProxy] = useState("");
  const [cookies, setCookies] = useState("");
  const [allSourcesOpen, allSourcesToggle] = useDisclosure(false);
  const [advancedOpen, advancedToggle] = useDisclosure(false);
  const [rawInit, setRawInit] = useState("{}");
  const [rawRequests, setRawRequests] = useState("{}");
  const [rawThreadings, setRawThreadings] = useState("{}");
  const [rawSearchRules, setRawSearchRules] = useState("{}");
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "downloading">("idle");
  const [searchResponse, setSearchResponse] = useState<MusicdlSearchResponse | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadTemplates(localStorage));
  const activeSearchJobId = useRef<string | null>(null);
  const settledSearchJobId = useRef<string | null>(null);

  useEffect(() => {
    if (defaultOutputDirectory) {
      setOutputDirectory((current) => current || defaultOutputDirectory);
    }
  }, [defaultOutputDirectory]);

  // 搜索结果流式到达 + 搜索进程结束信号（契约与旧页一致）
  useEffect(() => {
    const unlistenResult = listen<MusicdlSearchResponse>("musicdl-search-result", ({ payload }) => {
      if (activeSearchJobId.current && payload.sessionId !== activeSearchJobId.current) {
        return;
      }
      activeSearchJobId.current = payload.sessionId;
      setSearchResponse(payload);
      setSelected([]);
      setConfigurationError(null);
    });
    const unlistenState = listen<JobState>("job-state", ({ payload }) => {
      if (payload.jobId !== activeSearchJobId.current) return;
      if (payload.state === "running") return;
      setSearchState("idle");
      if (payload.state === "failed") {
        setConfigurationError(payload.message);
      }
      settledSearchJobId.current = payload.jobId;
      activeSearchJobId.current = null;
    });
    return () => {
      void unlistenResult.then((dispose) => dispose());
      void unlistenState.then((dispose) => dispose());
    };
  }, []);

  const prepared = useMemo(() => {
    try {
      const configs = buildConfigs(
        sources,
        parseObject(rawInit, "客户端设置"),
        parseObject(rawRequests, "请求设置"),
        parseObject(rawThreadings, "线程设置"),
        outputDirectory,
        Math.max(1, searchSize || 1),
        Math.max(1, threadCount || 1),
        proxy,
        cookies
      );
      const searchRules = parseObject(rawSearchRules, "搜索规则");
      return {
        error: null,
        cli: {
          keyword: mode === "search" ? keyword : "",
          playlistUrl: mode === "playlist" ? playlistUrl : "",
          musicSources: sources,
          initMusicClientsCfg: configs.init,
          requestsOverrides: configs.requests,
          clientsThreadings: configs.threadings,
          searchRules
        } satisfies MusicdlCliOptions
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), cli: null };
    }
  }, [
    cookies,
    keyword,
    mode,
    outputDirectory,
    playlistUrl,
    proxy,
    rawInit,
    rawRequests,
    rawSearchRules,
    rawThreadings,
    searchSize,
    sources,
    threadCount
  ]);

  const preview = prepared.cli ? commandPreview("musicdl", buildMusicdlArgs(prepared.cli)) : "";
  const musicdlInstalled = dependency?.available ?? false;
  const pythonInstalled = pythonDependency?.available ?? false;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({ message: "已复制", color: "teal" });
    } catch {
      notifications.show({ message: "复制失败", color: "red" });
    }
  };

  const toggleSource = (source: string) => {
    setSources((current) =>
      current.includes(source) ? current.filter((value) => value !== source) : [...current, source]
    );
    setSearchResponse(null);
    setSelected([]);
  };

  const templateSource = (): MusicTemplateSource => ({
    mode,
    sources,
    outputDirectory,
    searchSize,
    threadCount,
    proxy,
    cookies,
    rawInit,
    rawRequests,
    rawThreadings,
    rawSearchRules
  });

  const applyTemplate = (template: SavedTemplate) => {
    const v = template.value;
    setMode(v.mode);
    setSources(v.sources);
    setOutputDirectory(v.outputDirectory);
    setSearchSize(v.searchSize);
    setThreadCount(v.threadCount);
    setProxy(v.proxy);
    setRawThreadings(v.rawThreadings);
    setRawSearchRules(v.rawSearchRules);
    setConfigurationError(null);
    notifications.show({ message: `已应用模板「${template.name}」（登录凭证类字段不入模板）` });
  };

  const run = async () => {
    setConfigurationError(prepared.error);
    if (!prepared.cli || prepared.error) return;
    if (mode === "playlist") {
      setSearchState("downloading");
      setConfigurationError(null);
      settledSearchJobId.current = null;
      try {
        const started = await onPlaylist({
          playlistUrl,
          musicSources: sources,
          initMusicClientsCfg: prepared.cli.initMusicClientsCfg,
          requestsOverrides: prepared.cli.requestsOverrides,
          clientsThreadings: prepared.cli.clientsThreadings,
          searchRules: prepared.cli.searchRules,
          outputDirectory: outputDirectory || null
        });
        if (settledSearchJobId.current !== started.jobId) {
          activeSearchJobId.current = started.jobId;
        }
      } catch (error) {
        setConfigurationError(error instanceof Error ? error.message : String(error));
      } finally {
        setSearchState("idle");
      }
      return;
    }
    setSearchState("searching");
    setSearchResponse(null);
    setSelected([]);
    setConfigurationError(null);
    settledSearchJobId.current = null;
    try {
      const started = await onSearch({
        keyword,
        musicSources: sources,
        initMusicClientsCfg: prepared.cli.initMusicClientsCfg,
        requestsOverrides: prepared.cli.requestsOverrides,
        clientsThreadings: prepared.cli.clientsThreadings,
        searchRules: prepared.cli.searchRules,
        outputDirectory: outputDirectory || null,
        searchSizePerSource: Math.max(1, searchSize || 1)
      });
      if (settledSearchJobId.current !== started.jobId) {
        activeSearchJobId.current = started.jobId;
      }
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : String(error));
      setSearchState("idle");
    }
  };

  const downloadSelected = async () => {
    if (!searchResponse || !selected.length) return;
    setSearchState("downloading");
    try {
      await onDownload(searchResponse.sessionId, selected);
    } finally {
      setSearchState("idle");
    }
  };

  const pickOutputDirectory = async () => {
    const dir = await openDialog({ directory: true });
    if (typeof dir === "string") setOutputDirectory(dir);
  };

  // ---- 未安装态 ----
  if (!(musicdlInstalled && pythonInstalled)) {
    const installCommand = musicdlInstallCommand;
    return (
      <Stack gap="md" p="md">
        <Title order={3}>音乐下载</Title>
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={18} />}
          title={!pythonInstalled ? "尚未检测到 Python 3" : "尚未检测到 musicdl"}
        >
          <Stack gap="xs">
            <Text size="sm">
              musicdl 需要 Python 3。推荐通过{isWindows ? " winget" : " Homebrew"}安装
              Python，并使用 pipx 创建隔离环境；两者不随 MAD Toolbox 分发（musicdl 为 PolyForm
              Noncommercial 许可，禁止捆绑）。
            </Text>
            <Group gap="xs">
              <Badge color={pythonInstalled ? "teal" : "yellow"} variant="light">
                Python 3 {pythonDependency?.version ?? "需要安装"}
              </Badge>
              <Badge color={musicdlInstalled ? "teal" : "yellow"} variant="light">
                musicdl {dependency?.version ?? "需要安装"}
              </Badge>
            </Group>
            <Code block>{installCommand}</Code>
            <Group gap="xs">
              <Button
                size="compact-sm"
                variant="default"
                leftSection={<IconCopy size={14} />}
                onClick={() => void copyText(installCommand)}
              >
                复制安装命令
              </Button>
              <Button
                size="compact-sm"
                leftSection={<IconRefresh size={14} />}
                onClick={() => void onRefresh()}
              >
                重新检测
              </Button>
              <Button
                size="compact-sm"
                variant="subtle"
                leftSection={<IconExternalLink size={14} />}
                onClick={() => void openUrl("https://github.com/CharlesPikachu/musicdl")}
              >
                musicdl 项目
              </Button>
            </Group>
          </Stack>
        </Alert>

        <Card withBorder padding="md">
          <Stack gap="xs">
            <Text fw={500}>中国大陆网络：配置 pip 镜像（可选）</Text>
            <Text size="sm" c="dimmed">
              如果 PyPI 下载缓慢，先执行其一，再运行上面的安装命令。
            </Text>
            {PIP_MIRRORS.map((mirror) => {
              const command = `${pipCommand} config set global.index-url ${mirror.url}`;
              return (
                <Group key={mirror.id} justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm">{mirror.name}</Text>
                    <Code>{command}</Code>
                  </div>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="复制命令">
                      <Button
                        size="compact-xs"
                        variant="default"
                        onClick={() => void copyText(command)}
                      >
                        <IconCopy size={13} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="镜像站官方帮助">
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => void openUrl(mirror.help)}
                      >
                        <IconExternalLink size={13} />
                      </Button>
                    </Tooltip>
                  </Group>
                </Group>
              );
            })}
            <Text size="xs" c="dimmed">
              恢复官方源：<Code>{`${pipCommand} config unset global.index-url`}</Code>
            </Text>
          </Stack>
        </Card>
      </Stack>
    );
  }

  // ---- 已安装态 ----
  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <Title order={3}>音乐下载</Title>
        <Group gap="xs">
          <Badge variant="light" color="teal" leftSection={<IconCheck size={12} />}>
            {dependency?.version || "musicdl"} · {pythonDependency?.version || "Python 3"}
          </Badge>
          <Menu>
            <Menu.Target>
              <Button
                variant="default"
                size="compact-sm"
                rightSection={<IconChevronDown size={14} />}
              >
                模板
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconDeviceFloppy size={14} />}
                onClick={() => {
                  const name = window.prompt("模板名称");
                  if (name?.trim()) {
                    setTemplates(saveTemplate(localStorage, name.trim(), templateSource()));
                    notifications.show({ message: `模板「${name.trim()}」已保存（不含登录凭证）` });
                  }
                }}
              >
                保存当前设置为模板
              </Menu.Item>
              {templates.length > 0 && <Menu.Divider />}
              {templates.map((template) => (
                <Menu.Item key={template.id} onClick={() => applyTemplate(template)}>
                  {template.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <SegmentedControl
            data={[
              { value: "search", label: "搜索音乐" },
              { value: "playlist", label: "下载歌单" }
            ]}
            value={mode}
            onChange={(value) => setMode(value as "search" | "playlist")}
          />
          {mode === "search" ? (
            <TextInput
              label="搜索关键词"
              placeholder="歌曲、歌手或专辑"
              value={keyword}
              onChange={(e) => setKeyword(e.currentTarget.value)}
            />
          ) : (
            <TextInput
              label="歌单链接"
              description="链接必须由所选 musicdl 客户端支持"
              placeholder="https://music.163.com/#/playlist?id=..."
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.currentTarget.value)}
            />
          )}
          <Group grow>
            <TextInput
              label="下载目录"
              placeholder="留空保存到 下载/MAD Toolbox/Music"
              value={outputDirectory}
              onChange={(e) => setOutputDirectory(e.currentTarget.value)}
              rightSection={
                <Tooltip label="选择目录">
                  <IconFolderOpen
                    size={16}
                    style={{ cursor: "pointer" }}
                    onClick={() => void pickOutputDirectory()}
                  />
                </Tooltip>
              }
            />
            <NumberInput
              label="每源结果数"
              min={1}
              max={100}
              value={searchSize}
              onChange={(v) => setSearchSize(typeof v === "number" ? v : 5)}
            />
            <NumberInput
              label="每源线程数"
              min={1}
              max={50}
              value={threadCount}
              onChange={(v) => setThreadCount(typeof v === "number" ? v : 5)}
            />
            <TextInput
              label="代理服务器"
              placeholder="http://127.0.0.1:7890"
              value={proxy}
              onChange={(e) => setProxy(e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="登录 Cookie（可选）"
            description="应用到所选全部音乐源；会员音质取决于对应平台账户权限"
            autosize
            minRows={1}
            value={cookies}
            onChange={(e) => setCookies(e.currentTarget.value)}
          />

          <Group justify="space-between" align="end">
            <Text size="sm" fw={500}>
              音乐源
              <Text span size="xs" c="dimmed" ml={8}>
                已选 {sources.length} 个；同时搜索过多音乐源会明显变慢并产生重复结果
              </Text>
            </Text>
            <Button size="compact-xs" variant="subtle" onClick={() => setSources(DEFAULT_SOURCES)}>
              恢复默认
            </Button>
          </Group>
          <Chip.Group
            multiple
            value={sources}
            onChange={(next) => {
              setSources(next);
              setSearchResponse(null);
              setSelected([]);
            }}
          >
            <Group gap={6}>
              {SOURCE_GROUPS[0][1].map(([source, label]) => (
                <Chip key={source} value={source} size="xs" variant="light">
                  {label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <Button variant="subtle" size="compact-sm" onClick={allSourcesToggle.toggle}>
            {allSourcesOpen ? "收起全部音乐源" : "显示全部音乐源"}
          </Button>
          <Collapse expanded={allSourcesOpen}>
            <Stack gap="xs">
              {SOURCE_GROUPS.slice(1).map(([group, entries]) => (
                <div key={group}>
                  <Text size="xs" c="dimmed" mb={4}>
                    {group}
                  </Text>
                  <Group gap={6}>
                    {entries.map(([source, label]) => (
                      <Chip
                        key={source}
                        checked={sources.includes(source)}
                        onChange={() => toggleSource(source)}
                        size="xs"
                        variant="light"
                      >
                        {label}
                      </Chip>
                    ))}
                  </Group>
                </div>
              ))}
            </Stack>
          </Collapse>

          <Button variant="subtle" size="compact-sm" onClick={advancedToggle.toggle}>
            {advancedOpen ? "收起完整参数" : "展开完整参数"}
          </Button>
          <Collapse expanded={advancedOpen}>
            <Stack gap="sm">
              <Text size="xs" c="dimmed">
                以下四项对应 musicdl 的全部高级 CLI
                参数；上方的目录、Cookie、代理、结果数与线程数会与 JSON 合并。
              </Text>
              <Group grow align="start">
                <Textarea
                  label="-i 客户端初始化设置（JSON）"
                  autosize
                  minRows={3}
                  value={rawInit}
                  onChange={(e) => setRawInit(e.currentTarget.value)}
                  styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
                />
                <Textarea
                  label="-r 请求覆盖设置（JSON）"
                  autosize
                  minRows={3}
                  value={rawRequests}
                  onChange={(e) => setRawRequests(e.currentTarget.value)}
                  styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
                />
              </Group>
              <Group grow align="start">
                <Textarea
                  label="-c 客户端线程设置（JSON）"
                  autosize
                  minRows={3}
                  value={rawThreadings}
                  onChange={(e) => setRawThreadings(e.currentTarget.value)}
                  styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
                />
                <Textarea
                  label="-s 搜索规则（JSON）"
                  autosize
                  minRows={3}
                  value={rawSearchRules}
                  onChange={(e) => setRawSearchRules(e.currentTarget.value)}
                  styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
                />
              </Group>
            </Stack>
          </Collapse>
        </Stack>
      </Card>

      {(configurationError || prepared.error) && (
        <Alert color="red" icon={<IconAlertTriangle size={16} />} title="参数或执行错误">
          {configurationError || prepared.error}
        </Alert>
      )}

      <Card withBorder padding="md">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            命令预览
          </Text>
          <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {preview || "…"}
          </Code>
          <Group justify="end">
            <Button
              onClick={() => void run()}
              loading={searchState === "searching"}
              disabled={
                searchState !== "idle" ||
                sources.length === 0 ||
                !!prepared.error ||
                (mode === "search" ? !keyword.trim() : !playlistUrl.trim())
              }
            >
              {mode === "search" ? "开始搜索" : "下载歌单"}
            </Button>
          </Group>
        </Stack>
      </Card>

      {searchState === "searching" && (
        <Text size="sm" c="dimmed">
          正在通过 {sources.length} 个音乐源搜索……结果将陆续显示。
        </Text>
      )}

      {searchResponse && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>
                搜索结果
                <Text span size="xs" c="dimmed" ml={8}>
                  {searchResponse.results.length} 项 · 已选 {selected.length} 项
                </Text>
              </Text>
              <Group gap="xs">
                <Button
                  size="compact-sm"
                  variant="default"
                  onClick={() =>
                    setSelected(
                      selected.length === searchResponse.results.length
                        ? []
                        : searchResponse.results.map((result) => result.index)
                    )
                  }
                >
                  {selected.length === searchResponse.results.length ? "取消全选" : "全选"}
                </Button>
                <Button
                  size="compact-sm"
                  variant="default"
                  onClick={() =>
                    setSelected(
                      searchResponse.results.filter((r) => r.lossless).map((r) => r.index)
                    )
                  }
                >
                  只选无损
                </Button>
                <Button
                  size="compact-sm"
                  leftSection={<IconDownload size={14} />}
                  disabled={!selected.length || searchState === "downloading"}
                  loading={searchState === "downloading"}
                  onClick={() => void downloadSelected()}
                >
                  下载所选
                </Button>
              </Group>
            </Group>
            {searchResponse.results.length === 0 ? (
              <Text size="sm" c="dimmed">
                没有找到音乐，请更换关键词、音乐源或登录 Cookie。
              </Text>
            ) : (
              <Table highlightOnHover verticalSpacing={6}>
                <Table.Tbody>
                  {searchResponse.results.map((result: MusicdlSearchResult) => {
                    const checked = selected.includes(result.index);
                    return (
                      <Table.Tr
                        key={`${result.source}-${result.index}`}
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setSelected((current) =>
                            checked
                              ? current.filter((index) => index !== result.index)
                              : [...current, result.index]
                          )
                        }
                      >
                        <Table.Td w={36}>
                          <Checkbox checked={checked} readOnly tabIndex={-1} />
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {result.songName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {result.singers}
                            {result.album ? ` · ${result.album}` : ""}
                          </Text>
                        </Table.Td>
                        <Table.Td w={140}>
                          <Badge
                            variant="light"
                            color={result.lossless ? "teal" : "gray"}
                            style={{ textTransform: "none" }}
                          >
                            {result.extension || result.codec || "未知格式"}
                            {result.bitrate ? ` · ${Math.round(result.bitrate / 1000)}k` : ""}
                          </Badge>
                        </Table.Td>
                        <Table.Td w={160}>
                          <Text size="xs">{sourceLabel(result.source)}</Text>
                          <Text size="xs" c="dimmed">
                            {[result.fileSize, result.duration].filter(Boolean).join(" · ")}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
