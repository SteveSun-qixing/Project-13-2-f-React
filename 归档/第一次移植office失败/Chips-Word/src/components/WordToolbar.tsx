import React, { useEffect, useState } from "react";
import { Button, ColorPicker, Divider, Dropdown, Select, Tooltip } from "antd";
import type { Color } from "antd/es/color-picker";
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ItalicOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import type { Editor } from "@tiptap/core";
import type { Block, NumberingDef, TableModel } from "@genoffice/docx-engine";
import { getActiveSubEditor } from "../editor/active-editor";
import { stepParagraphIndent } from "../editor/indent";
import { isEastAsianFontName, BUILTIN_FONT_FAMILIES } from "../editor/font-list";
import { findNumId } from "../editor/doc-ops";
import { tableModelToPmNode } from "../editor/convert";
import { formatMessage } from "../lib/messages";
import "./word-workspace.css";

const FONT_SIZES_PT = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

const HIGHLIGHT_PRESETS = [
  { key: "ffff00", label: "黄色" },
  { key: "00ff00", label: "鲜绿色" },
  { key: "00ffff", label: "青色" },
  { key: "ff00ff", label: "洋红色" },
  { key: "ffc000", label: "橙色" },
  { key: "92d050", label: "浅绿色" },
  { key: "0000ff", label: "蓝色" },
  { key: "ff0000", label: "红色" },
  { key: "ffffff", label: "白色" },
  { key: "none", label: "无颜色" },
];

export interface WordToolbarProps {
  editor: Editor | null;
  disabled: boolean;
  blocks: Block[];
  numbering: Map<string, NumberingDef>;
}

function hexOf(color: Color | string): string {
  if (typeof color === "string") return color.replace("#", "");
  return color.toHexString().replace("#", "");
}

/** 列表编号解析：优先复用正文已用编号，其次复用文档内同类型定义的 numId。 */
function resolveNumId(
  blocks: Block[],
  numbering: Map<string, NumberingDef>,
  kind: "bullet" | "ordered",
): string | null {
  const used = findNumId(blocks, kind);
  if (used) return used;
  for (const [numId, def] of numbering) {
    if ((def.levels[0]?.numFmt === "bullet") === (kind === "bullet")) return numId;
  }
  return null;
}

