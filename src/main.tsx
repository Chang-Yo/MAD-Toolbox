import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/carousel/styles.css";
import "./styles/animations.css";
import "./styles/layout.css";
import "./styles/notifications.css";
import App from "./app/App";
import { theme } from "./theme";
import { isWindows } from "./lib/platform";

document.documentElement.dataset.platform = isWindows ? "windows" : "macos";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {/* 左下角展示：远离顶部导航与右侧操作区；图标与底色规则见 styles/notifications.css 中 app-notification */}
      <Notifications position="bottom-left" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
