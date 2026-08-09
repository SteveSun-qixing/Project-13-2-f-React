import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ExclamationCircleFilled } from "@ant-design/icons";
import { Button } from "antd";
import type { Client } from "chips-sdk";
import { createScopedLogger } from "../../config/logging";
import { resolveMessage } from "../lib/messages";
import "./CardWindow.css";

interface HostedDocumentWindowProps {
  client: Client;
  documentUrl: string;
  traceId?: string;
  iframeTitle: string;
  loadingLabel: string;
  containerErrorLabel: string;
  resourceOpenErrorTitle: string;
  resourceOpenErrorFallback: string;
  retryLabel?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type DocumentSurfaceResizeReason =
  | "initial"
  | "content-resize"
  | "asset-load"
  | "font-load"
  | "viewport-resize";

interface DocumentSurfaceResizePayload {
  height: number;
  contentHeight: number;
  safeBlockEnd: number;
  safeBlockStart?: number;
  viewportHeight: number;
  reason: DocumentSurfaceResizeReason;
  stable: boolean;
}

const DOCUMENT_FLOW_MIN_CONTENT_HEIGHT = 320;
const DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT = 960;
const DOCUMENT_FLOW_SAFE_BLOCK_END_FALLBACK = 72;
const DOCUMENT_FLOW_SAFE_BLOCK_START_FALLBACK = 96;
const DOCUMENT_FLOW_STABLE_DELAY_MS = 160;
const DOCUMENT_FLOW_HEIGHT_EPSILON = 1;
const HOSTED_DOCUMENT_SANDBOX = "allow-scripts allow-forms";
const HOSTED_DOCUMENT_READY_EVENTS = new Set(["chips.composite:ready", "chips.box-layout:ready"]);
const HOSTED_DOCUMENT_ERROR_EVENTS = new Set(["chips.composite:fatal-error", "chips.box-layout:error"]);
const HOSTED_DOCUMENT_RESIZE_EVENT = "chips.composite:resize";
const HOSTED_DOCUMENT_RESOURCE_OPEN_EVENT = "chips.composite:resource-open";

function readElementBlockSize(element: HTMLElement | null, fallback: number): number {
  if (!element || typeof window === "undefined") {
    return fallback;
  }

  const rectHeight = element.getBoundingClientRect().height;
  if (Number.isFinite(rectHeight) && rectHeight > 0) {
    return Math.ceil(rectHeight);
  }

  const computedBlockSize = Number.parseFloat(window.getComputedStyle(element).blockSize);
  if (Number.isFinite(computedBlockSize) && computedBlockSize > 0) {
    return Math.ceil(computedBlockSize);
  }

  return fallback;
}

function normalizeDocumentSurfaceReason(reason: unknown): DocumentSurfaceResizeReason {
  if (
    reason === "initial"
    || reason === "asset-load"
    || reason === "font-load"
    || reason === "viewport-resize"
  ) {
    return reason;
  }

  return "content-resize";
}

function getViewportHeight(): number {
  if (typeof window === "undefined" || !Number.isFinite(window.innerHeight)) {
    return 0;
  }

  return Math.ceil(window.innerHeight);
}

function clearScheduledFrame(frameId: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frameId);
  } else {
    window.clearTimeout(frameId);
  }
}

function shouldPublishSurfaceResize(
  previous: DocumentSurfaceResizePayload | null,
  next: DocumentSurfaceResizePayload,
): boolean {
  if (!previous) {
    return true;
  }

  return (
    Math.abs(previous.height - next.height) >= DOCUMENT_FLOW_HEIGHT_EPSILON
    || Math.abs(previous.contentHeight - next.contentHeight) >= DOCUMENT_FLOW_HEIGHT_EPSILON
    || Math.abs(previous.safeBlockEnd - next.safeBlockEnd) >= DOCUMENT_FLOW_HEIGHT_EPSILON
    || previous.viewportHeight !== next.viewportHeight
    || previous.reason !== next.reason
    || previous.stable !== next.stable
  );
}

