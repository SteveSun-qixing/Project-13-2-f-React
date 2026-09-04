/** 绘图工具类型（便签单独走便签批注链路） */
export type DrawKind = "ink" | "rect" | "ellipse" | "line" | "arrow";

/** 绘图批注统一输入（坐标均为 PDF 用户空间，y 向上） */
export type DrawingInput =
  | {
      kind: "ink";
      pageIndex: number;
      color: [number, number, number];
      width: number;
      paths: number[][];
    }
  | {
      kind: "rect";
      pageIndex: number;
      color: [number, number, number];
      width: number;
      rect: [number, number, number, number];
    }
  | {
      kind: "ellipse";
      pageIndex: number;
      color: [number, number, number];
      width: number;
      rect: [number, number, number, number];
    }
  | {
      kind: "line";
      pageIndex: number;
      color: [number, number, number];
      width: number;
      from: [number, number];
      to: [number, number];
    }
  | {
      kind: "arrow";
      pageIndex: number;
      color: [number, number, number];
      width: number;
      from: [number, number];
      to: [number, number];
    }
  | {
      kind: "note";
      pageIndex: number;
      color: [number, number, number];
      at: [number, number];
      contents: string;
      author?: string;
      createdMs?: number;
      localId?: string;
      replyToSaved?: NoteReplyTarget;
      replyToLocalId?: string;
    };

/** 回复目标：文件中已保存的便签（Text）批注 */
export interface NoteReplyTarget {
  objNum: number;
  rect: [number, number, number, number];
  contents: string;
}

/** 会话内待保存的绘图批注 */
export interface LocalDrawing {
  id: string;
  input: DrawingInput;
}

/** 绘图颜色盘（0-1 rgb，文档数据） */
export const DRAW_COLORS: { name: string; rgb: [number, number, number] }[] = [
  { name: "red", rgb: [0.86, 0.22, 0.18] },
  { name: "yellow", rgb: [1, 0.78, 0.13] },
  { name: "green", rgb: [0.13, 0.65, 0.35] },
  { name: "blue", rgb: [0.17, 0.4, 1] },
  { name: "black", rgb: [0.15, 0.15, 0.15] },
];

/** 已保存便签的默认定位色（文档数据） */
export const NOTE_FALLBACK_COLOR: [number, number, number] = [1, 0.78, 0.13];
