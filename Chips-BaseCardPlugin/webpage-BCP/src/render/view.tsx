import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import type { BasecardOpenResourceInput } from "../index";
import type { BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import {
  createSrcDocDocument,
  deriveBaseHref,
  loadTextFromRuntimeUrl,
  publishViewportToFrame,
  WEBPAGE_CONTENT_HEIGHT_MESSAGE_TYPE,
  type WebpageViewportPayload,
} from "../shared/resource-loader";
import { getBundleEntryPath, validateWebpageUrl } from "../shared/utils";

const FIXED_RATIO_WIDTH = 7;
const FIXED_RATIO_HEIGHT = 16;
const FALLBACK_WIDTH = 640;
const MIN_FREE_VIEWPORT_HEIGHT = 160;

function calculateFixedHeight(width: number): number {
  return Math.max(MIN_FREE_VIEWPORT_HEIGHT, Math.round((width / FIXED_RATIO_WIDTH) * FIXED_RATIO_HEIGHT));
}

function getRuntimeViewportHeight(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const candidates: number[] = [];
  try {
    if (window.top && typeof window.top.innerHeight === "number") {
      candidates.push(window.top.innerHeight);
    }
  } catch {
    // Ignore cross-origin access failures and fall back to local measurements.
  }

  candidates.push(
    window.screen?.availHeight ?? 0,
    window.screen?.height ?? 0,
    window.innerHeight,
  );

  for (const candidate of candidates) {
    const normalized = clampPositiveNumber(candidate);
    if (normalized > 0) {
      return normalized;
    }
  }

  return 0;
}

function calculateProtocolViewportHeight(width: number, displayMode: BasecardConfig["display_mode"]): number {
  const fixedHeight = calculateFixedHeight(width);
  if (displayMode === "fixed") {
    return fixedHeight;
  }

  const runtimeViewportHeight = getRuntimeViewportHeight();
  if (runtimeViewportHeight <= 0) {
    return fixedHeight;
  }

  return Math.max(MIN_FREE_VIEWPORT_HEIGHT, Math.min(fixedHeight, runtimeViewportHeight));
}

function calculateInitialLayoutHeight(width: number, displayMode: BasecardConfig["display_mode"]): number {
  if (displayMode === "fixed") {
    return calculateFixedHeight(width);
  }

  return MIN_FREE_VIEWPORT_HEIGHT;
}

function getMeasureRootWidth(target: HTMLElement | null): number {
  if (!target) {
    return FALLBACK_WIDTH;
  }

  return Math.max(
    1,
    Math.round(target.getBoundingClientRect().width || target.clientWidth || FALLBACK_WIDTH),
  );
}

function measureDocumentHeight(doc: Document): number {
  const documentElement = doc.documentElement as {
    scrollHeight?: number;
    offsetHeight?: number;
    clientHeight?: number;
  } | null;
  const body = doc.body as {
    scrollHeight?: number;
    offsetHeight?: number;
    clientHeight?: number;
    textContent?: string | null;
    childElementCount?: number;
  } | null;

  return Math.max(
    documentElement?.scrollHeight ?? 0,
    documentElement?.offsetHeight ?? 0,
    documentElement?.clientHeight ?? 0,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    body?.clientHeight ?? 0,
  );
}

function getAccessibleFrameDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument ?? null;
  } catch {
    return null;
  }
}

function clampPositiveNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function calculateViewportLayout(
  measuredHeight: number,
  width: number,
  config: BasecardConfig,
  baseHeight: number,
  maxHeightRatio: number,
): { height: number; scrollMode: boolean } {
  if (config.display_mode === "fixed") {
    return {
      height: calculateFixedHeight(width),
      scrollMode: true,
    };
  }

  const normalizedHeight = clampPositiveNumber(measuredHeight);
  const maxHeight = Math.max(baseHeight, Math.round(width * maxHeightRatio));
  if (normalizedHeight <= 0) {
    return {
      height: baseHeight,
      scrollMode: true,
    };
  }

  const shouldScroll = normalizedHeight > maxHeight;
  return {
    height: shouldScroll ? maxHeight : Math.max(baseHeight, normalizedHeight),
    scrollMode: shouldScroll,
  };
}

function createViewportPayload(
  width: number,
  height: number,
  baseHeight: number,
  config: BasecardConfig,
  maxHeightRatio: number,
  scrollMode: boolean,
): WebpageViewportPayload {
  const maxHeight = config.display_mode === "fixed"
    ? baseHeight
    : Math.max(baseHeight, Math.round(width * maxHeightRatio));
  return {
    version: 1,
    displayMode: config.display_mode,
    fixedRatio: "7:16",
    width: clampPositiveNumber(width),
    height: clampPositiveNumber(height),
    baseHeight: clampPositiveNumber(baseHeight),
    maxHeight: clampPositiveNumber(maxHeight),
    scrollMode,
  };
}