function resolveFrameOrigin(url: string): string {
  if (typeof window === "undefined") {
    return "null";
  }

  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

function isAllowedFrameOrigin(frame: HTMLIFrameElement, origin: string): boolean {
  if (origin === "null") {
    return true;
  }

  const allowedOrigins = new Set<string>();
  if (typeof window !== "undefined") {
    allowedOrigins.add(window.location.origin);
  }

  const frameOrigin = frame.dataset?.chipsOrigin;
  if (frameOrigin) {
    allowedOrigins.add(frameOrigin);
  }

  return allowedOrigins.has(origin);
}

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isRecord(error) && typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function normalizeResourceOpenPayload(payload: unknown): {
  intent?: string;
  resource: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    payload?: Record<string, unknown>;
  };
} | null {
  if (!isRecord(payload) || typeof payload.resourceId !== "string" || payload.resourceId.trim().length === 0) {
    return null;
  }

  return {
    intent: typeof payload.intent === "string" && payload.intent.trim().length > 0 ? payload.intent : undefined,
    resource: {
      resourceId: payload.resourceId.trim(),
      mimeType: typeof payload.mimeType === "string" ? payload.mimeType : undefined,
      title: typeof payload.title === "string" ? payload.title : undefined,
      fileName: typeof payload.fileName === "string" ? payload.fileName : undefined,
      payload: isRecord(payload.payload) ? payload.payload : undefined,
    },
  };
}

