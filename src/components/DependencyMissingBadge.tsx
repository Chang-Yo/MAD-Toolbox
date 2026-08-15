import { Badge, Tooltip } from "@mantine/core";

interface DependencyMissingBadgeProps {
  labels?: string[];
  onOpen?: () => void;
}

/** 功能页标题旁的依赖缺失警示：红边红字无填充，点击跳转依赖管理页。 */
export function DependencyMissingBadge({ labels, onOpen }: DependencyMissingBadgeProps) {
  if (!labels?.length || !onOpen) return null;
  return (
    <Tooltip
      label="点击前往依赖管理"
      position="bottom"
      events={{ hover: true, focus: true, touch: true }}
    >
      <Badge variant="outline" color="red" size="lg" style={{ cursor: "pointer" }} onClick={onOpen}>
        {labels.join("、")}依赖缺失
      </Badge>
    </Tooltip>
  );
}
