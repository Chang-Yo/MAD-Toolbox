import { Suspense, useEffect, type ReactNode } from "react";
import { useWorkspacesStore, type WorkspaceId } from "../../stores/workspaces";
import { WorkspaceSlot, type WorkspaceHiddenMode } from "./WorkspaceSlot";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  render: (active: boolean, generation: number) => ReactNode;
  hiddenMode?: WorkspaceHiddenMode;
}

interface WorkspaceSessionHostProps {
  activeWorkspace: WorkspaceId | null;
  workspaces: readonly WorkspaceDefinition[];
  fallback?: ReactNode;
}

export function WorkspaceSessionHost({
  activeWorkspace,
  workspaces,
  fallback = null
}: WorkspaceSessionHostProps) {
  const sessions = useWorkspacesStore((state) => state.sessions);
  const visit = useWorkspacesStore((state) => state.visit);
  const evictIfReleasable = useWorkspacesStore((state) => state.evictIfReleasable);

  useEffect(() => {
    if (activeWorkspace !== null) {
      visit(activeWorkspace);
    }
  }, [activeWorkspace, visit]);

  useEffect(() => {
    for (const workspace of workspaces) {
      const session = sessions[workspace.id];
      if (workspace.id !== activeWorkspace && session.mounted && session.phase === "releasable") {
        evictIfReleasable(workspace.id);
      }
    }
  }, [activeWorkspace, evictIfReleasable, sessions, workspaces]);

  return workspaces.map((workspace) => {
    const session = sessions[workspace.id];
    const active = workspace.id === activeWorkspace;
    if (!session.mounted && !active) return null;

    return (
      <WorkspaceSlot
        key={workspace.id}
        id={workspace.id}
        active={active}
        generation={session.generation}
        hiddenMode={workspace.hiddenMode}
      >
        <Suspense fallback={active ? fallback : null}>
          {workspace.render(active, session.generation)}
        </Suspense>
      </WorkspaceSlot>
    );
  });
}
