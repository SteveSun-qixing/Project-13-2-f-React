/**
 * 画布编辑覆盖层的动态几何样式出口。
 *
 * 生态规范要求 TSX 中不出现 JSX 内联样式对象：视觉常量统一收敛在 CSS
 * （editor.css，使用生态色变量）；但文本编辑框、裁剪覆盖层等的位置/尺寸/
 * 字号是引擎按元素模型与缩放逐帧计算的动态布局值，无法用静态 CSS 表达，
 * 因此参照 Chips-Word 的动态几何写法，由渲染层计算样式映射后经 ref 命令式
 * 写入元素内联样式。本模块只承载动态布局值，不承载任何视觉常量。
 */

/** 数值不追加 px 的无单位 CSS 属性。 */
const UNITLESS = new Set([
  "zIndex",
  "opacity",
  "lineHeight",
  "fontWeight",
  "flexGrow",
  "flexShrink",
  "order",
]);

/** 驼峰属性名 → kebab-case。 */
function toKebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** 动态样式映射：值为引擎计算的布局量；undefined/null 项跳过不写。 */
export type OverlayStyle = Record<string, string | number | undefined | null>;

/**
 * 将动态样式整体写入元素（全量覆盖式，语义等同 React style prop 的每次
 * 渲染同步；视觉常量仍由 CSS 类提供，不经过本函数）。
 */
export function applyOverlayStyle(
  element: HTMLElement | null,
  style: OverlayStyle,
): void {
  if (!element) return;
  let cssText = "";
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null || value === "") continue;
    const text =
      typeof value === "number" && !UNITLESS.has(key) ? `${value}px` : String(value);
    cssText += (cssText ? ";" : "") + `${toKebab(key)}:${text}`;
  }
  element.setAttribute("style", cssText);
}
