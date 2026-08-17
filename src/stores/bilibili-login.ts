import { notifications } from "../lib/notifications";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { JobState } from "../contracts/job";
import { bilibiliLoginStart, bilibiliLoginStatus } from "../pages/bilibili/api";

interface LoginQrPayload {
  jobId: string;
  dataUrl: string;
}

interface PendingLoginEvents {
  qrDataUrl?: string;
  terminal?: JobState;
}

type BilibiliLoginPhase = "idle" | "starting" | "running";

interface BilibiliLoginStore {
  initialized: boolean;
  phase: BilibiliLoginPhase;
  loggedIn: boolean;
  jobId: string | null;
  qrDataUrl: string | null;
  init: () => Promise<void>;
  start: () => Promise<void>;
  refresh: () => Promise<void>;
  dismissQr: () => void;
}

let initPromise: Promise<void> | null = null;
let startPromise: Promise<void> | null = null;
const pendingEvents = new Map<string, PendingLoginEvents>();

function notifyTerminal(state: JobState, hadVisibleQr: boolean) {
  if (!hadVisibleQr) return;
  notifications.show({
    color: state.state === "completed" ? "green" : "red",
    message: state.message
  });
}

export const useBilibiliLoginStore = create<BilibiliLoginStore>((set, get) => {
  // completed 表示后端已校验并写入 BBDown.data，可直接置为已登录；
  // failed/canceled 时旧的本地 Cookie 仍可能有效（如换号扫码中途放弃），重新查询落盘状态
  const applyTerminal = (state: JobState) => {
    set({ phase: "idle", jobId: null, qrDataUrl: null });
    if (state.state === "completed") set({ loggedIn: true });
    else void get().refresh();
  };

  const handleQr = (payload: LoginQrPayload) => {
    const state = get();
    if (payload.jobId === state.jobId) {
      set({ qrDataUrl: payload.dataUrl });
      return;
    }
    if (state.phase === "starting") {
      const pending = pendingEvents.get(payload.jobId) ?? {};
      pending.qrDataUrl = payload.dataUrl;
      pendingEvents.set(payload.jobId, pending);
    }
  };

  const handleJobState = (payload: JobState) => {
    if (payload.tool !== "bbdown" || payload.state === "running") return;

    const state = get();
    if (payload.jobId === state.jobId) {
      notifyTerminal(payload, state.qrDataUrl !== null);
      applyTerminal(payload);
      return;
    }
    if (state.phase === "starting") {
      const pending = pendingEvents.get(payload.jobId) ?? {};
      pending.terminal = payload;
      pendingEvents.set(payload.jobId, pending);
    }
  };

  return {
    initialized: false,
    phase: "idle",
    loggedIn: false,
    jobId: null,
    qrDataUrl: null,

    init: () => {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        const unlistenQr = await listen<LoginQrPayload>("bbdown-login-qr", ({ payload }) =>
          handleQr(payload)
        );
        try {
          await listen<JobState>("job-state", ({ payload }) => handleJobState(payload));
          set({ initialized: true });
        } catch (error) {
          unlistenQr();
          throw error;
        }
      })().catch((error) => {
        initPromise = null;
        throw error;
      });
      return initPromise;
    },

    start: () => {
      if (startPromise) return startPromise;
      if (get().phase !== "idle") return Promise.resolve();

      set({ phase: "starting", jobId: null, qrDataUrl: null });
      pendingEvents.clear();
      startPromise = (async () => {
        try {
          await get().init();
          const result = await bilibiliLoginStart();
          const pending = pendingEvents.get(result.jobId);
          pendingEvents.clear();

          if (pending?.terminal) {
            notifyTerminal(pending.terminal, pending.qrDataUrl !== undefined);
            applyTerminal(pending.terminal);
            return;
          }
          set({
            phase: "running",
            jobId: result.jobId,
            qrDataUrl: pending?.qrDataUrl ?? null
          });
        } catch (error) {
          pendingEvents.clear();
          set({ phase: "idle", jobId: null, qrDataUrl: null });
          throw error;
        } finally {
          startPromise = null;
        }
      })();
      return startPromise;
    },

    // 查询落盘登录态（BBDown.data + 在线校验）；失败静默按未登录处理，
    // 依赖缺失等可操作错误由依赖徽标与扫码按钮本身呈现
    refresh: () =>
      bilibiliLoginStatus()
        .then((loggedIn) => set({ loggedIn }))
        .catch(() => set({ loggedIn: false })),

    // 关闭二维码弹窗 = 放弃本次登录：立即复位，页面不再卡在「等待扫码」。
    // 后台轮询至多 180s 自行超时；若用户关窗前已扫码，凭证仍会正常写入（只是无 UI 回执）。
    dismissQr: () => set({ phase: "idle", jobId: null, qrDataUrl: null })
  };
});
