import React, { useCallback, useMemo, useRef, useState } from "react";
import { ExclamationCircleFilled } from "@ant-design/icons";
import { Button } from "antd";
import { createScopedLogger } from "../../config/logging";
import { resolveMessage } from "../lib/messages";
import "./DropZone.css";

type DragState = "idle" | "accept" | "reject";

const SUPPORTED_EXTENSIONS = [".card", ".box"];

function isSupportedCardFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function evaluateDragState(event: React.DragEvent<HTMLDivElement>): DragState {
  const items = event.dataTransfer.items;
  if (!items || items.length === 0) {
    return "accept";
  }
  for (const item of Array.from(items)) {
    if (item.kind !== "file") {
      continue;
    }
    const file = item.getAsFile();
    if (file && !isSupportedCardFile(file.name)) {
      return "reject";
    }
  }
  return "accept";
}

interface DropZoneProps {
  onFilePath: (filePath: string) => void;
  onOpenFile: () => void;
  onRetry?: () => void;
  error?: string | null;
  traceId?: string;
  ariaLabel: string;
  fileMarkLabel: string;
  title: string;
  description: string;
  openLabel: string;
  reselectLabel?: string;
}

function resolveNativeFilePath(file: File): string {
  const bridge = (window as {
    chips?: {
      platform?: {
        getPathForFile?: (value: File) => string;
      };
    };
  }).chips;

  if (typeof bridge?.platform?.getPathForFile === "function") {
    return bridge.platform.getPathForFile(file);
  }

  return (file as File & { path?: string }).path ?? "";
}

interface ChipBridgeWindow {
  chips?: {
    platform?: {
      getPathForFile?: (value: File) => string;
    };
  };
}

export function DropZone({
  onFilePath,
  onOpenFile,
  onRetry,
  error = null,
  traceId,
  ariaLabel,
  fileMarkLabel,
  title,
  description,
  openLabel,
  reselectLabel = resolveMessage("card-viewer.actions.reselectFile"),
}: DropZoneProps) {
  const logger = useMemo(
    () =>
      createScopedLogger({
        scope: "dropzone",
        traceId,
      }),
    [traceId],
  );
  const dragDepthRef = useRef(0);
  const [dragState, setDragState] = useState<DragState>("idle");

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setDragState("idle");
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragState(evaluateDragState(event));
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragState(evaluateDragState(event));
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragState("idle");
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      resetDragState();
      logger.info("收到拖拽投放事件", {
        itemCount: event.dataTransfer.items?.length ?? 0,
        fileCount: event.dataTransfer.files?.length ?? 0,
      });

      const items = event.dataTransfer.items;
      const file =
        items && items.length > 0
          ? Array.from(items)
              .find((item) => item.kind === "file")
              ?.getAsFile() ?? null
          : event.dataTransfer.files?.[0] ?? null;
      if (!file) {
        logger.warn("拖拽事件中未解析到文件对象");
        return;
      }

      const filePath = resolveNativeFilePath(file);
      if (filePath) {
        const bridgeWindow = window as ChipBridgeWindow;
        logger.info("拖拽文件路径解析成功", {
          fileName: file.name,
          filePath,
          fileType: file.type,
          source: typeof bridgeWindow.chips?.platform?.getPathForFile === "function" ? "webUtils" : "file.path",
        });
        onFilePath(filePath);
        return;
      }

      const bridgeWindow = window as ChipBridgeWindow;
      logger.warn("拖拽文件未携带可用的本地路径", {
        fileName: file.name,
        fileType: file.type,
        hasBridgeResolver: typeof bridgeWindow.chips?.platform?.getPathForFile === "function",
      });
    },
    [logger, onFilePath, resetDragState],
  );
  const titleId = "card-viewer-dropzone-title";
  const descriptionId = "card-viewer-dropzone-description";
  const errorId = error ? "card-viewer-dropzone-error" : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      data-chips-app="card-viewer.dropzone"
      data-state={dragState}
      className="card-viewer-dropzone"
      role="region"
      aria-label={ariaLabel}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <section
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="card-viewer-dropzone__panel"
      >
        <div
          aria-hidden="true"
          className="card-viewer-dropzone__file-mark"
        >
          {fileMarkLabel}
        </div>
        <div className="card-viewer-dropzone__copy">
          <h1 id={titleId} className="card-viewer-dropzone__title">{title}</h1>
          <p
            id={descriptionId}
            className="card-viewer-dropzone__description"
          >
            {description}
          </p>
        </div>
        <div className="card-viewer-dropzone__actions">
          <Button type="default" onClick={onOpenFile}>
            {openLabel}
          </Button>
        </div>
        {error ? (
          <div
            id={errorId}
            role="alert"
            className="card-viewer-dropzone__error"
          >
            <ExclamationCircleFilled
              aria-hidden="true"
              style={{ fontSize: 16, marginInlineEnd: 6, verticalAlign: "-2px" }}
            />
            <span>{error}</span>
            {onRetry ? (
              <span className="card-viewer-dropzone__error-retry">
                <Button size="small" onClick={onRetry}>
                  {reselectLabel}
                </Button>
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
