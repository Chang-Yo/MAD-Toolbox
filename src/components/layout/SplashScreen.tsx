import { Center } from "@mantine/core";

/** 首屏启动遮罩：仅覆盖 React 挂载前的瞬间，视觉中心一个五点加载器。 */
export function SplashScreen() {
  return (
    <Center w="100%" mih="100vh" style={{ background: "var(--mantine-color-body)" }}>
      <DotsLoader />
    </Center>
  );
}

/** 点状加载器（5 点）：Mantine Loader 的 dots 变体仅 3 点，不满足需求故自绘。 */
function DotsLoader() {
  return (
    <span className="dots-loader" aria-hidden>
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className="dots-loader-dot"
          style={{ animationDelay: `${index * 100}ms` }}
        />
      ))}
    </span>
  );
}