export function WordToolbar(props: WordToolbarProps): React.ReactElement {
  const { editor, disabled, blocks, numbering } = props;
  const [, setRenderTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const rerender = () => setRenderTick((tick) => tick + 1);
    editor.on("transaction", rerender);
    editor.on("selectionUpdate", rerender);
    return () => {
      editor.off("transaction", rerender);
      editor.off("selectionUpdate", rerender);
    };
  }, [editor]);

  const activeEditor = getActiveSubEditor() ?? editor;
  const can = Boolean(activeEditor) && !disabled;
  const chain = () => (activeEditor ?? editor)!.chain().focus();

  const isActiveHeading = activeEditor?.isActive("docHeading") ?? false;
  const headingLevel = isActiveHeading
    ? Number(activeEditor?.getAttributes("docHeading").level) || 1
    : 0;
  const styleAttrs = (activeEditor?.getAttributes("docTextStyle") ?? {}) as {
    font?: string | null;
    fontAscii?: string | null;
    sizeHalfPoints?: number | null;
    color?: string | null;
    highlight?: string | null;
  };
  const activeFont = styleAttrs.font ?? styleAttrs.fontAscii ?? null;
  const activeSizePt = styleAttrs.sizeHalfPoints ? Number(styleAttrs.sizeHalfPoints) / 2 : null;
  const activeHighlight = styleAttrs.highlight ?? null;
  const paraAttrs = (activeEditor?.getAttributes("docParagraph") ?? {}) as { align?: string | null; lineSpacing?: number | null };
  const activeAlign = paraAttrs.align ?? "left";
  const activeLineSpacing = paraAttrs.lineSpacing ? Number(paraAttrs.lineSpacing) : null;

  const setParaAttr = (attrs: Record<string, unknown>): void => {
    chain()
      .updateAttributes("docParagraph", attrs)
      .updateAttributes("docHeading", attrs)
      .updateAttributes("docListItem", attrs)
      .run();
  };

  const setTextStyle = (patch: Record<string, unknown>): void => {
    chain().setMark("docTextStyle", patch).run();
  };

  const setFontFamily = (name: string): void => {
    if (isEastAsianFontName(name)) {
      setTextStyle({ font: name });
    } else {
      setTextStyle({ fontAscii: name });
    }
  };

  const applyHeading = (level: number): void => {
    if (level === 0) {
      chain().setNode("docParagraph").run();
      return;
    }
    chain().setNode("docHeading", { level }).run();
  };

  const toggleList = (kind: "bullet" | "ordered"): void => {
    if (!activeEditor) return;
    const ed: Editor = activeEditor;
    if (ed.isActive("docListItem", { kind })) {
      chain().setNode("docParagraph").run();
      return;
    }
    const numId = resolveNumId(blocks, numbering, kind);
    chain().setNode("docListItem", { kind, numId, ilvl: 0 }).run();
  };

  const setAlign = (align: string): void => {
    setParaAttr({ align });
    chain().updateAttributes("docProtected", { imageAlign: align }).run();
  };

  const insertTable = (rows: number, cols: number): void => {
    const model: TableModel = {
      rows: Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ paras: [""] })),
      ),
    };
    const node = tableModelToPmNode(model);
    chain().insertContent(node).run();
  };

  const headingItems = [
    { key: "body", label: formatMessage("toolbar.heading.body") },
    ...HEADING_LEVELS.map((level) => ({
      key: String(level),
      label: formatMessage("toolbar.heading.level", { level }),
    })),
  ];

  const alignItems = [
    { key: "left", label: formatMessage("toolbar.align.left"), icon: <AlignLeftOutlined /> },
    { key: "center", label: formatMessage("toolbar.align.center"), icon: <AlignCenterOutlined /> },
    { key: "right", label: formatMessage("toolbar.align.right"), icon: <AlignRightOutlined /> },
    { key: "both", label: formatMessage("toolbar.align.justify"), icon: <MenuOutlined /> },
  ];

  const spacingItems = LINE_SPACINGS.map((spacing) => ({
    key: String(spacing),
    label: spacing.toFixed(2).replace(/0+$/, "").replace(/\.$/, ".0"),
  }));

  const alignIcon =
    activeAlign === "center" ? (
      <AlignCenterOutlined />
    ) : activeAlign === "right" ? (
      <AlignRightOutlined />
    ) : activeAlign === "both" ? (
      <MenuOutlined />
    ) : (
      <AlignLeftOutlined />
    );

  return (
    <div className="word-toolbar" role="toolbar" aria-label={formatMessage("app.identity.displayName")}>
      <Tooltip title={formatMessage("toolbar.undo")}>
        <Button
          type="text"
          icon={<UndoOutlined />}
          disabled={!can || !activeEditor?.can().undo()}
          onClick={() => chain().undo().run()}
        />
      </Tooltip>
      <Tooltip title={formatMessage("toolbar.redo")}>
        <Button
          type="text"
          icon={<RedoOutlined />}
          disabled={!can || !activeEditor?.can().redo()}
          onClick={() => chain().redo().run()}
        />
      </Tooltip>
      <Divider orientation="vertical" />
      <Dropdown
        menu={{
          items: headingItems,
          selectable: true,
          selectedKeys: [String(headingLevel)],
          onClick: ({ key }) => applyHeading(key === "body" ? 0 : Number(key)),
        }}
        disabled={!can}
      >
        <Button className="word-toolbar__style-button">
          {headingLevel === 0
            ? formatMessage("toolbar.heading.body")
            : formatMessage("toolbar.heading.level", { level: headingLevel })}
        </Button>
      </Dropdown>
      <Divider orientation="vertical" />
      <Select
        className="word-toolbar__font-select"
        showSearch
        placeholder={formatMessage("toolbar.fontFamily")}
        value={activeFont ?? undefined}
        disabled={!can}
        onChange={setFontFamily}
        allowClear
        onClear={() => setTextStyle({ font: null, fontAscii: null })}
        options={BUILTIN_FONT_FAMILIES.map((name) => ({ value: name, label: name }))}
      />
      <Select
        className="word-toolbar__size-select"
        placeholder={formatMessage("toolbar.fontSize")}
        value={activeSizePt ?? undefined}
        disabled={!can}
        onChange={(pt) => setTextStyle({ sizeHalfPoints: Math.round(pt * 2) })}
        options={FONT_SIZES_PT.map((pt) => ({ value: pt, label: String(pt) }))}
      />
      <Divider orientation="vertical" />
      <Tooltip title={formatMessage("toolbar.bold")}>
        <Button
          type={activeEditor?.isActive("bold") ? "primary" : "text"}
          icon={<BoldOutlined />}
          disabled={!can}
          onClick={() => chain().toggleMark("bold").run()}
        />
      </Tooltip>
      <Tooltip title={formatMessage("toolbar.italic")}>
        <Button
          type={activeEditor?.isActive("italic") ? "primary" : "text"}
          icon={<ItalicOutlined />}
          disabled={!can}
          onClick={() => chain().toggleMark("italic").run()}
        />
      </Tooltip>
      <Tooltip title={formatMessage("toolbar.underline")}>
        <Button
          type={activeEditor?.isActive("underline") ? "primary" : "text"}
          icon={<UnderlineOutlined />}
          disabled={!can}
          onClick={() => chain().toggleMark("underline").run()}
        />
      </Tooltip>
      <Tooltip title={formatMessage("toolbar.strike")}>
        <Button
          type={activeEditor?.isActive("strike") ? "primary" : "text"}
          icon={<StrikethroughOutlined />}
          disabled={!can}
          onClick={() => chain().toggleMark("strike").run()}
        />
      </Tooltip>
      <Divider orientation="vertical" />
      <ColorPicker
        disabled={!can}
        value={`#${styleAttrs.color ?? "000000"}`}
        onChange={(color) => {
          const hex = hexOf(color);
          setTextStyle({ color: hex.toUpperCase() === "000000" ? null : hex });
        }}
      />
      <Dropdown
        menu={{
          items: HIGHLIGHT_PRESETS.map((preset) => ({ key: preset.key, label: preset.label })),
          selectable: true,
          selectedKeys: [activeHighlight ?? "none"],
          onClick: ({ key }) => setTextStyle({ highlight: key === "none" ? null : key }),
        }}
        disabled={!can}
      >
        <Button type="text">{formatMessage("toolbar.highlight")}</Button>
      </Dropdown>
      <Divider orientation="vertical" />
      <Dropdown
        menu={{
          items: alignItems,
          selectable: true,
          selectedKeys: [activeAlign],
          onClick: ({ key }) => setAlign(key),
        }}
        disabled={!can}
      >
        <Button type="text" icon={alignIcon} />
      </Dropdown>
      <Dropdown
        menu={{
          items: spacingItems,
          selectable: true,
          selectedKeys: activeLineSpacing ? [String(activeLineSpacing)] : [],
          onClick: ({ key }) =>
            setParaAttr({ lineSpacing: Number(key), lineRule: null, lineRawTwips: null }),
        }}
        disabled={!can}
      >
        <Button type="text">{formatMessage("toolbar.lineSpacing")}</Button>
      </Dropdown>
      <Divider orientation="vertical" />
      <Tooltip title={formatMessage("toolbar.indentDecrease")}>
        <Button
          type="text"
          icon={<MenuFoldOutlined />}
          disabled={!can}
          onClick={() => activeEditor && stepParagraphIndent(activeEditor, -1)}
        />
      </Tooltip>
      <Tooltip title={formatMessage("toolbar.indentIncrease")}>
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          disabled={!can}
          onClick={() => activeEditor && stepParagraphIndent(activeEditor, 1)}
        />
      </Tooltip>
      <Divider orientation="vertical" />
      <Tooltip title={formatMessage("toolbar.bulletList")}>
        <Button
          type={activeEditor?.isActive("docListItem", { kind: "bullet" }) ? "primary" : "text"}
          icon={<UnorderedListOutlined />}
          disabled={!can}
          onClick={() => toggleList("bullet")}
        />
      </Tooltip>
      <Tooltip title={formatMessage("toolbar.orderedList")}>
        <Button
          type={activeEditor?.isActive("docListItem", { kind: "ordered" }) ? "primary" : "text"}
          icon={<OrderedListOutlined />}
          disabled={!can}
          onClick={() => toggleList("ordered")}
        />
      </Tooltip>
      <Divider orientation="vertical" />
      <Dropdown
        menu={{
          items: Array.from({ length: 8 }, (_, row) => ({
            key: `row-${row}`,
            type: "group" as const,
            label: `${row + 1}`,
            children: Array.from({ length: 8 }, (_, col) => ({
              key: `${row + 1}x${col + 1}`,
              label: formatMessage("toolbar.tableSize", { rows: row + 1, cols: col + 1 }),
            })),
          })),
          onClick: ({ key }) => {
            const [rows, cols] = key.split("x").map(Number);
            insertTable(rows, cols);
          },
        }}
        disabled={!can}
      >
        <Button type="text">{formatMessage("toolbar.insertTable")}</Button>
      </Dropdown>
    </div>
  );
}
