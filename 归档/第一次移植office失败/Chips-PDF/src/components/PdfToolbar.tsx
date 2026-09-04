import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Button, Divider, InputNumber, Segmented, Tooltip } from "antd";
import {
  BgColorsOutlined,
  ColumnWidthOutlined,
  LeftOutlined,
  RightOutlined,
  EditOutlined,
  FileDoneOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  OneToOneOutlined,
  SaveOutlined,
  SelectOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { DRAW_COLORS } from "../pdf/drawings";
import type { ViewerTool } from "../pdf/view-config";
import { formatMessage } from "../lib/messages";
import { applyElementRgb } from "./geometry-style";

export interface PdfToolbarProps {
  hasDocument: boolean;
  busy: boolean;
  currentPage: number;
  pageCount: number;
  pageInput: number;
  onPageInput: (page: number | null) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  scalePercent: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomReset: () => void;
  fitMode: string | null;
  onFitWidth: () => void;
  onFitPage: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleFind: () => void;
  tool: ViewerTool;
  onToolChange: (tool: ViewerTool) => void;
  drawColor: [number, number, number];
  onDrawColor: (rgb: [number, number, number]) => void;
  spread: 1 | 2;
  onSpreadChange: (spread: 1 | 2) => void;
  onStamp: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  dirty: boolean;
}

function ColorSwatch({
  rgb,
  active,
  onPick,
}: {
  rgb: [number, number, number];
  active: boolean;
  onPick: (rgb: [number, number, number]) => void;
}): ReactElement {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    applyElementRgb(ref.current, "--swatch-rgb", rgb);
  }, [rgb]);
  return (
    <button
      ref={ref}
      type="button"
      className={`pdf-color-swatch${active ? " pdf-color-swatch-active" : ""}`}
      aria-label={formatMessage("pdf.toolbar.drawColor")}
      onClick={() => onPick(rgb)}
    />
  );
}