export function HostedDocumentWindow({
  client,
  documentUrl,
  traceId,
  iframeTitle,
  loadingLabel,
  containerErrorLabel,
  resourceOpenErrorTitle,
  resourceOpenErrorFallback,
  retryLabel = resolveMessage("card-viewer.actions.retry"),
}: HostedDocumentWindowProps) {
  const logger = useMemo(
    () =>
      createScopedLogger({
        scope: "hosted-document-window",
        traceId,
      }),
    [traceId],
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const topSafeAreaRef = useRef<HTMLDivElement | null>(null);
  const safeAreaRef = useRef<HTMLDivElement | null>(null);
  const lastPublishedPayloadRef = useRef<DocumentSurfaceResizePayload | null>(null);
  const pendingReasonRef = useRef<DocumentSurfaceResizeReason>("initial");
  const innerDocumentHeightRef = useRef(DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT);
  const currentSurfaceHeightRef = useRef(DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT);
  const pendingSurfaceHeightRef = useRef(DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT);
  const renderedInnerDocumentHeightRef = useRef(DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT);
  const pendingMeasureModeRef = useRef<"layout" | "target">("layout");
  const scheduledHeightFrameRef = useRef<number | null>(null);
  const stableHeightTimerRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentHeight, setDocumentHeight] = useState(() =>
    DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT,
  );
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  const readSafeBlockStart = useCallback(
    () => readElementBlockSize(topSafeAreaRef.current, DOCUMENT_FLOW_SAFE_BLOCK_START_FALLBACK),
    [],
  );

  const readSafeBlockEnd = useCallback(
    () => readElementBlockSize(safeAreaRef.current, DOCUMENT_FLOW_SAFE_BLOCK_END_FALLBACK),
    [],
  );

  const measureHostedDocumentHeight = useCallback((mode: "layout" | "target" = "layout"): number => {
    const frame = iframeRef.current;
    const content = contentRef.current;
    const root = rootRef.current;
    const rootTop = root?.getBoundingClientRect().top ?? 0;
    const contentTop = content?.getBoundingClientRect().top ?? rootTop;
    const frameTop = frame
      ? Math.max(0, frame.getBoundingClientRect().top - contentTop)
      : 0;
    const topSafeArea = readSafeBlockStart();
    const bottomSafeArea = readSafeBlockEnd();
    const measuredContentHeight = mode === "layout" && content
      ? Math.max(
          content.scrollHeight,
          content.offsetHeight,
          content.getBoundingClientRect().height,
        )
      : 0;

    return Math.max(
      DOCUMENT_FLOW_MIN_CONTENT_HEIGHT,
      Math.ceil(measuredContentHeight),
      Math.ceil(innerDocumentHeightRef.current + Math.max(frameTop, topSafeArea) + bottomSafeArea),
    );
  }, [readSafeBlockEnd, readSafeBlockStart]);

  const publishDocumentHeight = useCallback((
    nextHeight: number,
    reason: DocumentSurfaceResizeReason,
    stable: boolean,
  ) => {
    const contentHeight = Math.max(DOCUMENT_FLOW_MIN_CONTENT_HEIGHT, Math.ceil(nextHeight));
    const safeBlockStart = readSafeBlockStart();
    const safeBlockEnd = readSafeBlockEnd();
    const payload: DocumentSurfaceResizePayload = {
      height: contentHeight,
      contentHeight,
      safeBlockStart,
      safeBlockEnd,
      viewportHeight: getViewportHeight(),
      reason,
      stable,
    };

    if (!shouldPublishSurfaceResize(lastPublishedPayloadRef.current, payload)) {
      return;
    }

    currentSurfaceHeightRef.current = contentHeight;
    lastPublishedPayloadRef.current = payload;
    void client.events.emit("plugin.surface.resize", payload).catch(() => undefined);
  }, [client, readSafeBlockEnd]);

  const scheduleStableHeightPublish = useCallback((reason: DocumentSurfaceResizeReason) => {
    if (stableHeightTimerRef.current !== null) {
      window.clearTimeout(stableHeightTimerRef.current);
    }

    stableHeightTimerRef.current = window.setTimeout(() => {
      stableHeightTimerRef.current = null;
      const stableSurfaceHeight = Math.max(
        DOCUMENT_FLOW_MIN_CONTENT_HEIGHT,
        Math.ceil(pendingSurfaceHeightRef.current),
      );
      const stableInnerHeight = Math.max(
        DOCUMENT_FLOW_MIN_CONTENT_HEIGHT,
        Math.ceil(innerDocumentHeightRef.current),
      );
      renderedInnerDocumentHeightRef.current = stableInnerHeight;
      setDocumentHeight((currentHeight) =>
        Math.abs(currentHeight - stableInnerHeight) >= DOCUMENT_FLOW_HEIGHT_EPSILON
          ? stableInnerHeight
          : currentHeight,
      );
      publishDocumentHeight(stableSurfaceHeight, pendingReasonRef.current || reason, true);
    }, DOCUMENT_FLOW_STABLE_DELAY_MS);
  }, [publishDocumentHeight]);

  const scheduleDocumentHeightPublish = useCallback((
    reason: DocumentSurfaceResizeReason,
    nextInnerDocumentHeight?: number,
  ) => {
    const hasExplicitInnerHeight = Number.isFinite(nextInnerDocumentHeight);

    if (Number.isFinite(nextInnerDocumentHeight)) {
      const normalizedHeight = Math.max(
        DOCUMENT_FLOW_MIN_CONTENT_HEIGHT,
        Math.ceil(Number(nextInnerDocumentHeight)),
      );
      innerDocumentHeightRef.current = normalizedHeight;
      pendingMeasureModeRef.current = "target";
      if (reason === "initial" || normalizedHeight >= renderedInnerDocumentHeightRef.current) {
        renderedInnerDocumentHeightRef.current = normalizedHeight;
        setDocumentHeight((currentHeight) =>
          Math.abs(currentHeight - normalizedHeight) >= DOCUMENT_FLOW_HEIGHT_EPSILON
            ? normalizedHeight
            : currentHeight,
        );
      }
    } else {
      pendingMeasureModeRef.current = "layout";
    }

    pendingReasonRef.current = reason;
    if (scheduledHeightFrameRef.current !== null) {
      return;
    }

    const scheduledMeasureMode = hasExplicitInnerHeight ? "target" : pendingMeasureModeRef.current;
    const schedule = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);

    scheduledHeightFrameRef.current = schedule(() => {
      scheduledHeightFrameRef.current = null;
      const measuredHeight = measureHostedDocumentHeight(scheduledMeasureMode);
      pendingSurfaceHeightRef.current = measuredHeight;
      const previousContentHeight = lastPublishedPayloadRef.current?.contentHeight ?? currentSurfaceHeightRef.current;
      if (measuredHeight + DOCUMENT_FLOW_HEIGHT_EPSILON >= previousContentHeight) {
        currentSurfaceHeightRef.current = measuredHeight;
        publishDocumentHeight(measuredHeight, pendingReasonRef.current, false);
      }
      scheduleStableHeightPublish(pendingReasonRef.current);
    });
  }, [measureHostedDocumentHeight, publishDocumentHeight, scheduleStableHeightPublish]);

  useLayoutEffect(() => {
    const frame = iframeRef.current;
    if (!frame) {
      return;
    }

    setIsLoading(true);
    setError(null);
    innerDocumentHeightRef.current = DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT;
    currentSurfaceHeightRef.current = DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT;
    pendingSurfaceHeightRef.current = DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT;
    renderedInnerDocumentHeightRef.current = DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT;
    pendingMeasureModeRef.current = "target";
    lastPublishedPayloadRef.current = null;
    pendingReasonRef.current = "initial";
    setDocumentHeight(DOCUMENT_FLOW_INITIAL_CONTENT_HEIGHT);

    const handleFrameLoad = () => {
      logger.info("托管文档 iframe 已完成原生加载", {
        documentUrl,
      });
      setIsLoading(false);
      setError(null);
      scheduleDocumentHeightPublish("asset-load");
    };

    const handleFrameError = () => {
      logger.error("托管文档 iframe 原生加载失败", {
        documentUrl,
      });
      setIsLoading(false);
      setError(containerErrorLabel);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) {
        return;
      }

      if (!isAllowedFrameOrigin(frame, event.origin)) {
        logger.warn("已忽略来源不匹配的托管文档消息", {
          documentUrl,
          origin: event.origin,
          expectedOrigin: frame.dataset.chipsOrigin,
        });
        return;
      }

      const payload = event.data;
      if (!isRecord(payload) || typeof payload.type !== "string") {
        return;
      }

      if (HOSTED_DOCUMENT_READY_EVENTS.has(payload.type)) {
        logger.info("托管文档已通过正式运行时发出 ready 事件", {
          documentUrl,
          type: payload.type,
          payload: payload.payload,
        });
        setError(null);
        setIsLoading(false);
        return;
      }

      if (payload.type === HOSTED_DOCUMENT_RESIZE_EVENT) {
        const height =
          isRecord(payload.payload) && Number.isFinite(Number(payload.payload.height))
            ? Number(payload.payload.height)
            : null;
        if (height) {
          scheduleDocumentHeightPublish(
            normalizeDocumentSurfaceReason(isRecord(payload.payload) ? payload.payload.reason : undefined),
            height,
          );
        }
        setIsLoading(false);
        return;
      }

      if (HOSTED_DOCUMENT_ERROR_EVENTS.has(payload.type)) {
        logger.error("托管文档运行时报告错误", {
          type: payload.type,
          payload: payload.payload,
        });
        setIsLoading(false);
        setError(resolveErrorMessage(payload.payload, containerErrorLabel));
        return;
      }

      if (payload.type !== HOSTED_DOCUMENT_RESOURCE_OPEN_EVENT) {
        return;
      }

      const resourceOpenRequest = normalizeResourceOpenPayload(payload.payload);
      if (!resourceOpenRequest) {
        logger.warn("托管文档资源打开事件缺少有效 resourceId", payload.payload);
        void client.platform.showMessage({
          title: resourceOpenErrorTitle,
          message: resourceOpenErrorFallback,
        }).catch(() => undefined);
        return;
      }

      void client.resource
        .open(resourceOpenRequest)
        .catch((resourceError) => {
          logger.error("通过正式资源路由打开文档内资源失败", resourceError);
          void client.platform.showMessage({
            title: resourceOpenErrorTitle,
            message:
              resourceError && typeof resourceError === "object" && "message" in resourceError && typeof resourceError.message === "string"
                ? resourceError.message
                : resourceOpenErrorFallback,
          }).catch(() => undefined);
        });
    };

    const handleViewportResize = () => {
      scheduleDocumentHeightPublish("viewport-resize");
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("resize", handleViewportResize);
    window.visualViewport?.addEventListener("resize", handleViewportResize);
    frame.addEventListener("load", handleFrameLoad);
    frame.addEventListener("error", handleFrameError);

    frame.removeAttribute("src");
    frame.dataset.chipsOrigin = resolveFrameOrigin(documentUrl);
    frame.src = documentUrl;
    scheduleDocumentHeightPublish("initial", innerDocumentHeightRef.current);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("resize", handleViewportResize);
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      frame.removeEventListener("load", handleFrameLoad);
      frame.removeEventListener("error", handleFrameError);
      frame.removeAttribute("src");
      if (scheduledHeightFrameRef.current !== null) {
        clearScheduledFrame(scheduledHeightFrameRef.current);
        scheduledHeightFrameRef.current = null;
      }
      if (stableHeightTimerRef.current !== null) {
        window.clearTimeout(stableHeightTimerRef.current);
        stableHeightTimerRef.current = null;
      }
    };
  }, [client, containerErrorLabel, documentUrl, logger, resourceOpenErrorFallback, resourceOpenErrorTitle, retryKey, scheduleDocumentHeightPublish]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const topSafeArea = topSafeAreaRef.current;
    const safeArea = safeAreaRef.current;
    if ((!content && !topSafeArea && !safeArea) || typeof ResizeObserver !== "function") {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleDocumentHeightPublish("content-resize");
    });
    if (content) {
      observer.observe(content);
    }
    if (topSafeArea) {
      observer.observe(topSafeArea);
    }
    if (safeArea) {
      observer.observe(safeArea);
    }
    return () => {
      observer.disconnect();
    };
  }, [scheduleDocumentHeightPublish]);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.ready) {
      return;
    }

    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        scheduleDocumentHeightPublish("font-load");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [scheduleDocumentHeightPublish]);

  return (
    <div
      ref={rootRef}
      data-chips-app="card-viewer.window"
      className="card-viewer-window card-viewer-window--document-flow"
    >
      <div ref={contentRef} className="card-viewer-window__content card-viewer-window__content--document-flow">
        <div ref={topSafeAreaRef} className="card-viewer-window__top-safe-area" aria-hidden="true" />
        <div
          data-chips-app="card-viewer.viewport"
          className="card-viewer-window__viewport card-viewer-window__viewport--document-flow"
        >
          <div className="card-viewer-window__frame-host card-viewer-window__frame-host--document-flow">
            <iframe
              ref={iframeRef}
              className="card-viewer-window__iframe card-viewer-window__iframe--document-flow"
              title={iframeTitle}
              sandbox={HOSTED_DOCUMENT_SANDBOX}
              data-chips-origin={resolveFrameOrigin(documentUrl)}
              style={{ height: `${documentHeight}px` }}
              scrolling="no"
            />
          </div>
          {isLoading && (
            <div
              data-scope="composite-card-window"
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
              data-scope="composite-card-window"
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
      <div ref={safeAreaRef} className="card-viewer-window__safe-area" aria-hidden="true" />
    </div>
  );
}
