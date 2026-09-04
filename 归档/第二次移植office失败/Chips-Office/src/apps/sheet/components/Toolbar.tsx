import React, { memo, useCallback } from "react";
import { Button, Dropdown, Tooltip, Select, Divider, type MenuProps } from "antd";
import {
  SaveOutlined,
  SaveFilled,
  FileAddOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  UndoOutlined,
  RedoOutlined,
  ScissorOutlined,
  CopyOutlined,
  SnippetsOutlined,
  MergeCellsOutlined,
  BorderOutlined,
  InsertRowAboveOutlined,
  InsertRowBelowOutlined,
  DeleteRowOutlined,
  InsertRowLeftOutlined,
  InsertRowRightOutlined,
  DeleteColumnOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { formatMessage } from "../lib/messages";

export interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  canMerge: boolean;
  isMerged: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onOpen: () => void;
  onExportCsv: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onMergeCells: () => void;
  onUnmergeCells: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onDeleteRow: () => void;
  onInsertColumnLeft: () => void;
  onInsertColumnRight: () => void;
  onDeleteColumn: () => void;
  onFormatChange: (key: string, value: string | number | boolean) => void;
  isBusy: boolean;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 72];
const FONT_FAMILIES = [
  { label: "宋体", value: "SimSun" },
  { label: "黑体", value: "SimHei" },
  { label: "微软雅黑", value: "Microsoft YaHei" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Courier New", value: "Courier New" },
];

export const Toolbar = memo<ToolbarProps>(function Toolbar({
  canUndo,
  canRedo,
  canMerge,
  isMerged,
  onUndo,
  onRedo,
  onSave,
  onSaveAs,
  onNew,
  onOpen,
  onExportCsv,
  onCut,
  onCopy,
  onPaste,
  onMergeCells,
  onUnmergeCells,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteRow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDeleteColumn,
  onFormatChange,
  isBusy,
}) {
  const [selectedFontFamily, setSelectedFontFamily] = React.useState<string>("Arial");
  const [selectedFontSize, setSelectedFontSize] = React.useState<number>(11);

  const handleFontFamilyChange = useCallback((value: string) => {
    setSelectedFontFamily(value);
    onFormatChange("fontFamily", value);
  }, [onFormatChange]);

  const handleFontSizeChange = useCallback((value: number) => {
    setSelectedFontSize(value);
    onFormatChange("fontSize", value);
  }, [onFormatChange]);

  const insertMenuItems: MenuProps["items"] = [
    {
      key: "row-above",
      icon: <InsertRowAboveOutlined />,
      label: formatMessage("sheet.toolbar.insertRowAbove"),
      onClick: onInsertRowAbove,
    },
    {
      key: "row-below",
      icon: <InsertRowBelowOutlined />,
      label: formatMessage("sheet.toolbar.insertRowBelow"),
      onClick: onInsertRowBelow,
    },
    { type: "divider" },
    {
      key: "column-left",
      icon: <InsertRowLeftOutlined />,
      label: formatMessage("sheet.toolbar.insertColumnLeft"),
      onClick: onInsertColumnLeft,
    },
    {
      key: "column-right",
      icon: <InsertRowRightOutlined />,
      label: formatMessage("sheet.toolbar.insertColumnRight"),
      onClick: onInsertColumnRight,
    },
  ];

  const deleteMenuItems: MenuProps["items"] = [
    {
      key: "row",
      icon: <DeleteRowOutlined />,
      label: formatMessage("sheet.toolbar.deleteRow"),
      onClick: onDeleteRow,
    },
    {
      key: "column",
      icon: <DeleteColumnOutlined />,
      label: formatMessage("sheet.toolbar.deleteColumn"),
      onClick: onDeleteColumn,
    },
  ];

  return (
    <div className="sheet-toolbar" role="toolbar" aria-label={formatMessage("sheet.toolbar.ariaLabel")}>
      <div className="toolbar-group">
        <Tooltip title={formatMessage("command.file.open.description")}>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={onOpen}
            disabled={isBusy}
          />
        </Tooltip>
        <Tooltip title={formatMessage("command.file.new.description")}>
          <Button
            icon={<FileAddOutlined />}
            onClick={onNew}
            disabled={isBusy}
          />
        </Tooltip>
        <Tooltip title={formatMessage("command.file.save.description")}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={onSave}
            disabled={isBusy}
          />
        </Tooltip>
        <Tooltip title={formatMessage("command.file.saveAs.description")}>
          <Button
            icon={<SaveFilled />}
            onClick={onSaveAs}
            disabled={isBusy}
          />
        </Tooltip>
        <Tooltip title={formatMessage("command.file.exportCsv.description")}>
          <Button
            icon={<DownloadOutlined />}
            onClick={onExportCsv}
            disabled={isBusy}
          />
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="toolbar-group">
        <Tooltip title="撤销 (Ctrl+Z)">
          <Button
            icon={<UndoOutlined />}
            onClick={onUndo}
            disabled={!canUndo || isBusy}
          />
        </Tooltip>
        <Tooltip title="重做 (Ctrl+Y)">
          <Button
            icon={<RedoOutlined />}
            onClick={onRedo}
            disabled={!canRedo || isBusy}
          />
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="toolbar-group">
        <Tooltip title="剪切 (Ctrl+X)">
          <Button icon={<ScissorOutlined />} onClick={onCut} disabled={isBusy} />
        </Tooltip>
        <Tooltip title="复制 (Ctrl+C)">
          <Button icon={<CopyOutlined />} onClick={onCopy} disabled={isBusy} />
        </Tooltip>
        <Tooltip title="粘贴 (Ctrl+V)">
          <Button icon={<SnippetsOutlined />} onClick={onPaste} disabled={isBusy} />
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="toolbar-group toolbar-group--font">
        <Select
          value={selectedFontFamily}
          onChange={handleFontFamilyChange}
          options={FONT_FAMILIES}
          style={{ width: 120 }}
          size="small"
          disabled={isBusy}
        />
        <Select
          value={selectedFontSize}
          onChange={handleFontSizeChange}
          options={FONT_SIZES.map((size) => ({ label: String(size), value: size }))}
          style={{ width: 60 }}
          size="small"
          disabled={isBusy}
        />
      </div>

      <Divider type="vertical" />

      <div className="toolbar-group">
        <Tooltip title={formatMessage("sheet.toolbar.bold")}>
          <Button
            className="toolbar-format-btn"
            onClick={() => onFormatChange("bold", true)}
            disabled={isBusy}
          >
            <strong>B</strong>
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage("sheet.toolbar.italic")}>
          <Button
            className="toolbar-format-btn"
            onClick={() => onFormatChange("italic", true)}
            disabled={isBusy}
          >
            <em>I</em>
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage("sheet.toolbar.underline")}>
          <Button
            className="toolbar-format-btn"
            onClick={() => onFormatChange("underline", true)}
            disabled={isBusy}
          >
            <u>U</u>
          </Button>
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="toolbar-group">
        <Tooltip title={formatMessage("sheet.toolbar.alignLeft")}>
          <Button
            className="toolbar-format-btn"
            onClick={() => onFormatChange("horizontal", "left")}
            disabled={isBusy}
          >
            左
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage("sheet.toolbar.alignCenter")}>
          <Button
            className="toolbar-format-btn"
            onClick={() => onFormatChange("horizontal", "center")}
            disabled={isBusy}
          >
            中
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage("sheet.toolbar.alignRight")}>
          <Button
            className="toolbar-format-btn"
            onClick={() => onFormatChange("horizontal", "right")}
            disabled={isBusy}
          >
            右
          </Button>
        </Tooltip>
      </div>

      <Divider type="vertical" />

      <div className="toolbar-group">
        <Tooltip title={formatMessage("sheet.toolbar.mergeCells")}>
          <Button
            icon={<MergeCellsOutlined />}
            onClick={isMerged ? onUnmergeCells : onMergeCells}
            disabled={!canMerge || isBusy}
          />
        </Tooltip>
        <Dropdown menu={{ items: insertMenuItems }} trigger={["click"]}>
          <Button icon={<InsertRowAboveOutlined />} disabled={isBusy}>
            插入
          </Button>
        </Dropdown>
        <Dropdown menu={{ items: deleteMenuItems }} trigger={["click"]}>
          <Button icon={<DeleteRowOutlined />} disabled={isBusy}>
            删除
          </Button>
        </Dropdown>
      </div>
    </div>
  );
});

export default Toolbar;
