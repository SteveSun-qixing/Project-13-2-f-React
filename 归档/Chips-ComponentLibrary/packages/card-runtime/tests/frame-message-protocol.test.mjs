import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSITE_FRAME_CHANNEL,
  CompositeFrameEventType,
  parseCompositeFrameMessage
} from "../src/frame-message-protocol.js";

test("parseCompositeFrameMessage returns ready payload", () => {
  const payload = parseCompositeFrameMessage({
    channel: COMPOSITE_FRAME_CHANNEL,
    type: CompositeFrameEventType.READY,
    cardId: "card-a",
    nodeCount: 3
  });

  assert.deepEqual(payload, {
    type: CompositeFrameEventType.READY,
    cardId: "card-a",
    nodeCount: 3
  });
});

test("parseCompositeFrameMessage returns resize payload", () => {
  const payload = parseCompositeFrameMessage({
    channel: COMPOSITE_FRAME_CHANNEL,
    type: CompositeFrameEventType.RESIZE,
    height: 720,
    nodeCount: 3,
    reason: "node-height"
  });

  assert.deepEqual(payload, {
    type: CompositeFrameEventType.RESIZE,
    height: 720,
    nodeCount: 3,
    reason: "node-height"
  });
});

test("parseCompositeFrameMessage maps node error to standard error", () => {
  const payload = parseCompositeFrameMessage({
    channel: COMPOSITE_FRAME_CHANNEL,
    type: CompositeFrameEventType.NODE_ERROR,
    nodeId: "node-1",
    error: { code: "X", message: "node fail", retryable: true }
  });

  assert.equal(payload.type, CompositeFrameEventType.NODE_ERROR);
  assert.equal(payload.nodeId, "node-1");
  assert.equal(payload.error.code, "X");
  assert.equal(payload.error.retryable, true);
});

test("parseCompositeFrameMessage ignores invalid channel", () => {
  const payload = parseCompositeFrameMessage({
    channel: "other",
    type: CompositeFrameEventType.READY
  });

  assert.equal(payload, null);
});
