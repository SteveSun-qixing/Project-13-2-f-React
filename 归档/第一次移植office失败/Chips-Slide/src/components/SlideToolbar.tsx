/**
 * 幻灯片工具栏（antd）：当前选中元素可用的编辑操作（填充、描边、字号、
 * 加粗/斜体/下划线、对齐、翻转、层级、删除）+ 缩放与撤销/重做。
 * 属性回显读取引擎元素模型；所有操作通过 op 提交到本地会话。
 */
import React, { useMemo } from "react";
import { Button, ColorPicker, Select, Space, Tooltip, Divider } from "antd";
import type { Color } from "antd/es/color-picker";
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  DeleteOutlined,
  ItalicOutlined,
  MenuOutlined,
  UnderlineOutlined,
  VerticalAlignMiddleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ColumnWidthOutlined,
  UndoOutlined,
  RedoOutlined,
  SwapLeftOutlined,
  SwapRightOutlined,
  BgColorsOutlined,
  RadiusUprightOutlined,
} from "@ant-design/icons";
import type { Stroke, TextElement } from "@genoffice/pptx-engine";
import { useDeck } from "../state/deck-store";
import { formatMessage } from "../lib/messages";
import { FONT_SIZES } from "../slides/render/font-sizes";

const ALIGN_OPTIONS = [
  { value: "left", icon: <AlignLeftOutlined />, title: "deck.toolbar.alignLeft" },
  { value: "center", icon: <AlignCenterOutlined />, title: "deck.toolbar.alignCenter" },
  { value: "right", icon: <AlignRightOutlined />, title: "deck.toolbar.alignRight" },
] as const;

