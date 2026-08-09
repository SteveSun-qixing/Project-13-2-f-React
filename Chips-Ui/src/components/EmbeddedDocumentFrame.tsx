import { Spin } from "antd";
import { useEffect, useRef, useState } from "react";

export interface EmbeddedDocumentFrameProps {
  title?: string;
  src?: string;
  srcDoc?: string;
  ratio?: string;
  scope?: string;
  surfaceId?: string;
  sandbox?: string;
  onActivate?: () => void;
  onFrameReady?: () => void;
  onFrameError?: () => void;
}

export function EmbeddedDocumentFrame({
  title,
  src,
  srcDoc,
  ratio,
  scope,
  surfaceId,
  sandbox,
  onActivate,
  onFrameReady,
  onFrameError,
}: EmbeddedDocumentFrameProps): React.ReactElement {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [src, srcDoc]);

  const aspectRatioStyle: React.CSSProperties | undefined = (() => {
    const match = ratio?.match(/^(\d+):(\d+)$/);
    if (!match) {
      return undefined;
    }
    return { aspectRatio: `${match[1]} / ${match[2]}` };
  })();

  const frame = (
    <iframe
      ref={frameRef}
      title={title ?? "嵌入式文档"}
      src={src}
      srcDoc={srcDoc}
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
      className="chips-embedded-document-frame"
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "transparent",
        ...aspectRatioStyle,
      }}
    >
      {frame}
      {status !== "ready" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f5f7",
          }}
        >
          {status === "loading" ? <Spin /> : <span style={{ color: "#86868b", fontSize: 13 }}>加载失败</span>}
        </div>
      ) : null}
    </div>
  );
}
