/**
 * Univer 灌入层：把 exceljs 解析出的内部工作簿模型一次性写入 Univer 快照。
 *
 * 原版 GenOffice 通过 sidecar 视口懒加载（viewport streaming）按需拉取数据；
 * 浏览器插件无法携带 sidecar 进程，本移植改为「全量快照灌入」：一次性构造
 * 完整 IWorkbookData（sheet 顺序/名称、行列规模、单元格值与公式、数字格式、
 * 样式子集、合并区域、行高列宽、冻结窗格、隐藏状态），经
 * univerAPI.createWorkbook 创建单元。公式由 Univer preset 内置公式引擎接管
 * 显示与重算。这是正式实现路径而非妥协方案。
 */
import {
  BooleanNumber,
  LocaleType,
  type ICellData,
  type IObjectMatrixPrimitiveType,
  type IObjectArrayPrimitiveType,
  type IRange,
  type IWorkbookData,
  type IWorksheetData,
} from "@univerjs/core";

import type { UniverRuntime } from "./univer-state";
import { modelStyleToUniverStyle } from "./univer-style-bridge";
import {
  DEFAULT_COLUMN_WIDTH_PIXELS,
  DEFAULT_ROW_HEIGHT_PIXELS,
} from "./geometry";
import {
  formatAddress,
  parseRange,
} from "./cell-address";
import type { CellModel, SheetModel, WorkbookModel } from "./workbook-model";

const MINIMUM_SHEET_ROW_COUNT = 100;
const MINIMUM_SHEET_COLUMN_COUNT = 26;

function buildCellData(sheet: SheetModel): {
  cellData: IObjectMatrixPrimitiveType<ICellData>;
  maxRow: number;
  maxColumn: number;
} {
  const cellData: IObjectMatrixPrimitiveType<ICellData> = {};
  let maxRow = 0;
  let maxColumn = 0;
  for (const [rowKey, rowCells] of Object.entries(sheet.cells)) {
    const row = Number(rowKey);
    const matrixRow: Record<number, ICellData> = {};
    for (const [columnKey, cell] of Object.entries(rowCells)) {
      const column = Number(columnKey);
      const cellDataItem = modelCellToUniverCell(cell);
      if (cellDataItem) {
        matrixRow[column] = cellDataItem;
      }
      maxRow = Math.max(maxRow, row);
      maxColumn = Math.max(maxColumn, column);
    }
    if (Object.keys(matrixRow).length > 0) {
      cellData[row] = matrixRow;
    }
  }
  return { cellData, maxRow, maxColumn };
}

