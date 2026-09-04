import React, { memo, useCallback, useMemo } from "react";
import type { CellModel, CellScalarValue } from "../types/workbook-model";

export interface CellRenderProps {
  value: CellScalarValue;
  formula?: string;
  error?: string;
  style?: CellModel["style"];
  isEditing: boolean;
  isSelected: boolean;
  isInSelection: boolean;
}

interface CellProps {
  row: number;
  column: number;
  cell?: CellModel;
  isSelected: boolean;
  isInSelection: boolean;
  isEditing: boolean;
  onClick: (row: number, column: number, event: React.MouseEvent) => void;
  onDoubleClick: (row: number, column: number) => void;
  onValueChange: (row: number, column: number, value: CellScalarValue) => void;
  onFormulaChange: (row: number, column: number, formula: string) => void;
  columnWidth: number;
  rowHeight: number;
}

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_COLUMN_WIDTH = 100;

function formatCellDisplay(cell: CellModel | undefined): string {
  if (!cell) return "";
  if (cell.error) return cell.error;
  if (cell.formula !== undefined && cell.result !== undefined) {
    return formatScalarValue(cell.result);
  }
  if (cell.value !== undefined) {
    return formatScalarValue(cell.value);
  }
  return "";
}

function formatScalarValue(value: CellScalarValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!isFinite(value)) return value.toString();
    return Number.isInteger(value) ? value.toString() : value.toFixed(6).replace(/\.?0+$/, "");
  }
  return String(value);
}

function getCellStyle(cell: CellModel | undefined): React.CSSProperties {
  const style: React.CSSProperties = {};

  if (!cell?.style) return style;

  const cellStyle = cell.style;

  if (cellStyle.fontFamily) {
    style.fontFamily = cellStyle.fontFamily;
  }
  if (cellStyle.fontSize) {
    style.fontSize = cellStyle.fontSize;
  }
  if (cellStyle.bold) {
    style.fontWeight = "bold";
  }
  if (cellStyle.italic) {
    style.fontStyle = "italic";
  }
  if (cellStyle.underline) {
    style.textDecoration = "underline";
  }
  if (cellStyle.strike) {
    style.textDecoration = "line-through";
  }
  if (cellStyle.fontColor) {
    style.color = cellStyle.fontColor;
  }
  if (cellStyle.fillColor) {
    style.backgroundColor = cellStyle.fillColor;
  }
  if (cellStyle.horizontal) {
    style.textAlign = cellStyle.horizontal;
  }
  if (cellStyle.vertical) {
    style.alignItems =
      cellStyle.vertical === "top"
        ? "flex-start"
        : cellStyle.vertical === "bottom"
          ? "flex-end"
          : "center";
  }
  if (cellStyle.wrapText) {
    style.whiteSpace = "pre-wrap";
    style.wordBreak = "break-word";
  }
  if (typeof cellStyle.textRotation === "number" && cellStyle.textRotation > 0) {
    style.transform = `rotate(-${cellStyle.textRotation}deg)`;
  }

  return style;
}

function getCellBorderStyle(cell: CellModel | undefined): React.CSSProperties {
  const borderStyle: React.CSSProperties = {};
  const borders = cell?.style?.borders;

  if (!borders) return borderStyle;

  if (borders.top) {
    borderStyle.borderTop = `${borders.top.style} ${borders.top.color ?? "#000000"}`;
  }
  if (borders.bottom) {
    borderStyle.borderBottom = `${borders.bottom.style} ${borders.bottom.color ?? "#000000"}`;
  }
  if (borders.left) {
    borderStyle.borderLeft = `${borders.left.style} ${borders.left.color ?? "#000000"}`;
  }
  if (borders.right) {
    borderStyle.borderRight = `${borders.right.style} ${borders.right.color ?? "#000000"}`;
  }

  return borderStyle;
}

export const CellComponent = memo<CellProps>(function CellComponent({
  row,
  column,
  cell,
  isSelected,
  isInSelection,
  isEditing,
  onClick,
  onDoubleClick,
  onValueChange,
  onFormulaChange,
  columnWidth,
  rowHeight,
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onClick(row, column, e);
    },
    [onClick, row, column],
  );

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(row, column);
  }, [onDoubleClick, row, column]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const input = e.currentTarget;
        const value = input.value;
        if (value.startsWith("=") || value.startsWith("+") || value.startsWith("-")) {
          onFormulaChange(row, column, value.replace(/^[=+-]/, ""));
        } else {
          const num = Number(value);
          if (value === "TRUE" || value === "FALSE") {
            onValueChange(row, column, value === "TRUE");
          } else if (!isNaN(num) && value.trim() !== "") {
            onValueChange(row, column, num);
          } else {
            onValueChange(row, column, value);
          }
        }
        input.blur();
      } else if (e.key === "Escape") {
        e.currentTarget.blur();
      }
    },
    [onValueChange, onFormulaChange, row, column],
  );

  const displayValue = useMemo(() => formatCellDisplay(cell), [cell]);
  const cellStyle = useMemo(() => getCellStyle(cell), [cell]);
  const borderStyle = useMemo(() => getCellBorderStyle(cell), [cell]);

  return (
    <div
      className={`sheet-cell${isSelected ? " sheet-cell--selected" : ""}${
        isInSelection ? " sheet-cell--in-selection" : ""
      }`}
      style={{
        ...cellStyle,
        ...borderStyle,
        width: columnWidth,
        height: rowHeight,
        minWidth: columnWidth,
        minHeight: rowHeight,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-row={row}
      data-column={column}
    >
      {isEditing ? (
        <input
          type="text"
          className="sheet-cell__input"
          defaultValue={cell?.formula ?? (cell?.value !== undefined ? displayValue : "")}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <span className="sheet-cell__content" title={displayValue}>
          {displayValue}
        </span>
      )}
    </div>
  );
});

export default CellComponent;
