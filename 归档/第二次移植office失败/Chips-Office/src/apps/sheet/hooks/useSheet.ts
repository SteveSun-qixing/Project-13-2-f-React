import { useCallback, useMemo, useState } from "react";
import type {
  CellModel,
  CellScalarValue,
  SheetModel,
  WorkbookModel,
} from "../types/workbook-model";
import {
  createEmptySheetModel,
  createEmptyWorkbookModel,
  formatCellAddress,
} from "../types/workbook-model";
import { parseXlsxBytes, xlsxModelToCsv } from "../types/xlsx-parser";
import { writeXlsx } from "../types/xlsx-writer";
import type { Client } from "chips-sdk";

export type SheetPhase = "start" | "loading" | "ready" | "error";

export interface SelectionModel {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface SheetErrorState {
  title: string;
  detail: string;
}

export interface SheetRuntimeValue {
  phase: SheetPhase;
  workbook: WorkbookModel | null;
  activeSheet: SheetModel | null;
  activeSheetIndex: number;
  selection: SelectionModel;
  isDirty: boolean;
  errorState: SheetErrorState | null;
  client: Client | null;
  sessionId: string | null;
}

export interface SheetActions {
  openFile(client: Client): Promise<void>;
  newWorkbook(client: Client): void;
  saveWorkbook(client: Client): Promise<void>;
  saveWorkbookAs(client: Client): Promise<void>;
  exportCsv(client: Client): Promise<void>;
  setSelection(selection: SelectionModel): void;
  setActiveSheet(index: number): void;
  addSheet(): void;
  renameSheet(index: number, name: string): void;
  deleteSheet(index: number): void;
  setCellValue(row: number, column: number, value: CellScalarValue): void;
  setCellFormula(row: number, column: number, formula: string): void;
  setCellStyle(row: number, column: number, style: Partial<NonNullable<CellModel["style"]>>): void;
  insertRow(index: number): void;
  insertColumn(index: number): void;
  deleteRow(index: number): void;
  deleteColumn(index: number): void;
  mergeCells(selection: SelectionModel): void;
  unmergeCells(selection: SelectionModel): void;
  dismissError(): void;
  retryLastTarget(): void;
}

const DEFAULT_SELECTION: SelectionModel = {
  startRow: 0,
  startColumn: 0,
  endRow: 0,
  endColumn: 0,
};

/** 依据现有工作表名单生成不重复的默认工作表名（工作表N）。 */
function createUniqueSheetName(existingNames: string[]): string {
  const taken = new Set(existingNames);
  let index = existingNames.length + 1;
  while (taken.has(`工作表${index}`)) {
    index += 1;
  }
  return `工作表${index}`;
}

export function useSheet(): [SheetRuntimeValue, SheetActions] {
  const [phase, setPhase] = useState<SheetPhase>("start");
  const [workbook, setWorkbook] = useState<WorkbookModel | null>(null);
  const [selection, setSelection] = useState<SelectionModel>(DEFAULT_SELECTION);
  const [isDirty, setIsDirty] = useState(false);
  const [errorState, setErrorState] = useState<SheetErrorState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const lastTargetRef = { current: { filePath: "", fileName: "" } };

  // 活动工作表下标单源化：以 workbook.activeSheetIndex 为唯一事实来源，
  // 视图仅做合法性钳制，切换与编辑不再出现双份状态漂移。
  const activeSheetIndex = useMemo(() => {
    if (!workbook || workbook.sheets.length === 0) return 0;
    return Math.max(0, Math.min(workbook.activeSheetIndex, workbook.sheets.length - 1));
  }, [workbook]);

  const activeSheet = useMemo<SheetModel | null>(() => {
    if (!workbook) return null;
    return workbook.sheets[activeSheetIndex] ?? workbook.sheets[0] ?? null;
  }, [workbook, activeSheetIndex]);

  const runtimeValue = useMemo<SheetRuntimeValue>(() => ({
    phase,
    workbook,
    activeSheet,
    activeSheetIndex,
    selection,
    isDirty,
    errorState,
    client: null,
    sessionId,
  }), [phase, workbook, activeSheet, activeSheetIndex, selection, isDirty, errorState, sessionId]);

  const setActiveSheet = useCallback((index: number) => {
    setWorkbook((prev) => {
      if (!prev || prev.sheets.length === 0) return prev;
      const clamped = Math.max(0, Math.min(index, prev.sheets.length - 1));
      if (clamped === prev.activeSheetIndex) return prev;
      return { ...prev, activeSheetIndex: clamped };
    });
    setSelection(DEFAULT_SELECTION);
  }, []);

  const updateWorkbook = useCallback((updater: (wb: WorkbookModel) => WorkbookModel) => {
    setWorkbook((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      return updated;
    });
    setIsDirty(true);
  }, []);

  const setCellValue = useCallback((row: number, column: number, value: CellScalarValue) => {
    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };
      const cells = { ...sheet.cells };
      const rowCells = { ...(cells[row] ?? {}) };
      const existingCell = rowCells[column] ?? {};
      rowCells[column] = { ...existingCell, value };
      cells[row] = rowCells;
      sheet.cells = cells;
      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const setCellFormula = useCallback((row: number, column: number, formula: string) => {
    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };
      const cells = { ...sheet.cells };
      const rowCells = { ...(cells[row] ?? {}) };
      const existingCell = rowCells[column] ?? {};
      rowCells[column] = { ...existingCell, formula };
      cells[row] = rowCells;
      sheet.cells = cells;
      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const setCellStyle = useCallback((
    row: number,
    column: number,
    style: Partial<NonNullable<CellModel["style"]>>,
  ) => {
    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };
      const cells = { ...sheet.cells };
      const rowCells = { ...(cells[row] ?? {}) };
      const existingCell = rowCells[column] ?? {};
      const existingStyle = existingCell.style ?? {};
      rowCells[column] = { ...existingCell, style: { ...existingStyle, ...style } };
      cells[row] = rowCells;
      sheet.cells = cells;
      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const insertRow = useCallback((index: number) => {
    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };
      const newCells: Record<number, Record<number, CellModel>> = {};

      for (const [rowStr, rowCells] of Object.entries(sheet.cells)) {
        const row = parseInt(rowStr, 10);
        if (row >= index) {
          newCells[row + 1] = rowCells;
        } else {
          newCells[row] = rowCells;
        }
      }

      const newMerges = sheet.merges.map((merge) => {
        const [start, end] = merge.split(":");
        const startMatch = start.match(/([A-Z]+)(\d+)/i);
        const endMatch = end.match(/([A-Z]+)(\d+)/i);
        if (!startMatch || !endMatch) return merge;

        let startRow = parseInt(startMatch[2], 10);
        let endRow = parseInt(endMatch[2], 10);

        if (endRow > index) {
          endRow++;
        }
        if (startRow > index) {
          startRow++;
        }

        const colStart = startMatch[1];
        const colEnd = endMatch[1];
        return `${colStart}${startRow}:${colEnd}${endRow}`;
      });

      sheet.cells = newCells;
      sheet.merges = newMerges;
      sheet.rowCount = Math.max(sheet.rowCount, Object.keys(newCells).length + 1);
      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const insertColumn = useCallback((index: number) => {
    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };
      const newCells: Record<number, Record<number, CellModel>> = {};

      for (const [rowStr, rowCells] of Object.entries(sheet.cells)) {
        const newRowCells: Record<number, CellModel> = {};
        for (const [colStr, cell] of Object.entries(rowCells)) {
          const col = parseInt(colStr, 10);
          newRowCells[col >= index ? col + 1 : col] = cell;
        }
        newCells[parseInt(rowStr, 10)] = newRowCells;
      }

      const newMerges = sheet.merges.map((merge) => {
        const [start, end] = merge.split(":");
        const startMatch = start.match(/([A-Z]+)(\d+)/i);
        const endMatch = end.match(/([A-Z]+)(\d+)/i);
        if (!startMatch || !endMatch) return merge;

        let startCol = startMatch[1];
        let endCol = endMatch[1];
        let startRow = parseInt(startMatch[2], 10);
        let endRow = parseInt(endMatch[2], 10);

        const colToIndex = (col: string) => {
          let idx = 0;
          for (const ch of col) {
            idx = idx * 26 + (ch.charCodeAt(0) - 64);
          }
          return idx - 1;
        };

        const indexToCol = (idx: number) => {
          let result = "";
          let i = idx + 1;
          while (i > 0) {
            const rem = (i - 1) % 26;
            result = String.fromCharCode(65 + rem) + result;
            i = Math.floor((i - 1) / 26);
          }
          return result;
        };

        const startColIdx = colToIndex(startCol);
        const endColIdx = colToIndex(endCol);

        if (endColIdx >= index) {
          endCol = indexToCol(endColIdx + 1);
        }
        if (startColIdx >= index) {
          startCol = indexToCol(startColIdx + 1);
        }

        return `${startCol}${startRow}:${endCol}${endRow}`;
      });

      sheet.cells = newCells;
      sheet.merges = newMerges;
      sheet.columnCount = Math.max(
        sheet.columnCount,
        Math.max(...Object.values(newCells).flatMap((rc) => Object.keys(rc).map(Number)), 0) + 2,
      );
      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const deleteRow = useCallback((index: number) => {
    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };
      const newCells: Record<number, Record<number, CellModel>> = {};

      for (const [rowStr, rowCells] of Object.entries(sheet.cells)) {
        const row = parseInt(rowStr, 10);
        if (row === index) continue;
        newCells[row > index ? row - 1 : row] = rowCells;
      }

      sheet.cells = newCells;
      sheet.rowCount = Math.max(sheet.rowCount - 1, 1);
      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const deleteColumn = useCallback((index: number) => {
    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };
      const newCells: Record<number, Record<number, CellModel>> = {};

      for (const [rowStr, rowCells] of Object.entries(sheet.cells)) {
        const newRowCells: Record<number, CellModel> = {};
        for (const [colStr, cell] of Object.entries(rowCells)) {
          const col = parseInt(colStr, 10);
          if (col === index) continue;
          newRowCells[col > index ? col - 1 : col] = cell;
        }
        newCells[parseInt(rowStr, 10)] = newRowCells;
      }

      sheet.cells = newCells;
      sheet.columnCount = Math.max(sheet.columnCount - 1, 1);
      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const mergeCells = useCallback((sel: SelectionModel) => {
    const { startRow, startColumn, endRow, endColumn } = sel;
    if (startRow === endRow && startColumn === endColumn) return;

    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };

      const topLeft = formatCellAddress(startColumn, startRow);
      const bottomRight = formatCellAddress(endColumn, endRow);
      const mergeRef = `${topLeft}:${bottomRight}`;

      if (!sheet.merges.includes(mergeRef)) {
        sheet.merges = [...sheet.merges, mergeRef];
      }

      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const unmergeCells = useCallback((sel: SelectionModel) => {
    const { startRow, startColumn, endRow, endColumn } = sel;

    updateWorkbook((wb) => {
      const sheets = [...wb.sheets];
      const sheetIndex = wb.activeSheetIndex;
      const sheet = { ...sheets[sheetIndex] };

      const topLeft = formatCellAddress(startColumn, startRow);
      const bottomRight = formatCellAddress(endColumn, endRow);
      const mergeRef = `${topLeft}:${bottomRight}`;

      sheet.merges = sheet.merges.filter((m) => m !== mergeRef);

      sheets[sheetIndex] = sheet;
      return { ...wb, sheets };
    });
  }, [updateWorkbook]);

  const addSheet = useCallback(() => {
    if (!workbook) return;
    const name = createUniqueSheetName(workbook.sheets.map((sheet) => sheet.name));
    const sheets = [...workbook.sheets, createEmptySheetModel(name)];
    setWorkbook({ ...workbook, sheets, activeSheetIndex: sheets.length - 1 });
    setSelection(DEFAULT_SELECTION);
    setIsDirty(true);
  }, [workbook]);

  const renameSheet = useCallback((index: number, name: string) => {
    if (!workbook) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const target = workbook.sheets[index];
    if (!target || target.name === trimmedName) return;
    const sheets = workbook.sheets.map((sheet, i) =>
      i === index ? { ...sheet, name: trimmedName } : sheet,
    );
    setWorkbook({ ...workbook, sheets });
    setIsDirty(true);
  }, [workbook]);

  const deleteSheet = useCallback((index: number) => {
    if (!workbook || workbook.sheets.length <= 1) return;
    const sheets = workbook.sheets.filter((_, i) => i !== index);
    // 活动索引收缩：始终落在合法区间 [0, sheets.length - 1]。
    const activeSheetIndex = Math.max(0, Math.min(workbook.activeSheetIndex, sheets.length - 1));
    setWorkbook({ ...workbook, sheets, activeSheetIndex });
    setSelection(DEFAULT_SELECTION);
    setIsDirty(true);
  }, [workbook]);

  const openFile = useCallback(async (client: Client) => {
    try {
      setPhase("loading");
      setErrorState(null);

      const selected = await client.platform.openFile({
        title: "打开表格文件",
        mode: "file",
        allowMultiple: false,
        mustExist: true,
        filters: [{ name: "表格文件", extensions: ["xlsx", "xlsm", "csv"] }],
      });

      const filePath = Array.isArray(selected) ? selected[0] : undefined;
      if (!filePath) {
        setPhase(workbook ? "ready" : "start");
        return;
      }

      const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

      lastTargetRef.current = { filePath, fileName };

      if (extension === "xlsx" || extension === "xlsm") {
        const session = await client.file.session.open({ filePath, format: "xlsx" });
        setSessionId(session.sessionId);
        const result = await client.file.session.read({ sessionId: session.sessionId });
        const model = await parseXlsxBytes(result.bytes);
        model.fileName = fileName;
        setWorkbook(model);
      } else {
        throw new Error(`不支持的文件格式：.${extension}`);
      }

      setIsDirty(false);
      setPhase("ready");
      setSelection(DEFAULT_SELECTION);
    } catch (error) {
      setPhase("error");
      setErrorState({
        title: "表格打开失败",
        detail: error instanceof Error ? error.message : "未知错误",
      });
    }
  }, [workbook]);

  const newWorkbook = useCallback((client: Client) => {
    const model = createEmptyWorkbookModel("工作簿1.xlsx");
    setWorkbook(model);
    setSelection(DEFAULT_SELECTION);
    setIsDirty(true);
    setPhase("ready");
    setSessionId(null);
  }, []);

  const saveWorkbook = useCallback(async (client: Client) => {
    if (!workbook) return;

    try {
      if (sessionId && workbook.fileName) {
        const bytes = await writeXlsx(workbook);
        await client.file.session.write({ sessionId, bytes });
        await client.file.session.persist({ sessionId });
      }
      setIsDirty(false);
    } catch (error) {
      throw new Error(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [workbook, sessionId]);

  const saveWorkbookAs = useCallback(async (client: Client) => {
    if (!workbook) return;

    try {
      const destinationPath = await client.platform.saveFile({
        title: "保存表格文件",
        defaultPath: workbook.fileName,
      });

      if (!destinationPath) return;

      const extension = destinationPath.split(".").pop()?.toLowerCase() ?? "";
      const fileName = destinationPath.split(/[\\/]/).pop() ?? workbook.fileName;

      if (extension === "csv") {
        const csvContent = xlsxModelToCsv(workbook);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvContent);
        await client.file.write(destinationPath, bytes, { encoding: "binary" });
      } else {
        const bytes = await writeXlsx(workbook);
        const session = await client.file.session.create({
          format: "xlsx",
          fileName,
          initialBytes: bytes,
        });
        setSessionId(session.sessionId);
        await client.file.session.persist({
          sessionId: session.sessionId,
          options: { filePath: destinationPath },
        });
      }

      setWorkbook((prev) => prev ? { ...prev, fileName } : prev);
      setIsDirty(false);
    } catch (error) {
      throw new Error(`另存失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [workbook]);

  const exportCsv = useCallback(async (client: Client) => {
    if (!workbook) return;

    try {
      const destinationPath = await client.platform.saveFile({
        title: "导出 CSV 文件",
        defaultPath: workbook.fileName.replace(/\.[^.]+$/, ".csv"),
      });

      if (!destinationPath) return;

      const csvContent = xlsxModelToCsv(workbook);
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const body = new TextEncoder().encode(csvContent);
      const bytes = new Uint8Array(bom.length + body.length);
      bytes.set(bom, 0);
      bytes.set(body, bom.length);

      await client.file.write(destinationPath, bytes, { encoding: "binary" });
    } catch (error) {
      throw new Error(`导出失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [workbook]);

  const dismissError = useCallback(() => {
    setErrorState(null);
    setPhase(workbook ? "ready" : "start");
  }, [workbook]);

  const retryLastTarget = useCallback(() => {
    const target = lastTargetRef.current;
    if (target.filePath) {
      setPhase("loading");
    } else {
      dismissError();
    }
  }, [dismissError]);

  const actions: SheetActions = useMemo(() => ({
    openFile,
    newWorkbook,
    saveWorkbook,
    saveWorkbookAs,
    exportCsv,
    setSelection,
    setActiveSheet,
    addSheet,
    renameSheet,
    deleteSheet,
    setCellValue,
    setCellFormula,
    setCellStyle,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    mergeCells,
    unmergeCells,
    dismissError,
    retryLastTarget,
  }), [
    openFile,
    newWorkbook,
    saveWorkbook,
    saveWorkbookAs,
    exportCsv,
    setSelection,
    setActiveSheet,
    addSheet,
    renameSheet,
    deleteSheet,
    setCellValue,
    setCellFormula,
    setCellStyle,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    mergeCells,
    unmergeCells,
    dismissError,
    retryLastTarget,
  ]);

  return [runtimeValue, actions];
}
