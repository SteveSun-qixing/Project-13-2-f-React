import React, { useEffect, useMemo, useRef } from "react";
import { Button, Result, Spin } from "antd";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { SectionSettings } from "@genoffice/docx-engine";
import { effectiveBottomPx, effectiveTopPx, sectionPageBox } from "../editor/pagination";
import { formatMessage } from "../lib/messages";
import type { DocumentLoadError } from "../app/AppRuntimeProvider";
import "./word-workspace.css";

export interface DocumentStageProps {
  editor: Editor | null;
  docCss: string;
  /** 动态分节 CSS 变量（页宽/页高/页边距），由运行时按文档计算 */
  sectionCss: string;
  zoom: number;
  loading: boolean;
  loadError: DocumentLoadError | null;
  hasDocument: boolean;
  onRetry(): void;
  onOpenOther(): void;
  onClose(): void;
  onDropFile(file: File): void;
}

export function DocumentStage(props: DocumentStageProps): React.ReactElement {
  const {
    editor,
    docCss,
    sectionCss,
    zoom,
    loading,
    loadError,
    hasDocument,
    onRetry,
    onOpenOther,
    onClose,
    onDropFile,
  } = props;

  const dragDepthRef = useRef(0);
  const [dragActive, setDragActive] = React.useState(false);

  useEffect(() => {
    setDragActive(false);
    dragDepthRef.current = 0;
  }, []);

  const zoomCss = useMemo(() => `.doc-zoom { zoom: ${(zoom / 100).toFixed(4)}; }\n`, [zoom]);

  const handleDragEnter = (event: React.DragEvent<HTMLElement>): void => {
    if (!hasDocument) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>): void => {
    if (!hasDocument) return;
    event.preventDefault();
  };

  const handleDragLeave = (event: React.DragEvent<HTMLElement>): void => {
    if (!hasDocument) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>): void => {
    if (!hasDocument) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    const file = Array.from(event.dataTransfer.files ?? [])[0];
    if (file) onDropFile(file);
  };

  if (loadError) {
    return (
      <div className="word-stage word-stage--error">
        <Result
          status="warning"
          title={formatMessage("document.error.title")}
          subTitle={errorText(loadError)}
          extra={[
            <Button key="retry" type="primary" onClick={onRetry}>
              {formatMessage("document.error.retry")}
            </Button>,
            <Button key="open" onClick={onOpenOther}>
              {formatMessage("document.error.openOther")}
            </Button>,
            <Button key="close" onClick={onClose}>
              {formatMessage("document.error.close")}
            </Button>,
          ]}
        />
      </div>
    );
  }

  if (loading || !editor || !hasDocument) {
    return (
      <div className="word-stage word-stage--loading">
        <Spin size="large" description={formatMessage("document.loading")}>
          <div className="word-stage__loading-placeholder" />
        </Spin>
      </div>
    );
  }

  return (
    <div
      className={`word-stage${dragActive ? " word-stage--drag-active" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <style>{sectionCss}</style>
      <style>{zoomCss}</style>
      {docCss ? <style>{docCss}</style> : null}
      <div className="editor-scroll">
        <div className="doc-zoom">
          <div className="page-wrap">
            <EditorContent editor={editor} className="word-stage__editor" />
          </div>
        </div>
        {dragActive ? (
          <div className="word-stage__drop-overlay">{formatMessage("start-home.hints.dropToOpen")}</div>
        ) : null}
      </div>
    </div>
  );
}

function errorText(error: DocumentLoadError): string {
  if (error.kind === "encrypted") {
    return formatMessage("document.error.encrypted");
  }
  if (error.kind === "read") {
    return formatMessage("document.error.read", { reason: error.reason ?? "" });
  }
  return formatMessage("document.error.parse", { reason: error.reason ?? "" });
}

/** 依据分节设置生成画布 CSS 变量（页宽/页高/内容宽度/内边距）。 */
export function buildSectionCss(sections: SectionSettings[]): string {
  const first = sections[0];
  if (!first) return "";
  const box = sectionPageBox(first);
  const twipsToPx = (twips: number): number => (twips / 1440) * 96;
  const topPx = effectiveTopPx(first, 0);
  const bottomPx = effectiveBottomPx(first, 0);
  return [
    ".word-stage {",
    `  --page-w: ${box.width}px;`,
    `  --page-h: ${box.height}px;`,
    `  --section-content-w: ${box.contentWidth}px;`,
    `  --page-pad: ${topPx}px ${twipsToPx(first.marginRight)}px ${bottomPx}px ${twipsToPx(first.marginLeft)}px;`,
    "}",
  ].join("\n");
}
