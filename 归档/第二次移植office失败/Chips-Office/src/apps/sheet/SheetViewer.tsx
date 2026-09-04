import React, { useCallback, useMemo, useState } from "react";
import { Spin, Result, Button, Space } from "antd";
import { useChips } from "@chips/ui";
import { Grid } from "./components/Grid";
import { SheetTabs } from "./components/SheetTabs";
import { useSheet, type SheetRuntimeValue, type SheetActions } from "./hooks/useSheet";
import { formatMessage } from "./lib/messages";
import "./sheet-editor.css";

export function SheetViewer() {
  const { client } = useChips();
  const [runtime, actions] = useSheet();

  const handleOpenFile = useCallback(() => {
    if (client) {
      void actions.openFile(client);
    }
  }, [client, actions]);

  const handleSelectionChange = useCallback((selection: typeof runtime.selection) => {
    actions.setSelection(selection);
  }, [actions]);

  const handleCellValueChange = useCallback(
    (_row: number, _column: number, _value: string | number | boolean) => {
      // 只读模式下不允许修改
    },
    [],
  );

  const handleCellFormulaChange = useCallback(
    (_row: number, _column: number, _formula: string) => {
      // 只读模式下不允许修改
    },
    [],
  );

  const handleTabChange = useCallback((index: number) => {
    actions.setActiveSheet(index);
  }, [actions]);

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
          </Space>
        </div>
      </div>
    );
  }

  const sheetNames = runtime.workbook.sheets.map((s) => s.name);

  return (
    <div className="sheet-editor sheet-editor--viewer" role="application" aria-label={formatMessage("sheet.stage.ariaLabel")}>
      <header className="sheet-editor__header">
        <div className="sheet-editor__file-info">
          <span className="sheet-editor__file-name" title={runtime.workbook.fileName}>
            {runtime.workbook.fileName}
          </span>
          <span className="sheet-editor__view-mode">(只读)</span>
        </div>
      </header>

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
        onTabAdd={() => {}}
        onTabRename={() => {}}
        onTabDelete={() => {}}
        disabled
      />

      <footer className="sheet-editor__status-bar">
        <div className="status-bar__info">
          <span className="status-bar__cell-info">
            {formatMessage("sheet.stage.status.row")}: {runtime.selection.startRow + 1}, {formatMessage("sheet.stage.status.column")}: {runtime.selection.startColumn + 1}
          </span>
        </div>
        <div className="status-bar__save-status">
          {runtime.workbook.sheets.length} 个工作表
        </div>
      </footer>
    </div>
  );
}

export default SheetViewer;
