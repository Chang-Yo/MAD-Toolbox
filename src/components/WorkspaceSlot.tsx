import { Activity, Fragment, type ReactNode } from "react";
import type { WorkspaceId } from "../stores/workspaces";

export type WorkspaceHiddenMode = "activity" | "preserve-effects";

interface WorkspaceSlotProps {
  id: WorkspaceId;
  active: boolean;
  generation: number;
  hiddenMode?: WorkspaceHiddenMode;
  children: ReactNode;
}

export function WorkspaceSlot({
  id,
  active,
  generation,
  hiddenMode = "activity",
  children
}: WorkspaceSlotProps) {
  if (hiddenMode === "preserve-effects") {
    return (
      <div
        key={generation}
        className="workspace-enter"
        hidden={!active}
        aria-hidden={active ? undefined : true}
        inert={!active}
      >
        {children}
      </div>
    );
  }

  return (
    <Activity name={id} mode={active ? "visible" : "hidden"}>
      <Fragment key={generation}>
        <div className="workspace-enter">{children}</div>
      </Fragment>
    </Activity>
  );
}
