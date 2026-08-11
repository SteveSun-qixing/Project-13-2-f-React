// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../src/core/client";
import type { BoxInspectionResult } from "../src/api/box";

const inspection: BoxInspectionResult = {
  path: "/workspace/ProductFinishedProductTestingSpace/美食网格箱子.box",
  exists: true,
  valid: true,
  errors: [],
  metadata: {
    chipStandardsVersion: "1.0.0",
    boxId: "b1C2d3E4f5",
    name: "美食网格箱子",
    activeLayoutType: "chips.layout.grid",
    availableLayouts: ["chips.layout.grid"],
    coverRatio: "3:4",
    tags: ["美食"],
  },
  content: {
    schemaVersion: "1.0.0",
    activeLayoutType: "chips.layout.grid",
    layoutConfigs: {
      "chips.layout.grid": {
        schemaVersion: "1.0.0",
        props: {
          columnCount: 4,
        },
      },
    },
  },
  entries: [
    {
      entryId: "food-entry-1",
      source: {
        type: "local-card",
        cardFile: "美食卡片成品/美食卡片-01-点心百宝盒.card",
      },
      title: "点心百宝盒",
      tags: ["点心"],
    },
  ],
  assets: ["assets/layouts/grid/background.webp"],
};

const openViewResult = {
  sessionId: "box-view-session-1",
  box: {
    boxId: "b1C2d3E4f5",
    boxFile: inspection.path,
    name: "美食网格箱子",
    activeLayoutType: "chips.layout.grid",
    availableLayouts: ["chips.layout.grid"],
    coverRatio: "3:4",
    capabilities: {
      listEntries: true,
      readEntryDetail: true,
      renderEntryCover: true,
      renderEntryDocument: true,
      releaseEntryDocument: true,
      resolveEntryResource: true,
      readBoxAsset: true,
      prefetchEntries: true,
      openEntry: true,
    },
  },
  initialView: {
    items: inspection.entries,
    total: 1,
  },
};

