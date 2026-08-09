import { toStandardError } from "./standard-error.js";

export const COMPOSITE_FRAME_CHANNEL = "chips.composite";

export const CompositeFrameEventType = {
  READY: "ready",
  RESIZE: "resize",
  NODE_ERROR: "node-error",
  FATAL_ERROR: "fatal-error"
};

function isObject(value) {
  return value !== null && typeof value === "object";
}

export function parseCompositeFrameMessage(data) {
  if (!isObject(data)) {
    return null;
  }

  if (data.channel !== COMPOSITE_FRAME_CHANNEL || typeof data.type !== "string") {
    return null;
  }

  if (data.type === CompositeFrameEventType.READY) {
    return {
      type: CompositeFrameEventType.READY,
      cardId: typeof data.cardId === "string" ? data.cardId : "",
      nodeCount: typeof data.nodeCount === "number" ? data.nodeCount : 0
    };
  }

  if (data.type === CompositeFrameEventType.RESIZE) {
    return {
      type: CompositeFrameEventType.RESIZE,
      height: typeof data.height === "number" ? data.height : 0,
      nodeCount: typeof data.nodeCount === "number" ? data.nodeCount : 0,
      reason: typeof data.reason === "string" ? data.reason : "initial"
    };
  }

  if (data.type === CompositeFrameEventType.NODE_ERROR) {
    return {
      type: CompositeFrameEventType.NODE_ERROR,
      nodeId: typeof data.nodeId === "string" ? data.nodeId : "unknown-node",
      error: toStandardError(data.error, "COMPOSITE_CARD_NODE_RENDER_FAILED")
    };
  }

  if (data.type === CompositeFrameEventType.FATAL_ERROR) {
    return {
      type: CompositeFrameEventType.FATAL_ERROR,
      error: toStandardError(data.error, "COMPOSITE_CARD_WINDOW_LOAD_FAILED")
    };
  }

  return null;
}
