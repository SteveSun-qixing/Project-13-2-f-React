import ExcelJS from "exceljs";
import { numfmt } from "@univerjs/core";
import { argbToHex, hexToArgb } from "./color";
import { offsetFormulaRefs } from "./formula-shift";
import { columnCharsToPixels, columnPixelsToChars, rowPointsToPixels, rowPixelsToPoints } from "./geometry";
import { decodeCsvBuffer, isNumericCell, parseCsv } from "./csv-import";
import {
  formatAddress,
  parseAddress,
  type RangeBounds,
} from "./cell-address";
import {
  createEmptyWorkbookModel,
  createEmptySheetModel,
  resolveFileExtension,
  type CellBorderModel,
  type CellModel,
  type CellScalarValue,
  type CellStyleModel,
  type SheetModel,
  type WorkbookModel,
} from "./workbook-model";

/** 1900 日期系统基准序列值（exceljs dateToExcel 同口径）。 */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
/** 1904 日期系统与 1900 系统的天数差。 */
export const DATE_1904_OFFSET_DAYS = 1462;

function excelSerialFromDate(date: Date, date1904: boolean): number {
  const serial = EXCEL_EPOCH_OFFSET_DAYS + date.getTime() / 86_400_000;
  return date1904 ? serial - DATE_1904_OFFSET_DAYS : serial;
}

function toExcelLoadInput(bytes: Uint8Array): Uint8Array {
  const bufferCtor = (globalThis as typeof globalThis & {
    Buffer?: {
      from(
        input: ArrayBufferLike,
        byteOffset?: number,
        length?: number,
      ): Uint8Array & { buffer: ArrayBufferLike };
    };
  }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return bytes;
}

function toBytes(output: unknown): Uint8Array {
  if (output instanceof Uint8Array) {
    return output;
  }
  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output);
  }
  if (typeof output === "object" && output !== null && "buffer" in output) {
    const view = output as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  throw new Error("工作簿写出结果不是有效的二进制数据。");
}

const EXCEL_BORDER_STYLE_MAP: Record<string, string> = {
  thin: "thin",
  medium: "medium",
  thick: "thick",
  dotted: "dotted",
  hair: "hair",
  dashed: "dashed",
  dashDot: "dashed",
  dashDotDot: "dashed",
  mediumDashed: "dashed",
  mediumDashDot: "dashed",
  mediumDashDotDot: "dashed",
  slantDashDot: "dashed",
};

const MODEL_BORDER_STYLE_TO_EXCEL: Record<string, string> = {
  thin: "thin",
  medium: "medium",
  thick: "thick",
  dotted: "dotted",
  hair: "hair",
  dashed: "dashed",
};

function mapExcelBorderStyle(style: string | undefined): string {
  if (!style) {
    return "thin";
  }
  return EXCEL_BORDER_STYLE_MAP[style] ?? "thin";
}

function mapExcelFontColor(color: { argb?: string } | undefined): string | undefined {
  return argbToHex(color?.argb);
}

function mapExcelFill(fill: unknown): string | undefined {
  if (!fill || typeof fill !== "object") {
    return undefined;
  }
  const patternFill = fill as {
    type?: string;
    pattern?: string;
    fgColor?: { argb?: string };
  };
  if (patternFill.type !== "pattern" || patternFill.pattern !== "solid") {
    return undefined;
  }
  return argbToHex(patternFill.fgColor?.argb);
}

function mapExcelBorderSide(side: { style?: string; color?: { argb?: string } } | undefined): CellBorderModel | undefined {
  if (!side?.style) {
    return undefined;
  }
  return {
    style: mapExcelBorderStyle(side.style),
    color: argbToHex(side.color?.argb) ?? "#000000",
  };
}

