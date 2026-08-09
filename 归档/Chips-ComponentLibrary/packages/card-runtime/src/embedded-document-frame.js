import React from "react";
import { resolveCardCoverFrameState } from "./states.js";
import { toStandardError } from "./standard-error.js";
import { resolveIframeSandboxPolicy } from "./security-policy.js";

export function EmbeddedDocumentFrame(props) {
  const {
    surfaceId,
    title,
    src,
    srcDoc,
    ratio = "4:3",
    loading = false,
    disabled = false,
    sandbox = "allow-scripts",
    scope = "embedded-document-frame",
    onActivate,
    onFrameReady,
    onFrameError
  } = props;

  const [frameStatus, setFrameStatus] = React.useState("idle");
  const [loadError, setLoadError] = React.useState(null);

  React.useEffect(() => {
    setFrameStatus(loading ? "loading" : "idle");
    setLoadError(null);
  }, [src, srcDoc, loading]);

  const frameSource = typeof src === "string" && src.trim().length > 0
    ? src
    : typeof srcDoc === "string" && srcDoc.trim().length > 0
      ? srcDoc
      : undefined;
  const state = resolveCardCoverFrameState({
    coverUrl: frameSource,
    frameStatus,
    loading,
    disabled,
    loadError
  });
  const sandboxPolicy = resolveIframeSandboxPolicy(sandbox);
  const interactive = typeof onActivate === "function";

  const handleActivate = () => {
    if (!interactive || disabled || state === "loading" || state === "error") {
      return;
    }
    onActivate(surfaceId);
  };

  const handleLoad = () => {
    setFrameStatus("ready");
    setLoadError(null);
    if (typeof onFrameReady === "function") {
      onFrameReady(surfaceId);
    }
  };

  const handleError = (error) => {
    const normalized = toStandardError(error, "EMBEDDED_DOCUMENT_FRAME_LOAD_FAILED");
    setFrameStatus("error");
    setLoadError(normalized);
    if (typeof onFrameError === "function") {
      onFrameError(normalized);
    }
  };

  const rootProps = interactive
    ? {
        onClick: handleActivate,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleActivate();
          }
        },
        role: "button",
        tabIndex: disabled ? -1 : 0,
        "aria-disabled": disabled || undefined
      }
    : {};

  const iframeProps = {
    "data-part": "iframe",
    title: title || "Embedded Document",
    loading: "lazy",
    sandbox: sandboxPolicy,
    onLoad: handleLoad,
    onError: handleError
  };

  if (typeof src === "string" && src.trim().length > 0) {
    iframeProps.src = src;
  } else if (typeof srcDoc === "string" && srcDoc.trim().length > 0) {
    iframeProps.srcDoc = srcDoc;
  }

  return React.createElement(
    "article",
    {
      "data-scope": scope,
      "data-part": "root",
      "data-state": state,
      ...rootProps
    },
    React.createElement(
      "div",
      {
        "data-part": "frame-container",
        "data-ratio": ratio
      },
      frameSource ? React.createElement("iframe", iframeProps) : null
    ),
    React.createElement(
      "div",
      { "data-part": "status", "aria-live": "polite" },
      state
    )
  );
}
