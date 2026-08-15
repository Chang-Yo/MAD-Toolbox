import { NavLink, Stack } from "@mantine/core";
import type { AppRoute } from "../app/route";
import type { L2NavigationItem } from "../app/navigation";

type SecondaryPage = Extract<AppRoute, { page: string }>["page"];

interface LeftNavigationProps {
  items: readonly L2NavigationItem[];
  active: SecondaryPage;
  onNavigate: (page: SecondaryPage) => void;
}

export function LeftNavigation({ items, active, onNavigate }: LeftNavigationProps) {
  return (
    <Stack component="nav" aria-label="当前功能" gap={2} p="xs">
      {items.map(({ page, label, icon: Icon }) => {
        const isActive = active === page;
        return (
          <NavLink
            key={page}
            label={label}
            leftSection={Icon ? <Icon size={17} stroke={1.7} /> : undefined}
            active={isActive}
            aria-current={isActive ? "page" : undefined}
            variant="light"
            onClick={() => onNavigate(page)}
            styles={{ root: { padding: "8px 10px", borderRadius: "var(--mantine-radius-md)" } }}
          />
        );
      })}
    </Stack>
  );
}
