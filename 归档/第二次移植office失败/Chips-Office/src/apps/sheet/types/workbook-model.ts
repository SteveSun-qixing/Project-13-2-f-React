export type CellScalarValue = string | number | boolean | null;

export interface CellBorderModel {
  style: "thin" | "medium" | "thick" | "dotted" | "dashed" | "hair";
  color?: string;
}

export interface CellStyleModel {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontColor?: string;
  fillColor?: string;
  horizontal?: "left" | "center" | "right";
  vertical?: "top" | "middle" | "bottom";
  wrapText?: boolean;
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
  formula?: string;
  result?: CellScalarValue;
  error?: string;
  numFmt?: string;
  style?: CellStyleModel;
}

export interface SheetFreezeModel {
  xSplit: number;
  ySplit: number;
}

export interface SheetModel {
  name: string;
  hidden: boolean;
  rowCount: number;
  columnCount: number;
  defaultRowHeight?: number;
  defaultColumnWidth?: number;
  cells: Record<number, Record<number, CellModel>>;
  merges: string[];
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  freeze?: SheetFreezeModel;
}

export interface WorkbookModel {
  fileName: string;
  sheets: SheetModel[];
  activeSheetIndex: number;
}

export type WorkbookFormat = "xlsx" | "xlsm" | "csv";

export const DEFAULT_NEW_SHEET_ROW_COUNT = 100;
export const DEFAULT_NEW_SHEET_COLUMN_COUNT = 26;

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

export function parseCellAddress(address: string): { column: number; row: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    return { column: 0, row: 0 };
  }
  const colStr = match[1].toUpperCase();
  const row = parseInt(match[2], 10) - 1;
  let column = 0;
  for (const char of colStr) {
    column = column * 26 + (char.charCodeAt(0) - 64);
  }
  return { column: column - 1, row };
}

export function formatCellAddress(column: number, row: number): string {
  const colStr = columnIndexToLetters(column);
  return `${colStr}${row + 1}`;
}

function columnIndexToLetters(column: number): string {
  let result = "";
  let index = column + 1;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    index = Math.floor((index - 1) / 26);
  }
  return result;
}

export function isNumericCell(value: string): boolean {
  if (value.trim() === "") return false;
  return !isNaN(Number(value)) && isFinite(Number(value));
}
