export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
export const MIN_SCALE = ZOOM_STEPS[0];
export const MAX_SCALE = ZOOM_STEPS[ZOOM_STEPS.length - 1];
/** 相邻页面的间距（缩放无关，像素） */
export const PAGE_GAP = 16;
/** 滚动视口内边距 */
export const SCROLL_PAD = 24;
/** 绘图线宽（PDF pt） */
export const STROKE_WIDTH = 2;
/** 批注边栏宽度（像素） */
export const NOTE_MARGIN_W = 300;
/** 便签批注定位的固定像素偏移 */
export const NOTE_PIN_OFFSET = 20;

export const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export type FitMode = "width" | "page" | null;

export type ViewerTool = "select" | "ink" | "rect" | "ellipse" | "line" | "arrow" | "note";