function mapExcelAlignment(alignment: { horizontal?: string; vertical?: string; wrapText?: boolean; textRotation?: number } | undefined): Pick<CellStyleModel, "horizontal" | "vertical" | "wrapText" | "textRotation"> {
  if (!alignment) {
    return {};
  }
  const result: Pick<CellStyleModel, "horizontal" | "vertical" | "wrapText" | "textRotation"> = {};
  if (alignment.horizontal === "left" || alignment.horizontal === "center" || alignment.horizontal === "right") {
    result.horizontal = alignment.horizontal;
  }
  if (alignment.vertical === "top" || alignment.vertical === "middle" || alignment.vertical === "bottom") {
    result.vertical = alignment.vertical;
  }
  if (alignment.wrapText === true) {
    result.wrapText = true;
  }
  const rotation = alignment.textRotation;
  if (typeof rotation === "number" && rotation > 0 && rotation <= 180) {
    result.textRotation = rotation;
  }
  return result;
}

function normalizeNumFmt(numFmt: string | undefined): string | undefined {
  if (!numFmt || numFmt === "General" || numFmt === "@") {
    return undefined;
  }
  return numFmt;
}

interface ExcelStyleLike {
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    strike?: boolean;
    color?: { argb?: string };
  };
  fill?: unknown;
  border?: {
    top?: { style?: string; color?: { argb?: string } };
    bottom?: { style?: string; color?: { argb?: string } };
    left?: { style?: string; color?: { argb?: string } };
    right?: { style?: string; color?: { argb?: string } };
  };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean; textRotation?: number };
}

function mapExcelStyleToModel(style: ExcelStyleLike | undefined, numFmt: string | undefined): { numFmt?: string; style?: CellStyleModel } {
  const normalizedFormat = normalizeNumFmt(numFmt);
  if (!style) {
    return normalizedFormat ? { numFmt: normalizedFormat } : {};
  }
  const modelStyle: CellStyleModel = {};
  const font = style.font;
  if (font) {
    if (font.name) {
      modelStyle.fontFamily = font.name;
    }
    if (typeof font.size === "number" && font.size > 0) {
      modelStyle.fontSize = font.size;
    }
    if (font.bold === true) {
      modelStyle.bold = true;
    }
    if (font.italic === true) {
      modelStyle.italic = true;
    }
    if (font.underline === true || font.underline === "single" || font.underline === "double") {
      modelStyle.underline = true;
    }
    if (font.strike === true) {
      modelStyle.strike = true;
    }
    const color = mapExcelFontColor(font.color);
    if (color) {
      modelStyle.fontColor = color;
    }
  }
  const fillColor = mapExcelFill(style.fill);
  if (fillColor) {
    modelStyle.fillColor = fillColor;
  }
  const border = style.border;
  if (border) {
    const top = mapExcelBorderSide(border.top);
    const bottom = mapExcelBorderSide(border.bottom);
    const left = mapExcelBorderSide(border.left);
    const right = mapExcelBorderSide(border.right);
    if (top || bottom || left || right) {
      modelStyle.borders = {
        ...(top ? { top } : {}),
        ...(bottom ? { bottom } : {}),
        ...(left ? { left } : {}),
        ...(right ? { right } : {}),
      };
    }
  }
  Object.assign(modelStyle, mapExcelAlignment(style.alignment));

  const hasStyle = Object.keys(modelStyle).length > 0;
  if (normalizedFormat && hasStyle) {
    return { numFmt: normalizedFormat, style: modelStyle };
  }
  if (normalizedFormat) {
    return { numFmt: normalizedFormat };
  }
  return hasStyle ? { style: modelStyle } : {};
}

/** exceljs 单元格原始值（读取态） */
interface ExcelCellValueLike {
  formula?: string;
  sharedFormula?: string;
  shareType?: string;
  result?: unknown;
  richText?: Array<{ text?: string }>;
  text?: unknown;
  hyperlink?: string;
  error?: string;
}

function scalarFromResult(result: unknown, date1904: boolean): CellScalarValue {
  if (result === undefined || result === null) {
    return null;
  }
  if (result instanceof Date) {
    return excelSerialFromDate(result, date1904);
  }
  if (typeof result === "number" || typeof result === "string" || typeof result === "boolean") {
    return result;
  }
  if (typeof result === "object" && "error" in (result as Record<string, unknown>)) {
    return null;
  }
  return null;
}

