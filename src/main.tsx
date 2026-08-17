import React from "react";
import ReactDOM from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/carousel/styles.css";
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
      {/* 左下角展示：远离顶部导航与右侧操作区；图标与底色规则见 layout.css 中 app-notification */}
      <Notifications position="bottom-left" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