describe("Document window SDK contract", () => {
  const calls: Array<{ action: string; payload: unknown }> = [];

  beforeEach(() => {
    calls.length = 0;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  function createDocumentClient() {
    return createClient({
      environment: "node",
      transport: async (action, payload) => {
        calls.push({ action, payload });

        if (action === "card.render") {
          return {
            view: {
              documentUrl: "chips-render://card-session/index.html",
              sessionId: "card-render-session-1",
              title: "集大成者",
            },
          };
        }
        if (action === "card.releaseRenderSession") {
          return { ack: true };
        }
        if (action === "box.inspect") {
          return { inspection };
        }
        if (action === "box.readLayoutDescriptor") {
          return {
            descriptor: {
              layoutType: "chips.layout.grid",
              pluginId: "com.chips.layout.grid",
              displayName: "Grid",
              defaultConfig: {
                schemaVersion: "1.0.0",
                props: {
                  columnCount: 3,
                },
              },
            },
          };
        }
        if (action === "box.normalizeLayoutConfig") {
          return {
            config: {
              schemaVersion: "1.0.0",
              props: {
                columnCount: 4,
              },
            },
          };
        }
        if (action === "box.getLayoutInitialQuery") {
          return {
            query: {
              limit: 24,
            },
          };
        }
        if (action === "box.openView") {
          return openViewResult;
        }
        if (action === "box.renderLayoutFrame") {
          return {
            view: {
              documentUrl: "chips-render://box-render-session/index.html",
              sessionId: "box-render-session-1",
              title: "美食网格箱子",
            },
          };
        }
        if (action === "box.listEntries") {
          return { page: openViewResult.initialView };
        }
        if (action === "box.readEntryDetail") {
          return {
            items: [
              {
                entryId: "food-entry-1",
                detail: {
                  status: { state: "ready" },
                },
              },
            ],
          };
        }
        if (action === "box.renderEntryCover") {
          return {
            view: {
              title: "点心百宝盒",
              coverUrl: "chips-render://box-entry-cover/food-entry-1.html",
              mimeType: "text/html",
              ratio: "3:4",
            },
          };
        }
        if (action === "box.renderEntryDocument") {
          return {
            view: {
              entryId: "food-entry-1",
              documentType: "card",
              title: "点心百宝盒",
              documentUrl: "chips-render://card-entry-session/index.html",
              renderSessionId: "card-entry-session-1",
            },
          };
        }
        if (action === "box.resolveEntryResource" || action === "box.readBoxAsset") {
          return {
            resource: {
              resourceUrl: "chips-render://box-resource/asset.webp",
              mimeType: "image/webp",
              cacheKey: "asset",
            },
          };
        }
        if (action === "box.prefetchEntries") {
          return { ack: true };
        }
        if (action === "box.openEntry") {
          return {
            result: {
              mode: "document-window",
              documentType: "card",
              windowId: "card-window-1",
            },
          };
        }
        if (
          action === "box.releaseRenderSession"
          || action === "box.releaseEntryDocument"
          || action === "box.closeView"
        ) {
          return { ack: true };
        }

        throw { code: "SERVICE_NOT_FOUND", message: String(action) };
      },
    });
  }

  it("routes .card and .box files through their formal render windows and releases sessions", async () => {
    const client = createDocumentClient();

    const card = await client.document.window.render({
      filePath: "/workspace/ProductFinishedProductTestingSpace/集大成者.card",
      locale: "zh-CN",
      mode: "view",
    });
    const box = await client.document.window.render({
      filePath: inspection.path,
      locale: "zh-CN",
      themeId: "chips.default.dark",
    });

    expect(card.documentType).toBe("card");
    expect(card.frame.src).toBe("chips-render://card-session/index.html");
    expect(card.frame.dataset.chipsDocumentType).toBe("card");
    expect(box.documentType).toBe("box");
    expect(box.frame.src).toBe("chips-render://box-render-session/index.html");
    expect(box.frame.dataset.chipsDocumentType).toBe("box");
    expect(calls.map((call) => call.action)).toEqual([
      "card.render",
      "box.inspect",
      "box.readLayoutDescriptor",
      "box.normalizeLayoutConfig",
      "box.getLayoutInitialQuery",
      "box.openView",
      "box.renderLayoutFrame",
    ]);
    expect(calls.find((call) => call.action === "box.renderLayoutFrame")?.payload).toMatchObject({
      layoutType: "chips.layout.grid",
      sessionId: "box-view-session-1",
      locale: "zh-CN",
      themeId: "chips.default.dark",
    });

    await card.dispose();
    await box.dispose();

    expect(calls).toEqual(
      expect.arrayContaining([
        {
          action: "card.releaseRenderSession",
          payload: { sessionId: "card-render-session-1" },
        },
        {
          action: "box.releaseRenderSession",
          payload: { sessionId: "box-render-session-1" },
        },
        {
          action: "box.closeView",
          payload: { sessionId: "box-view-session-1" },
        },
      ]),
    );
  });

  it("bridges box layout ready/error/runtime requests through SDK without application-side plugin loading", async () => {
    const client = createDocumentClient();
    const result = await client.document.window.render({ filePath: inspection.path });
    const ready = vi.fn();
    const error = vi.fn();

    client.document.window.onReady(result.frame, ready);
    client.document.window.onError(result.frame, error);
    document.body.appendChild(result.frame);

    const contentWindow = result.frame.contentWindow;
    expect(contentWindow).toBeTruthy();

    window.dispatchEvent(new MessageEvent("message", {
      source: contentWindow,
      origin: "null",
      data: {
        type: "chips.box-layout:ready",
        payload: {
          sessionId: "box-view-session-1",
          layoutType: "chips.layout.grid",
          pluginId: "com.chips.layout.grid",
        },
      },
    }));
    expect(ready).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new MessageEvent("message", {
      source: contentWindow,
      origin: "null",
      data: {
        type: "chips.box-layout:runtime-request",
        payload: {
          requestId: "open-entry-1",
          action: "openEntry",
          entryId: "food-entry-1",
        },
      },
    }));
    await Promise.resolve();

    expect(calls).toEqual(
      expect.arrayContaining([
        {
          action: "box.openEntry",
          payload: {
            sessionId: "box-view-session-1",
            entryId: "food-entry-1",
          },
        },
      ]),
    );

    window.dispatchEvent(new MessageEvent("message", {
      source: contentWindow,
      origin: "null",
      data: {
        type: "chips.box-layout:runtime-request",
        payload: {
          requestId: "render-entry-document-1",
          action: "renderEntryDocument",
          sessionId: "untrusted-other-session",
          entryId: "food-entry-1",
          options: {
            mode: "preview",
            interactionPolicy: "delegate",
          },
        },
      },
    }));
    await Promise.resolve();

    expect(calls).toEqual(
      expect.arrayContaining([
        {
          action: "box.renderEntryDocument",
          payload: {
            sessionId: "box-view-session-1",
            entryId: "food-entry-1",
            options: {
              mode: "preview",
              interactionPolicy: "delegate",
              locale: undefined,
              themeId: undefined,
            },
          },
        },
      ]),
    );

    window.dispatchEvent(new MessageEvent("message", {
      source: contentWindow,
      origin: "null",
      data: {
        type: "chips.box-layout:runtime-request",
        payload: {
          requestId: "release-entry-document-1",
          action: "releaseEntryDocument",
          renderSessionId: "card-entry-session-1",
        },
      },
    }));
    await Promise.resolve();

    expect(calls).toEqual(
      expect.arrayContaining([
        {
          action: "box.releaseEntryDocument",
          payload: {
            sessionId: "box-view-session-1",
            renderSessionId: "card-entry-session-1",
          },
        },
      ]),
    );

    window.dispatchEvent(new MessageEvent("message", {
      source: contentWindow,
      origin: "null",
      data: {
        type: "chips.box-layout:error",
        payload: {
          sessionId: "box-view-session-1",
          layoutType: "chips.layout.grid",
          pluginId: "com.chips.layout.grid",
          code: "BOX_LAYOUT_RENDER_FAILED",
          message: "Layout plugin failed.",
        },
      },
    }));

    expect(error).toHaveBeenCalledWith({
      code: "BOX_LAYOUT_RENDER_FAILED",
      message: "Layout plugin failed.",
      details: expect.objectContaining({
        code: "BOX_LAYOUT_RENDER_FAILED",
        message: "Layout plugin failed.",
      }),
      retryable: false,
      documentType: "box",
    });

    await result.dispose();
  });

  it("exposes composite node-error through the unified document window API", async () => {
    const client = createDocumentClient();
    const result = await client.document.window.render({
      filePath: "/workspace/ProductFinishedProductTestingSpace/集大成者.card",
    });
    const nodeError = vi.fn();

    client.document.window.onNodeError(result.frame, nodeError);

    window.dispatchEvent(new MessageEvent("message", {
      source: result.frame.contentWindow,
      origin: "null",
      data: {
        type: "chips.composite:node-error",
        payload: {
          nodeId: "node-missing-plugin",
          code: "BASECARD_PLUGIN_MISSING",
          message: "Base card plugin is missing.",
          stage: "render-commit",
        },
      },
    }));

    expect(nodeError).toHaveBeenCalledWith({
      documentType: "card",
      nodeId: "node-missing-plugin",
      code: "BASECARD_PLUGIN_MISSING",
      message: "Base card plugin is missing.",
      stage: "render-commit",
    });

    await result.dispose();
  });

  it("exposes card and box resize events through the unified document window API", async () => {
    const client = createDocumentClient();
    const card = await client.document.window.render({
      filePath: "/workspace/ProductFinishedProductTestingSpace/集大成者.card",
    });
    const box = await client.document.window.render({ filePath: inspection.path });
    const cardResize = vi.fn();
    const boxResize = vi.fn();

    const cleanupCardResize = client.document.window.onResize(card.frame, cardResize);

    window.dispatchEvent(new MessageEvent("message", {
      source: card.frame.contentWindow,
      origin: "null",
      data: {
        type: "chips.composite:resize",
        payload: {
          height: 421.4,
          nodeCount: 3,
          reason: "node-height",
        },
      },
    }));
    cleanupCardResize();

    const cleanupBoxResize = client.document.window.onResize(box.frame, boxResize);
    window.dispatchEvent(new MessageEvent("message", {
      source: box.frame.contentWindow,
      origin: "null",
      data: {
        type: "chips.box-layout:resize",
        payload: {
          height: 612.2,
          reason: "layout-ready",
          layoutType: "chips.layout.grid",
          pluginId: "com.chips.layout.grid",
          sessionId: "box-view-session-1",
        },
      },
    }));
    cleanupBoxResize();
    window.dispatchEvent(new MessageEvent("message", {
      source: box.frame.contentWindow,
      origin: "null",
      data: {
        type: "chips.box-layout:resize",
        payload: {
          height: 0,
          reason: "invalid",
        },
      },
    }));

    expect(cardResize).toHaveBeenCalledTimes(1);
    expect(cardResize).toHaveBeenCalledWith({
      documentType: "card",
      height: 422,
      nodeCount: 3,
      reason: "node-height",
    });
    expect(boxResize).toHaveBeenCalledTimes(1);
    expect(boxResize).toHaveBeenCalledWith({
      documentType: "box",
      height: 613,
      reason: "layout-ready",
      layoutType: "chips.layout.grid",
      pluginId: "com.chips.layout.grid",
      sessionId: "box-view-session-1",
    });

    await card.dispose();
    await box.dispose();
  });
});
