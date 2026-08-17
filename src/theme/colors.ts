/**
 * 品牌色彩真相源：blue 主色十级色阶（Mantine colors 契约），
 * 核心色 #0A84FF 落在第 6 级（Mantine 的 filled/主操作取色位）。
 */

export const blue = [
  "#EAF4FF",
  "#D3E7FF",
  "#AECEFF",
  "#85BCFF",
  "#5CA9FF",
  "#2F94FF",
  "#0A84FF",
  "#086ACC",
  "#0654A0",
  "#043E78"
] as const;

/**
 * dark 色阶在 Mantine v9 默认值（#242424 系）基础上整体加深：
 * 第 7 级 = body 背景锚定 #1D1D20，0-3 级文字色保持默认，4-6 级（边框/悬浮/卡片底）
 * 与 8-9 级随之等距收拢，并统一带与锚点一致的微蓝调。
 */
export const dark = [
  "#C9C9C9",
  "#B8B8B8",
  "#828282",
  "#696969",
  "#3C3C41",
  "#2E2E33",
  "#242429",
  "#1D1D20",
  "#151518",
  "#101013"
] as const;
