import test from "node:test";
import assert from "node:assert/strict";
import {
  loadCompositeWindowData,
  loadCoverFrameData,
  validateCardDisplayAdapter
} from "../src/runtime-adapter.js";

test("validateCardDisplayAdapter checks required functions", () => {
  assert.throws(() => validateCardDisplayAdapter({}), /resolveCoverFrame/);
  assert.equal(
    validateCardDisplayAdapter({
      resolveCoverFrame: async () => ({ coverUrl: "https://example.com/cover.html" }),
      resolveCompositeWindow: async () => ({ frameUrl: "https://example.com/frame.html" })
    }),
    true
  );
});

test("loadCoverFrameData normalizes adapter output", async () => {
  const adapter = {
    resolveCoverFrame: async () => ({
      coverUrl: "https://example.com/cover.html",
      title: "Card A",
      ratio: "3:4"
    }),
    resolveCompositeWindow: async () => ({ frameUrl: "https://example.com/frame.html" })
  };

  const result = await loadCoverFrameData(adapter, {
    cardId: "card-1"
  });

  assert.deepEqual(result, {
    cardId: "card-1",
    title: "Card A",
    ratio: "3:4",
    coverUrl: "https://example.com/cover.html"
  });
});

test("loadCompositeWindowData throws StandardError when adapter fails", async () => {
  const adapter = {
    resolveCoverFrame: async () => ({ coverUrl: "https://example.com/cover.html" }),
    resolveCompositeWindow: async () => {
      throw new Error("sdk unavailable");
    }
  };

  await assert.rejects(
    () =>
      loadCompositeWindowData(adapter, {
        cardFile: "/x/a.card"
      }),
    (error) => {
      assert.equal(error.code, "CARD_RUNTIME_COMPOSITE_RESOLVE_FAILED");
      assert.equal(error.message, "sdk unavailable");
      return true;
    }
  );
});

test("loadCoverFrameData uses input fallback id when adapter cardId missing", async () => {
  const adapter = {
    resolveCoverFrame: async () => ({
      coverUrl: "https://example.com/cover.html",
      title: "Card B"
    }),
    resolveCompositeWindow: async () => ({ frameUrl: "https://example.com/frame.html" })
  };

  const result = await loadCoverFrameData(adapter, {
    cardId: "fallback-id"
  });

  assert.equal(result.cardId, "fallback-id");
  assert.equal(result.title, "Card B");
});

test("loadCompositeWindowData uses cardFile fallback id when adapter cardId missing", async () => {
  const adapter = {
    resolveCoverFrame: async () => ({ coverUrl: "https://example.com/cover.html" }),
    resolveCompositeWindow: async () => ({
      frameUrl: "https://example.com/frame.html",
      nodeCount: 4
    })
  };

  const result = await loadCompositeWindowData(adapter, {
    cardFile: "/cards/demo.card"
  });

  assert.equal(result.cardId, "/cards/demo.card");
  assert.equal(result.nodeCount, 4);
});

test("loadCoverFrameData throws when cover url is missing", async () => {
  const adapter = {
    resolveCoverFrame: async () => ({
      cardId: "card-2"
    }),
    resolveCompositeWindow: async () => ({ frameUrl: "https://example.com/frame.html" })
  };

  await assert.rejects(
    () =>
      loadCoverFrameData(adapter, {
        cardId: "card-2"
      }),
    (error) => {
      assert.equal(error.code, "CARD_RUNTIME_COVER_RESOLVE_FAILED");
      assert.equal(error.message, "CARD_RUNTIME_ADAPTER_INVALID:resolveCoverFrame.coverUrl");
      return true;
    }
  );
});

test("loadCompositeWindowData throws when frame url is missing", async () => {
  const adapter = {
    resolveCoverFrame: async () => ({ coverUrl: "https://example.com/cover.html" }),
    resolveCompositeWindow: async () => ({
      cardId: "card-3"
    })
  };

  await assert.rejects(
    () =>
      loadCompositeWindowData(adapter, {
        cardFile: "/cards/error.card"
      }),
    (error) => {
      assert.equal(error.code, "CARD_RUNTIME_COMPOSITE_RESOLVE_FAILED");
      assert.equal(error.message, "CARD_RUNTIME_ADAPTER_INVALID:resolveCompositeWindow.frameUrl");
      return true;
    }
  );
});

test("loadCompositeWindowData passes mode and signal to adapter", async () => {
  const calls = [];
  const signal = { aborted: false };
  const adapter = {
    resolveCoverFrame: async () => ({ coverUrl: "https://example.com/cover.html" }),
    resolveCompositeWindow: async (params) => {
      calls.push(params);
      return {
        frameUrl: "https://example.com/frame.html"
      };
    }
  };

  await loadCompositeWindowData(
    adapter,
    {
      cardFile: "/cards/mode.card",
      mode: "preview"
    },
    { signal }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, "preview");
  assert.equal(calls[0].signal, signal);
});

test("loadCompositeWindowData rejects unsupported mode", async () => {
  const adapter = {
    resolveCoverFrame: async () => ({ coverUrl: "https://example.com/cover.html" }),
    resolveCompositeWindow: async () => ({
      frameUrl: "https://example.com/frame.html"
    })
  };

  await assert.rejects(
    () =>
      loadCompositeWindowData(adapter, {
        cardFile: "/cards/mode.card",
        mode: "edit"
      }),
    (error) => {
      assert.equal(error.code, "CARD_RUNTIME_COMPOSITE_RESOLVE_FAILED");
      assert.equal(error.message, "CARD_RUNTIME_ADAPTER_INVALID:resolveCompositeWindow.mode");
      return true;
    }
  );
});
