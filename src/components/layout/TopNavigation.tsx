import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActionIcon, Box, Indicator, Tooltip } from "@mantine/core";
import type { AppRoute } from "../../app/route";
import type { L1NavigationItem } from "../../app/navigation";

type AppSection = AppRoute["section"];

interface TopNavigationProps {
  items: readonly L1NavigationItem[];
  active: AppSection;
  onNavigate: (section: AppSection) => void;
  statuses?: Partial<Record<AppSection, NavigationStatus>>;
}

export interface NavigationStatus {
  count: number;
  label: string;
  color: string;
}

interface PillPosition {
  left: number;
  right: number;
}

/** 点击导航时的描边轨迹动画时长，缓动与运行中循环动画（animations.css）一致 */
const DRAW_DURATION_MS = 700;
const DRAW_EASING = "cubic-bezier(0.45, 0, 0.2, 1)";

export function TopNavigation({ items, active, onNavigate, statuses }: TopNavigationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pill, setPill] = useState<PillPosition | null>(null);
  // 窗口拉伸期间禁用 pill 过渡：有过渡时高亮块跟不上图标重排，会出现挤压/跨越
  const [resizing, setResizing] = useState(false);
  const resizeTimerRef = useRef<number | undefined>(undefined);
  // 观察器只读当前 active，不能因 active 变化重建——ResizeObserver 初次 observe
  // 会立即回调一次，若每次导航都重建会把 resizing 置真，恰好压掉本次滑动过渡
  const activeRef = useRef(active);
  activeRef.current = active;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const item = itemRefs.current[items.findIndex((entry) => entry.section === active)];
    if (!container || !item) return;
    setPill({
      left: item.offsetLeft,
      right: container.offsetWidth - item.offsetLeft - item.offsetWidth
    });
  }, [active, items]);

  // 描边轨迹动画：与运行中循环动画同一手法（stroke-dash 位移），但按每条 path
  // 实际长度取值——CSS 固定 dasharray:64 对长路径（如设置齿轮）会露出虚线残影。
  // WAAPI 播放完自动回收样式，无需清理。
  const drawIcon = (index: number) => {
    const node = itemRefs.current[index];
    if (!node) return;
    node.querySelectorAll<SVGPathElement>("svg path").forEach((path) => {
      const length = path.getTotalLength();
      path.animate(
        [
          { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length}`, strokeDashoffset: "0" }
        ],
        { duration: DRAW_DURATION_MS, easing: DRAW_EASING }
      );
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimerRef.current);
      setResizing(true);
      const item =
        itemRefs.current[items.findIndex((entry) => entry.section === activeRef.current)];
      if (item) {
        setPill((current) => {
          if (current === null) return current;
          return {
            ...current,
            left: item.offsetLeft,
            right: container.offsetWidth - item.offsetLeft - item.offsetWidth
          };
        });
      }
      // 停止拉伸一小段时间后恢复滑动动画
      resizeTimerRef.current = window.setTimeout(() => setResizing(false), 150);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimerRef.current);
    };
  }, [items]);

  return (
    <Tooltip.Group openDelay={300} closeDelay={100}>
      <Box
        component="nav"
        aria-label="主要功能"
        className="top-nav"
        ref={containerRef}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 3,
          borderRadius: "calc(var(--mantine-radius-md) + 3px)",
          background: "var(--mantine-color-default-hover)"
        }}
      >
        {pill !== null && (
          <span
            className={resizing ? "top-nav-pill top-nav-pill-resizing" : "top-nav-pill"}
            style={{ left: pill.left, right: pill.right }}
          />
        )}
        {items.map(({ section, label, icon: Icon }, index) => {
          const isActive = active === section;
          const status = statuses?.[section];
          const running = section === "tasks" && (status?.count ?? 0) > 0;
          return (
            <Box
              key={section}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              className={running ? "top-nav-item top-nav-task-running" : "top-nav-item"}
            >
              <Tooltip
                label={status ? `${label} · ${status.label}` : label}
                position="top"
                withArrow
                arrowSize={5}
                offset={4}
                events={{ hover: true, focus: true, touch: false }}
                styles={{ tooltip: { padding: "3px 7px", fontSize: 11, lineHeight: 1.2 } }}
              >
                <Indicator
                  disabled={!status || status.count === 0}
                  label={status && status.count > 99 ? "99+" : status?.count}
                  color={status?.color}
                  size={16}
                  offset={3}
                >
                  <ActionIcon
                    size="lg"
                    radius="md"
                    variant="transparent"
                    color={running ? "green" : isActive ? "orange" : "gray"}
                    style={{ position: "relative", zIndex: 1 }}
                    aria-label={status ? `${label}，${status.label}` : label}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      onNavigate(section);
                      // 任务运行中的图标已有循环描边动画，点击时不再叠加一次性动画
                      if (!running) drawIcon(index);
                    }}
                  >
                    <Icon size={20} stroke={1.7} />
                  </ActionIcon>
                </Indicator>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Tooltip.Group>
  );
}
