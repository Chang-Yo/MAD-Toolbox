import React from "react";
import ReactDOM from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/animations.css";
import "./styles/layout.css";
import App from "./app/App";
import { isWindows } from "./lib/platform";

document.documentElement.dataset.platform = isWindows ? "windows" : "macos";

// 清爽基调：orange 主色只出现在激活态与主按钮，其余交给留白与细边框
const theme = createTheme({
  primaryColor: "orange",
  defaultRadius: "md"
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {/* 顶部 66px 是全局导航栏：top-right 通知压到导航栏之下，避免遮挡
          （不能直接给 style——会平铺到全部六个方位容器，bottom 容器会因此被拉伸成全屏挡点击） */}
      <Notifications position="top-right" classNames={{ root: "app-notifications" }} />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
