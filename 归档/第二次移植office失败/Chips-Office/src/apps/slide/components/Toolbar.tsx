/**
 * 工具栏组件
 * 提供幻灯片编辑工具和操作按钮
 */
import React, { useCallback } from "react";
import { Button, Tooltip, Divider, Dropdown, Slider, Space, Select } from "antd";
import {
  UndoOutlined,
  RedoOutlined,
  SaveOutlined,
  PrinterOutlined,
  CopyOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  DeleteOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { ToolType, ZoomState } from "../types";
import { formatMessage } from "../../../lib/messages";

export interface ToolbarProps {
  /** 当前工具 */
  activeTool: ToolType;
  /** 工具改变回调 */
  onToolChange?: (tool: ToolType) => void;
  /** 缩放状态 */
  zoomState: ZoomState;
  /** 缩放改变回调（fitMode：目标适配模式，如 "fit"） */
  onZoomChange?: (zoom: number, fitMode?: ZoomState["fitMode"]) => void;
  /** 撤销回调 */
  onUndo?: () => void;
  /** 重做回调 */
  onRedo?: () => void;
  /** 保存回调 */
  onSave?: () => void;
  /** 打印回调 */
  onPrint?: () => void;
  /** 剪切回调 */
  onCut?: () => void;
  /** 复制回调 */
  onCopy?: () => void;
  /** 粘贴回调 */
  onPaste?: () => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 是否有选中元素 */
  hasSelection?: boolean;
  /** 是否可撤销 */
  canUndo?: boolean;
  /** 是否可重做 */
  canRedo?: boolean;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 是否脏数据（未保存） */
  isDirty?: boolean;
}

/** 工具选项映射 */
const TOOL_ITEMS: Array<{ key: ToolType; icon: React.ReactNode; tooltip: string }> = [
  { key: "select", icon: <span style={{ fontSize: 16 }}>↖</span>, tooltip: "选择" },
  { key: "text", icon: <span style={{ fontSize: 16 }}>T</span>, tooltip: "文本" },
  { key: "shape", icon: <span style={{ fontSize: 16 }}>□</span>, tooltip: "形状" },
  { key: "line", icon: <span style={{ fontSize: 16 }}>╱</span>, tooltip: "线条" },
  { key: "pen", icon: <span style={{ fontSize: 16 }}>✎</span>, tooltip: "画笔" },
  { key: "highlight", icon: <span style={{ fontSize: 16 }}>🖍</span>, tooltip: "荧光笔" },
  { key: "eraser", icon: <span style={{ fontSize: 16 }}>⌫</span>, tooltip: "橡皮擦" },
];

/** 缩放预设值 */
const ZOOM_PRESETS = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2 },
];

