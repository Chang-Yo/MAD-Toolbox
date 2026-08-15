import { Button, Group, Title } from "@mantine/core";
import { IconInfoCircle, IconListDetails, IconPlayerPlay } from "@tabler/icons-react";
import type { ProbeKind } from "../pages/network/api";

interface NetworkVideoPageHeaderProps {
  probing: ProbeKind | null;
  probeDisabled: boolean;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  onProbe: (kind: ProbeKind) => Promise<void>;
}

export function NetworkVideoPageHeader({
  probing,
  probeDisabled,
  submitting,
  submitDisabled,
  onSubmit,
  onProbe
}: NetworkVideoPageHeaderProps) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Title order={3}>网络视频下载</Title>
      <Group gap="xs" wrap="nowrap">
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          添加到任务队列
        </Button>
        <Button
          variant="default"
          leftSection={<IconListDetails size={16} />}
          loading={probing === "formats"}
          disabled={probeDisabled}
          onClick={() => void onProbe("formats")}
        >
          查看格式
        </Button>
        <Button
          variant="default"
          leftSection={<IconInfoCircle size={16} />}
          loading={probing === "metadata"}
          disabled={probeDisabled}
          onClick={() => void onProbe("metadata")}
        >
          查看元数据
        </Button>
      </Group>
    </Group>
  );
}
