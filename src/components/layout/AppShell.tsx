import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import type { L1NavigationItem, L2NavigationItem } from "../../app/navigation";
import type { AppRoute } from "../../app/route";
import { AppBrand } from "./AppBrand";
import { LeftNavigation } from "./LeftNavigation";
import { TopNavigation } from "./TopNavigation";
import type { NavigationStatus } from "./TopNavigation";
import { WorkspaceFrame } from "./WorkspaceFrame";

type AppSection = AppRoute["section"];
type SecondaryPage = Extract<AppRoute, { page: string }>["page"];

interface AppShellProps {
  route: AppRoute;
  primaryItems: readonly L1NavigationItem[];
  secondaryItems: readonly L2NavigationItem[];
  onNavigatePrimary: (section: AppSection) => void;
  onNavigateSecondary: (page: SecondaryPage) => void;
  navigationStatuses?: Partial<Record<AppSection, NavigationStatus>>;
  children: ReactNode;
}

function secondaryPage(route: AppRoute): SecondaryPage | null {
  return "page" in route ? route.page : null;
}

export function AppShell({
  route,
  primaryItems,
  secondaryItems,
  onNavigatePrimary,
  onNavigateSecondary,
  navigationStatuses,
  children
}: AppShellProps) {
  const activeSecondaryPage = secondaryPage(route);
  const hasSecondaryNavigation = secondaryItems.length > 0 && activeSecondaryPage !== null;

  return (
    <Box
      style={{
        width: "100%",
        height: "100vh",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--mantine-color-body)"
      }}
    >
      <Box
        component="header"
        style={{
          flex: "0 0 66px",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          background: "var(--mantine-color-body)"
        }}
      >
        <Box
          h="100%"
          px="md"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 50% minmax(0, 1fr)",
            alignItems: "center",
            columnGap: "var(--mantine-spacing-md)"
          }}
        >
          <Box style={{ minWidth: 0, justifySelf: "start" }}>
            <AppBrand />
          </Box>
          <TopNavigation
            items={primaryItems}
            active={route.section}
            onNavigate={onNavigatePrimary}
            statuses={navigationStatuses}
          />
          {/* 第三列留空：右侧入口（主题/GitHub/官网）已并入设置页，保留空列维持导航居中 */}
        </Box>
      </Box>

      <WorkspaceFrame
        navigation={
          hasSecondaryNavigation ? (
            <LeftNavigation
              items={secondaryItems}
              active={activeSecondaryPage}
              onNavigate={onNavigateSecondary}
            />
          ) : undefined
        }
      >
        {children}
      </WorkspaceFrame>
    </Box>
  );
}
