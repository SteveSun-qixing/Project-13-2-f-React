import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExclamationCircleFilled } from "@ant-design/icons";
import { Button } from "antd";
import type { Client, DocumentWindowResizePayload, FrameRenderResult } from "chips-sdk";
import { createScopedLogger } from "../../config/logging";
import { resolveMessage } from "../lib/messages";
import type { ViewerDocumentKind } from "../types/viewer-source";
import "./CardWindow.css";

interface CardWindowProps {
  client: Client;
  filePath: string;
  documentType?: ViewerDocumentKind;
  traceId?: string;
  locale?: string;
  loadingLabel: string;
  containerErrorLabel: string;
  fatalErrorFallback: string;
  renderErrorFallback: string;
  resourceOpenErrorTitle: string;
  resourceOpenErrorFallback: string;
  retryLabel?: string;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

const DOCUMENT_FLOW_MIN_CONTENT_HEIGHT = 320;
const DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT = 960;

function normalizeResizeHeight(payload: DocumentWindowResizePayload | undefined): number | null {
  if (!payload || !Number.isFinite(payload.height) || payload.height <= 0) {
    return null;
  }

  return Math.max(DOCUMENT_FLOW_MIN_CONTENT_HEIGHT, Math.ceil(payload.height));
}

export function CardWindow({
  client,
  filePath,
  documentType,
  traceId,
  locale,
  loadingLabel,
  containerErrorLabel,
  fatalErrorFallback,
  renderErrorFallback,
  resourceOpenErrorTitle,
  resourceOpenErrorFallback,
  retryLabel = resolveMessage("card-viewer.actions.retry"),
}: CardWindowProps) {
  const logger = useMemo(
    () =>
      createScopedLogger({
        scope: "document-window",
        traceId,
      }),
    [traceId],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameResultRef = useRef<FrameRenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [documentHeight, setDocumentHeight] = useState(DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT);
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cleanupTasks: Array<() => void> = [];
    const resolvedDocumentType = documentType ?? client.document.detectType(filePath);
    logger.info("准备渲染文档窗口", {
      filePath,
      documentType: resolvedDocumentType,
    });

    const container = containerRef.current;
    if (!container) {
      logger.error("找不到文档窗口容器");
      setError(containerErrorLabel);
      return;
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    setIsLoading(true);
    setError(null);
    setDocumentHeight(DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT);

    client.document.window.render({
      filePath,
      documentType: documentType ?? undefined,
      locale,
      mode: "view",
    })
      .then((result) => {
        if (cancelled) {
          void result.dispose().catch(() => undefined);
          return;
        }

        const frame = result.frame;
        frameResultRef.current = result;
        frame.style.width = "100%";
        frame.style.height = `${DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT}px`;
        frame.style.border = "none";
        frame.style.display = "block";
        frame.style.overflow = "hidden";
        frame.setAttribute("scrolling", "no");

        const handleLoad = () => {
          if (!cancelled) {
            setIsLoading(false);
          }
        };
        const handleFrameError = () => {
          logger.error("iframe 触发原生 error 事件", {
            filePath,
            documentType: result.documentType,
          });
        };
        frame.addEventListener("load", handleLoad);
        frame.addEventListener("error", handleFrameError);
        cleanupTasks.push(() => {
          frame.removeEventListener("load", handleLoad);
          frame.removeEventListener("error", handleFrameError);
        });

        container.appendChild(frame);

        cleanupTasks.push(
          client.document.window.onReady(frame, () => {
            if (!cancelled) {
              setIsLoading(false);
            }
          }),
        );
        cleanupTasks.push(
          client.document.window.onResize(frame, (payload) => {
            const nextHeight = normalizeResizeHeight(payload);
            if (!cancelled && nextHeight) {
              setDocumentHeight((currentHeight) =>
                Math.abs(currentHeight - nextHeight) >= 1 ? nextHeight : currentHeight,
              );
              frame.style.height = `${nextHeight}px`;
            }
          }),
        );
        cleanupTasks.push(
          client.document.window.onError(frame, (payload) => {
            if (!cancelled) {
              logger.error("收到文档窗口错误事件", payload);
              setIsLoading(false);
              setError(payload.message || fatalErrorFallback);
            }
          }),
        );
        cleanupTasks.push(
          client.document.window.onNodeError(frame, (payload) => {
            if (!cancelled) {
              logger.warn("收到复合卡片节点降级事件", payload);
            }
          }),
        );
        cleanupTasks.push(
          client.document.window.onResourceOpen(frame, (payload) => {
            void client.resource
              .open({
                intent: payload.intent,
                resource: {
                  resourceId: payload.resourceId,
                  mimeType: payload.mimeType,
                  title: payload.title,
                  fileName: payload.fileName,
                  payload: payload.payload,
                },
              })
              .catch((resourceError) => {
                const message =
                  typeof resourceError === "object" &&
                  resourceError !== null &&
                  "message" in resourceError &&
                  typeof (resourceError as { message?: unknown }).message === "string"
                    ? (resourceError as { message: string }).message
                    : resourceOpenErrorFallback;
                logger.error("通过正式资源路由打开文档内部资源失败", resourceError);
                void client.platform.showMessage({
                  title: resourceOpenErrorTitle,
                  message,
                }).catch(() => undefined);
              });
          }),
        );
      })
      .catch((runtimeError) => {
        if (!cancelled) {
          logger.error("文档窗口渲染失败", runtimeError);
          setIsLoading(false);
          setError(resolveErrorMessage(runtimeError, renderErrorFallback));
        }
      });

    return () => {
      cancelled = true;
      for (const task of cleanupTasks) {
        task();
      }
      const frameResult = frameResultRef.current;
      const frame = frameResult?.frame ?? null;
      void frameResult?.dispose().catch(() => undefined);
      if (frame && frame.parentElement) {
        frame.parentElement.removeChild(frame);
      }
      frameResultRef.current = null;
    };
  }, [
    client,
    containerErrorLabel,
    documentType,
    fatalErrorFallback,
    filePath,
    locale,
    logger,
    renderErrorFallback,
    resourceOpenErrorFallback,
    resourceOpenErrorTitle,
    retryKey,
  ]);

  return (
    <div
      data-chips-app="card-viewer.window"
      className="card-viewer-window card-viewer-window--document-flow"
    >
      <div className="card-viewer-window__content card-viewer-window__content--document-flow">
        <div className="card-viewer-window__top-safe-area" aria-hidden="true" />
        <div
          data-chips-app="card-viewer.viewport"
          className="card-viewer-window__viewport card-viewer-window__viewport--document-flow"
          style={{ "--card-viewer-document-frame-height": `${documentHeight}px` } as React.CSSProperties}
        >
          <div
            ref={containerRef}
            data-scope="document-window"
            data-part="frame-host"
            className="card-viewer-window__frame-host card-viewer-window__frame-host--document-flow"
          />
          {isLoading && (
            <div
              data-scope="document-window"
              data-part="overlay"
              data-state="loading"
              role="status"
              aria-live="polite"
              className="card-viewer-window__overlay"
            >
              {loadingLabel}
            </div>
          )}
          {error && (
            <div
              data-scope="document-window"
              data-part="overlay"
              data-state="error"
              role="alert"
              className="card-viewer-window__overlay card-viewer-window__overlay--error"
            >
              <div className="card-viewer-window__error-panel">
                <ExclamationCircleFilled
                  aria-hidden="true"
                  className="card-viewer-window__error-icon"
                />
                <div className="card-viewer-window__error-title">{error}</div>
                <Button type="primary" onClick={retry}>
                  {retryLabel}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="card-viewer-window__safe-area" aria-hidden="true" />
    </div>
  );
}