function isLikelyBlockedDocument(doc: Document): boolean {
  const body = doc.body as { textContent?: string | null; childElementCount?: number } | null;
  const bodyText = body?.textContent?.trim() ?? "";
  const bodyChildCount = body?.childElementCount ?? 0;
  return doc.URL === "about:blank" && bodyText.length === 0 && bodyChildCount === 0;
}

function useContainerWidth(targetRef: React.RefObject<HTMLElement>) {
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    const update = () => {
      setWidth(getMeasureRootWidth(target));
    };

    update();
    if (typeof ResizeObserver !== "function") {
      return;
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [targetRef]);

  return width;
}

export const VIEW_STYLE_TEXT = `
.chips-webpage-card {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.chips-webpage-card__viewport {
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.chips-webpage-card__viewport--scroll {
  overflow: hidden;
}

.chips-webpage-card__frame {
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
  background: transparent;
}

.chips-webpage-card__message {
  min-height: 180px;
  width: 100%;
  padding: 28px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #1d1d1f;
  box-sizing: border-box;
}

.chips-webpage-card__message--error {
  color: #ff3b30;
}

.chips-webpage-card__toolbar {
  position: absolute;
  z-index: 1;
  inset-block-start: 10px;
  inset-inline-end: 10px;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}

.chips-webpage-card__open-button {
  pointer-events: auto;
  min-height: 34px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  color: #1d1d1f;
  padding: 0 10px;
  backdrop-filter: blur(10px);
}

.chips-webpage-card__open-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.chips-webpage-card__loading {
  font-size: 14px;
  line-height: 1.6;
}
`;

export interface WebpageCardViewProps {
  config: BasecardConfig;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: BasecardOpenResourceInput) => void;
}

