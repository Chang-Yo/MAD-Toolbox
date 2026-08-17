import { createTheme } from "@mantine/core";
import { orange } from "./colors";

// 清爽基调：orange 主色只出现在激活态与主按钮，其余交给留白与细边框
export const theme = createTheme({
  primaryColor: "orange",
  defaultRadius: "md",
  colors: {
    orange
  }
});
