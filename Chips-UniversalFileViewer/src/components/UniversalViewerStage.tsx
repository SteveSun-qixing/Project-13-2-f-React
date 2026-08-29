import { useMemo, useState } from "react";
import { Spin, Typography } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { EngineViewer } from "../views/EngineViewer";
import { ViewerToolbar } from "../views/ViewerToolbar";
import type { PreviewToolbarRenderContext } from "../viewer-engine";
import { formatMessage } from "../lib/messages";
import { formatFileSize, resolveFileExtension } from "../utils/file-kind";
import type { LoadedViewerFile } from "../utils/source-loader";

export interface UniversalViewerStageProps {
  loadedFiles: LoadedViewerFile[];
  initialIndex: number;
  isLoading: boolean;
  feedback: { tone: "info" | "success" | "error"; message: string } | null;
  toolbarContext: PreviewToolbarRenderContext | null;
  onToolbarContext: (context: PreviewToolbarRenderContext | null) => void;
  onOpenFile: () => void;
  onReload: () => void;
  onSaveCopy: () => void;
  onDropFile: (file: File | null) => void;
}

function formatFileType(file: LoadedViewerFile): string {
  const extension = resolveFileExtension(file.fileName);
  if (extension.length > 0) {
    return extension.toUpperCase();
  }
  return file.mimeType ?? formatMessage("universal-viewer.info.format");
}

/**
 * 万能文件查看器舞台：引擎容器 + antd 工具栏 + 空态与拖拽引导。
 */
export function UniversalViewerStage({
  loadedFiles,
  initialIndex,
  isLoading,
  feedback,
  toolbarContext,
  onToolbarContext,
  onOpenFile,
  onReload,
  onSaveCopy,
  onDropFile,
}: UniversalViewerStageProps): React.ReactElement {
  const [isDraggingOver, setDraggingOver] = useState(false);
  const hasFile = loadedFiles.length > 0;
  const currentFile = useMemo<LoadedViewerFile | null>(() => {
    if (loadedFiles.length === 0) {
      return null;
    }
    const index = Math.min(Math.max(initialIndex, 0), loadedFiles.length - 1);
    return loadedFiles[index] ?? null;
  }, [initialIndex, loadedFiles]);

  const previewItems = useMemo(() => loadedFiles.map((file) => ({
    file: file.source,
    fileName: file.fileName,
    mimeType: file.mimeType,
  })), [loadedFiles]);

  const metaItems = useMemo(() => {
    if (!currentFile) {
      return [];
    }
    const items: string[] = [formatFileType(currentFile)];
    const size = formatFileSize(currentFile.size);
    if (size) {
      items.push(size);
    }
    return items;
  }, [currentFile]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (!isDraggingOver) {
      setDraggingOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDraggingOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDraggingOver(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    onDropFile(file);
  };

  return (
    <div
      className={`universal-viewer-stage${hasFile ? " universal-viewer-stage--viewing" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {hasFile ? (
        <>
          <div className="universal-viewer-stage__meta">
            <span className="universal-viewer-stage__file-name" title={currentFile?.fileName}>
              {currentFile?.fileName}
            </span>
            {metaItems.map((item) => (
              <span key={item} className="universal-viewer-stage__meta-item">{item}</span>
            ))}
          </div>
          <ViewerToolbar
            context={toolbarContext}
            onOpenFile={onOpenFile}
            onReload={onReload}
            onSaveCopy={onSaveCopy}
          />
          <div className="universal-viewer-stage__engine">
            <EngineViewer
              items={previewItems}
              initialIndex={initialIndex}
              onToolbarContext={onToolbarContext}
            />
          </div>
        </>
      ) : (
        <div className="universal-viewer-stage__empty">
          <InboxOutlined className="universal-viewer-stage__empty-icon" aria-hidden="true" />
          <Typography.Text strong>{formatMessage("universal-viewer.scenes.empty.title")}</Typography.Text>
          <Typography.Text type="secondary">{formatMessage("universal-viewer.scenes.empty.hint")}</Typography.Text>
          <button type="button" className="universal-viewer-stage__empty-action" onClick={onOpenFile}>
            {formatMessage("universal-viewer.commands.openFile.title")}
          </button>
        </div>
      )}

      {isDraggingOver ? (
        <div className="universal-viewer-stage__drop-overlay" aria-hidden="true">
          {formatMessage("universal-viewer.stage.dropHint")}
        </div>
      ) : null}

      {isLoading ? (
        <div className="universal-viewer-stage__loading" role="status">
          <Spin />
          <span>{formatMessage("universal-viewer.stage.loading")}</span>
        </div>
      ) : null}

      {feedback ? (
        <div className={`universal-viewer-stage__feedback universal-viewer-stage__feedback--${feedback.tone}`} role="status">
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}