function mapExcelCellValue(
  rawValue: unknown,
  numFmt: string | undefined,
  date1904: boolean,
): Pick<CellModel, "value" | "formula" | "result" | "error"> {
  if (rawValue === undefined || rawValue === null) {
    return {};
  }
  if (typeof rawValue === "number" || typeof rawValue === "string" || typeof rawValue === "boolean") {
    return { value: rawValue };
  }
  if (rawValue instanceof Date) {
    return { value: excelSerialFromDate(rawValue, date1904) };
  }
  const structured = rawValue as ExcelCellValueLike;
  if (typeof structured.formula === "string" && structured.formula.length > 0) {
    return { formula: structured.formula, result: scalarFromResult(structured.result, date1904) };
  }
  if (typeof structured.sharedFormula === "string" && structured.sharedFormula.length > 0) {
    // 从属共享公式在此处先记录缓存结果，公式文本由 resolveSharedFormulas 二次扫描补齐。
    return { result: scalarFromResult(structured.result, date1904) };
  }
  if (Array.isArray(structured.richText)) {
    const text = structured.richText.map((run) => run.text ?? "").join("");
    return { value: text };
  }
  if (typeof structured.error === "string") {
    return { error: structured.error };
  }
  if (structured.text !== undefined && structured.text !== null) {
    if (structured.text instanceof Date) {
      return { value: excelSerialFromDate(structured.text, date1904) };
    }
    if (typeof structured.text === "number" || typeof structured.text === "string" || typeof structured.text === "boolean") {
      return { value: structured.text };
    }
  }
  return {};
}

function parseMergeRange(merge: string): RangeBounds {
  const first = parseAddress(merge.split(":")[0] ?? merge);
  const secondPart = merge.split(":")[1];
  const second = secondPart ? parseAddress(secondPart) : first;
  return {
    startRow: Math.min(first.row, second.row),
    startColumn: Math.min(first.column, second.column),
    endRow: Math.max(first.row, second.row),
    endColumn: Math.max(first.column, second.column),
  };
}

interface WorksheetLike {
  name: string;
  state: string;
  properties: { defaultRowHeight?: number; defaultColWidth?: number };
  views: Array<{ state?: string; xSplit?: number; ySplit?: number; topLeftCell?: string }> | null;
  model?: {
    cols?: Array<{ min?: number; max?: number; width?: number }>;
    merges?: string[];
  };
  eachRow(options: { includeEmpty: boolean }, callback: (row: ExcelRowLike, rowNumber: number) => void): void;
  getCell(address: string): ExcelCellLike;
}

interface ExcelRowLike {
  number: number;
  height?: number;
  eachCell(options: { includeEmpty: boolean }, callback: (cell: ExcelCellLike, colNumber: number) => void): void;
}

interface ExcelCellLike {
  address: string;
  numFmt?: string;
  style: ExcelStyleLike;
  value: unknown;
  /** exceljs 把合并区域主单元格的值共享给从属单元格；master 指向主单元格 */
  master?: { address: string };
}

