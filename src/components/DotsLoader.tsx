/** 点状加载器（5 点）：Mantine Loader 的 dots 变体仅 3 点，不满足需求故自绘。 */
export function DotsLoader() {
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
