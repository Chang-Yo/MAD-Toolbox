import { Box } from "@mantine/core";
import type { ReactNode } from "react";

interface WorkspaceFrameProps {
  navigation?: ReactNode;
  children: ReactNode;
}

export function WorkspaceFrame({ navigation, children }: WorkspaceFrameProps) {
  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: navigation ? "134px minmax(0, 1fr)" : "minmax(0, 1fr)",
        // 面板四周留白（顶部紧贴顶栏不留额外 gap），在 chrome 底色上向中间缩进形成层级
        margin: "0 16px 16px"
      }}
    >
      {navigation ? (
        <Box
          key="navigation"
          component="aside"
          style={{
            minHeight: 0,
            overflowY: "auto",
            borderRight: "1px solid var(--mantine-color-default-border)",
            background: "var(--mantine-color-default-hover)"
          }}
        >
          {navigation}
        </Box>
      ) : null}
      <Box
        key="workspace"
        component="main"
        className="workspace-surface"
        style={{
          minWidth: 0,
          minHeight: 0,
          overflow: "auto",
          borderRadius: "10px"
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