function parseSheet(
  worksheet: WorksheetLike,
  date1904: boolean,
): SheetModel {
  const cells: Record<number, Record<number, CellModel>> = {};
  const masters = new Map<string, string>();
  let maxRow = 0;
  let maxColumn = 0;
  const rowHeights: Record<number, number> = {};

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowIndex = rowNumber - 1;
    if (typeof row.height === "number" && row.height > 0) {
      rowHeights[rowIndex] = rowPointsToPixels(row.height);
    }
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const columnIndex = colNumber - 1;
      maxRow = Math.max(maxRow, rowIndex);
      maxColumn = Math.max(maxColumn, columnIndex);
      // 合并区域的从属单元格：exceljs 会把主单元格的值共享过来，
      // 按 Excel 语义跳过（值只保存在主单元格上）。
      if (cell.master && cell.master.address !== cell.address) {
        return;
      }
      const { value, formula, result, error } = mapExcelCellValue(cell.value, cell.numFmt, date1904);
      if (typeof cell.value === "object" && cell.value !== null) {
        const structured = cell.value as ExcelCellValueLike;
        if (typeof structured.formula === "string" && structured.formula.length > 0) {
          masters.set(cell.address, structured.formula);
        }
      }
      const hasContent = value !== undefined || formula !== undefined || error !== undefined;
      const mapped = mapExcelStyleToModel(cell.style, cell.numFmt);
      const hasDecor = mapped.numFmt !== undefined || mapped.style !== undefined;
      if (!hasContent && !hasDecor) {
        return;
      }
      const cellModel: CellModel = {};
      if (value !== undefined) {
        cellModel.value = value;
      }
      if (formula !== undefined) {
        cellModel.formula = formula;
        if (result !== undefined) {
          cellModel.result = result;
        }
      } else if (error !== undefined) {
        cellModel.error = error;
      } else if (value === undefined && mapped.numFmt !== undefined) {
        cellModel.value = "";
      }
      if (mapped.numFmt !== undefined) {
        cellModel.numFmt = mapped.numFmt;
      }
      if (mapped.style !== undefined) {
        cellModel.style = mapped.style;
      }
      const rowCells = cells[rowIndex] ?? {};
      rowCells[columnIndex] = cellModel;
      cells[rowIndex] = rowCells;
    });
  });

  // 二次扫描：把共享公式从属单元格的公式文本按主单元格偏移展开。
  for (const [rowIndex, rowCells] of Object.entries(cells)) {
    for (const [columnIndex, cell] of Object.entries(rowCells)) {
      if (cell.formula !== undefined || cell.result === undefined) {
        continue;
      }
      const row = Number(rowIndex);
      const column = Number(columnIndex);
      const source = worksheet.getCell(formatAddress(row, column));
      const structured = source.value as ExcelCellValueLike | null;
      const masterAddress = structured?.sharedFormula;
      if (typeof masterAddress !== "string" || masterAddress.length === 0) {
        continue;
      }
      const masterFormula = masters.get(masterAddress);
      if (!masterFormula) {
        continue;
      }
      const master = parseAddress(masterAddress);
      cell.formula = offsetFormulaForSharedCell(masterFormula, row - master.row, column - master.column);
      cell.value = undefined;
    }
  }

  const merges: string[] = [];
  const parsedMerges = worksheet.model?.merges;
  if (Array.isArray(parsedMerges)) {
    for (const merge of parsedMerges) {
      if (typeof merge === "string" && merge.length > 0) {
        merges.push(merge);
        const bounds = parseMergeRange(merge);
        maxRow = Math.max(maxRow, bounds.endRow);
        maxColumn = Math.max(maxColumn, bounds.endColumn);
      }
    }
  }

  const colWidths: Record<number, number> = {};
  const parsedCols = worksheet.model?.cols;
  if (Array.isArray(parsedCols)) {
    for (const col of parsedCols) {
      if (typeof col.min === "number" && typeof col.max === "number" && typeof col.width === "number" && col.width > 0) {
        for (let index = col.min; index <= col.max; index += 1) {
          colWidths[index - 1] = columnCharsToPixels(col.width);
        }
        maxColumn = Math.max(maxColumn, col.max - 1);
      }
    }
  }

  const view = (worksheet.views ?? []).find((candidate) => candidate.state === "frozen");
  const freeze =
    view && (view.xSplit ?? 0) > 0 && (view.ySplit ?? 0) > 0
      ? { xSplit: Math.max(0, view.xSplit ?? 0), ySplit: Math.max(0, view.ySplit ?? 0) }
      : view && (view.xSplit ?? 0) > 0
        ? { xSplit: Math.max(0, view.xSplit ?? 0), ySplit: 0 }
        : view && (view.ySplit ?? 0) > 0
          ? { xSplit: 0, ySplit: Math.max(0, view.ySplit ?? 0) }
          : undefined;

  return {
    name: worksheet.name,
    hidden: worksheet.state === "hidden" || worksheet.state === "veryHidden",
    rowCount: Math.max(maxRow + 50, 100),
    columnCount: Math.max(maxColumn + 10, 26),
    defaultRowHeight:
      typeof worksheet.properties.defaultRowHeight === "number"
        ? rowPointsToPixels(worksheet.properties.defaultRowHeight)
        : undefined,
    defaultColumnWidth:
      typeof worksheet.properties.defaultColWidth === "number"
        ? columnCharsToPixels(worksheet.properties.defaultColWidth)
        : undefined,
    cells,
    merges,
    colWidths,
    rowHeights,
    freeze,
  };
}

