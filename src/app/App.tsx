import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { notifications } from "@mantine/notifications";
import { useBackend } from "../hooks/useBackend";
import { useTasksStore } from "../stores/tasks";
import type { MusicdlPlaylistRequest, TaskSubmitResult } from "../lib/types";
import type { TaskEnvelope } from "../contracts/types";
import { AppShell } from "../components/AppShell";
import { WorkspaceSessionHost, type WorkspaceDefinition } from "../components/WorkspaceSessionHost";
import { BilibiliPage } from "../pages/bilibili/BilibiliPage";
import { NetworkVideoPage } from "../pages/network/NetworkVideoPage";
import { MediaWorkspace } from "../components/MediaWorkspace";
import { MusicPage } from "../pages/music/MusicPage";
import { TasksPage } from "../pages/tasks/TasksPage";
import { GeneralSettingsPage } from "../pages/settings/GeneralSettingsPage";
import { DependenciesSettingsPage } from "../pages/settings/DependenciesSettingsPage";
import { AboutSettingsPage } from "../pages/settings/AboutSettingsPage";
import { useBilibiliLoginStore } from "../stores/bilibili-login";
import { useMusicSessionStore } from "../stores/music-session";
import { useWorkspacesStore, type WorkspaceId } from "../stores/workspaces";
import { L1_NAVIGATION, SETTINGS_L2_NAVIGATION } from "./navigation";
import {
  DEFAULT_APP_ROUTE,
  routeForTask,
  type AppRoute,
  type AppSection,
  type MediaPageId,
  type SettingsPageId
} from "./route";

