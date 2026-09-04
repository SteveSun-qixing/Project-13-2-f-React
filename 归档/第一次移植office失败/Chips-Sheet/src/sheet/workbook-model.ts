export type WorkbookFormat = "xlsx" | "xlsm" | "csv";

export type CellScalarValue = string | number | boolean | null;

export interface CellBorderModel {
  /** 线型：thin | medium | thick | dotted | dashed | hair */
  style: string;
  /** 颜色，#RRGGBB */
  color?: string;
}

export interface CellStyleModel {
  fontFamily?: string;
  /** 字号（pt） */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** 前景色，#RRGGBB */
  fontColor?: string;
  /** 填充色，#RRGGBB */
  fillColor?: string;
  /** 水平对齐：left | center | right */
  horizontal?: string;
  /** 垂直对齐：top | middle | bottom */
  vertical?: string;
  wrapText?: boolean;
  /** 文字旋转角度（OOXML textRotation 语义：1-90 逆时针，91-180 顺时针，255 垂直堆叠） */
  textRotation?: number;
  borders?: {
    top?: CellBorderModel;
    bottom?: CellBorderModel;
    left?: CellBorderModel;
    right?: CellBorderModel;
  };
}

export interface CellModel {
  value?: CellScalarValue;
  /** 公式文本（不带等号前缀，例如 "SUM(A1:A2)"） */
  formula?: string;
  /** 公式缓存结果 */
  result?: CellScalarValue;
  /** 单元格错误值（例如 "#N/A"），仅错误单元格携带 */
  error?: string;
  /** 数字格式（OOXML numFmt 格式串，例如 "0.00%"） */
  numFmt?: string;
  style?: CellStyleModel;
}

export interface SheetFreezeModel {
  /** 冻结的列数 */
  xSplit: number;
  /** 冻结的行数 */
  ySplit: number;
}

export interface SheetModel {
  name: string;
  hidden: boolean;
  /** 行数（引擎网格规模，0 起） */
  rowCount: number;
  /** 列数（引擎网格规模，0 起） */
  columnCount: number;
  /** 默认行高（px） */
  defaultRowHeight?: number;
  /** 默认列宽（px） */
  defaultColumnWidth?: number;
  /** 单元格矩阵：行 → 列 → 单元格（0 起下标，稀疏存储） */
  cells: Record<number, Record<number, CellModel>>;
  /** 合并区域（例如 "A1:B2"） */
  merges: string[];
  /** 列宽（0 起列号 → px） */
  colWidths: Record<number, number>;
  /** 行高（0 起行号 → px） */
  rowHeights: Record<number, number>;
  freeze?: SheetFreezeModel;
}

export interface WorkbookModel {
  fileName: string;
  sheets: SheetModel[];
  activeSheetIndex: number;
}

export const DEFAULT_NEW_SHEET_ROW_COUNT = 100;
export const DEFAULT_NEW_SHEET_COLUMN_COUNT = 26;

export const SUPPORTED_SHEET_EXTENSIONS = ["xlsx", "xlsm", "csv"] as const;
export const SUPPORTED_SHEET_EXTENSION_LABEL = ".xlsx / .xlsm / .csv";

export function resolveFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }
  return normalized.slice(dotIndex + 1);
}

export function resolveFileName(filePath: string): string {
  const normalized = filePath.trim();
  if (!normalized) {
    return "";
  }
  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

export function isSupportedSheetFileName(fileName: string): boolean {
  const extension = resolveFileExtension(fileName);
  return (SUPPORTED_SHEET_EXTENSIONS as readonly string[]).includes(extension);
}

export function stripExtension(fileName: string): string {
  const normalized = fileName.trim();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
}

export function createEmptySheetModel(
  name: string,
  rowCount = DEFAULT_NEW_SHEET_ROW_COUNT,
  columnCount = DEFAULT_NEW_SHEET_COLUMN_COUNT,
): SheetModel {
  return {
    name,
    hidden: false,
    rowCount,
    columnCount,
    cells: {},
    merges: [],
    colWidths: {},
    rowHeights: {},
  };
}

export function createEmptyWorkbookModel(fileName = "工作簿1.xlsx"): WorkbookModel {
  return {
    fileName,
    sheets: [createEmptySheetModel("工作表1")],
    activeSheetIndex: 0,
  };
}