/** 顶部工具栏：页码导航 / 缩放 / 旋转 / 查找 / 工具切换 / 印章 / 保存 */
export function PdfToolbar(props: PdfToolbarProps): ReactElement {
  const disabled = !props.hasDocument || props.busy;
  return (
    <div className="pdf-toolbar" role="toolbar" aria-label={formatMessage("app.commands.menu.view")}>
      <Tooltip title={formatMessage("pdf.toolbar.sidebar")}>
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          aria-label={formatMessage("pdf.toolbar.sidebar")}
          onClick={props.onToggleSidebar}
        />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title={formatMessage("pdf.toolbar.prevPage")}>
        <Button
          type="text"
          icon={<LeftOutlined />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.prevPage")}
          onClick={props.onPrevPage}
        />
      </Tooltip>
      <InputNumber
        className="pdf-toolbar-page-input"
        min={1}
        max={Math.max(props.pageCount, 1)}
        value={props.pageInput}
        disabled={disabled}
        aria-label={formatMessage("pdf.toolbar.pageInput")}
        onChange={props.onPageInput}
      />
      <span className="pdf-toolbar-page-total">/ {props.pageCount}</span>
      <Tooltip title={formatMessage("pdf.toolbar.nextPage")}>
        <Button
          type="text"
          icon={<RightOutlined />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.nextPage")}
          onClick={props.onNextPage}
        />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title={formatMessage("pdf.toolbar.zoomOut")}>
        <Button
          type="text"
          icon={<ZoomOutOutlined />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.zoomOut")}
          onClick={props.onZoomOut}
        />
      </Tooltip>
      <button
        type="button"
        className="pdf-toolbar-zoom-value"
        disabled={disabled}
        onClick={props.onZoomReset}
        title={formatMessage("pdf.toolbar.zoomReset")}
      >
        {props.scalePercent}%
      </button>
      <Tooltip title={formatMessage("pdf.toolbar.zoomIn")}>
        <Button
          type="text"
          icon={<ZoomInOutlined />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.zoomIn")}
          onClick={props.onZoomIn}
        />
      </Tooltip>
      <Tooltip title={formatMessage("pdf.toolbar.fitWidth")}>
        <Button
          type={props.fitMode === "width" ? "primary" : "text"}
          icon={<ColumnWidthOutlined />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.fitWidth")}
          onClick={props.onFitWidth}
        />
      </Tooltip>
      <Tooltip title={formatMessage("pdf.toolbar.fitPage")}>
        <Button
          type={props.fitMode === "page" ? "primary" : "text"}
          icon={<OneToOneOutlined />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.fitPage")}
          onClick={props.onFitPage}
        />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title={formatMessage("pdf.toolbar.rotateLeft")}>
        <Button
          type="text"
          icon={<ZoomOutOutlined rotate={90} />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.rotateLeft")}
          onClick={props.onRotateLeft}
        />
      </Tooltip>
      <Tooltip title={formatMessage("pdf.toolbar.rotateRight")}>
        <Button
          type="text"
          icon={<ZoomInOutlined rotate={90} />}
          disabled={disabled}
          aria-label={formatMessage("pdf.toolbar.rotateRight")}
          onClick={props.onRotateRight}
        />
      </Tooltip>
      <Divider type="vertical" />
      <Tooltip title={formatMessage("app.commands.view.find.title")}>
        <Button
          type="text"
          icon={<SearchOutlined />}
          disabled={disabled}
          aria-label={formatMessage("app.commands.view.find.title")}
          onClick={props.onToggleFind}
        />
      </Tooltip>
      <Divider type="vertical" />
      <Segmented
        className="pdf-toolbar-tools"
        value={props.tool === "select" || props.tool === "note" ? props.tool : "ink"}
        disabled={disabled}
        onChange={(value) => props.onToolChange(value as ViewerTool)}
        options={[
          { value: "select", icon: <SelectOutlined />, label: formatMessage("pdf.toolbar.tool.select") },
          { value: "ink", icon: <EditOutlined />, label: formatMessage("pdf.toolbar.tool.draw") },
          { value: "note", icon: <EditOutlined />, label: formatMessage("pdf.toolbar.tool.note") },
        ]}
      />
      {props.tool !== "select" && props.tool !== "note" ? (
        <Segmented
          className="pdf-toolbar-shapes"
          value={props.tool}
          disabled={disabled}
          onChange={(value) => props.onToolChange(value as ViewerTool)}
          options={[
            { value: "ink", label: formatMessage("pdf.tool.ink") },
            { value: "rect", label: formatMessage("pdf.tool.rect") },
            { value: "ellipse", label: formatMessage("pdf.tool.ellipse") },
            { value: "line", label: formatMessage("pdf.tool.line") },
            { value: "arrow", label: formatMessage("pdf.tool.arrow") },
          ]}
        />
      ) : null}
      {props.tool !== "select" ? (
        <span className="pdf-toolbar-colors">
          <BgColorsOutlined className="pdf-toolbar-colors-icon" />
          {DRAW_COLORS.map((c) => (
            <ColorSwatch
              key={c.name}
              rgb={c.rgb}
              active={
                c.rgb[0] === props.drawColor[0] &&
                c.rgb[1] === props.drawColor[1] &&
                c.rgb[2] === props.drawColor[2]
              }
              onPick={props.onDrawColor}
            />
          ))}
        </span>
      ) : null}
      <Divider type="vertical" />
      <Segmented
        value={props.spread}
        disabled={disabled}
        onChange={(value) => props.onSpreadChange(value as 1 | 2)}
        options={[
          { value: 1, label: formatMessage("pdf.toolbar.spread.single") },
          { value: 2, label: formatMessage("pdf.toolbar.spread.double") },
        ]}
      />
      <div className="pdf-toolbar-spacer" />
      <Tooltip title={formatMessage("pdf.dialog.stamp.title")}>
        <Button icon={<FileDoneOutlined />} disabled={disabled} onClick={props.onStamp}>
          {formatMessage("pdf.toolbar.stamp")}
        </Button>
      </Tooltip>
      <Tooltip title={formatMessage("pdf.toolbar.save")}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          disabled={!props.hasDocument || props.busy}
          loading={props.busy}
          onClick={props.onSave}
        >
          {formatMessage("pdf.toolbar.save")}
        </Button>
      </Tooltip>
      <Button disabled={!props.hasDocument || props.busy} onClick={props.onSaveAs}>
        {formatMessage("pdf.toolbar.saveAs")}
      </Button>
    </div>
  );
}

/** 状态栏：文件名 / 页码 / 缩放 / 工具 / 未保存标记 */
export function PdfStatusBar(props: {
  currentPage: number;
  pageCount: number;
  scalePercent: number;
  toolLabel: string;
  dirty: boolean;
  fileName: string;
}): ReactElement {
  return (
    <footer className="pdf-status-bar">
      <span className="pdf-status-file">{props.fileName}</span>
      <span>{formatMessage("pdf.status.page", { current: props.currentPage, total: props.pageCount })}</span>
      <span>{formatMessage("pdf.status.zoom", { scale: props.scalePercent })}</span>
      <span>
        {props.toolLabel
          ? formatMessage("pdf.status.tool.active", { tool: props.toolLabel })
          : formatMessage("pdf.status.tool.none")}
      </span>
      {props.dirty ? <span className="pdf-status-dirty">{formatMessage("pdf.status.unsaved")}</span> : null}
    </footer>
  );
}