function workspaceIdForRoute(route: AppRoute): WorkspaceId | null {
  if (route.section === "bilibili" || route.section === "network" || route.section === "music") {
    return route.section;
  }
  if (route.section === "media") return "media";
  return null;
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(DEFAULT_APP_ROUTE);
  const [lastMediaPage, setLastMediaPage] = useState<MediaPageId>("pr-compatible");
  const [lastSettingsPage, setLastSettingsPage] = useState<SettingsPageId>("general");
  const [rerunSeed, setRerunSeed] = useState<TaskEnvelope | null>(null);
  const backend = useBackend();
  const initTasksStore = useTasksStore((s) => s.init);
  const activeTaskCount = useTasksStore(
    (state) =>
      Object.values(state.tasks).filter((task) =>
        ["queued", "running", "canceling"].includes(task.status)
      ).length
  );
  const initBilibiliLogin = useBilibiliLoginStore((state) => state.init);
  const initMusicSession = useMusicSessionStore((state) => state.init);
  const markWorkspaceRetained = useWorkspacesStore((state) => state.markRetained);
  const markWorkspaceReleasable = useWorkspacesStore((state) => state.markReleasable);

  useEffect(() => {
    void initTasksStore();
    void initBilibiliLogin();
    void initMusicSession();
  }, [initBilibiliLogin, initMusicSession, initTasksStore]);

  const distributionMode =
    backend.dependencies.some((item) => item.required) &&
    backend.dependencies.every((item) => !item.required || item.bundledAvailable)
      ? "Full"
      : "Lite";
  const missingDependencyCount = backend.dependencies.filter(
    (dependency) => dependency.required && !dependency.available
  ).length;

  const showError = (error: unknown) => {
    notifications.show({
      color: "red",
      message: error instanceof Error ? error.message : String(error)
    });
  };

  const downloadMusic = async (sessionId: string, indices: number[]) => {
    try {
      return await invoke<TaskSubmitResult>("musicdl_download", { sessionId, indices });
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const downloadMusicPlaylist = async (request: MusicdlPlaylistRequest) => {
    try {
      return await invoke<TaskSubmitResult>("musicdl_playlist", { request });
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const navigatePrimary = (section: AppSection) => {
    if (section === "media") {
      setRoute({ section, page: lastMediaPage });
      return;
    }
    if (section === "settings") {
      setRoute({ section, page: lastSettingsPage });
      return;
    }
    setRoute({ section });
  };

  const navigateSecondary = (page: MediaPageId | SettingsPageId) => {
    if (route.section === "media") {
      const mediaPage = page as MediaPageId;
      setLastMediaPage(mediaPage);
      setRoute({ section: "media", page: mediaPage });
    } else if (route.section === "settings") {
      const settingsPage = page as SettingsPageId;
      setLastSettingsPage(settingsPage);
      setRoute({ section: "settings", page: settingsPage });
    }
  };

  const renderNonWorkspacePage = () => {
    if (route.section === "tasks") {
      return (
        <TasksPage
          onRerun={(task) => {
            const target = routeForTask(task);
            const targetWorkspace = workspaceIdForRoute(target);
            if (targetWorkspace !== null) {
              const session = useWorkspacesStore.getState().sessions[targetWorkspace];
              if (
                session.mounted &&
                session.phase === "retained" &&
                !window.confirm("目标页面有尚未释放的配置。放弃当前配置并载入这个任务吗？")
              ) {
                return;
              }
              useWorkspacesStore.getState().reset(targetWorkspace);
            }
            setRerunSeed(task);
            if (target.section === "media") setLastMediaPage(target.page);
            setRoute(target);
          }}
        />
      );
    }
    if (route.section !== "settings") return null;
    if (route.page === "general") {
      return (
        <GeneralSettingsPage
          settings={backend.settings}
          onSave={async (settings) => {
            const saved = await backend.saveSettings(settings);
            await backend.refreshDependencies();
            return saved;
          }}
        />
      );
    }
    if (route.page === "dependencies") {
      return (
        <DependenciesSettingsPage
          dependencies={backend.dependencies}
          loading={backend.loadingDependencies}
          distributionMode={distributionMode}
          onRefresh={() => void backend.refreshDependencies()}
        />
      );
    }
    return <AboutSettingsPage distributionMode={distributionMode} />;
  };

  const activeWorkspace = workspaceIdForRoute(route);
  const workspaces: readonly WorkspaceDefinition[] = [
    {
      id: "bilibili",
      render: (active, generation) => (
        <BilibiliPage
          active={active}
          seed={active && rerunSeed?.feature === "bilibili" ? rerunSeed : null}
          onSeedConsumed={() => setRerunSeed(null)}
          onRetain={() => markWorkspaceRetained("bilibili", generation)}
          onSubmitted={() => markWorkspaceReleasable("bilibili", generation)}
        />
      )
    },
    {
      id: "network",
      render: (active, generation) => (
        <NetworkVideoPage
          active={active}
          seed={active && rerunSeed?.feature === "network" ? rerunSeed : null}
          onSeedConsumed={() => setRerunSeed(null)}
          onRetain={() => markWorkspaceRetained("network", generation)}
          onSubmitted={() => markWorkspaceReleasable("network", generation)}
        />
      )
    },
    {
      id: "music",
      render: (active, generation) => (
        <MusicPage
          active={active}
          dependency={backend.dependencyMap.get("musicdl") ?? null}
          pythonDependency={backend.dependencyMap.get("python") ?? null}
          defaultOutputDirectory={backend.settings.defaultOutputDirectory}
          onRefresh={backend.refreshDependencies}
          onPlaylist={downloadMusicPlaylist}
          onDownload={downloadMusic}
          onRetain={() => markWorkspaceRetained("music", generation)}
          onSubmitted={() => markWorkspaceReleasable("music", generation)}
        />
      )
    },
    {
      id: "media",
      render: (active, generation) => (
        <MediaWorkspace
          active={active}
          page={route.section === "media" ? route.page : lastMediaPage}
          seed={active && rerunSeed?.feature === "media" ? rerunSeed : null}
          onSeedConsumed={() => setRerunSeed(null)}
          onNavigatePage={navigateSecondary}
          onRetain={() => markWorkspaceRetained("media", generation)}
          onSubmitted={() => markWorkspaceReleasable("media", generation)}
        />
      )
    }
  ];

  // 媒体工作流的 L2 导航已内联为页头 Select，侧栏仅保留给设置页
  const secondaryItems = route.section === "settings" ? SETTINGS_L2_NAVIGATION : [];

  return (
    <AppShell
      route={route}
      primaryItems={L1_NAVIGATION}
      secondaryItems={secondaryItems}
      onNavigatePrimary={navigatePrimary}
      onNavigateSecondary={navigateSecondary}
      navigationStatuses={{
        ...(activeTaskCount > 0
          ? {
              tasks: {
                count: activeTaskCount,
                label: `${activeTaskCount} 个活动任务`,
                color: "blue"
              }
            }
          : {}),
        ...(missingDependencyCount > 0
          ? {
              settings: {
                count: missingDependencyCount,
                label: `${missingDependencyCount} 个必要依赖未就绪`,
                color: "yellow"
              }
            }
          : {})
      }}
    >
      <WorkspaceSessionHost activeWorkspace={activeWorkspace} workspaces={workspaces} />
      {activeWorkspace === null ? (
        <div
          key={"page" in route ? `${route.section}:${route.page}` : route.section}
          className="workspace-enter"
        >
          {renderNonWorkspacePage()}
        </div>
      ) : null}
    </AppShell>
  );
}
