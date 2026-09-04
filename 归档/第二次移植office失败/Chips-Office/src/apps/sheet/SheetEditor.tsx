import React, { useCallback, useMemo, useState } from "react";
import { Spin, Result, Button, Space } from "antd";
import { useChips } from "@chips/ui";
import { Grid } from "./components/Grid";
import { Toolbar } from "./components/Toolbar";
import { FormulaBar } from "./components/FormulaBar";
import { SheetTabs } from "./components/SheetTabs";
import { useSheet, type SheetRuntimeValue } from "./hooks/useSheet";
import { formatCellAddress, type CellModel, type CellScalarValue } from "./types/workbook-model";
import { formatMessage } from "./lib/messages";
import "./sheet-editor.css";

export function SheetEditor() {
  const { client } = useChips();
  const [runtime, actions] = useSheet();
  const [undoStack] = useState<SheetRuntimeValue[]>([]);
  const [redoStack] = useState<SheetRuntimeValue[]>([]);

  const handleOpenFile = useCallback(() => {
    if (client) {
      void actions.openFile(client);
    }
  }, [client, actions]);

  const handleNewWorkbook = useCallback(() => {
    if (client) {
      actions.newWorkbook(client);
    }
  }, [client, actions]);

  const handleSave = useCallback(async () => {
    if (client && runtime.workbook) {
      try {
        await actions.saveWorkbook(client);
      } catch (error) {
        console.error("保存失败:", error);
      }
    }
  }, [client, runtime.workbook, actions]);

  const handleSaveAs = useCallback(async () => {
    if (client && runtime.workbook) {
      try {
        await actions.saveWorkbookAs(client);
      } catch (error) {
        console.error("另存失败:", error);
      }
    }
  }, [client, runtime.workbook, actions]);

  const handleExportCsv = useCallback(async () => {
    if (client) {
      try {
        await actions.exportCsv(client);
      } catch (error) {
        console.error("导出失败:", error);
      }
    }
  }, [client, actions]);

  const handleSelectionChange = useCallback((selection: typeof runtime.selection) => {
    actions.setSelection(selection);
  }, [actions]);

  const handleCellValueChange = useCallback((
    row: number,
    column: number,
    value: CellScalarValue,
  ) => {
    actions.setCellValue(row, column, value);
  }, [actions]);

  const handleCellFormulaChange = useCallback((
    row: number,
    column: number,
    formula: string,
  ) => {
    actions.setCellFormula(row, column, formula);
  }, [actions]);

  const handleTabChange = useCallback((index: number) => {
    actions.setActiveSheet(index);
  }, [actions]);

  const handleTabAdd = useCallback(() => {
    actions.addSheet();
  }, [actions]);

  const handleTabRename = useCallback((index: number, newName: string) => {
    actions.renameSheet(index, newName);
  }, [actions]);

  const handleTabDelete = useCallback((index: number) => {
    actions.deleteSheet(index);
  }, [actions]);

  const handleMergeCells = useCallback(() => {
    actions.mergeCells(runtime.selection);
  }, [actions, runtime.selection]);

  const handleUnmergeCells = useCallback(() => {
    actions.unmergeCells(runtime.selection);
  }, [actions, runtime.selection]);

  const handleFormatChange = useCallback((key: string, value: string | number | boolean) => {
    let style: Partial<NonNullable<CellModel["style"]>>;
    switch (key) {
      case "bold":
        style = { bold: Boolean(value) };
        break;
      case "italic":
        style = { italic: Boolean(value) };
        break;
      case "underline":
        style = { underline: Boolean(value) };
        break;
      case "fontSize":
        style = { fontSize: Number(value) };
        break;
      case "fontFamily":
        style = { fontFamily: String(value) };
        break;
      case "horizontal":
        style = { horizontal: value === "center" ? "center" : value === "right" ? "right" : "left" };
        break;
      default:
        return;
    }
    const { startRow, startColumn, endRow, endColumn } = runtime.selection;
    for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
      for (let col = Math.min(startColumn, endColumn); col <= Math.max(startColumn, endColumn); col++) {
        actions.setCellStyle(row, col, style);
      }
    }
  }, [actions, runtime.selection]);

  const selectedCell = useMemo(() => {
    if (!runtime.activeSheet) return null;
    const { startRow, startColumn } = runtime.selection;
    return runtime.activeSheet.cells[startRow]?.[startColumn];
  }, [runtime.activeSheet, runtime.selection]);

  const cellAddress = useMemo(() => {
    return formatCellAddress(runtime.selection.startColumn, runtime.selection.startRow);
  }, [runtime.selection]);

  const cellDisplayValue = useMemo(() => {
    if (!selectedCell) return null;
    if (selectedCell.formula !== undefined && selectedCell.result !== undefined) {
      return selectedCell.result;
    }
    return selectedCell.value;
  }, [selectedCell]);

  const canMerge = useMemo(() => {
    const { startRow, startColumn, endRow, endColumn } = runtime.selection;
    return !(startRow === endRow && startColumn === endColumn);
  }, [runtime.selection]);

  const isMerged = useMemo(() => {
    if (!runtime.activeSheet) return false;
    const { startRow, startColumn, endRow, endColumn } = runtime.selection;
    const topLeft = formatCellAddress(startColumn, startRow);
    const bottomRight = formatCellAddress(endColumn, endRow);
    const mergeRef = `${topLeft}:${bottomRight}`;
    return runtime.activeSheet.merges.includes(mergeRef);
  }, [runtime.activeSheet, runtime.selection]);

  if (runtime.phase === "loading") {
    return (
      <div className="sheet-editor sheet-editor--loading">
        <Spin size="large" />
        <p className="sheet-editor__status">{formatMessage("sheet.stage.status.loading")}</p>
      </div>
    );
  }

  if (runtime.phase === "error" && runtime.errorState) {
    return (
      <div className="sheet-editor sheet-editor--error">
        <Result
          status="error"
          title={runtime.errorState.title}
          subTitle={runtime.errorState.detail}
          extra={
            <Space size="small">
              <Button type="primary" onClick={actions.retryLastTarget}>
                {formatMessage("sheet.stage.errorRetry")}
              </Button>
              <Button onClick={actions.dismissError}>
                {formatMessage("sheet.stage.errorBack")}
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  if (runtime.phase === "start" || !runtime.workbook) {
    return (
      <div className="sheet-editor sheet-editor--start">
        <div className="sheet-start">
          <h1 className="sheet-start__title">{formatMessage("sheet.start.title")}</h1>
          <p className="sheet-start__description">{formatMessage("sheet.start.description")}</p>
          <p className="sheet-start__formats">{formatMessage("sheet.start.formats")}</p>
          <Space size="middle">
            <Button type="primary" size="large" onClick={handleOpenFile}>
              {formatMessage("sheet.start.actions.open")}
            </Button>
            <Button size="large" onClick={handleNewWorkbook}>
              {formatMessage("sheet.start.actions.create")}
            </Button>
          </Space>
          <p className="sheet-start__hint">{formatMessage("sheet.start.hints.shortcut")}</p>
        </div>
      </div>
    );
  }

  const sheetNames = runtime.workbook.sheets.map((sheet) => sheet.name);

  return (
    <div className="sheet-editor" role="application" aria-label={formatMessage("sheet.stage.ariaLabel")}>
      <header className="sheet-editor__header">
        <div className="sheet-editor__file-info">
          <span className="sheet-editor__file-name" title={runtime.workbook.fileName}>
            {runtime.workbook.fileName}
          </span>
          {runtime.isDirty && (
            <span className="sheet-editor__dirty-indicator">*</span>
          )}
        </div>
        <Toolbar
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          canMerge={canMerge}
          isMerged={isMerged}
          onUndo={() => {}}
          onRedo={() => {}}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onNew={handleNewWorkbook}
          onOpen={handleOpenFile}
          onExportCsv={handleExportCsv}
          onCut={() => {}}
          onCopy={() => {}}
          onPaste={() => {}}
          onMergeCells={handleMergeCells}
          onUnmergeCells={handleUnmergeCells}
          onInsertRowAbove={() => actions.insertRow(runtime.selection.startRow)}
          onInsertRowBelow={() => actions.insertRow(runtime.selection.startRow + 1)}
          onDeleteRow={() => actions.deleteRow(runtime.selection.startRow)}
          onInsertColumnLeft={() => actions.insertColumn(runtime.selection.startColumn)}
          onInsertColumnRight={() => actions.insertColumn(runtime.selection.startColumn + 1)}
          onDeleteColumn={() => actions.deleteColumn(runtime.selection.startColumn)}
          onFormatChange={handleFormatChange}
          isBusy={false}
        />
      </header>

      <FormulaBar
        cellAddress={cellAddress}
        cellValue={cellDisplayValue ?? null}
        cellFormula={selectedCell?.formula}
        cell={selectedCell ?? undefined}
        onFormulaCommit={(formula) => {
          const { startRow, startColumn } = runtime.selection;
          handleCellFormulaChange(startRow, startColumn, formula);
        }}
        onValueCommit={(value) => {
          const { startRow, startColumn } = runtime.selection;
          handleCellValueChange(startRow, startColumn, value);
        }}
        onCancel={() => {}}
        isEditing={false}
      />

      {runtime.activeSheet && (
        <div className="sheet-editor__grid-container">
          <Grid
            sheet={runtime.activeSheet}
            selection={runtime.selection}
            onSelectionChange={handleSelectionChange}
            onCellValueChange={handleCellValueChange}
            onCellFormulaChange={handleCellFormulaChange}
          />
        </div>
      )}

      <SheetTabs
        sheets={sheetNames}
        activeIndex={runtime.activeSheetIndex}
        onTabChange={handleTabChange}
        onTabAdd={handleTabAdd}
        onTabRename={handleTabRename}
        onTabDelete={handleTabDelete}
      />

      <footer className="sheet-editor__status-bar">
        <div className="status-bar__info">
          <span className="status-bar__cell-info">
            {formatMessage("sheet.stage.status.row")}: {runtime.selection.startRow + 1}, {formatMessage("sheet.stage.status.column")}: {runtime.selection.startColumn + 1}
          </span>
        </div>
        <div className="status-bar__save-status">
          {runtime.isDirty
            ? formatMessage("sheet.stage.status.unsaved")
            : formatMessage("sheet.stage.status.saved")}
        </div>
      </footer>
    </div>
  );
}

export default SheetEditor;
