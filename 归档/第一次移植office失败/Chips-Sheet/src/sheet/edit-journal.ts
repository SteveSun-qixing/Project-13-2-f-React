/**
 * 编辑状态采集（编辑日志思想的移植形态）。
 *
 * 原版 edit-journal 逐条记录用户编辑并以增量方式回放（配合 sidecar 视口流）；
 * 全量快照方案下不再需要增量回放，但“保存前从 Univer 采集完整状态”的职责
 * 原样保留：保存时通过 univerAPI.getActiveWorkbook().save() 拿到引擎权威快照
 * （含用户全部编辑、样式、合并、行列尺寸与冻结窗格），再转换为内部工作簿模型
 * 交给 exceljs 写出。与 sidecar / Node API 完全解耦。
 */
import {
  BooleanNumber,
  type ICellData,
  type IObjectMatrixPrimitiveType,
  type IStyleData,
  type IWorkbookData,
  type Nullable,
} from "@univerjs/core";

import { formatAddress } from "./cell-address";
import { univerStyleToModelStyle } from "./univer-style-bridge";
import type { UniverRuntime } from "./univer-state";
import type {
  CellModel,
  CellScalarValue,
  CellStyleModel,
  SheetModel,
  WorkbookModel,
} from "./workbook-model";

/** Univer 样式表（快照 styles 字段） */
type UniverStyleTable = Record<string, Nullable<IStyleData>>;

function resolveStyle(
  cell: ICellData,
  styles: UniverStyleTable,
): { style?: CellStyleModel; numFmt?: string } {
  const raw = cell.s;
  if (!raw) {
    return {};
  }
  const styleData: IStyleData | undefined = typeof raw === "string" ? styles[raw] ?? undefined : raw;
  if (!styleData) {
    return {};
  }
  const modelStyle = univerStyleToModelStyle(styleData);
  const result: { style?: CellStyleModel; numFmt?: string } = {};
  if (Object.keys(modelStyle).length > 0) {
    result.style = modelStyle;
  }
  if (styleData.n?.pattern && styleData.n.pattern !== "General") {
    result.numFmt = styleData.n.pattern;
  }
  return result;
}

function scalarValue(cell: ICellData): CellScalarValue | undefined {
  if (cell.v === undefined || cell.v === null) {
    return undefined;
  }
  if (typeof cell.v === "number" || typeof cell.v === "string" || typeof cell.v === "boolean") {
    return cell.v;
  }
  return undefined;
}

function univerCellToModelCell(cell: ICellData, styles: UniverStyleTable): CellModel | undefined {
  const { style, numFmt } = resolveStyle(cell, styles);
  const value = scalarValue(cell);
  const formula = typeof cell.f === "string" && cell.f.length > 0 ? cell.f : undefined;

  if (formula) {
    const model: CellModel = { formula, result: value ?? null };
    if (numFmt) {
      model.numFmt = numFmt;
    }
    if (style) {
      model.style = style;
    }
    return model;
  }

  const hasContent = value !== undefined;
  const hasDecor = style !== undefined || numFmt !== undefined;
  if (!hasContent && !hasDecor) {
    return undefined;
  }
  const model: CellModel = {};
  if (hasContent) {
    model.value = value;
  } else {
    model.value = "";
  }
  if (numFmt) {
    model.numFmt = numFmt;
  }
  if (style) {
    model.style = style;
  }
  return model;
}

