import {
  IconBrandBilibili,
  IconGauge,
  IconHome,
  IconLicense,
  IconMovie,
  IconMusic,
  IconSettings,
  IconWorldDownload
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { notifications } from "@mantine/notifications";
import { useBackend } from "./hooks/useBackend";
import { useTasksStore } from "./stores/tasks";
import type { MusicdlPlaylistRequest, MusicdlSearchRequest, NavPage, RunResult } from "./lib/types";
import type { TaskEnvelope } from "./contracts/types";
import { AppShellV2, type NavEntry } from "./layouts/AppShellV2";
import { HomePageV2 } from "./features/home/HomePageV2";
import { LicensesPageV2 } from "./features/home/LicensesPageV2";
import { BilibiliPageV2 } from "./features/bilibili/BilibiliPageV2";
import { NetworkPageV2 } from "./features/network/NetworkPageV2";
import { MediaPageV2 } from "./features/media/MediaPageV2";
import { MusicPageV2 } from "./features/music/MusicPageV2";
import { TasksPageV2 } from "./features/tasks/TasksPageV2";
import { SettingsPageV2 } from "./features/settings/SettingsPageV2";

const navItems: NavEntry[] = [
  { page: "home", label: "首页", icon: IconHome },
  { page: "bilibili", label: "哔哩哔哩下载", icon: IconBrandBilibili },
  { page: "network", label: "网络视频下载", icon: IconWorldDownload },
  { page: "music", label: "音乐下载", icon: IconMusic },
  { page: "media", label: "媒体处理", icon: IconMovie },
  { page: "tasks", label: "任务中心", icon: IconGauge }
];

const utilityItems: NavEntry[] = [
  { page: "settings", label: "设置", icon: IconSettings },
  { page: "licenses", label: "开源许可", icon: IconLicense }
];

export default function App() {
  const [page, setPage] = useState<NavPage>("home");
  const [rerunSeed, setRerunSeed] = useState<TaskEnvelope | null>(null);
  const backend = useBackend();
  const initTasksStore = useTasksStore((s) => s.init);

  useEffect(() => {
    void initTasksStore();
  }, [initTasksStore]);

  const distributionMode =
    backend.dependencies.some((item) => item.required) &&
    backend.dependencies.every((item) => !item.required || item.bundledAvailable)
      ? "Full"
      : "Lite";

  const showError = (error: unknown) => {
    notifications.show({
      color: "red",
      message: error instanceof Error ? error.message : String(error)
    });
  };

  const searchMusic = async (request: MusicdlSearchRequest) => {
    try {
      return await invoke<RunResult>("musicdl_search", { request });
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const downloadMusic = async (sessionId: string, indices: number[]) => {
    try {
      const result = await invoke("musicdl_download", { sessionId, indices });
      setPage("tasks");
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const downloadMusicPlaylist = async (request: MusicdlPlaylistRequest) => {
    try {
      const result = await invoke<RunResult>("musicdl_playlist", { request });
      setPage("tasks");
      return result;
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const renderMusicPage = () => (
    <MusicPageV2
      dependency={backend.dependencyMap.get("musicdl") ?? null}
      pythonDependency={backend.dependencyMap.get("python") ?? null}
      defaultOutputDirectory={backend.settings.defaultOutputDirectory}
      onRefresh={backend.refreshDependencies}
      onSearch={searchMusic}
      onPlaylist={downloadMusicPlaylist}
      onDownload={downloadMusic}
    />
  );

  const renderPage = () => {
    if (page === "home") {
      return (
        <HomePageV2
          dependencies={backend.dependencies}
          loading={backend.loadingDependencies}
          onRefresh={() => void backend.refreshDependencies()}
          onNavigate={setPage}
        />
      );
    }
    if (page === "bilibili") {
      return (
        <BilibiliPageV2
          seed={rerunSeed?.feature === "bilibili" ? rerunSeed : null}
          onSeedConsumed={() => setRerunSeed(null)}
          onSubmitted={() => setPage("tasks")}
        />
      );
    }
    if (page === "network") {
      return (
        <NetworkPageV2
          seed={rerunSeed?.feature === "network" ? rerunSeed : null}
          onSeedConsumed={() => setRerunSeed(null)}
          onSubmitted={() => setPage("tasks")}
        />
      );
    }
    if (page === "media") {
      return (
        <MediaPageV2
          seed={rerunSeed?.feature === "media" ? rerunSeed : null}
          onSeedConsumed={() => setRerunSeed(null)}
          onSubmitted={() => setPage("tasks")}
        />
      );
    }
    if (page === "tasks") {
      return (
        <TasksPageV2
          onRerun={(task) => {
            setRerunSeed(task);
            setPage(
              task.feature === "network"
                ? "network"
                : task.feature === "media"
                  ? "media"
                  : "bilibili"
            );
          }}
        />
      );
    }
    if (page === "settings") {
      return (
        <SettingsPageV2
          settings={backend.settings}
          distributionMode={distributionMode}
          onSave={async (settings) => {
            const saved = await backend.saveSettings(settings);
            await backend.refreshDependencies();
            return saved;
          }}
        />
      );
    }
    return <LicensesPageV2 />;
  };

  return (
    <AppShellV2
      navItems={navItems}
      utilityItems={utilityItems}
      active={page}
      onNavigate={setPage}
      distributionMode={distributionMode}
    >
      {/* 音乐页常驻挂载：保留搜索会话（沿旧行为） */}
      <div style={{ display: page === "music" ? "block" : "none" }}>{renderMusicPage()}</div>
      {page !== "music" && renderPage()}
    </AppShellV2>
  );
}
