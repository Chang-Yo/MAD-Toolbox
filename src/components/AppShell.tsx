import { ActionIcon, Box, Group, Tooltip } from "@mantine/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconBrandGithub } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { L1NavigationItem, L2NavigationItem } from "../app/navigation";
import type { AppRoute } from "../app/route";
import { AppBrand } from "./AppBrand";
import { LeftNavigation } from "./LeftNavigation";
import { MpsMark } from "./MpsMark";
import { ThemeSwitch } from "./ThemeSwitch";
import { TopNavigation } from "./TopNavigation";
import type { NavigationStatus } from "./TopNavigation";
import { WorkspaceFrame } from "./WorkspaceFrame";

const GITHUB_URL = "https://github.com/MAD-Producer/MAD-Toolbox";
const MPS_URL = "https://madproducer.com/about";

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
          <Group justify="flex-end" gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeSwitch />
            <Tooltip
              label="在 GitHub 上查看项目"
              position="top"
              events={{ hover: true, focus: true, touch: false }}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label="在 GitHub 上查看 MAD-Toolbox"
                onClick={() => void openUrl(GITHUB_URL)}
              >
                <IconBrandGithub size={19} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
            <Tooltip
              label="关于 MAD Producer"
              position="top"
              events={{ hover: true, focus: true, touch: false }}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label="打开 MAD Producer 官网"
                onClick={() => void openUrl(MPS_URL)}
              >
                <MpsMark size={33} />
              </ActionIcon>
            </Tooltip>
          </Group>
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
