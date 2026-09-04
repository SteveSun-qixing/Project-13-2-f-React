/**
 * 动态几何与文档数据颜色的写入工具。
 * 界面规范要求 TSX 不出现内联 style：所有随缩放/旋转变化的定位
 * 通过 CSS 自定义属性 + 引用式 setProperty 写入，CSS 规则统一消费。
 */

export interface ElementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 将盒子写入元素的自定义属性（--box-left/-top/-width/-height，px 单位） */
export function applyElementBox(el: HTMLElement | SVGElement | null, box: ElementBox): void {
  if (!el) return;
  el.style.setProperty("--box-left", `${box.left}px`);
  el.style.setProperty("--box-top", `${box.top}px`);
  el.style.setProperty("--box-width", `${box.width}px`);
  el.style.setProperty("--box-height", `${box.height}px`);
}

/** 写入 RGB 自定义属性（0-1 rgb → "r,g,b"），供 CSS 以 rgb(var(--c) / a) 消费 */
export function applyElementRgb(el: HTMLElement | SVGElement | null, name: string, rgb: readonly [number, number, number]): void {
  if (!el) return;
  const scaled = rgb.map((v) => Math.round(Math.min(Math.max(v, 0), 1) * 255));
  el.style.setProperty(name, scaled.join(", "));
}

/** 写入任意字符串自定义属性（如 data URI） */
export function applyElementVar(el: HTMLElement | SVGElement | null, name: string, value: string): void {
  if (!el) return;
  el.style.setProperty(name, value);
}
