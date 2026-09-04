import React, { memo, useCallback, useState, useEffect } from "react";
import { Input, Button, Tooltip } from "antd";
import { CheckOutlined, CloseOutlined, FunctionOutlined } from "@ant-design/icons";
import type { CellModel, CellScalarValue } from "../types/workbook-model";
import { formatCellAddress } from "../types/workbook-model";

export interface FormulaBarProps {
  cellAddress: string;
  cellValue: CellScalarValue;
  cellFormula?: string;
  cell?: CellModel;
  onFormulaCommit: (formula: string) => void;
  onValueCommit: (value: CellScalarValue) => void;
  onCancel: () => void;
  isEditing: boolean;
  disabled?: boolean;
}

const PRESET_FUNCTIONS = [
  { label: "SUM", description: "求和" },
  { label: "AVERAGE", description: "平均值" },
  { label: "COUNT", description: "计数" },
  { label: "MAX", description: "最大值" },
  { label: "MIN", description: "最小值" },
  { label: "IF", description: "条件判断" },
  { label: "VLOOKUP", description: "垂直查找" },
  { label: "HLOOKUP", description: "水平查找" },
  { label: "CONCATENATE", description: "文本连接" },
  { label: "LEFT", description: "左侧文本" },
  { label: "RIGHT", description: "右侧文本" },
  { label: "MID", description: "中间文本" },
  { label: "LEN", description: "文本长度" },
  { label: "NOW", description: "当前日期时间" },
  { label: "TODAY", description: "当前日期" },
];

export const FormulaBar = memo<FormulaBarProps>(function FormulaBar({
  cellAddress,
  cellValue,
  cellFormula,
  onFormulaCommit,
  onValueCommit,
  onCancel,
  isEditing,
  disabled,
}) {
  const [inputValue, setInputValue] = useState("");
  const [showFunctionList, setShowFunctionList] = useState(false);

  useEffect(() => {
    if (isEditing) {
      if (cellFormula) {
        setInputValue(`=${cellFormula}`);
      } else if (cellValue !== null && cellValue !== undefined) {
        setInputValue(String(cellValue));
      } else {
        setInputValue("");
      }
    }
  }, [isEditing, cellFormula, cellValue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.startsWith("=") || value.startsWith("+") || value.startsWith("-")) {
      setShowFunctionList(true);
    } else {
      setShowFunctionList(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (inputValue.startsWith("=") || inputValue.startsWith("+") || inputValue.startsWith("-")) {
          onFormulaCommit(inputValue.replace(/^[=+-]/, ""));
        } else {
          const num = Number(inputValue);
          if (inputValue === "TRUE" || inputValue === "FALSE") {
            onValueCommit(inputValue === "TRUE");
          } else if (!isNaN(num) && inputValue.trim() !== "") {
            onValueCommit(num);
          } else {
            onValueCommit(inputValue);
          }
        }
      } else if (e.key === "Escape") {
        onCancel();
      }
    },
    [inputValue, onFormulaCommit, onValueCommit, onCancel],
  );

  const handleCommit = useCallback(() => {
    if (inputValue.startsWith("=") || inputValue.startsWith("+") || inputValue.startsWith("-")) {
      onFormulaCommit(inputValue.replace(/^[=+-]/, ""));
    } else {
      const num = Number(inputValue);
      if (inputValue === "TRUE" || inputValue === "FALSE") {
        onValueCommit(inputValue === "TRUE");
      } else if (!isNaN(num) && inputValue.trim() !== "") {
        onValueCommit(num);
      } else {
        onValueCommit(inputValue);
      }
    }
  }, [inputValue, onFormulaCommit, onValueCommit]);

  const handleFunctionClick = useCallback((funcName: string) => {
    setInputValue(`=${funcName}()`);
    setShowFunctionList(false);
  }, []);

  const formatDisplayValue = (value: CellScalarValue): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "number") {
      return Number.isInteger(value) ? value.toString() : value.toFixed(6).replace(/\.?0+$/, "");
    }
    return String(value);
  };

  return (
    <div className="sheet-formula-bar">
      <div className="formula-bar__cell-address">{cellAddress}</div>
      <div className="formula-bar__input-wrapper">
        <Input
          className="formula-bar__input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isEditing ? "输入公式或值" : ""}
          prefix={<FunctionOutlined />}
        />
        {isEditing && (
          <div className="formula-bar__actions">
            <Tooltip title="确认 (Enter)">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={handleCommit}
              />
            </Tooltip>
            <Tooltip title="取消 (Esc)">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={onCancel}
              />
            </Tooltip>
          </div>
        )}
      </div>
      {showFunctionList && isEditing && (
        <div className="formula-bar__function-list">
          {PRESET_FUNCTIONS.map((func) => (
            <div
              key={func.label}
              className="function-item"
              onClick={() => handleFunctionClick(func.label)}
            >
              <span className="function-item__name">{func.label}</span>
              <span className="function-item__desc">{func.description}</span>
            </div>
          ))}
        </div>
      )}
      {!isEditing && (
        <div className="formula-bar__display">
          <span className="formula-bar__display-value">
            {formatDisplayValue(cellValue)}
          </span>
        </div>
      )}
    </div>
  );
});

export default FormulaBar;