/** 工具栏组件 */
export const Toolbar = React.memo(function Toolbar({
  activeTool,
  onToolChange,
  zoomState,
  onZoomChange,
  onUndo,
  onRedo,
  onSave,
  onPrint,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  hasSelection = false,
  canUndo = false,
  canRedo = false,
  readOnly = false,
  isDirty = false,
}: ToolbarProps) {
  const handleToolClick = useCallback(
    (tool: ToolType) => {
      if (!readOnly) {
        onToolChange?.(tool);
      }
    },
    [readOnly, onToolChange],
  );

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(4, zoomState.scale * 1.25);
    onZoomChange?.(newZoom);
  }, [zoomState.scale, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(0.1, zoomState.scale / 1.25);
    onZoomChange?.(newZoom);
  }, [zoomState.scale, onZoomChange]);

  const handleFitMode = useCallback(() => {
    onZoomChange?.(1, "fit");
  }, [onZoomChange]);

  const handleZoomPreset = useCallback(
    (value: number) => {
      onZoomChange?.(value);
    },
    [onZoomChange],
  );

  const handleSliderChange = useCallback(
    (value: number) => {
      onZoomChange?.(value / 100);
    },
    [onZoomChange],
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 12px",
        background: "#fff",
        borderBottom: "1px solid #e8e8e8",
        gap: 8,
      }}
    >
      {/* 撤销/重做 */}
      <Space size={4}>
        <Tooltip title={formatMessage("slide.toolbar.undo")}>
          <Button
            type="text"
            icon={<UndoOutlined />}
            onClick={onUndo}
            disabled={!canUndo || readOnly}
          />
        </Tooltip>
        <Tooltip title={formatMessage("slide.toolbar.redo")}>
          <Button
            type="text"
            icon={<RedoOutlined />}
            onClick={onRedo}
            disabled={!canRedo || readOnly}
          />
        </Tooltip>
      </Space>

      <Divider type="vertical" style={{ margin: "0 4px" }} />

      {/* 文件操作 */}
      <Space size={4}>
        <Tooltip title={formatMessage("slide.toolbar.save")}>
          <Button
            type="text"
            icon={<SaveOutlined />}
            onClick={onSave}
            disabled={readOnly}
          />
        </Tooltip>
        <Tooltip title={formatMessage("slide.toolbar.print")}>
          <Button
            type="text"
            icon={<PrinterOutlined />}
            onClick={onPrint}
          />
        </Tooltip>
      </Space>

      <Divider type="vertical" style={{ margin: "0 4px" }} />

      {/* 编辑操作 */}
      <Space size={4}>
        <Tooltip title={formatMessage("slide.toolbar.cut")}>
          <Button
            type="text"
            icon={<ScissorOutlined />}
            onClick={onCut}
            disabled={!hasSelection || readOnly}
          />
        </Tooltip>
        <Tooltip title={formatMessage("slide.toolbar.copy")}>
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={onCopy}
            disabled={!hasSelection || readOnly}
          />
        </Tooltip>
        <Tooltip title={formatMessage("slide.toolbar.paste")}>
          <Button
            type="text"
            icon={<SnippetsOutlined />}
            onClick={onPaste}
            disabled={readOnly}
          />
        </Tooltip>
        <Tooltip title={formatMessage("slide.toolbar.delete")}>
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={onDelete}
            disabled={!hasSelection || readOnly}
            danger
          />
        </Tooltip>
      </Space>

      <Divider type="vertical" style={{ margin: "0 4px" }} />

      {/* 工具选择 */}
      {!readOnly && (
        <Space size={4}>
          {TOOL_ITEMS.map((item) => (
            <Tooltip key={item.key} title={item.tooltip}>
              <Button
                type={activeTool === item.key ? "primary" : "text"}
                onClick={() => handleToolClick(item.key)}
              >
                {item.icon}
              </Button>
            </Tooltip>
          ))}
        </Space>
      )}

      <div style={{ flex: 1 }} />

      {/* 缩放控制 */}
      <Space size={4}>
        <Tooltip title={formatMessage("slide.toolbar.zoomOut")}>
          <Button
            type="text"
            icon={<ZoomOutOutlined />}
            onClick={handleZoomOut}
            disabled={zoomState.scale <= 0.1}
          />
        </Tooltip>

        <Select
          size="small"
          value={zoomState.scale}
          onChange={handleZoomPreset}
          style={{ width: 80 }}
          options={ZOOM_PRESETS.map((p) => ({ ...p, value: p.value }))}
        />

        <Tooltip title={formatMessage("slide.toolbar.zoomIn")}>
          <Button
            type="text"
            icon={<ZoomInOutlined />}
            onClick={handleZoomIn}
            disabled={zoomState.scale >= 4}
          />
        </Tooltip>

        <Tooltip title={formatMessage("slide.toolbar.fit")}>
          <Button
            type="text"
            icon={<ExpandOutlined />}
            onClick={handleFitMode}
          />
        </Tooltip>

        <div style={{ width: 100, marginLeft: 8 }}>
          <Slider
            min={10}
            max={400}
            value={Math.round(zoomState.scale * 100)}
            onChange={handleSliderChange}
            tooltip={{ formatter: (v) => `${v}%` }}
          />
        </div>
      </Space>
    </div>
  );
});
