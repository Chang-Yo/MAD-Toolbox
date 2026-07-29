import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AuthStatus,
  AppSettings,
  DependencyStatus,
  JobLog,
  JobState,
  LoginQr,
  RunRequest,
  RunResult,
  ToolName
} from "../lib/types";

export function useBackend() {
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [jobs, setJobs] = useState<JobState[]>([]);
  const [auth, setAuth] = useState<AuthStatus>({
    authenticated: false,
    sessionPath: null
  });
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [ffmpegEncoders, setFfmpegEncoders] = useState<string[]>([]);
  const [loginQr, setLoginQr] = useState<LoginQr | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    defaultOutputDirectory: null,
    dependencyPreference: "bundled"
  });

  const refreshDependencies = useCallback(async () => {
    setLoadingDependencies(true);
    try {
      const next = await invoke<DependencyStatus[]>("dependency_status");
      setDependencies(next);
      if (next.some((item) => item.tool === "ffmpeg" && item.available)) {
        setFfmpegEncoders(await invoke<string[]>("ffmpeg_encoders").catch(() => []));
      } else {
        setFfmpegEncoders([]);
      }
    } finally {
      setLoadingDependencies(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setAuth(await invoke<AuthStatus>("bbdown_auth_status"));
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettings(await invoke<AppSettings>("app_settings"));
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    const saved = await invoke<AppSettings>("save_app_settings", { settings: next });
    setSettings(saved);
    return saved;
  }, []);

  useEffect(() => {
    void refreshDependencies();
    void refreshAuth();
    void refreshSettings();
    const unlistenLog = listen<JobLog>("job-log", ({ payload }) => {
      setLogs((current) => [...current.slice(-4999), payload]);
    });
    const unlistenQr = listen<LoginQr>("bbdown-login-qr", ({ payload }) => {
      setLoginQr(payload);
    });
    const unlistenState = listen<JobState>("job-state", ({ payload }) => {
      setJobs((current) => {
        const without = current.filter((job) => job.jobId !== payload.jobId);
        return [payload, ...without].slice(0, 200);
      });
      if (payload.tool === "bbdown" && payload.state === "completed") {
        void refreshAuth();
      }
      if (payload.state !== "running") {
        setLoginQr((current) => (current?.jobId === payload.jobId ? null : current));
      }
    });
    return () => {
      void unlistenLog.then((dispose) => dispose());
      void unlistenState.then((dispose) => dispose());
      void unlistenQr.then((dispose) => dispose());
    };
  }, [refreshAuth, refreshDependencies, refreshSettings]);

  const runTool = useCallback(async (request: RunRequest) => {
    return invoke<RunResult>("run_tool", { request });
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    await invoke("cancel_job", { jobId });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const dependencyMap = useMemo(
    () => new Map<ToolName, DependencyStatus>(dependencies.map((item) => [item.tool, item])),
    [dependencies]
  );

  return {
    dependencies,
    dependencyMap,
    ffmpegEncoders,
    loadingDependencies,
    logs,
    jobs,
    auth,
    loginQr,
    settings,
    saveSettings,
    refreshDependencies,
    refreshAuth,
    runTool,
    cancelJob,
    clearLogs
  };
}
