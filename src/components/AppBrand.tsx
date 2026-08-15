import { Group, Image, Stack, Text } from "@mantine/core";
import appIcon from "../assets/app-icon.png";
import { platformLabel } from "../lib/platform";
import packageInfo from "../../package.json";

export function AppBrand() {
  return (
    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
      <Image src={appIcon} alt="" w={32} h={32} radius="sm" flex="0 0 auto" />
      <Stack gap={1} style={{ minWidth: 0 }}>
        <Text fw={650} size="sm" lh={1.25} truncate>
          MAD-Toolbox
        </Text>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed" lh={1.25} truncate style={{ minWidth: 0 }}>
            {platformLabel}
          </Text>
          <Text size="xs" c="dimmed" lh={1.25} style={{ flexShrink: 0 }}>
            v{packageInfo.version}
          </Text>
        </Group>
      </Stack>
    </Group>
  );
}
