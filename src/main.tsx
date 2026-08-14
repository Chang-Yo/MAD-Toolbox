import React from "react";
import ReactDOM from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import App from "./App";
import { isWindows } from "./lib/platform";

document.documentElement.dataset.platform = isWindows ? "windows" : "macos";

// 清爽基调：teal 主色只出现在激活态与主按钮，其余交给留白与细边框
const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md"
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
