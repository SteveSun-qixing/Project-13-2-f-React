import React from "react";
import { Button, Tooltip } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import type { Editor } from "@tiptap/core";
import { countWords } from "../editor/word-count";
import { formatMessage } from "../lib/messages";
import "./word-workspace.css";

export interface StatusBarProps {
  wordCount: number;
  pageCount: number;
  zoom: number;
  dirty: boolean;
  fileName: string | null;
  saving: boolean;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  onZoomChange(zoom: number): void;
}

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const {
    wordCount,
    pageCount,
    zoom,
    dirty,
    fileName,
    saving,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onZoomChange,
  } = props;

  return (
    <div className="word-status-bar">
      <span className="word-status-bar__item">
        {fileName ? formatMessage("status.fileName", { name: fileName }) : ""}
      </span>
      <span className="word-status-bar__item">
        {saving ? formatMessage("document.saving") : dirty ? formatMessage("status.dirty") : formatMessage("status.saved")}
      </span>
      <span className="word-status-bar__spacer" />
      <span className="word-status-bar__item">{formatMessage("status.words", { count: wordCount })}</span>
      <span className="word-status-bar__item">{formatMessage("status.pages", { count: pageCount })}</span>
      <span className="word-status-bar__zoom">
        <Tooltip title={formatMessage("status.zoom.decrease")}>
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined />}
            aria-label={formatMessage("status.zoom.decrease")}
            onClick={onZoomOut}
          />
        </Tooltip>
        <input
          className="word-status-bar__zoom-range"
          type="range"
          min={30}
          max={300}
          step={10}
          value={zoom}
          aria-label={formatMessage("status.zoom.reset")}
          onChange={(event) => onZoomChange(Number(event.target.value))}
        />
        <Tooltip title={formatMessage("status.zoom.increase")}>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            aria-label={formatMessage("status.zoom.increase")}
            onClick={onZoomIn}
          />
        </Tooltip>
        <Button type="text" size="small" onClick={onZoomReset}>
          {zoom}%
        </Button>
      </span>
    </div>
  );
}

/** Word 口径字数统计（中文逐字 + 西文按词）。 */
export function countEditorWords(editor: Editor): number {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n");
  return countWords(text);
}
