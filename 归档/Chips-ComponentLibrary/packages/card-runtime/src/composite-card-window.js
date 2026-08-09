import React from "react";
import { resolveCompositeCardWindowState } from "./states.js";
import { toStandardError } from "./standard-error.js";
import {
  CompositeFrameEventType,
  parseCompositeFrameMessage
} from "./frame-message-protocol.js";
import {
  isAllowedFrameOrigin,
  resolveIframeSandboxPolicy
} from "./security-policy.js";

export function CompositeCardWindow(props) {
  const {
    cardFile,
    frameUrl,
    mode = "view",
    loading = false,
    disabled = false,
    sandbox = "allow-scripts allow-same-origin",
    allowedOrigins,
    onReady,
    onResize,
    onNodeError,
    onFatalError
  } = props;

  const [phase, setPhase] = React.useState(loading ? "resolving" : "idle");
  const [nodeErrorCount, setNodeErrorCount] = React.useState(0);
  const [fatalError, setFatalError] = React.useState(null);
  const frameRef = React.useRef(null);
  const sandboxPolicy = resolveIframeSandboxPolicy(sandbox);

  React.useEffect(() => {
    if (loading) {
      setPhase("resolving");
      return;
    }

    if (frameUrl) {
      setPhase("rendering");
    } else {
      setPhase("idle");
    }
  }, [frameUrl, loading]);

  React.useEffect(() => {
    setNodeErrorCount(0);
    setFatalError(null);
  }, [cardFile, frameUrl]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleMessage = (event) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) {
        return;
      }
      if (!isAllowedFrameOrigin(event.origin, allowedOrigins)) {
        return;
      }

      const message = parseCompositeFrameMessage(event.data);
      if (!message) {
        return;
      }

      if (message.type === CompositeFrameEventType.READY) {
        setPhase("ready");
        if (typeof onReady === "function") {
          onReady({
            cardId: message.cardId || cardFile,
            nodeCount: message.nodeCount
          });
        }
        return;
      }

      if (message.type === CompositeFrameEventType.RESIZE) {
        if (typeof onResize === "function") {
          onResize({
            height: message.height,
            nodeCount: message.nodeCount,
            reason: message.reason
          });
        }
        return;
      }

      if (message.type === CompositeFrameEventType.NODE_ERROR) {
        setNodeErrorCount((value) => value + 1);
        if (typeof onNodeError === "function") {
          onNodeError({
            nodeId: message.nodeId,
            error: message.error
          });
        }
        return;
      }

      if (message.type === CompositeFrameEventType.FATAL_ERROR) {
        setFatalError(message.error);
        if (typeof onFatalError === "function") {
          onFatalError(message.error);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [allowedOrigins, cardFile, onFatalError, onNodeError, onReady, onResize]);

  const state = resolveCompositeCardWindowState({
    disabled,
    fatalError,
    nodeErrorCount,
    loading,
    phase
  });

  const handleFrameLoad = () => {
    setPhase("rendering");
  };

  const handleFrameError = (error) => {
    const normalized = toStandardError(error, "COMPOSITE_CARD_WINDOW_LOAD_FAILED");
    setFatalError(normalized);
    setPhase("idle");
    if (typeof onFatalError === "function") {
      onFatalError(normalized);
    }
  };

  return React.createElement(
    "section",
    {
      "data-scope": "composite-card-window",
      "data-part": "root",
      "data-state": state,
      "data-mode": mode,
      "data-card-file": cardFile,
      "data-node-error-count": String(nodeErrorCount),
      "data-disabled": disabled ? "true" : "false"
    },
      frameUrl
      ? React.createElement("iframe", {
          "data-part": "iframe",
          ref: frameRef,
          title: `composite-card:${cardFile}`,
          src: frameUrl,
          loading: "lazy",
          sandbox: sandboxPolicy,
          onLoad: handleFrameLoad,
          onError: handleFrameError
        })
      : null,
    React.createElement(
      "div",
      {
        "data-part": "overlay",
        hidden: state === "ready"
      },
      state
    ),
    React.createElement(
      "div",
      {
        "data-part": "status",
        "aria-live": "polite"
      },
      state
    )
  );
}