function offsetFormulaForSharedCell(formula: string, rowDelta: number, columnDelta: number): string {
  return offsetFormulaRefs(formula, rowDelta, columnDelta);
}

export interface OpenWorkbookOptions {
  fileName?: string;
}

/**
 * 解析工作簿字节为内部模型。
 * - .xlsx/.xlsm：exceljs 读取；
 * - .csv：解码（BOM/UTF-8/GB18030/Shift_JIS 等）→ 解析 → 合成单 sheet 值模型。
 */
export async function openWorkbookBytes(bytes: Uint8Array, fileName: string): Promise<WorkbookModel> {
  const extension = resolveFileExtension(fileName);
  if (extension === "csv") {
    return openCsvBytes(bytes, fileName);
  }
  if (extension !== "xlsx" && extension !== "xlsm") {
    throw new Error(`不支持的表格文件格式：.${extension || "（无扩展名）"}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toExcelLoadInput(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const date1904 = (workbook.properties as { date1904?: boolean } | undefined)?.date1904 === true;

  const model = createEmptyWorkbookModel(fileName);
  model.sheets = [];
  for (const worksheet of workbook.worksheets) {
    model.sheets.push(parseSheet(worksheet as unknown as WorksheetLike, date1904));
  }
  if (model.sheets.length === 0) {
    model.sheets.push(createEmptySheetModel("工作表1"));
  }
  const activeTab = workbook.views?.[0]?.activeTab;
  model.activeSheetIndex =
    typeof activeTab === "number" && activeTab >= 0 && activeTab < model.sheets.length
      ? activeTab
      : 0;
  return model;
}

function openCsvBytes(bytes: Uint8Array, fileName: string): WorkbookModel {
  const text = decodeCsvBuffer(bytes);
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("CSV 文件没有可解析的数据行。");
  }
  const model = createEmptyWorkbookModel(fileName);
  const sheet = createEmptySheetModel("工作表1");
  let maxRow = 0;
  let maxColumn = 0;
  rows.forEach((row, rowIndex) => {
    row.forEach((rawValue, columnIndex) => {
      if (rawValue === "") {
        return;
      }
      maxRow = Math.max(maxRow, rowIndex);
      maxColumn = Math.max(maxColumn, columnIndex);
      const rowCells = sheet.cells[rowIndex] ?? {};
      rowCells[columnIndex] = isNumericCell(rawValue) ? { value: Number(rawValue) } : { value: rawValue };
      sheet.cells[rowIndex] = rowCells;
    });
  });
  sheet.rowCount = Math.max(maxRow + 50, 100);
  sheet.columnCount = Math.max(maxColumn + 10, 26);
  model.sheets = [sheet];
  model.activeSheetIndex = 0;
  return model;
}

function mapModelBorderToExcel(border: CellBorderModel): { style: string; color: { argb: string } } {
  return {
    style: MODEL_BORDER_STYLE_TO_EXCEL[border.style] ?? "thin",
    color: { argb: hexToArgb(border.color) ?? "FF000000" },
  };
}

function mapModelStyleToExcel(cell: CellModel): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  const modelStyle = cell.style;
  if (cell.numFmt) {
    style.numFmt = cell.numFmt;
  }
  if (modelStyle) {
    const font: Record<string, unknown> = {};
    if (modelStyle.fontFamily) {
      font.name = modelStyle.fontFamily;
    }
    if (typeof modelStyle.fontSize === "number") {
      font.size = modelStyle.fontSize;
    }
    if (modelStyle.bold === true) {
      font.bold = true;
    }
    if (modelStyle.italic === true) {
      font.italic = true;
    }
    if (modelStyle.underline === true) {
      font.underline = true;
    }
    if (modelStyle.strike === true) {
      font.strike = true;
    }
    const fontColor = hexToArgb(modelStyle.fontColor);
    if (fontColor) {
      font.color = { argb: fontColor };
    }
    if (Object.keys(font).length > 0) {
      style.font = font;
    }
    const fillColor = hexToArgb(modelStyle.fillColor);
    if (fillColor) {
      style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    }
    const borders = modelStyle.borders;
    if (borders) {
      const border: Record<string, unknown> = {};
      if (borders.top) {
        border.top = mapModelBorderToExcel(borders.top);
      }
      if (borders.bottom) {
        border.bottom = mapModelBorderToExcel(borders.bottom);
      }
      if (borders.left) {
        border.left = mapModelBorderToExcel(borders.left);
      }
      if (borders.right) {
        border.right = mapModelBorderToExcel(borders.right);
      }
      if (Object.keys(border).length > 0) {
        style.border = border;
      }
    }
    const alignment: Record<string, unknown> = {};
    if (modelStyle.horizontal) {
      alignment.horizontal = modelStyle.horizontal;
    }
    if (modelStyle.vertical) {
      alignment.vertical = modelStyle.vertical === "middle" ? "middle" : modelStyle.vertical;
    }
    if (modelStyle.wrapText === true) {
      alignment.wrapText = true;
    }
    if (typeof modelStyle.textRotation === "number" && modelStyle.textRotation > 0 && modelStyle.textRotation <= 180) {
      alignment.textRotation = modelStyle.textRotation;
    }
    if (Object.keys(alignment).length > 0) {
      style.alignment = alignment;
    }
  }
  return style;
}

function applyModelCell(worksheet: ExcelJS.Worksheet, row: number, column: number, cell: CellModel): void {
  const target = worksheet.getCell(row + 1, column + 1);
  const style = mapModelStyleToExcel(cell);
  const hasStyle = Object.keys(style).length > 0;
  if (typeof cell.formula === "string" && cell.formula.length > 0) {
    const result = cell.result;
    target.value =
      result === undefined || result === null
        ? { formula: cell.formula }
        : { formula: cell.formula, result };
  } else if (typeof cell.error === "string") {
    target.value = { error: cell.error } as ExcelJS.CellErrorValue;
  } else if (cell.value !== undefined && cell.value !== null) {
    target.value = cell.value;
  } else if (!hasStyle) {
    // 空单元格且无任何样式：无需写入
    return;
  }
  if (hasStyle) {
    target.style = style;
  }
}

export type SaveWorkbookFormat = "xlsx" | "xlsm";

/**
 * 将内部模型写出为 xlsx/xlsm 字节。
 * 公式单元格按 { formula, result } 写出；数字格式写入 numFmt；
 * 样式子集（字体/填充/边框/对齐）、合并区域、行高列宽、冻结窗格、多 sheet 全量重建。
 */
export async function saveWorkbookBytes(model: WorkbookModel, format: SaveWorkbookFormat = "xlsx"): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: model.activeSheetIndex, visibility: "visible" }];

  for (const sheet of model.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name, {
      state: sheet.hidden ? "hidden" : "visible",
      properties: {
        defaultRowHeight: sheet.defaultRowHeight ? rowPixelsToPoints(sheet.defaultRowHeight) : 15,
        ...(sheet.defaultColumnWidth
          ? { defaultColWidth: columnPixelsToChars(sheet.defaultColumnWidth) }
          : {}),
      },
      views:
        sheet.freeze && (sheet.freeze.xSplit > 0 || sheet.freeze.ySplit > 0)
          ? [
              {
                state: "frozen",
                xSplit: sheet.freeze.xSplit,
                ySplit: sheet.freeze.ySplit,
                topLeftCell: formatAddress(sheet.freeze.ySplit, sheet.freeze.xSplit),
              },
            ]
          : [],
    });

    for (const [columnKey, pixels] of Object.entries(sheet.colWidths)) {
      const chars = columnPixelsToChars(pixels);
      if (chars > 0) {
        worksheet.getColumn(Number(columnKey) + 1).width = chars;
      }
    }
    for (const [rowKey, pixels] of Object.entries(sheet.rowHeights)) {
      worksheet.getRow(Number(rowKey) + 1).height = rowPixelsToPoints(pixels);
    }
    for (const merge of sheet.merges) {
      worksheet.mergeCells(merge);
    }
    for (const [rowKey, rowCells] of Object.entries(sheet.cells)) {
      for (const [columnKey, cell] of Object.entries(rowCells)) {
        applyModelCell(worksheet, Number(rowKey), Number(columnKey), cell);
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return toBytes(buffer);
}

function csvField(text: string): string {
  const normalized = text.replace(/\r\n|\r/g, "\n");
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

export function csvFromValueRows(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvField).join(",") + "\r\n").join("");
}

function formatCsvValue(value: CellScalarValue, numFmt: string | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (typeof value === "number" && numFmt) {
    try {
      return numfmt.format(numFmt, value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * 将指定 sheet 的值矩阵导出为 CSV 字节（UTF-8 带 BOM，便于 Excel 识别中文）。
 * 公式单元格取缓存结果；数值单元格按数字格式渲染（与 Excel 导出行为一致）。
 */
export function exportSheetCsv(model: WorkbookModel, sheetIndex = model.activeSheetIndex): Uint8Array {
  const sheet = model.sheets[sheetIndex];
  if (!sheet) {
    throw new Error("导出 CSV 失败：没有找到活动工作表。");
  }

  let maxRow = -1;
  let maxColumn = -1;
  for (const [rowKey, rowCells] of Object.entries(sheet.cells)) {
    for (const [columnKey, cell] of Object.entries(rowCells)) {
      const hasValue =
        cell.value !== undefined ||
        cell.result !== undefined ||
        (cell.formula !== undefined && cell.result !== undefined);
      if (hasValue) {
        maxRow = Math.max(maxRow, Number(rowKey));
        maxColumn = Math.max(maxColumn, Number(columnKey));
      }
    }
  }

  const rows: string[][] = [];
  for (let row = 0; row <= maxRow; row += 1) {
    const rowValues: string[] = [];
    for (let column = 0; column <= maxColumn; column += 1) {
      const cell = sheet.cells[row]?.[column];
      const value = cell?.formula !== undefined ? (cell.result ?? null) : (cell?.value ?? null);
      rowValues.push(formatCsvValue(value ?? null, cell?.numFmt));
    }
    rows.push(rowValues);
  }

  const text = csvFromValueRows(rows);
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const body = new TextEncoder().encode(text);
  const bytes = new Uint8Array(bom.length + body.length);
  bytes.set(bom, 0);
  bytes.set(body, bom.length);
  return bytes;
}

/**
 * CSV 文本 → 最小 xlsx 字节（值导入：纯数字转数值，其余保持文本）。
 * 与原版 csvToXlsxBuffer 语义一致，底层改用 exceljs 构建工作簿。
 */
export async function csvToXlsxBuffer(csvText: string, sheetName = "Sheet1"): Promise<Uint8Array> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error("CSV 文件没有可解析的数据行。");
  }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  for (const row of rows) {
    worksheet.addRow(row.map((value) => (isNumericCell(value) ? Number(value) : value)));
  }
  return toBytes(await workbook.xlsx.writeBuffer());
}