export function SlideToolbar(): React.ReactElement {
  const deck = useDeck();

  const selected = useMemo(() => {
    if (!deck.selectedId) return null;
    return deck.getElementModel(deck.currentIndex, deck.selectedId);
  }, [deck]);

  const selectedText = useMemo(() => {
    if (!selected) return null;
    if (selected.type === "text" || selected.type === "shape") {
      return (selected as TextElement).text ?? null;
    }
    return null;
  }, [selected]);

  const hasSelection = !!selected;
  const hasText = !!selectedText;
  const firstRun = selectedText?.paragraphs.find((p) => p.runs.length)?.runs[0];
  const firstPara = selectedText?.paragraphs[0];
  const fill = selected && "fill" in selected ? (selected as TextElement).fill : undefined;
  const fillHex =
    fill && typeof fill === "object" && "type" in fill && fill.type === "solid"
      ? normalizePickerHex((fill as { color: string }).color)
      : undefined;
  const stroke =
    selected && "stroke" in selected ? ((selected as TextElement).stroke ?? null) : null;
  const strokeHex =
    stroke && stroke.fill.type === "solid" ? normalizePickerHex(stroke.fill.color) : undefined;
  const strokeWidthPt = stroke ? stroke.width / 12700 : 1;

  const toHex = (color: Color): string => color.toHexString().slice(0, 7);

  const applyFont = (patch: Record<string, unknown>) => {
    if (!deck.selectedId) return;
    deck.apply({
      op: "setFont",
      target: { slide: deck.currentIndex, el: deck.selectedId },
      font: patch,
    });
  };

  const applyFormat = (patch: Record<string, unknown>) => {
    if (!deck.selectedId) return;
    deck.apply({
      op: "setParagraphFormat",
      target: { slide: deck.currentIndex, el: deck.selectedId },
      format: patch,
    });
  };

  return (
    <div className="slide-toolbar" role="toolbar" aria-label={formatMessage("deck.toolbar.text")}>
      <Space size={4} wrap>
        <Tooltip title={formatMessage("deck.toolbar.undo")}>
          <Button size="small" icon={<UndoOutlined />} disabled={!deck.canUndo} onClick={deck.undo} />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.redo")}>
          <Button size="small" icon={<RedoOutlined />} disabled={!deck.canRedo} onClick={deck.redo} />
        </Tooltip>
        <Divider type="vertical" />
        <Tooltip title={formatMessage("deck.toolbar.zoomIn")}>
          <Button size="small" icon={<ZoomInOutlined />} onClick={deck.zoomIn} />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.zoomOut")}>
          <Button size="small" icon={<ZoomOutOutlined />} onClick={deck.zoomOut} />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.zoomReset")}>
          <Button size="small" icon={<ColumnWidthOutlined />} onClick={deck.zoomReset} />
        </Tooltip>
        <Divider type="vertical" />
        <Tooltip title={formatMessage("deck.toolbar.fill")}>
          <ColorPicker
            size="small"
            disabled={!hasSelection}
            value={fillHex ?? "#0a84ff"}
            onChange={(color) => {
              if (!deck.selectedId) return;
              deck.apply({
                op: "setFill",
                target: { slide: deck.currentIndex, el: deck.selectedId },
                fill: toHex(color),
              });
            }}
          />
        </Tooltip>
        <Button
          size="small"
          icon={<BgColorsOutlined />}
          disabled={!hasSelection}
          onClick={() => {
            if (!deck.selectedId) return;
            deck.apply({
              op: "setFill",
              target: { slide: deck.currentIndex, el: deck.selectedId },
              fill: "none",
            });
          }}
        >
          {formatMessage("deck.toolbar.fillNone")}
        </Button>
        <Tooltip title={formatMessage("deck.toolbar.stroke")}>
          <ColorPicker
            size="small"
            disabled={!hasSelection}
            value={strokeHex ?? "#1d1d1f"}
            onChange={(color) => {
              if (!deck.selectedId) return;
              deck.apply({
                op: "setStroke",
                target: { slide: deck.currentIndex, el: deck.selectedId },
                stroke: { color: toHex(color), widthPt: strokeWidthPt },
              });
            }}
          />
        </Tooltip>
        <Button
          size="small"
          icon={<RadiusUprightOutlined />}
          disabled={!hasSelection}
          onClick={() => {
            if (!deck.selectedId) return;
            deck.apply({
              op: "setStroke",
              target: { slide: deck.currentIndex, el: deck.selectedId },
              stroke: null,
            });
          }}
        >
          {formatMessage("deck.toolbar.strokeNone")}
        </Button>
        <Divider type="vertical" />
        <Select
          size="small"
          className="slide-toolbar__font-size"
          value={firstRun?.fontSize ?? undefined}
          placeholder={formatMessage("deck.toolbar.fontSize")}
          disabled={!hasText}
          onChange={(value) => applyFont({ fontSizePt: value })}
          options={FONT_SIZES.map((size) => ({ value: size, label: String(size) }))}
        />
        <Tooltip title={formatMessage("deck.toolbar.bold")}>
          <Button
            size="small"
            icon={<BoldOutlined />}
            type={firstRun?.bold ? "primary" : "default"}
            disabled={!hasText}
            onClick={() => applyFont({ bold: !firstRun?.bold })}
          />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.italic")}>
          <Button
            size="small"
            icon={<ItalicOutlined />}
            type={firstRun?.italic ? "primary" : "default"}
            disabled={!hasText}
            onClick={() => applyFont({ italic: !firstRun?.italic })}
          />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.underline")}>
          <Button
            size="small"
            icon={<UnderlineOutlined />}
            type={firstRun?.underline ? "primary" : "default"}
            disabled={!hasText}
            onClick={() => applyFont({ underline: !firstRun?.underline })}
          />
        </Tooltip>
        <Divider type="vertical" />
        {ALIGN_OPTIONS.map((option) => (
          <Tooltip key={option.value} title={formatMessage(option.title)}>
            <Button
              size="small"
              icon={option.icon}
              type={firstPara?.align === option.value ? "primary" : "default"}
              disabled={!hasText}
              onClick={() => applyFormat({ align: option.value })}
            />
          </Tooltip>
        ))}
        <Divider type="vertical" />
        <Tooltip title={formatMessage("deck.toolbar.flipH")}>
          <Button
            size="small"
            icon={<SwapLeftOutlined />}
            disabled={!hasSelection}
            onClick={() => {
              if (!deck.selectedId) return;
              deck.apply({
                op: "flipElements",
                target: { slide: deck.currentIndex },
                els: [deck.selectedId],
                axis: "h",
              });
            }}
          />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.flipV")}>
          <Button
            size="small"
            icon={<SwapRightOutlined />}
            disabled={!hasSelection}
            onClick={() => {
              if (!deck.selectedId) return;
              deck.apply({
                op: "flipElements",
                target: { slide: deck.currentIndex },
                els: [deck.selectedId],
                axis: "v",
              });
            }}
          />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.bringFront")}>
          <Button
            size="small"
            icon={<MenuOutlined rotate={180} />}
            disabled={!hasSelection}
            onClick={() => {
              if (!deck.selectedId) return;
              deck.apply({
                op: "reorderElement",
                target: { slide: deck.currentIndex, el: deck.selectedId },
                dir: "front",
              });
            }}
          />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.sendBack")}>
          <Button
            size="small"
            icon={<VerticalAlignMiddleOutlined />}
            disabled={!hasSelection}
            onClick={() => {
              if (!deck.selectedId) return;
              deck.apply({
                op: "reorderElement",
                target: { slide: deck.currentIndex, el: deck.selectedId },
                dir: "back",
              });
            }}
          />
        </Tooltip>
        <Tooltip title={formatMessage("deck.toolbar.delete")}>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!hasSelection}
            onClick={() => {
              if (!deck.selectedId) return;
              deck.apply({
                op: "deleteElement",
                target: { slide: deck.currentIndex, el: deck.selectedId },
              });
            }}
          />
        </Tooltip>
      </Space>
    </div>
  );
}

/** 任意颜色字符串 → 6 位 #RRGGBB（ColorPicker 需要）。 */
function normalizePickerHex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const value = color.replace("#", "");
  if (value.length === 8) return `#${value.slice(0, 6)}`;
  if (value.length === 6) return `#${value}`;
  if (value.length === 3) {
    return `#${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`;
  }
  return undefined;
}
