import type { ReactNode } from "react";
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

const ICON_BY_TYPE: Record<NotificationType, ReactNode> = {
  success: <IconCircleCheckFilled size={20} />,
  warning: <IconAlertTriangleFilled size={20} />,
  error: <IconCircleXFilled size={20} />,
  info: <IconInfoCircleFilled size={20} />
};

/**
 * notifications.show 的应用级包装：按语义色注入类型图标与样式类，
 * 调用处参数保持不变。通知整体外观（左下角、纯色底三段式布局）见 styles/notifications.css。
 */
export const notifications = {
  show(input: NotificationData) {
    const type = TYPE_BY_COLOR[input.color ?? "blue"] ?? "info";
    const typeClasses = `app-notification app-notification--${type}`;
    return mantineNotifications.show({
      ...input,
      icon: input.icon ?? ICON_BY_TYPE[type],
      className: input.className ? `${input.className} ${typeClasses}` : typeClasses,
      classNames: {
        ...input.classNames,
        icon: "app-notification-icon",
        title: "app-notification-title",
        description: "app-notification-description"
      }
    });
  }
};
