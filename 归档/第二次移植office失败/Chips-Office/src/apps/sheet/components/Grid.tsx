import React, { useCallback, useRef, useState, useMemo } from "react";
import { CellComponent } from "./Cell";
import type { SheetModel, CellModel, CellScalarValue } from "../types/workbook-model";
import type { SelectionModel } from "../hooks/useSheet";
import { formatCellAddress } from "../types/workbook-model";

export interface GridProps {
  sheet: SheetModel;
  selection: SelectionModel;
  onSelectionChange: (selection: SelectionModel) => void;
  onCellValueChange: (row: number, column: number, value: string | number | boolean) => void;
  onCellFormulaChange: (row: number, column: number, formula: string) => void;
}

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_COLUMN_WIDTH = 100;
const HEADER_HEIGHT = 28;
const ROW_HEADER_WIDTH = 50;

const VISIBLE_BUFFER_ROWS = 20;
const VISIBLE_BUFFER_COLS = 5;

export const Grid = React.memo<GridProps>(function Grid({
  sheet,
  selection,
  onSelectionChange,
  onCellValueChange,
  onCellFormulaChange,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; column: number } | null>(null);

  const rowHeight = sheet.defaultRowHeight ?? DEFAULT_ROW_HEIGHT;
  const columnWidth = sheet.defaultColumnWidth ?? DEFAULT_COLUMN_WIDTH;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollLeft(target.scrollLeft);
    setScrollTop(target.scrollTop);
  }, []);

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, []);

  React.useEffect(() => {
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [handleResize]);

  const visibleStartRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
  const visibleEndRow = Math.min(
    sheet.rowCount,
    Math.ceil((scrollTop + containerSize.height) / rowHeight) + 5,
  );

  const visibleStartCol = Math.max(0, Math.floor((scrollLeft - ROW_HEADER_WIDTH) / columnWidth) - 2);
  const visibleEndCol = Math.min(
    sheet.columnCount,
    Math.ceil((scrollLeft + containerSize.width) / columnWidth) + 2,
  );

  const handleCellClick = useCallback(
    (row: number, column: number, e: React.MouseEvent) => {
      if (e.shiftKey && (selection.startRow !== -1 && selection.startColumn !== -1)) {
        onSelectionChange({
          startRow: selection.startRow,
          startColumn: selection.startColumn,
          endRow: row,
          endColumn: column,
        });
      } else {
        onSelectionChange({
          startRow: row,
          startColumn: column,
          endRow: row,
          endColumn: column,
        });
        setEditingCell(null);
      }
    },
    [onSelectionChange, selection],
  );

  const handleCellDoubleClick = useCallback((row: number, column: number) => {
    setEditingCell({ row, column });
  }, []);

  const handleCellValueChange = useCallback(
    (row: number, column: number, value: CellScalarValue) => {
      onCellValueChange(row, column, value === null ? "" : value);
      setEditingCell(null);
    },
    [onCellValueChange],
  );

  const handleCellFormulaChange = useCallback(
    (row: number, column: number, formula: string) => {
      onCellFormulaChange(row, column, formula);
      setEditingCell(null);
    },
    [onCellFormulaChange],
  );

  const handleHeaderClick = useCallback(
    (axis: "row" | "column", index: number) => {
      if (axis === "row") {
        onSelectionChange({
          startRow: index,
          startColumn: 0,
          endRow: index,
          endColumn: sheet.columnCount - 1,
        });
      } else {
        onSelectionChange({
          startRow: 0,
          startColumn: index,
          endRow: sheet.rowCount - 1,
          endColumn: index,
        });
      }
    },
    [onSelectionChange, sheet],
  );

  const handleCornerClick = useCallback(() => {
    onSelectionChange({
      startRow: 0,
      startColumn: 0,
      endRow: sheet.rowCount - 1,
      endColumn: sheet.columnCount - 1,
    });
  }, [onSelectionChange, sheet]);

  const columnHeaders = useMemo(() => {
    const headers: React.ReactNode[] = [];
    for (let col = visibleStartCol; col < visibleEndCol; col++) {
      const left = col * columnWidth;
      const label = getColumnLabel(col);
      headers.push(
        <div
          key={`header-${col}`}
          className="grid-header grid-header--column"
          style={{
            position: "absolute",
            left,
            top: 0,
            width: columnWidth,
            height: HEADER_HEIGHT,
            transform: `translateX(${ROW_HEADER_WIDTH}px)`,
          }}
          onClick={() => handleHeaderClick("column", col)}
        >
          {label}
        </div>,
      );
    }
    return headers;
  }, [visibleStartCol, visibleEndCol, columnWidth, handleHeaderClick]);

  const rowHeaders = useMemo(() => {
    const headers: React.ReactNode[] = [];
    for (let row = visibleStartRow; row < visibleEndRow; row++) {
      const top = row * rowHeight;
      headers.push(
        <div
          key={`row-header-${row}`}
          className="grid-header grid-header--row"
          style={{
            position: "absolute",
            left: 0,
            top,
            width: ROW_HEADER_WIDTH,
            height: rowHeight,
          }}
          onClick={() => handleHeaderClick("row", row)}
        >
          {row + 1}
        </div>,
      );
    }
    return headers;
  }, [visibleStartRow, visibleEndRow, rowHeight, handleHeaderClick]);

  const cells = useMemo(() => {
    const cellElements: React.ReactNode[] = [];

    for (let row = visibleStartRow; row < visibleEndRow; row++) {
      for (let col = visibleStartCol; col < visibleEndCol; col++) {
        const cell = sheet.cells[row]?.[col];
        const isSelected =
          row === selection.startRow &&
          col === selection.startColumn &&
          row === selection.endRow &&
          col === selection.endColumn;
        const isInSelection =
          row >= Math.min(selection.startRow, selection.endRow) &&
          row <= Math.max(selection.startRow, selection.endRow) &&
          col >= Math.min(selection.startColumn, selection.endColumn) &&
          col <= Math.max(selection.startColumn, selection.endColumn);

        const isEditing =
          editingCell?.row === row && editingCell?.column === col;

        cellElements.push(
          <CellComponent
            key={`cell-${row}-${col}`}
            row={row}
            column={col}
            cell={cell}
            isSelected={isSelected}
            isInSelection={isInSelection}
            isEditing={isEditing}
            onClick={handleCellClick}
            onDoubleClick={handleCellDoubleClick}
            onValueChange={handleCellValueChange}
            onFormulaChange={handleCellFormulaChange}
            columnWidth={columnWidth}
            rowHeight={rowHeight}
          />,
        );
      }
    }

    return cellElements;
  }, [
    visibleStartRow,
    visibleEndRow,
    visibleStartCol,
    visibleEndCol,
    sheet.cells,
    selection,
    editingCell,
    columnWidth,
    rowHeight,
    handleCellClick,
    handleCellDoubleClick,
    handleCellValueChange,
    handleCellFormulaChange,
  ]);

  const gridWidth = sheet.columnCount * columnWidth;
  const gridHeight = sheet.rowCount * rowHeight;

  return (
    <div className="sheet-grid" ref={containerRef}>
      <div
        className="grid-corner"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: ROW_HEADER_WIDTH,
          height: HEADER_HEIGHT,
          zIndex: 10,
        }}
        onClick={handleCornerClick}
      />
      {columnHeaders}
      {rowHeaders}
      <div
        className="grid-scroll-container"
        onScroll={handleScroll}
        style={{
          marginLeft: ROW_HEADER_WIDTH,
          marginTop: HEADER_HEIGHT,
        }}
      >
        <div
          className="grid-content"
          style={{
            position: "relative",
            width: gridWidth,
            height: gridHeight,
          }}
        >
          {cells}
          <SelectionOverlay
            selection={selection}
            rowHeight={rowHeight}
            columnWidth={columnWidth}
          />
        </div>
      </div>
    </div>
  );
});

function getColumnLabel(index: number): string {
  let result = "";
  let idx = index + 1;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    idx = Math.floor((idx - 1) / 26);
  }
  return result;
}

interface SelectionOverlayProps {
  selection: SelectionModel;
  rowHeight: number;
  columnWidth: number;
}

const SelectionOverlay = React.memo<SelectionOverlayProps>(function SelectionOverlay({
  selection,
  rowHeight,
  columnWidth,
}) {
  const { startRow, startColumn, endRow, endColumn } = selection;
  const left = startColumn * columnWidth;
  const top = startRow * rowHeight;
  const width = (endColumn - startColumn + 1) * columnWidth;
  const height = (endRow - startRow + 1) * rowHeight;

  return (
    <div
      className="grid-selection-overlay"
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
});

export default Grid;
