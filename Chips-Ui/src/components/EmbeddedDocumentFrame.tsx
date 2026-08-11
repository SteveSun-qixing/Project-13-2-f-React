import { Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

export interface EmbeddedDocumentFrameProps {
  title?: string;
  src?: string;
  srcDoc?: string;
  ratio?: string;
  autoHeight?: boolean;
  maxHeightFactor?: number;
  scope?: string;
  surfaceId?: string;
  sandbox?: string;
  onActivate?: () => void;
  onFrameReady?: () => void;
  onFrameError?: () => void;
}

const HEIGHT_REPORT_TYPE = "chips.embedded-frame:height";
const SETTLE_TIMEOUT_MS = 3000;

function buildHeightReporterScript(): string {
  const script = [
    "(function () {",
    "  var lastHeight = -1;",
    "  function measure() {",
    "    var root = document.documentElement;",
    "    var body = document.body;",
    "    return Math.max(",
    "      root ? root.scrollHeight || 0 : 0,",
    "      body ? body.scrollHeight || 0 : 0",
    "    );",
    "  }",
    "  function report() {",
    "    var height = measure();",
    "    if (height > 0 && height !== lastHeight) {",
    "      lastHeight = height;",
    "      window.parent.postMessage({ type: '" + HEIGHT_REPORT_TYPE + "', height: height }, '*');",
    "    }",
    "  }",
    "  function reportNextFrame() {",
    "    window.requestAnimationFrame(report);",
    "  }",
    "  report();",
    "  window.addEventListener('load', function () { window.setTimeout(report, 0); });",
    "  window.addEventListener('resize', reportNextFrame);",
    "  if (typeof ResizeObserver === 'function') {",
    "    var observer = new ResizeObserver(reportNextFrame);",
    "    if (document.documentElement) { observer.observe(document.documentElement); }",
    "    if (document.body) { observer.observe(document.body); }",
    "  }",
    "})();",
  ].join("");
  return `<script>${script}<\/script>`;
}

function injectHeightReporter(srcDoc: string): string {
  const scriptTag = buildHeightReporterScript();
  if (/<\/body>/i.test(srcDoc)) {
    return srcDoc.replace(/<\/body>/i, `${scriptTag}</body>`);
  }
  return `${srcDoc}${scriptTag}`;
}

export function EmbeddedDocumentFrame({
  title,
  src,
  srcDoc,
  ratio,
  autoHeight,
  maxHeightFactor,
  scope,
  surfaceId,
  sandbox,
  onActivate,
  onFrameReady,
  onFrameError,
}: EmbeddedDocumentFrameProps): React.ReactElement {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(undefined);
  const [settled, setSettled] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const effectiveSrcDoc = useMemo(
    () => (autoHeight && srcDoc ? injectHeightReporter(srcDoc) : srcDoc),
    [autoHeight, srcDoc],
  );

  useEffect(() => {
    setStatus("loading");
  }, [src, srcDoc]);

  useEffect(() => {
    if (!autoHeight) {
      return undefined;
    }
    setMeasuredHeight(undefined);
    setSettled(false);
    const timer = window.setTimeout(() => {
      setSettled(true);
    }, SETTLE_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [autoHeight, src, srcDoc]);

  useEffect(() => {
    if (!autoHeight) {
      return undefined;
    }
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };
    updateWidth();
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateWidth)
      : undefined;
    observer?.observe(container);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [autoHeight]);

  useEffect(() => {
    if (!autoHeight) {
      return undefined;
    }
    const handleMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) {
        return;
      }
      const data = event.data as { type?: unknown; height?: unknown } | undefined;
      if (!data || data.type !== HEIGHT_REPORT_TYPE) {
        return;
      }
      const height = data.height;
      if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
        return;
      }
      setMeasuredHeight(Math.round(height));
      setSettled(true);
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [autoHeight]);

  const containerStyle = useMemo(() => {
    if (!autoHeight) {
      const match = ratio?.match(/^(\d+):(\d+)$/);
      return {
        position: "relative",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "transparent",
        ...(match
          ? { aspectRatio: `${match[1]} / ${match[2]}` }
          : {}),
      } as React.CSSProperties;
    }

    const cap = maxHeightFactor && containerWidth > 0
      ? maxHeightFactor * containerWidth
      : Number.POSITIVE_INFINITY;
    const height = measuredHeight !== undefined
      ? Math.min(measuredHeight, cap)
      : Number.isFinite(cap)
        ? cap
        : undefined;

    return {
      position: "relative",
      width: "100%",
      overflow: "hidden",
      backgroundColor: "transparent",
      ...(height !== undefined ? { height: `${height}px` } : {}),
    } as React.CSSProperties;
  }, [autoHeight, containerWidth, maxHeightFactor, measuredHeight, ratio]);

  const overlayVisible = status !== "ready" || (autoHeight && !settled);

  const frame = (
    <iframe
      ref={frameRef}
      title={title ?? "嵌入式文档"}
      src={src}
      srcDoc={effectiveSrcDoc}
      sandbox={sandbox}
      data-chips-embedded-frame={scope ?? "embedded-document-frame"}
      data-chips-surface-id={surfaceId}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        display: status === "ready" ? "block" : "none",
        background: "transparent",
      }}
      onLoad={() => {
        setStatus("ready");
        onFrameReady?.();
      }}
      onError={() => {
        setStatus("error");
        onFrameError?.();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.();
      }}
    />
  );

  return (
    <div
      ref={containerRef}
      className="chips-embedded-document-frame"
      style={containerStyle}
    >
      {frame}
      {overlayVisible ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: autoHeight ? "transparent" : "#f5f5f7",
          }}
        >
          {status === "error"
            ? <span style={{ color: "#86868b", fontSize: 13 }}>加载失败</span>
            : <Spin />}
        </div>
      ) : null}
    </div>
  );
}
