import { Badge, SegmentedControl } from "@mantine/core";

interface L2TabNavProps<PageId extends string> {
  items: readonly { page: PageId; label: string }[];
  value: PageId;
  onChange: (page: PageId) => void;
  /** 各页签的警示角标数（如依赖缺失数）；>0 时在页签文字右上角挂黄色数字角标 */
  badges?: Partial<Record<PageId, number>>;
  "aria-label": string;
}

/**
 * 二级页签导航（设置分区 / 媒体工作流）：通栏等宽页签，外层为带边框的大圆角容器，
 * 激活段核心蓝填充。样式见 styles/animations.css 的 .l2-tabnav。
 */
export function L2TabNav<PageId extends string>({
  items,
  value,
  onChange,
  badges,
  "aria-label": ariaLabel
}: L2TabNavProps<PageId>) {
  return (
    <SegmentedControl
      className="l2-tabnav"
      w="100%"
      radius="lg"
      value={value}
      onChange={(next) => onChange(next as PageId)}
      data={items.map(({ page, label }) => {
        const badge = badges?.[page] ?? 0;
        return {
          value: page,
          // 角标为行内胶囊（Badge），随文本排布不遮挡；黄色警示与顶栏入口同语言。
          // 用 inline-flex 的 span 让“文本+角标”整体像纯文本一样被页签居中
          label:
            badge > 0 ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {label}
                <Badge size="xs" variant="light" color="yellow">
                  {badge}
                </Badge>
              </span>
            ) : (
              label
            )
        };
      })}
      aria-label={ariaLabel}
    />
  );
}