export function univerSheetToModelSheet(
  sheetId: string,
  sheet: IWorkbookData["sheets"][string],
  snapshot: IWorkbookData,
): SheetModel {
  const styles: UniverStyleTable = snapshot.styles ?? {};
  const cells: Record<number, Record<number, CellModel>> = {};
  const cellData: IObjectMatrixPrimitiveType<ICellData> = sheet.cellData ?? {};
  let maxRow = 0;
  let maxColumn = 0;

  for (const [rowKey, rowCells] of Object.entries(cellData)) {
    const row = Number(rowKey);
    for (const [columnKey, cell] of Object.entries(rowCells ?? {})) {
      if (!cell) {
        continue;
      }
      const column = Number(columnKey);
      const model = univerCellToModelCell(cell, styles);
      if (!model) {
        continue;
      }
      const rowMap = cells[row] ?? {};
      rowMap[column] = model;
      cells[row] = rowMap;
      maxRow = Math.max(maxRow, row);
      maxColumn = Math.max(maxColumn, column);
    }
  }

  const merges: string[] = (sheet.mergeData ?? []).map((range) =>
    formatAddress(range.startRow, range.startColumn) ===
    formatAddress(range.endRow, range.endColumn)
      ? formatAddress(range.startRow, range.startColumn)
      : `${formatAddress(range.startRow, range.startColumn)}:${formatAddress(range.endRow, range.endColumn)}`,
  );
  for (const range of sheet.mergeData ?? []) {
    maxRow = Math.max(maxRow, range.endRow);
    maxColumn = Math.max(maxColumn, range.endColumn);
  }

  const rowHeights: Record<number, number> = {};
  for (const [rowKey, rowData] of Object.entries(sheet.rowData ?? {})) {
    if (typeof rowData?.h === "number" && rowData.h > 0) {
      rowHeights[Number(rowKey)] = rowData.h;
    }
  }
  const colWidths: Record<number, number> = {};
  for (const [columnKey, columnData] of Object.entries(sheet.columnData ?? {})) {
    if (typeof columnData?.w === "number" && columnData.w > 0) {
      colWidths[Number(columnKey)] = columnData.w;
    }
  }

  const freeze = sheet.freeze;
  const hasFreeze = !!freeze && (freeze.xSplit > 0 || freeze.ySplit > 0);

  return {
    name: sheet.name ?? sheetId,
    hidden: sheet.hidden === BooleanNumber.TRUE,
    rowCount: sheet.rowCount ?? Math.max(maxRow + 1, 100),
    columnCount: sheet.columnCount ?? Math.max(maxColumn + 1, 26),
    defaultRowHeight: sheet.defaultRowHeight,
    defaultColumnWidth: sheet.defaultColumnWidth,
    cells,
    merges,
    colWidths,
    rowHeights,
    freeze: hasFreeze ? { xSplit: freeze?.xSplit ?? 0, ySplit: freeze?.ySplit ?? 0 } : undefined,
  };
}

/** 从 Univer 权威快照还原内部工作簿模型。 */
export function workbookSnapshotToModel(
  snapshot: IWorkbookData,
  fallbackFileName: string,
  activeSheetId?: string,
): WorkbookModel {
  const sheetOrder = snapshot.sheetOrder ?? Object.keys(snapshot.sheets ?? {});
  const sheets = sheetOrder
    .map((sheetId) => {
      const sheet = snapshot.sheets?.[sheetId];
      if (!sheet) {
        return undefined;
      }
      return univerSheetToModelSheet(sheetId, sheet, snapshot);
    })
    .filter((sheet): sheet is SheetModel => sheet !== undefined);

  const activeIndex = activeSheetId ? sheetOrder.indexOf(activeSheetId) : -1;
  return {
    fileName: fallbackFileName,
    sheets: sheets.length > 0 ? sheets : [],
    activeSheetIndex: activeIndex >= 0 ? activeIndex : 0,
  };
}

export interface CollectSheetStatesOptions {
  fallbackFileName: string;
}

/**
 * 采集 Univer 当前活动工作簿的完整状态（编辑日志采集职责的正式入口）。
 * 返回 undefined 表示当前没有可保存的工作簿（引擎尚未挂载或已被销毁）。
 */
export function collectSheetStates(
  runtime: UniverRuntime | null,
  options: CollectSheetStatesOptions,
): WorkbookModel | undefined {
  const workbook = runtime?.univerAPI.getActiveWorkbook();
  if (!workbook) {
    return undefined;
  }
  const snapshot = workbook.save();
  const activeSheetId = workbook.getActiveSheet()?.getSheetId();
  return workbookSnapshotToModel(snapshot, options.fallbackFileName, activeSheetId);
}
