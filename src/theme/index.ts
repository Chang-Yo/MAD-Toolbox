import { createTheme } from "@mantine/core";
import { blue } from "./colors";

// 清爽基调：blue 主色只出现在激活态与主按钮，其余交给留白与细边框
export const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  colors: {
    blue
  },
  components: {
    // 去掉 Mantine v9 默认的选项间 1px 分隔线（withItemsBorders 默认 true），
    // 与全局激活段淡入淡出的样式语言保持一致
    SegmentedControl: {
      defaultProps: {
        withItemsBorders: false
      }
    }
  }
});
