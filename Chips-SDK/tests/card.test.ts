import { describe, it, expect, vi } from "vitest";
import { createCardApi } from "../src/api/card";
import type { CoreClient } from "../src/types/client";
import { createError } from "../src/types/errors";

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

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

  it("rejects invalid compositeWindow interactionPolicy", async () => {
    const api = createCardApi(
      createStubClient(async () => {
        throw new Error("should not be called");
      }),
    );

    await expect(
      // @ts-expect-error intentional invalid interactionPolicy for runtime check
      api.compositeWindow.render({ cardFile: "/test.card", interactionPolicy: "invalid" }),
    ).rejects.toMatchObject<ReturnType<typeof createError>>({
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

  it("passes interactionPolicy into card.render options for compositeWindow.render", async () => {
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

      await api.compositeWindow.render({
        cardFile: "/test.card",
        mode: "preview",
        interactionPolicy: "delegate",
      });

      const payload = calls[0]?.payload as {
        cardFile: string;
        options?: { mode?: string; target?: string; interactionPolicy?: string };
      };
      expect(payload.options?.interactionPolicy).toBe("delegate");
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });

  it("renders coverFrame using card.renderCover and returns a sandboxed iframe url", async () => {
    const calls: Array<{ action: string; payload: any }> = [];

    const api = createCardApi(
      createStubClient(async (action, payload) => {
        calls.push({ action, payload });
        return {
          view: {
            title: "Cover Title",
            coverUrl: "file:///workspace/.card/cover.html",
            ratio: "3:4",
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
      expect(calls[0]?.action).toBe("card.renderCover");
      const payload = calls[0]?.payload as { cardFile: string };
      expect(payload.cardFile).toBe("/cover.card");

      expect(result.origin).toBe("null");
      expect(created.length).toBe(1);
      const frame = created[0];
      expect(frame.tagName).toBe("IFRAME");
      expect(frame.attrs.sandbox).toBe("allow-scripts allow-same-origin");
      expect(frame.attrs.loading).toBe("lazy");
      expect(frame.title).toBe("My Card");
      expect(frame.src).toBe("file:///workspace/.card/cover.html");
      expect(frame.srcdoc).toBeUndefined();
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });

  it("passes card editor options into card.renderEditor for editorPanel.render", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];

    const api = createCardApi(
      createStubClient(async (action, payload) => {
        calls.push({ action, payload });
        return {
          view: {
            title: "富文本基础卡片 Editor",
            body: "<div>editor</div>",
            cardType: "base.richtext",
            pluginId: "chips.basecard.richtext",
            baseCardId: "base-1",
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

      const result = await api.editorPanel.render({
        cardType: "base.richtext",
        baseCardId: "base-1",
        initialConfig: {
          title: "Hello",
          body: "<p>World</p>",
        },
      });

      expect(calls.length).toBe(1);
      expect(calls[0]?.action).toBe("card.renderEditor");
      expect(calls[0]?.payload).toEqual({
        cardType: "base.richtext",
        baseCardId: "base-1",
        initialConfig: {
          title: "Hello",
          body: "<p>World</p>",
        },
      });
      expect(result.origin).toBe("https://example.test");
      expect(created[0]?.attrs?.sandbox).toBe("allow-scripts allow-forms allow-same-origin");
      expect(created[0]?.title).toBe("富文本基础卡片 Editor");
      expect(created[0]?.srcdoc).toBe("<div>editor</div>");
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });

  it("keeps editor resource bridge out of the card.renderEditor route payload", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];

    const api = createCardApi(
      createStubClient(async (action, payload) => {
        calls.push({ action, payload });
        return {
          view: {
            title: "base.image Editor",
            body: "<div>editor</div>",
            cardType: "base.image",
            pluginId: "chips.basecard.image",
            baseCardId: "image-1",
          },
        } as any;
      }),
    );

    const previousWindow = (globalThis as any).window;
    const previousDocument = (globalThis as any).document;
    try {
      (globalThis as any).window = {
        location: { origin: "https://example.test" },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      (globalThis as any).document = {
        createElement: (tag: string) => ({
          tagName: tag.toUpperCase(),
          attrs: {} as Record<string, string>,
          setAttribute(name: string, value: string) {
            this.attrs[name] = value;
          },
        }),
      };
      const resources = {
        rootPath: "/workspace/cards/demo",
        resolveResourceUrl: vi.fn(),
        importResource: vi.fn(),
        deleteResource: vi.fn(),
        releaseResourceUrl: vi.fn(),
      };

      await api.editorPanel.render({
        cardType: "base.image",
        baseCardId: "image-1",
        initialConfig: {
          src: "images/demo.png",
        },
        cardRootDir: "/workspace/cards/demo",
        resources,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.action).toBe("card.renderEditor");
      expect(calls[0]?.payload).toEqual({
        cardType: "base.image",
        baseCardId: "image-1",
        cardRootDir: "/workspace/cards/demo",
        initialConfig: {
          src: "images/demo.png",
        },
      });
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });

  it("bridges editor resource requests through the SDK resource handlers", async () => {
    const api = createCardApi(
      createStubClient(async () => ({
        view: {
          title: "base.image Editor",
          body: "<div>editor</div>",
          cardType: "base.image",
          pluginId: "chips.basecard.image",
          baseCardId: "image-1",
        },
      }) as any),
    );

    const previousWindow = (globalThis as any).window;
    const previousDocument = (globalThis as any).document;

    try {
      const listeners: Array<(event: MessageEvent) => void> = [];
      const postMessage = vi.fn();
      let createdFrame: HTMLIFrameElement | undefined;

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
        createElement: (tag: string) => {
          const el: any = {
            tagName: tag.toUpperCase(),
            attrs: {} as Record<string, string>,
            contentWindow: { postMessage },
            isConnected: true,
            setAttribute(name: string, value: string) {
              this.attrs[name] = value;
            },
          };
          createdFrame = el as HTMLIFrameElement;
          return el;
        },
      };

      const resolveResourceUrl = vi.fn(async (resourcePath: string) => `blob:https://example.test/${resourcePath}`);
      const importResource = vi.fn(async ({ file, preferredPath }: { file: File; preferredPath?: string }) => ({
        path: preferredPath ?? file.name,
      }));
      const deleteResource = vi.fn(async () => undefined);
      const releaseResourceUrl = vi.fn();

      await api.editorPanel.render({
        cardType: "base.image",
        resources: {
          resolveResourceUrl,
          importResource,
          deleteResource,
          releaseResourceUrl,
        },
      });

      expect(createdFrame).toBeTruthy();
      expect(listeners).toHaveLength(1);

      const dispatch = (data: unknown) => {
        listeners[0]?.({
          source: createdFrame?.contentWindow,
          origin: "https://example.test",
          data,
        } as MessageEvent);
      };

      dispatch({
        type: "chips.card-editor:resource-request",
        payload: {
          requestId: "req-resolve",
          action: "resolve",
          resourcePath: "assets/demo.png",
        },
      });
      await flushMicrotasks();
      expect(resolveResourceUrl).toHaveBeenCalledWith("assets/demo.png");
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: "chips.card-editor:resource-response",
          payload: {
            requestId: "req-resolve",
            ok: true,
            result: "blob:https://example.test/assets/demo.png",
          },
        },
        "*",
      );

      const file = new File(["hello"], "photo.png", { type: "image/png" });
      dispatch({
        type: "chips.card-editor:resource-request",
        payload: {
          requestId: "req-import",
          action: "import",
          preferredPath: "assets/photo.png",
          file,
        },
      });
      await flushMicrotasks();
      expect(importResource).toHaveBeenCalledWith({
        file,
        preferredPath: "assets/photo.png",
      });

      dispatch({
        type: "chips.card-editor:resource-request",
        payload: {
          requestId: "req-delete",
          action: "delete",
          resourcePath: "./assets/photo.png",
        },
      });
      await flushMicrotasks();
      expect(deleteResource).toHaveBeenCalledWith("assets/photo.png");

      dispatch({
        type: "chips.card-editor:resource-release",
        payload: {
          resourcePath: "./assets/photo.png",
        },
      });
      await flushMicrotasks();
      expect(releaseResourceUrl).toHaveBeenCalledWith("assets/photo.png");
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
  });

  it("falls back to rootPath for editor resource resolves when no custom resolver is provided", async () => {
    const api = createCardApi(
      createStubClient(async () => ({
        view: {
          title: "base.image Editor",
          body: "<div>editor</div>",
          cardType: "base.image",
          pluginId: "chips.basecard.image",
          baseCardId: "image-1",
        },
      }) as any),
    );

    const previousWindow = (globalThis as any).window;
    const previousDocument = (globalThis as any).document;

    try {
      const listeners: Array<(event: MessageEvent) => void> = [];
      const postMessage = vi.fn();
      let createdFrame: HTMLIFrameElement | undefined;

      (globalThis as any).window = {
        location: { origin: "https://example.test", href: "https://example.test/app" },
        addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
          if (type === "message") {
            listeners.push(listener);
          }
        },
        removeEventListener: () => {},
      };

      (globalThis as any).document = {
        createElement: (tag: string) => {
          const el: any = {
            tagName: tag.toUpperCase(),
            attrs: {} as Record<string, string>,
            contentWindow: { postMessage },
            isConnected: true,
            setAttribute(name: string, value: string) {
              this.attrs[name] = value;
            },
          };
          createdFrame = el as HTMLIFrameElement;
          return el;
        },
      };

      await api.editorPanel.render({
        cardType: "base.image",
        resources: {
          rootPath: "/workspace/card-root",
        },
      });

      listeners[0]?.({
        source: createdFrame?.contentWindow,
        origin: "https://example.test",
        data: {
          type: "chips.card-editor:resource-request",
          payload: {
            requestId: "req-root-path",
            action: "resolve",
            resourcePath: "assets/demo.png",
          },
        },
      } as MessageEvent);

      await flushMicrotasks();

      expect(postMessage).toHaveBeenCalledWith(
        {
          type: "chips.card-editor:resource-response",
          payload: {
            requestId: "req-root-path",
            ok: true,
            result: "file:///workspace/card-root/assets/demo.png",
          },
        },
        "*",
      );
    } finally {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    }
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
      let resizePayload: unknown = null;
      let interactionPayload: unknown = null;
      let nodeSelectPayload: unknown = null;
      let nodeErrorPayload: unknown = null;
      let fatalErrorPayload: unknown = null;

      api.compositeWindow.onReady(frame, () => {
        readyCount += 1;
      });

      api.compositeWindow.onResize(frame, (payload) => {
        resizePayload = payload;
      });

      api.compositeWindow.onInteraction(frame, (payload) => {
        interactionPayload = payload;
      });

      api.compositeWindow.onNodeError(frame, (payload) => {
        nodeErrorPayload = payload;
      });

      api.compositeWindow.onNodeSelect(frame, (payload) => {
        nodeSelectPayload = payload;
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

      const resize = {
        type: "chips.composite:resize",
        payload: {
          height: 720,
          nodeCount: 2,
          reason: "node-height",
        },
      };
      dispatch(resize);
      expect(resizePayload).toEqual(resize.payload);

      const interaction = {
        type: "chips.composite:interaction",
        payload: {
          cardId: "card-1",
          nodeId: "n1",
          cardType: "base.richtext",
          source: "basecard-frame",
          device: "wheel",
          intent: "scroll",
          deltaX: 10,
          deltaY: 24,
          clientX: 160,
          clientY: 240,
          pointerCount: 1,
        },
      };
      dispatch(interaction);
      expect(interactionPayload).toEqual(interaction.payload);

      const nodeSelect = {
        type: "chips.composite:node-select",
        payload: {
          nodeId: "n1",
          cardType: "base.richtext",
          pluginId: "chips.basecard.richtext",
          state: "ready",
          source: "pointer",
        },
      };
      dispatch(nodeSelect);
      expect(nodeSelectPayload).toEqual(nodeSelect.payload);

      // node-error payload
      const nodeError = { type: "chips.composite:node-error", payload: { nodeId: "n1", code: "E", message: "m" } };
      dispatch(nodeError);
      expect(nodeErrorPayload).toEqual(nodeError.payload);

      // sandboxed blob iframes use opaque origin and must still be accepted
      const nullOriginNodeSelect = {
        type: "chips.composite:node-select",
        payload: {
          nodeId: "n2",
          cardType: "base.richtext",
          source: "basecard",
        },
      };
      dispatch(nullOriginNodeSelect, "null");
      expect(nodeSelectPayload).toEqual(nullOriginNodeSelect.payload);

      const nullOriginNodeError = { type: "chips.composite:node-error", payload: { nodeId: "n2", code: "NULL", message: "opaque origin" } };
      dispatch(nullOriginNodeError, "null");
      expect(nodeErrorPayload).toEqual(nullOriginNodeError.payload);

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

  it("basecard events resolve iframe contentWindow lazily after the frame is mounted", () => {
    const api = createCardApi(
      createStubClient(async () => {
        throw new Error("should not be called");
      }),
    );

    const previousWindow = (globalThis as any).window;

    try {
      const listeners: Array<(event: MessageEvent) => void> = [];
      let contentWindow: Record<string, unknown> | null = null;

      (globalThis as any).window = {
        location: { origin: "https://example.test" },
        addEventListener: (type: string, listener: (event: MessageEvent) => void) => {
          if (type === "message") {
            listeners.push(listener);
          }
        },
        removeEventListener: () => {},
      };

      const frame = {
        get contentWindow() {
          return contentWindow;
        },
      } as unknown as HTMLIFrameElement;

      let receivedPayload: unknown = null;
      api.basecard.onChange(frame, (payload) => {
        receivedPayload = payload;
      });

      contentWindow = {};
      for (const listener of listeners) {
        listener({
          source: contentWindow,
          origin: "null",
          data: {
            type: "chips.basecard:change",
            payload: {
              baseCardId: "base-1",
              cardType: "base.richtext",
              pluginId: "chips.basecard.richtext",
              normalizedConfig: { id: "base-1", body: "<p>updated</p>" },
              validation: { valid: true, issues: [] },
              referencedResources: [],
            },
          },
        } as MessageEvent);
      }

      expect(receivedPayload).toEqual({
        baseCardId: "base-1",
        cardType: "base.richtext",
        pluginId: "chips.basecard.richtext",
        normalizedConfig: { id: "base-1", body: "<p>updated</p>" },
        validation: { valid: true, issues: [] },
        referencedResources: [],
      });
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

  it("editorPanel events respect origin and type filters", () => {
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
      let changePayload: unknown = null;
      let errorPayload: unknown = null;

      api.editorPanel.onReady(frame, () => {
        readyCount += 1;
      });
      api.editorPanel.onChange(frame, (payload) => {
        changePayload = payload;
      });
      api.editorPanel.onError(frame, (payload) => {
        errorPayload = payload;
      });

      const dispatch = (data: any, origin = "https://example.test", source: unknown = contentWindow) => {
        for (const listener of listeners) {
          listener({
            source,
            origin,
            data,
          } as MessageEvent);
        }
      };

      dispatch({ type: "chips.card-editor:ready" }, "https://ignored.test");
      dispatch({ type: "chips.card-editor:change", payload: { ignored: true } }, "https://example.test", {});
      dispatch({ type: "chips.card-editor:unknown", payload: { ignored: true } });

      dispatch({ type: "chips.card-editor:ready", payload: { pluginId: "chips.basecard.richtext" } });
      dispatch({
        type: "chips.card-editor:change",
        payload: {
          cardType: "base.richtext",
          pluginId: "chips.basecard.richtext",
          baseCardId: "base-1",
          config: { title: "Updated" },
        },
      });
      dispatch({
        type: "chips.card-editor:error",
        payload: {
          cardType: "base.richtext",
          pluginId: "chips.basecard.richtext",
          baseCardId: "base-1",
          code: "CARD_EDITOR_RENDER_FAILED",
          message: "failed",
        },
      });
      dispatch({ type: "chips.card-editor:ready", payload: { pluginId: "chips.basecard.richtext" } }, "null");

      expect(readyCount).toBe(2);
      expect(changePayload).toEqual({
        cardType: "base.richtext",
        pluginId: "chips.basecard.richtext",
        baseCardId: "base-1",
        config: { title: "Updated" },
      });
      expect(errorPayload).toEqual({
        cardType: "base.richtext",
        pluginId: "chips.basecard.richtext",
        baseCardId: "base-1",
        code: "CARD_EDITOR_RENDER_FAILED",
        message: "failed",
      });
    } finally {
      (globalThis as any).window = previousWindow;
    }
  });

  it("basecard onReady falls back to iframe load event", async () => {
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
      api.basecard.onReady(frame, () => {
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
});