export function WebpageCardView({
  config,
  resolveResourceUrl,
  releaseResourceUrl,
  openResource,
}: WebpageCardViewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const width = useContainerWidth(rootRef);
  const protocolViewportHeight = calculateProtocolViewportHeight(width, config.display_mode);
  const baseHeight = calculateInitialLayoutHeight(width, config.display_mode);
  const [status, setStatus] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const [errorText, setErrorText] = useState("");
  const [layoutHeight, setLayoutHeight] = useState(baseHeight);
  const [scrollMode, setScrollMode] = useState(false);
  const [bundleSrcDoc, setBundleSrcDoc] = useState<string | null>(null);

  const hasUrlSource = config.source_type === "url" && Boolean(config.source_url?.trim());
  const hasBundleSource = config.source_type === "bundle" && Boolean(config.bundle_root?.trim());
  const validUrl = hasUrlSource ? validateWebpageUrl(config.source_url ?? "") : false;
  const bundleEntryPath = getBundleEntryPath(config);
  const canOpenSource = Boolean(openResource) && ((hasUrlSource && validUrl) || Boolean(bundleEntryPath));
  const viewportPayload = useMemo(
    // Free mode may grow the outer iframe to the measured content height, but the embedded page
    // must keep receiving a stable viewport height to avoid measurement feedback loops.
    () => createViewportPayload(
      width,
      protocolViewportHeight,
      baseHeight,
      config,
      config.max_height_ratio,
      scrollMode,
    ),
    [baseHeight, config, config.max_height_ratio, protocolViewportHeight, scrollMode, width],
  );
  const baseHeightRef = useRef(baseHeight);
  const viewportPayloadRef = useRef<WebpageViewportPayload>(viewportPayload);

  useEffect(() => {
    baseHeightRef.current = baseHeight;
  }, [baseHeight]);

  useEffect(() => {
    viewportPayloadRef.current = viewportPayload;
  }, [viewportPayload]);

  useEffect(() => {
    if (config.display_mode === "fixed") {
      setLayoutHeight(baseHeight);
      return;
    }

    setLayoutHeight((current) => Math.max(current, baseHeight));
  }, [baseHeight, config.display_mode]);

  useEffect(() => {
    let cancelled = false;
    const entryPath = getBundleEntryPath(config);
    if (!hasBundleSource || !entryPath) {
      setBundleSrcDoc(null);
      return;
    }

    setStatus("loading");
    setErrorText("");
    setScrollMode(false);
    setLayoutHeight(baseHeightRef.current);

    void (async () => {
      try {
        const resolvedEntryUrl = resolveResourceUrl
          ? await resolveResourceUrl(entryPath)
          : entryPath;
        const htmlText = await loadTextFromRuntimeUrl(resolvedEntryUrl, entryPath);
        const srcDoc = createSrcDocDocument(
          htmlText,
          deriveBaseHref(resolvedEntryUrl),
          viewportPayloadRef.current,
        );
        if (cancelled) {
          return;
        }
        setBundleSrcDoc(srcDoc);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBundleSrcDoc(null);
        setStatus("error");
        setErrorText(error instanceof Error ? error.message : formatMessage("view.bundle_failed"));
      }
    })();

    return () => {
      cancelled = true;
      if (releaseResourceUrl) {
        void Promise.resolve(releaseResourceUrl(entryPath)).catch(() => undefined);
      }
    };
  }, [
    config,
    hasBundleSource,
    releaseResourceUrl,
    resolveResourceUrl,
  ]);

  const iframeSource = useMemo(() => {
    if (hasBundleSource) {
      return bundleSrcDoc ? { type: "srcDoc" as const, value: bundleSrcDoc } : null;
    }

    if (!hasUrlSource) {
      return null;
    }

    if (!validUrl) {
      return null;
    }

    return {
      type: "src" as const,
      value: config.source_url?.trim() ?? "",
    };
  }, [bundleSrcDoc, config.source_url, hasBundleSource, hasUrlSource, validUrl]);

  const openCurrentSource = () => {
    if (!openResource) {
      return;
    }

    if (hasUrlSource && validUrl && config.source_url) {
      openResource({
        resourceId: config.source_url.trim(),
        mimeType: "text/html",
        title: formatMessage("view.open_url_title"),
        payload: {
          kind: "chips.webpage-card",
          version: "1.0.0",
          cardType: config.card_type,
          sourceType: "url",
          url: config.source_url.trim(),
        },
      });
      return;
    }

    if (bundleEntryPath) {
      openResource({
        resourceId: bundleEntryPath,
        mimeType: "text/html",
        title: formatMessage("view.open_bundle_title"),
        fileName: config.entry_file ?? "index.html",
        payload: {
          kind: "chips.webpage-card",
          version: "1.0.0",
          cardType: config.card_type,
          sourceType: "bundle",
          bundleRoot: config.bundle_root ?? "",
          entryFile: config.entry_file ?? "index.html",
          resourcePaths: config.resource_paths,
        },
      });
    }
  };

  useEffect(() => {
    if (!iframeSource) {
      if (hasUrlSource && !validUrl) {
        setStatus("error");
        setErrorText(formatMessage("view.invalid_url"));
      } else if (hasBundleSource) {
        setStatus("loading");
      } else {
        setStatus("empty");
        setErrorText("");
      }
      return;
    }

    setStatus("loading");
    setErrorText("");
    setScrollMode(false);
    setLayoutHeight(baseHeightRef.current);
  }, [hasBundleSource, hasUrlSource, iframeSource, validUrl]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !iframeSource) {
      return;
    }

    const publishViewport = () => {
      publishViewportToFrame(frame, viewportPayload);
    };

    publishViewport();
    frame.addEventListener("load", publishViewport);
    return () => {
      frame.removeEventListener("load", publishViewport);
    };
  }, [iframeSource, viewportPayload]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !iframeSource) {
      return;
    }
    const frameElement = frame;

    let intervalId = 0;
    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frameWindow: Window | null = null;

    const clearObservers = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      if (frameWindow) {
        frameWindow.removeEventListener("resize", applyFrameResize);
      }
      intervalId = 0;
      mutationObserver = null;
      resizeObserver = null;
      frameWindow = null;
    };

    const applyUnmeasurableFallback = () => {
      setStatus("ready");
      setScrollMode(true);
      setLayoutHeight(baseHeight);
    };

    function applyMeasurement(reportedHeight?: number) {
      const accessibleDocument = getAccessibleFrameDocument(frameElement);
      if (accessibleDocument && config.source_type === "url" && isLikelyBlockedDocument(accessibleDocument)) {
        setStatus("error");
        setScrollMode(false);
        setErrorText(formatMessage("view.embed_blocked"));
        setLayoutHeight(baseHeight);
        return;
      }

      const measuredHeight = typeof reportedHeight === "number" && Number.isFinite(reportedHeight)
        ? reportedHeight
        : accessibleDocument
          ? measureDocumentHeight(accessibleDocument)
          : 0;

      if (!accessibleDocument && measuredHeight <= 0) {
        applyUnmeasurableFallback();
        return;
      }
      const nextLayout = calculateViewportLayout(
        measuredHeight,
        width,
        config,
        baseHeight,
        config.max_height_ratio,
      );

      setStatus("ready");
      setErrorText("");
      setScrollMode(nextLayout.scrollMode);
      setLayoutHeight(nextLayout.height);
    }

    const applyFrameResize = () => {
      applyMeasurement();
    };

    const attachToFrameDocument = () => {
      clearObservers();
      const accessibleDocument = getAccessibleFrameDocument(frameElement);
      if (!accessibleDocument) {
        applyUnmeasurableFallback();
        return;
      }

      applyMeasurement();
      try {
        mutationObserver = new MutationObserver(() => applyMeasurement());
        mutationObserver.observe(accessibleDocument.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      } catch {
        mutationObserver = null;
      }

      try {
        if (typeof ResizeObserver === "function") {
          resizeObserver = new ResizeObserver(() => applyMeasurement());
          resizeObserver.observe(accessibleDocument.documentElement);
          if (accessibleDocument.body) {
            resizeObserver.observe(accessibleDocument.body);
          }
        }
      } catch {
        resizeObserver = null;
      }

      try {
        frameWindow = frameElement.contentWindow;
        frameWindow?.addEventListener("resize", applyFrameResize);
      } catch {
        frameWindow = null;
      }

      intervalId = window.setInterval(() => applyMeasurement(), 600);
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.source !== frameElement.contentWindow) {
        return;
      }

      const data = event.data as {
        type?: unknown;
        payload?: { contentHeight?: unknown } | null;
      } | null;
      if (!data || data.type !== WEBPAGE_CONTENT_HEIGHT_MESSAGE_TYPE) {
        return;
      }

      const reportedHeight = data.payload?.contentHeight;
      if (typeof reportedHeight !== "number" || !Number.isFinite(reportedHeight) || reportedHeight <= 0) {
        return;
      }

      applyMeasurement(reportedHeight);
    };

    const handleLoad = () => {
      attachToFrameDocument();
    };
    const handleError = () => {
      clearObservers();
      setStatus("error");
      setScrollMode(false);
      setErrorText(formatMessage("view.load_failed"));
      setLayoutHeight(baseHeight);
    };

    frameElement.addEventListener("load", handleLoad);
    frameElement.addEventListener("error", handleError);
    window.addEventListener("message", handleWindowMessage);

    return () => {
      frameElement.removeEventListener("load", handleLoad);
      frameElement.removeEventListener("error", handleError);
      window.removeEventListener("message", handleWindowMessage);
      clearObservers();
    };
  }, [baseHeight, config, config.max_height_ratio, config.source_type, iframeSource, width]);

  if (!hasUrlSource && !hasBundleSource) {
    return (
      <div className="chips-webpage-card">
        <div className="chips-webpage-card__viewport">
          <div className="chips-webpage-card__message">{formatMessage("view.empty")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="chips-webpage-card" ref={rootRef}>
      <div
        className={`chips-webpage-card__viewport ${scrollMode ? "chips-webpage-card__viewport--scroll" : ""}`}
        style={{ height: `${layoutHeight}px` }}
      >
        {status === "error" ? (
          <div className="chips-webpage-card__message chips-webpage-card__message--error">
            {errorText || formatMessage("view.load_failed")}
          </div>
        ) : iframeSource ? (
          <iframe
            ref={iframeRef}
            className="chips-webpage-card__frame"
            src={iframeSource.type === "src" ? iframeSource.value : undefined}
            srcDoc={iframeSource.type === "srcDoc" ? iframeSource.value : undefined}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            loading="lazy"
            title="webpage-card-frame"
          />
        ) : null}

        {canOpenSource && (
          <div className="chips-webpage-card__toolbar" data-webpage-open-source="true">
            <Button
              type="default"
              className="chips-webpage-card__open-button"
              aria-label={formatMessage("view.open_source")}
              onClick={(event) => {
                event.stopPropagation();
                openCurrentSource();
              }}
            >
              <span className="chips-webpage-card__open-content">
                <ExportOutlined aria-hidden="true" style={{ fontSize: 16 }} />
                <span>{formatMessage("view.open_source")}</span>
              </span>
            </Button>
          </div>
        )}

        {status === "loading" && (
          <div className="chips-webpage-card__message chips-webpage-card__loading">
            {formatMessage("view.loading")}
          </div>
        )}
      </div>
    </div>
  );
}
