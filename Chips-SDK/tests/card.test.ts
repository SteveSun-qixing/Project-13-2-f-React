import { describe, it, expect } from "vitest";
import { createCardApi } from "../src/api/card";
import type { CoreClient } from "../src/types/client";
import { createError } from "../src/types/errors";

function createStubClient(invokeImpl: CoreClient["invoke"]): CoreClient {
  return {
    clientConfig: {},
    invoke: invokeImpl,
    events: {
      on: () => () => {},
      once: () => {},
      emit: async () => {},
    },
  };
}

describe("CardApi", () => {
  it("validates cardFile instead of card document for validate", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];
    const api = createCardApi(
      createStubClient(async (action, payload) => {
        calls.push({ action, payload });
        return { valid: true, errors: [] } as any;
      }),
    );

    await expect(api.validate("/test.card")).resolves.toEqual({ valid: true, errors: [] });
    expect(calls[0]?.action).toBe("card.validate");
    expect(calls[0]?.payload).toEqual({ cardFile: "/test.card" });
  });

  it("throws on empty cardFile for render", async () => {
    const api = createCardApi(
      createStubClient(async () => {
        throw new Error("should not be called");
      }),
    );

    await expect(api.render("", {})).rejects.toMatchObject<ReturnType<typeof createError>>({
      code: "INVALID_ARGUMENT",
    });
  });

  it("rejects invalid compositeWindow mode", async () => {
    const api = createCardApi(
      createStubClient(async () => {
        throw new Error("should not be called");
      }),
    );

    // @ts-expect-error intentional invalid mode for runtime check
    await expect(api.compositeWindow.render({ cardFile: "/test.card", mode: "edit" })).rejects.toMatchObject<
      ReturnType<typeof createError>
    >({
      code: "INVALID_ARGUMENT",
    });
  });

  it("passes mode into card.render options for compositeWindow.render", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];

    const api = createCardApi(
      createStubClient(async (action, payload) => {
        calls.push({ action, payload });
        return {
          view: {
            title: "Test Card",
            body: "<div>content</div>",
            contentFiles: [],
            target: "card-iframe",
            semanticHash: "hash",
          },
        } as any;
      }),
    );

    const previousWindow = (globalThis as any).window;
    const previousDocument = (globalThis as any).document;

    try {
      (globalThis as any).window = { location: { origin: "https://example.test" }, addEventListener: () => {}, removeEventListener: () => {} };
      (globalThis as any).document = {
        createElement: (tag: string) => ({
          tagName: tag.toUpperCase(),
          attrs: {} as Record<string, string>,
          setAttribute(name: string, value: string) {
            this.attrs[name] = value;
          },
        }),
      };

      await api.compositeWindow.render({ cardFile: "/test.card", mode: "preview" });

      expect(calls.length).toBe(1);
      expect(calls[0]?.action).toBe("card.render");
      const payload = calls[0]?.payload as { cardFile: string; options?: { mode?: string; target?: string } };
      expect(payload.cardFile).toBe("/test.card");
      expect(payload.options?.target).toBe("card-iframe");
      expect(payload.options?.mode).toBe("preview");
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });

  it("renders coverFrame using card.render and returns FrameRenderResult with origin", async () => {
    const calls: Array<{ action: string; payload: any }> = [];

    const api = createCardApi(
      createStubClient(async (action, payload) => {
        calls.push({ action, payload });
        return {
          view: {
            title: "Cover Title",
            body: "<div>cover</div>",
            contentFiles: [],
            target: "card-iframe",
            semanticHash: "hash",
          },
        } as any;
      }),
    );

    const previousWindow = (globalThis as any).window;
    const previousDocument = (globalThis as any).document;

    try {
      (globalThis as any).window = { location: { origin: "https://example.test" } };
      const created: any[] = [];
      (globalThis as any).document = {
        createElement: (tag: string) => {
          const el: any = {
            tagName: tag.toUpperCase(),
            attrs: {} as Record<string, string>,
            setAttribute(name: string, value: string) {
              this.attrs[name] = value;
            },
          };
          created.push(el);
          return el;
        },
      };

      const result = await api.coverFrame.render({ cardFile: "/cover.card", cardName: "My Card" });

      expect(calls.length).toBe(1);
      expect(calls[0]?.action).toBe("card.render");
      const payload = calls[0]?.payload as { cardFile: string; options?: { target?: string } };
      expect(payload.cardFile).toBe("/cover.card");
      expect(payload.options?.target).toBe("card-iframe");

      expect(result.origin).toBe("https://example.test");
      expect(created.length).toBe(1);
      const frame = created[0];
      expect(frame.tagName).toBe("IFRAME");
      expect(frame.attrs.sandbox).toBe("allow-same-origin allow-scripts allow-forms");
      expect(frame.attrs.loading).toBe("lazy");
      expect(frame.title).toBe("My Card");
      expect(frame.srcdoc).toBe("<div>cover</div>");
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });

  it("gets and updates a base card through formal card routes", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];
    const baseCard = {
      nodeId: "intro",
      cardType: "RichTextCard",
      pluginId: "chips.basecard.richtext",
      title: "Intro",
      contentPath: "intro.yaml",
      config: { id: "intro", title: "Intro", body: "<p>Hello</p>" },
    };

    const api = createCardApi(
      createStubClient(async (action, payload) => {
        calls.push({ action, payload });
        return { baseCard } as any;
      }),
    );

    await expect(api.getBaseCard("/demo.card", "intro")).resolves.toEqual(baseCard);
    await expect(
      api.updateBaseCard("/demo.card", "intro", { id: "intro", title: "Updated", body: "<p>Updated</p>" }),
    ).resolves.toEqual(baseCard);

    expect(calls[0]).toEqual({
      action: "card.getBaseCard",
      payload: { cardFile: "/demo.card", nodeId: "intro" },
    });
    expect(calls[1]).toEqual({
      action: "card.updateBaseCard",
      payload: {
        cardFile: "/demo.card",
        nodeId: "intro",
        config: { id: "intro", title: "Updated", body: "<p>Updated</p>" },
      },
    });
  });

  it("compositeWindow events respect origin and type filters", async () => {
    const api = createCardApi(
      createStubClient(async () => {
        throw new Error("should not be called");
      }),
    );

    const previousWindow = (globalThis as any).window;

    try {
      const listeners: Array<(event: MessageEvent) => void> = [];
      const contentWindow = {};

      (globalThis as any).window = {
        location: { origin: "https://example.test" },
        addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
          if (type === "message") {
            listeners.push(listener);
          }
        },
        removeEventListener: () => {},
      };

      const frame = { contentWindow } as unknown as HTMLIFrameElement;

      let readyCount = 0;
      let nodeSelectPayload: unknown = null;
      let nodeErrorPayload: unknown = null;
      let fatalErrorPayload: unknown = null;

      api.compositeWindow.onReady(frame, () => {
        readyCount += 1;
      });

      api.compositeWindow.onNodeSelect(frame, (payload) => {
        nodeSelectPayload = payload;
      });

      api.compositeWindow.onNodeError(frame, (payload) => {
        nodeErrorPayload = payload;
      });

      api.compositeWindow.onFatalError(frame, (error) => {
        fatalErrorPayload = error;
      });

      expect(listeners.length).toBeGreaterThan(0);
      const dispatch = (data: any, origin = "https://example.test") => {
        for (const listener of listeners) {
          listener({
            source: contentWindow,
            origin,
            data,
          } as unknown as MessageEvent);
        }
      };

      // wrong origin -> ignored
      dispatch({ type: "chips.composite:ready" }, "https://evil.test");
      expect(readyCount).toBe(0);

      // wrong type -> ignored
      dispatch({ type: "other" });
      expect(readyCount).toBe(0);

      // correct ready event
      dispatch({ type: "chips.composite:ready" });
      expect(readyCount).toBe(1);

      // node-select payload
      const nodeSelect = { type: "chips.composite:node-select", payload: { nodeId: "n1", cardType: "RichTextCard", pluginId: "chips.basecard.richtext", title: "Intro" } };
      dispatch(nodeSelect);
      expect(nodeSelectPayload).toEqual(nodeSelect.payload);

      // node-error payload
      const nodeError = { type: "chips.composite:node-error", payload: { nodeId: "n1", code: "E", message: "m" } };
      dispatch(nodeError);
      expect(nodeErrorPayload).toEqual(nodeError.payload);

      // fatal-error payload normalized to StandardError
      const rawFatal = { type: "chips.composite:fatal-error", payload: { code: "X", message: "boom" } };
      dispatch(rawFatal);
      expect((fatalErrorPayload as any).code).toBe("X");
      expect((fatalErrorPayload as any).message).toBe("boom");
      expect((fatalErrorPayload as any).retryable).toBe(false);
    } finally {
      (globalThis as any).window = previousWindow;
    }
  });

  it("compositeWindow onReady falls back to iframe load event", async () => {
    const api = createCardApi(
      createStubClient(async () => {
        throw new Error("should not be called");
      }),
    );

    const previousWindow = (globalThis as any).window;

    try {
      const listeners: Array<(event: MessageEvent) => void> = [];
      const loadListeners: Array<() => void> = [];
      const frame = {
        contentWindow: {},
        contentDocument: {
          readyState: "loading",
        },
        addEventListener: (type: string, listener: () => void) => {
          if (type === "load") {
            loadListeners.push(listener);
          }
        },
        removeEventListener: () => {},
      } as unknown as HTMLIFrameElement;

      (globalThis as any).window = {
        location: { origin: "https://example.test" },
        addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
          if (type === "message") {
            listeners.push(listener);
          }
        },
        removeEventListener: () => {},
      };

      let readyCount = 0;
      api.compositeWindow.onReady(frame, () => {
        readyCount += 1;
      });

      expect(loadListeners).toHaveLength(1);
      loadListeners[0]!();
      loadListeners[0]!();
      expect(readyCount).toBe(1);
      expect(listeners.length).toBeGreaterThan(0);
    } finally {
      (globalThis as any).window = previousWindow;
    }
  });

  it("renders baseCardEditor and wires lifecycle/config events", async () => {
    const api = createCardApi(
      createStubClient(async (action) => {
        if (action !== "card.renderBaseCardEditor") {
          throw new Error(`unexpected action: ${action}`);
        }
        return {
          editor: {
            title: "RichText Editor",
            body: "<div>editor</div>",
            protocolVersion: "1.0.0",
            baseCard: {
              nodeId: "intro",
              cardType: "RichTextCard",
              pluginId: "chips.basecard.richtext",
              title: "Intro",
              contentPath: "intro.yaml",
              config: { id: "intro", title: "Intro", body: "<p>Hello</p>" },
            },
          },
        } as any;
      }),
    );

    const previousWindow = (globalThis as any).window;
    const previousDocument = (globalThis as any).document;

    try {
      const listeners: Array<(event: MessageEvent) => void> = [];
      const posted: Array<{ message: unknown; origin: string }> = [];
      const contentWindow = {
        postMessage(message: unknown, origin: string) {
          posted.push({ message, origin });
        },
      };
      (globalThis as any).window = {
        location: { origin: "https://example.test" },
        addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
          if (type === "message") {
            listeners.push(listener);
          }
        },
        removeEventListener: () => {},
      };
      (globalThis as any).document = {
        createElement: (tag: string) => ({
          tagName: tag.toUpperCase(),
          attrs: {} as Record<string, string>,
          contentWindow,
          setAttribute(name: string, value: string) {
            this.attrs[name] = value;
          },
        }),
      };

      const rendered = await api.baseCardEditor.render({ cardFile: "/demo.card", nodeId: "intro" });
      expect(rendered.protocolVersion).toBe("1.0.0");
      expect(rendered.baseCard.nodeId).toBe("intro");
      expect((rendered.frame as any).srcdoc).toBe("<div>editor</div>");

      let readyPayload: any;
      let changePayload: any;
      let syncedPayload: any;
      let fatalPayload: any;

      api.baseCardEditor.onReady(rendered.frame, (payload) => {
        readyPayload = payload;
      });
      api.baseCardEditor.onConfigChange(rendered.frame, (payload) => {
        changePayload = payload;
      });
      api.baseCardEditor.onConfigSynced(rendered.frame, (payload) => {
        syncedPayload = payload;
      });
      api.baseCardEditor.onFatalError(rendered.frame, (payload) => {
        fatalPayload = payload;
      });

      const dispatch = (data: any, origin = "https://example.test") => {
        for (const listener of listeners) {
          listener({
            source: contentWindow,
            origin,
            data,
          } as unknown as MessageEvent);
        }
      };

      dispatch({ type: "chips.basecard-editor:ready", payload: { nodeId: "intro", cardType: "RichTextCard", pluginId: "chips.basecard.richtext", protocolVersion: "1.0.0" } });
      dispatch({ type: "chips.basecard-editor:config-change", payload: { nodeId: "intro", cardType: "RichTextCard", pluginId: "chips.basecard.richtext", config: { title: "Updated" } } });
      dispatch({ type: "chips.basecard-editor:config-synced", payload: { nodeId: "intro", config: { title: "Synced" } } });
      dispatch({ type: "chips.basecard-editor:fatal-error", payload: { code: "X", message: "boom" } });

      expect(readyPayload?.nodeId).toBe("intro");
      expect(changePayload?.config).toEqual({ title: "Updated" });
      expect(syncedPayload?.config).toEqual({ title: "Synced" });
      expect(fatalPayload?.code).toBe("X");

      api.baseCardEditor.syncConfig(rendered.frame, { title: "Remote" });
      expect(posted).toEqual([
        {
          message: {
            type: "chips.basecard-editor:sync-config",
            payload: { config: { title: "Remote" } },
          },
          origin: "https://example.test",
        },
      ]);
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });
});
