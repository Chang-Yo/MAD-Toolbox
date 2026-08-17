import { Button, Group, Title } from "@mantine/core";
import { IconInfoCircle, IconListDetails, IconPlayerPlay } from "@tabler/icons-react";
import type { ProbeKind } from "./api";
import { DependencyMissingBadge } from "../../components/common/DependencyMissingBadge";

interface NetworkVideoPageHeaderProps {
  probing: ProbeKind | null;
  probeDisabled: boolean;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  onProbe: (kind: ProbeKind) => Promise<void>;
  dependencyLabels?: string[];
  onOpenDependencies?: () => void;
}

export function NetworkVideoPageHeader({
  probing,
  probeDisabled,
  submitting,
  submitDisabled,
  onSubmit,
  onProbe,
  dependencyLabels,
  onOpenDependencies
}: NetworkVideoPageHeaderProps) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Title order={3}>网络视频下载</Title>
        <DependencyMissingBadge labels={dependencyLabels} onOpen={onOpenDependencies} />
      </Group>
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
