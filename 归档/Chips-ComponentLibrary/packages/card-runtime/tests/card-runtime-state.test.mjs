import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCardCoverFrameState,
  resolveCompositeCardWindowState
} from "../src/states.js";

test("CardCoverFrame state prefers disabled", () => {
  const state = resolveCardCoverFrameState({
    coverUrl: "https://example.com/cover.html",
    frameStatus: "ready",
    loading: false,
    disabled: true,
    loadError: null
  });

  assert.equal(state, "disabled");
});

test("CardCoverFrame state becomes error on loadError", () => {
  const state = resolveCardCoverFrameState({
    coverUrl: "https://example.com/cover.html",
    frameStatus: "loading",
    loading: true,
    disabled: false,
    loadError: { code: "X", message: "fail" }
  });

  assert.equal(state, "error");
});

test("CompositeCardWindow state becomes degraded when node errors exist", () => {
  const state = resolveCompositeCardWindowState({
    disabled: false,
    fatalError: null,
    nodeErrorCount: 2,
    loading: false,
    phase: "ready"
  });

  assert.equal(state, "degraded");
});

test("CompositeCardWindow state prefers fatal error over resolving", () => {
  const state = resolveCompositeCardWindowState({
    disabled: false,
    fatalError: { code: "F", message: "fatal" },
    nodeErrorCount: 0,
    loading: true,
    phase: "resolving"
  });

  assert.equal(state, "error");
});
