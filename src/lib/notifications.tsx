import type { CSSProperties, ReactNode } from "react";
import {
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconInfoCircleFilled
} from "@tabler/icons-react";
import { notifications as mantineNotifications } from "@mantine/notifications";
import type { NotificationData } from "@mantine/notifications";

type NotificationType = "success" | "warning" | "error" | "info";

/** 调用处的语义色 → 通知类型；未指定色（默认）按信息处理 */
const TYPE_BY_COLOR: Record<string, NotificationType> = {
  green: "success",
  teal: "success",
  yellow: "warning",
  red: "error",
  blue: "info"
};

/** 各类型默认驻留时长（ms）；调用方显式传 autoClose 时以调用方为准，false 则常驻 */
const AUTO_CLOSE_BY_TYPE: Record<NotificationType, number> = {
  success: 3000,
  warning: 5000,
  error: 10000,
  info: 4000
};

const ICON_BY_TYPE: Record<NotificationType, ReactNode> = {
  success: <IconCircleCheckFilled size={20} />,
  warning: <IconAlertTriangleFilled size={20} />,
  error: <IconCircleXFilled size={20} />,
  info: <IconInfoCircleFilled size={20} />
};

/** 倒计时条时长变量（CSSProperties 不含自定义属性键，需经 unknown 断言） */
const lifetimeStyle = (ms: number): CSSProperties =>
  ({ "--app-notification-lifetime": `${ms}ms` }) as unknown as CSSProperties;

/**
 * notifications.show 的应用级包装：按语义色注入类型图标与样式类、
 * 类型默认的自动关闭时长（底部倒计时条的时长与其同步），
 * 调用处参数保持不变。通知整体外观见 styles/notifications.css。
 */
export const notifications = {
  show(input: NotificationData) {
    const type = TYPE_BY_COLOR[input.color ?? "blue"] ?? "info";
    // true = 沿用 NotificationsProvider 默认时长（main.tsx 未覆写，即 4000ms）
    const requested = input.autoClose ?? AUTO_CLOSE_BY_TYPE[type];
    const duration: number | false = requested === true ? 4000 : requested;
    const timed = duration !== false;
    const typeClasses = [
      "app-notification",
      `app-notification--${type}`,
      timed ? "app-notification--timed" : undefined
    ]
      .filter(Boolean)
      .join(" ");
    // Mantine 的 autoClose 计时在悬停时会暂停、移开后按完整时长重置，与纯 CSS
    // 倒计时条无法同步；关闭时机由包装层定时器接管（倒计时无视悬停，归零即关）
    const id = mantineNotifications.show({
      ...input,
      autoClose: false,
      icon: input.icon ?? ICON_BY_TYPE[type],
      // 根类走 classNames.root 而非 className：NotificationContainer 中 data 的
      // className 会整体替换 provider 注入的堆叠间距类（mantine-Notifications-notification），
      // classNames 则由 Notification 合并，间距得以保留
      classNames: {
        ...(typeof input.classNames === "object" ? input.classNames : undefined),
        root: [
          input.className,
          typeof input.classNames === "object" ? input.classNames.root : undefined,
          typeClasses
        ]
          .filter(Boolean)
          .join(" "),
        icon: "app-notification-icon",
        title: "app-notification-title",
        description: "app-notification-description"
      },
      // 数组形式的 style 只有 Mantine Box 归并后才安全，通知这里直接合成对象
      style: timed
        ? ({
            ...(input.style as CSSProperties | undefined),
            ...lifetimeStyle(duration)
          } as CSSProperties)
        : input.style
    });
    if (timed) window.setTimeout(() => mantineNotifications.hide(id), duration);
    return id;
  }
};
