import { Center } from "@mantine/core";
import { DotsLoader } from "./DotsLoader";

/** 首屏启动遮罩：仅覆盖 React 挂载前的瞬间，视觉中心一个五点加载器。 */
export function SplashScreen() {
  return (
    <Center w="100%" mih="100vh" style={{ background: "var(--mantine-color-body)" }}>
      <DotsLoader />
    </Center>
  );
}