function modelCellToUniverCell(cell: CellModel): ICellData | undefined {
  const result: ICellData = {};
  const style = modelCellToUniverStyle(cell);
  if (style) {
    result.s = style;
  }
  if (typeof cell.formula === "string" && cell.formula.length > 0) {
    result.f = cell.formula;
    // 公式单元格把缓存结果一并写入，引擎挂载前首帧即可显示正确值，
    // 随后由 Univer 公式引擎重算接管。
    if (typeof cell.result === "number" || typeof cell.result === "string" || typeof cell.result === "boolean") {
      result.v = cell.result;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  if (typeof cell.error === "string") {
    result.v = cell.error;
    return result;
  }
  if (cell.value !== undefined && cell.value !== null) {
    result.v = cell.value;
    return result;
  }
  return style ? result : undefined;
}

function modelCellToUniverStyle(cell: CellModel): ICellData["s"] {
  const hasStyle = cell.style !== undefined;
  const hasNumFmt = typeof cell.numFmt === "string" && cell.numFmt.length > 0;
  if (!hasStyle && !hasNumFmt) {
    return undefined;
  }
  return modelStyleToUniverStyle(cell.style ?? {}, hasNumFmt ? cell.numFmt : undefined);
}

function parseMergeRanges(sheet: SheetModel): IRange[] {
  const ranges: IRange[] = [];
  for (const merge of sheet.merges) {
    try {
      const bounds = parseRange(merge);
      ranges.push({
        startRow: bounds.startRow,
        startColumn: bounds.startColumn,
        endRow: bounds.endRow,
        endColumn: bounds.endColumn,
      });
    } catch {
      // 非法合并区域直接跳过，不阻塞整表打开
    }
  }
  return ranges;
}

export function buildWorkbookSnapshot(model: WorkbookModel, workbookId: string): IWorkbookData {
  const sheets: Record<string, Partial<IWorksheetData>> = {};
  const sheetOrder: string[] = [];
  const parsedMergesBySheet = new Map<number, IRange[]>();

  model.sheets.forEach((sheet, sheetIndex) => {
    const sheetId = `sheet-${sheetIndex}`;
    sheetOrder.push(sheetId);
    const { cellData, maxRow: cellMaxRow, maxColumn: cellMaxColumn } = buildCellData(sheet);
    let maxRow = cellMaxRow;
    let maxColumn = cellMaxColumn;
    const mergeRanges = parseMergeRanges(sheet);
    parsedMergesBySheet.set(sheetIndex, mergeRanges);
    for (const range of mergeRanges) {
      maxRow = Math.max(maxRow, range.endRow);
      maxColumn = Math.max(maxColumn, range.endColumn);
    }

    const rowData: IObjectArrayPrimitiveType<{ h?: number }> = {};
    for (const [rowKey, pixels] of Object.entries(sheet.rowHeights)) {
      rowData[Number(rowKey)] = { h: pixels };
    }
    const columnData: IObjectArrayPrimitiveType<{ w?: number }> = {};
    for (const [columnKey, pixels] of Object.entries(sheet.colWidths)) {
      columnData[Number(columnKey)] = { w: pixels };
    }

    const freeze = sheet.freeze;
    const xSplit = freeze ? Math.max(0, Math.min(freeze.xSplit, 500)) : 0;
    const ySplit = freeze ? Math.max(0, Math.min(freeze.ySplit, 500)) : 0;

    sheets[sheetId] = {
      id: sheetId,
      name: sheet.name,
      hidden: sheet.hidden ? BooleanNumber.TRUE : BooleanNumber.FALSE,
      rowCount: Math.max(MINIMUM_SHEET_ROW_COUNT, maxRow + 1),
      columnCount: Math.max(MINIMUM_SHEET_COLUMN_COUNT, maxColumn + 1),
      defaultRowHeight: sheet.defaultRowHeight ?? DEFAULT_ROW_HEIGHT_PIXELS,
      defaultColumnWidth: sheet.defaultColumnWidth ?? DEFAULT_COLUMN_WIDTH_PIXELS,
      cellData,
      rowData,
      columnData,
      mergeData: parsedMergesBySheet.get(sheetIndex) ?? [],
      freeze: {
        xSplit,
        ySplit,
        startRow: ySplit,
        startColumn: xSplit,
      },
    };
  });

  const activeIndex = Math.max(0, Math.min(model.activeSheetIndex, model.sheets.length - 1));
  return {
    id: workbookId,
    name: model.fileName,
    appVersion: "",
    locale: LocaleType.ZH_CN,
    sheets,
    sheetOrder,
    styles: {},
    custom: { activeSheetIndex: activeIndex },
  };
}

/**
 * 把内部工作簿模型全量灌入 Univer。
 * 若当前存在活动工作簿（例如打开下一个文件前），先销毁旧单元，保证一次只承载
 * 一个工作簿实例。
 */
export function applyWorkbookModelToUniver(
  runtime: UniverRuntime,
  model: WorkbookModel,
  workbookId = "chips-sheet-workbook",
): ReturnType<UniverRuntime["univerAPI"]["createWorkbook"]> {
  const previous = runtime.univerAPI.getActiveWorkbook();
  if (previous) {
    runtime.univerAPI.disposeUnit(previous.getId());
  }
  const snapshot = buildWorkbookSnapshot(model, workbookId);
  const workbook = runtime.univerAPI.createWorkbook(snapshot);
  const activeIndex = Math.max(0, Math.min(model.activeSheetIndex, model.sheets.length - 1));
  const activeSheetId = `sheet-${activeIndex}`;
  const target = workbook.getSheetBySheetId(activeSheetId);
  if (target && model.activeSheetIndex !== 0) {
    workbook.setActiveSheet(target);
  }
  return workbook;
}

export function formatMergeBounds(bounds: {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}): string {
  const first = formatAddress(bounds.startRow, bounds.startColumn);
  const second = formatAddress(bounds.endRow, bounds.endColumn);
  return first === second ? first : `${first}:${second}`;
}
