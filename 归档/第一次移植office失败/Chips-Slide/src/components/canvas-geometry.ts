/**
 * 画布几何换算：px（fitWidth 视口）↔ EMU（文档空间）、旋转枢轴与手柄缩放的
 * 包围盒数学。单位语义与 pptx-render coords 模块一致：
 *   px = emu / EMU_PER_PX_96 * scale，emu = px * EMU_PER_PX_96 / scale。
 */
import type { RenderNode } from "@genoffice/pptx-render";

export interface PxBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** px → EMU（按视口 scale）。 */
export function pxToEmu(px: number, scale: number): number {
  return Math.round((px * 9525) / scale);
}

/** EMU → px（按视口 scale）。 */
export function emuToPx(emu: number, scale: number): number {
  return (emu / 9525) * scale;
}

/** 缩放手柄标识（八向）。 */
export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** 把手在未旋转盒子内的归一化锚点（0..1）。 */
export const HANDLE_ANCHORS: Record<HandleId, { x: number; y: number }> = {
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 },
};

function rotate(x: number, y: number, rad: number): { x: number; y: number } {
  return {
    x: x * Math.cos(rad) - y * Math.sin(rad),
    y: x * Math.sin(rad) + y * Math.cos(rad),
  };
}

/**
 * 拖动一个把手后的新盒子（视口 px）。
 * 数学：对侧角/边在屏幕上保持不动 —— 固定点 F 的页面位置 = 中心 C + R(θ)·(F − (w/2, h/2))；
 * 新尺寸下反解新中心 C1 = S(F) − R(θ)·(F1 − (w1/2, h1/2))，再取未旋转盒子左上角。
 */
export function resizeBoxFromHandle(
  box: PxBox,
  rotationDeg: number,
  handle: HandleId,
  pointer: { x: number; y: number },
  keepAspect: boolean,
): PxBox {
  const rad = (rotationDeg * Math.PI) / 180;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const anchor = HANDLE_ANCHORS[handle];
  // 指针换算到未旋转盒子局部坐标（原点 = 左上角）
  const d = rotate(pointer.x - cx, pointer.y - cy, -rad);
  const local = { x: d.x + box.w / 2, y: d.y + box.h / 2 };
  // 固定点（把手对侧）的局部坐标
  const fixed = { x: 1 - anchor.x, y: 1 - anchor.y };
  // 新尺寸：自由端取指针局部位置；边把手保持另一维原值
  let w = anchor.x === 0.5 ? box.w : Math.abs(local.x - fixed.x * box.w);
  let h = anchor.y === 0.5 ? box.h : Math.abs(local.y - fixed.y * box.h);
  if (keepAspect && anchor.x !== 0.5 && anchor.y !== 0.5 && w > 0 && h > 0) {
    const ratio = box.w / box.h;
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }
  w = Math.max(w, 4);
  h = Math.max(h, 4);
  // 缩放后固定点仍贴住盒子对应角/边：先取新盒内固定点的局部坐标
  const fixedLocal = { x: fixed.x * w, y: fixed.y * h };
  // 固定点页面位置（旧中心 + 旧尺寸）
  const fOffOld = rotate(fixed.x * box.w - box.w / 2, fixed.y * box.h - box.h / 2, rad);
  const fx = cx + fOffOld.x;
  const fy = cy + fOffOld.y;
  // 新中心：S(F) = C1 + R(θ)·(fixedLocal − (w/2, h/2)) → C1 = S(F) − R(θ)·(...)
  const fOffNew = rotate(fixedLocal.x - w / 2, fixedLocal.y - h / 2, rad);
  const cx1 = fx - fOffNew.x;
  const cy1 = fy - fOffNew.y;
  return { x: cx1 - w / 2, y: cy1 - h / 2, w, h };
}

/** 从旋转盒子 + 起始/当前指针位置解出新旋转角（度，顺时针）。 */
export function rotationFromPointer(
  box: PxBox,
  rotationDeg: number,
  startPointer: { x: number; y: number },
  pointer: { x: number; y: number },
): number {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const startAngle = Math.atan2(startPointer.y - cy, startPointer.x - cx);
  const currentAngle = Math.atan2(pointer.y - cy, pointer.x - cx);
  const delta = ((currentAngle - startAngle) * 180) / Math.PI;
  return rotationDeg + delta;
}

/** 节点是否可拖动（装饰节点只显示不交互）。 */
export function isMovableNode(node: RenderNode): boolean {
  return !node.decoration && !!node.sourceId;
}

/** 图片节点缩放默认保持纵横比。 */
export function nodeKeepAspect(node: RenderNode): boolean {
  return node.type === "picture";
}
