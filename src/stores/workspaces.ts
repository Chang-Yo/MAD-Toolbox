import { create } from "zustand";

export const WORKSPACE_IDS = ["bilibili", "network", "music", "media"] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];
export type WorkspacePhase = "retained" | "releasable";

export interface WorkspaceSession {
  mounted: boolean;
  generation: number;
  phase: WorkspacePhase;
}

type WorkspaceSessions = Record<WorkspaceId, WorkspaceSession>;

interface WorkspacesStore {
  sessions: WorkspaceSessions;
  visit: (id: WorkspaceId) => void;
  markRetained: (id: WorkspaceId, expectedGeneration: number) => void;
  markReleasable: (id: WorkspaceId, expectedGeneration: number) => void;
  evictIfReleasable: (id: WorkspaceId) => void;
  reset: (id: WorkspaceId) => void;
}

const createInitialSessions = (): WorkspaceSessions =>
  Object.fromEntries(
    WORKSPACE_IDS.map((id) => [id, { mounted: false, generation: 0, phase: "releasable" }])
  ) as WorkspaceSessions;

export const useWorkspacesStore = create<WorkspacesStore>((set) => ({
  sessions: createInitialSessions(),

  visit: (id) => {
    set((state) => {
      const current = state.sessions[id];
      if (current.mounted && current.phase === "retained") return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...current, mounted: true, phase: "retained" }
        }
      };
    });
  },

  markRetained: (id, expectedGeneration) => {
    set((state) => {
      const current = state.sessions[id];
      if (
        !current.mounted ||
        current.generation !== expectedGeneration ||
        current.phase === "retained"
      ) {
        return state;
      }
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...current, phase: "retained" }
        }
      };
    });
  },

  markReleasable: (id, expectedGeneration) => {
    set((state) => {
      const current = state.sessions[id];
      if (
        !current.mounted ||
        current.generation !== expectedGeneration ||
        current.phase === "releasable"
      ) {
        return state;
      }
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...current, phase: "releasable" }
        }
      };
    });
  },

  evictIfReleasable: (id) => {
    set((state) => {
      const current = state.sessions[id];
      if (!current.mounted || current.phase !== "releasable") return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: {
            mounted: false,
            generation: current.generation + 1,
            phase: "releasable"
          }
        }
      };
    });
  },

  reset: (id) => {
    set((state) => {
      const current = state.sessions[id];
      return {
        sessions: {
          ...state.sessions,
          [id]: {
            mounted: current.mounted,
            generation: current.generation + 1,
            phase: current.mounted ? "retained" : "releasable"
          }
        }
      };
    });
  }
}));
