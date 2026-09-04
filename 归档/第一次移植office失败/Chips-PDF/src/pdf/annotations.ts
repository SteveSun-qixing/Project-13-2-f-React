/** 文本标记类型 */
export type MarkupType = "highlight" | "underline" | "strikeout";

/** 要写入文件的文本标记；quads 为 PDF 坐标（y 向上）四点组 */
export interface MarkupInput {
  pageIndex: number;
  type: MarkupType;
  /** 0-1 归一化 rgb */
  color: [number, number, number];
  quads: number[][];
}

/** 会话内待保存的文本标记 */
export interface LocalMarkup extends MarkupInput {
  id: string;
}

/** 各标记类型的默认颜色（文档数据，非界面主题色） */
export const MARKUP_COLORS: Record<MarkupType, [number, number, number]> = {
  highlight: [1, 0.87, 0.35],
  underline: [0.17, 0.4, 1],
  strikeout: [0.86, 0.22, 0.18],
};

/** pdf.js AnnotationType 编码 → 标记类型（用于读取已保存标记） */
export const MARKUP_TYPE_BY_ANNOT: Record<number, MarkupType> = {
  9: "highlight",
  10: "underline",
  12: "strikeout",
};

export const MARKUP_SUBTYPES: Record<MarkupType, string> = {
  highlight: "Highlight",
  underline: "Underline",
  strikeout: "StrikeOut",
};

/** 0-1 rgb → css rgb() 字符串 */
export const cssRgb = (c: readonly [number, number, number]): string =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
