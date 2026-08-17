import { Card, Collapse, Group, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";

interface CollapsibleSectionProps {
  title: ReactNode;
  opened: boolean;
  onToggle: () => void;

  action?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  opened,
  onToggle,
  action,
  children
}: CollapsibleSectionProps) {
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" wrap="nowrap">
        <UnstyledButton
          onClick={onToggle}
          aria-expanded={opened}
          style={{ flex: "1 1 auto", minWidth: 0 }}
        >
          <Group gap="xs" wrap="nowrap">
            <IconChevronRight
              size={16}
              style={{
                transform: opened ? "rotate(90deg)" : "none",
                transition: "transform 150ms ease"
              }}
            />
            {title}
          </Group>
        </UnstyledButton>
        {action}
      </Group>
      <Collapse expanded={opened}>
        <div style={{ paddingTop: "var(--mantine-spacing-md)" }}>{children}</div>
      </Collapse>
    </Card>
  );
}
