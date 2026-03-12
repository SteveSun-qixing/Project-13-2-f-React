import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export interface CardDocument {
  // 这里使用宽松类型，具体结构由 Host 侧 schema 控制
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string; code?: string }>;
}

export interface RenderViewport {
  width?: number;
  height?: number;
  scrollTop?: number;
  scrollLeft?: number;
}

export type RenderTarget = "app-root" | "card-iframe" | "module-slot" | "offscreen-render";

export interface CardRenderOptions {
  target?: RenderTarget;
  viewport?: RenderViewport;
  verifyConsistency?: boolean;
  /**
   * 仅在复合卡片窗口场景下使用的渲染模式。
   * - view：正常查看模式；
   * - preview：预览模式（例如编辑器右侧预览）。
   *
   * 普通 `card.render` 调用可以忽略该字段。
   */
  mode?: CompositeMode;
}

export interface RenderNodeDiagnostic {
  nodeId: string;
  stage:
    | "node-normalize"
    | "contract-validate"
    | "theme-resolve"
    | "layout-compute"
    | "render-commit"
    | "effect-dispatch";
  code: string;
  message: string;
  details?: unknown;
}

export interface RenderConsistencyResult {
  consistent: boolean;
  hashByTarget: Record<string, string>;
  mismatches: string[];
}

export interface CardRenderView {
  title: string;
  body: string;
  contentFiles: string[];
  target: string;
  semanticHash: string;
  diagnostics?: RenderNodeDiagnostic[];
  consistency?: RenderConsistencyResult;
}

export interface CardRenderResult {
  view: CardRenderView;
}

export interface FrameRenderResult {
  frame: HTMLIFrameElement;
  origin: string;
}

export interface BaseCardRecord {
  nodeId: string;
  cardType: string;
  pluginId: string;
  title: string;
  contentPath: string;
  config: Record<string, unknown>;
}

export interface BaseCardEditorRenderResult extends FrameRenderResult {
  protocolVersion: string;
  baseCard: BaseCardRecord;
}

export type CompositeMode = "view" | "preview";

export interface CompositeNodeError {
  nodeId: string;
  code: string;
  message: string;
  stage?: string;
  details?: unknown;
}

export interface CompositeNodeSelection {
  nodeId: string;
  cardType: string;
  pluginId?: string;
  title?: string;
  trigger?: string;
}

export interface BaseCardEditorConfigChange {
  nodeId: string;
  cardType: string;
  pluginId: string;
  config: Record<string, unknown>;
}

export interface BaseCardEditorReadyPayload {
  nodeId: string;
  cardType: string;
  pluginId: string;
  protocolVersion: string;
}

export interface BaseCardEditorConfigSyncedPayload {
  nodeId: string;
  config: Record<string, unknown>;
}

export interface CardApi {
  parse(cardFile: string): Promise<CardDocument>;
  validate(cardFile: string): Promise<ValidationResult>;
  getBaseCard(cardFile: string, nodeId: string): Promise<BaseCardRecord>;
  updateBaseCard(cardFile: string, nodeId: string, config: Record<string, unknown>): Promise<BaseCardRecord>;
  render(cardFile: string, options?: CardRenderOptions): Promise<CardRenderResult>;
  coverFrame: {
    render(options: { cardFile: string; cardName?: string }): Promise<FrameRenderResult>;
  };
  compositeWindow: {
    render(options: { cardFile: string; mode?: CompositeMode }): Promise<FrameRenderResult>;
    onReady(frame: HTMLIFrameElement, handler: () => void): () => void;
    onNodeSelect(frame: HTMLIFrameElement, handler: (payload: CompositeNodeSelection) => void): () => void;
    onNodeError(
      frame: HTMLIFrameElement,
      handler: (payload: CompositeNodeError) => void,
    ): () => void;
    onFatalError(frame: HTMLIFrameElement, handler: (error: import("../types/errors").StandardError) => void): () => void;
  };
  baseCardEditor: {
    render(options: { cardFile: string; nodeId: string; title?: string }): Promise<BaseCardEditorRenderResult>;
    onReady(frame: HTMLIFrameElement, handler: (payload: BaseCardEditorReadyPayload) => void): () => void;
    onConfigChange(frame: HTMLIFrameElement, handler: (payload: BaseCardEditorConfigChange) => void): () => void;
    onConfigSynced(frame: HTMLIFrameElement, handler: (payload: BaseCardEditorConfigSyncedPayload) => void): () => void;
    onFatalError(frame: HTMLIFrameElement, handler: (error: import("../types/errors").StandardError) => void): () => void;
    syncConfig(frame: HTMLIFrameElement, config: Record<string, unknown>): void;
  };
}

export function createCardApi(client: CoreClient): CardApi {
  return {
    async parse(cardFile) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.parse: cardFile is required.");
      }
      return client.invoke("card.parse", { cardFile });
    },
    async validate(cardFile) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.validate: cardFile is required.");
      }
      return client.invoke("card.validate", { cardFile });
    },
    async getBaseCard(cardFile, nodeId) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.getBaseCard: cardFile is required.");
      }
      if (!nodeId) {
        throw createError("INVALID_ARGUMENT", "card.getBaseCard: nodeId is required.");
      }
      const { baseCard } = await client.invoke<
        { cardFile: string; nodeId: string },
        { baseCard: BaseCardRecord }
      >("card.getBaseCard", { cardFile, nodeId });
      return baseCard;
    },
    async updateBaseCard(cardFile, nodeId, config) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.updateBaseCard: cardFile is required.");
      }
      if (!nodeId) {
        throw createError("INVALID_ARGUMENT", "card.updateBaseCard: nodeId is required.");
      }
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw createError("INVALID_ARGUMENT", "card.updateBaseCard: config must be an object.");
      }
      const { baseCard } = await client.invoke<
        { cardFile: string; nodeId: string; config: Record<string, unknown> },
        { baseCard: BaseCardRecord }
      >("card.updateBaseCard", { cardFile, nodeId, config });
      return baseCard;
    },
    async render(cardFile, options) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.render: cardFile is required.");
      }
      return client.invoke("card.render", { cardFile, options });
    },
    coverFrame: {
      async render({ cardFile, cardName }) {
        if (!cardFile) {
          throw createError("INVALID_ARGUMENT", "card.coverFrame.render: cardFile is required.");
        }

        const { view } = await client.invoke<{ cardFile: string; options?: CardRenderOptions }, CardRenderResult>(
          "card.render",
          {
            cardFile,
            options: {
              target: "card-iframe",
            },
          },
        );

        return createFrameRenderResult(view.body, cardName ?? view.title ?? "Card Cover");
      },
    },
    compositeWindow: {
      async render({ cardFile, mode = "view" }) {
        if (!cardFile) {
          throw createError(
            "INVALID_ARGUMENT",
            "card.compositeWindow.render: cardFile is required.",
          );
        }
        if (mode !== "view" && mode !== "preview") {
          throw createError(
            "INVALID_ARGUMENT",
            "card.compositeWindow.render: mode must be 'view' or 'preview'.",
          );
        }

        const { view } = await client.invoke<{ cardFile: string; options: CardRenderOptions }, CardRenderResult>(
          "card.render",
          {
            cardFile,
            options: {
              target: "card-iframe",
              mode,
            },
          },
        );

        return createFrameRenderResult(view.body, view.title ?? "Card");
      },
      onReady(frame, handler) {
        return subscribeToCompositeReady(frame, handler);
      },
      onNodeSelect(frame, handler) {
        return subscribeToCompositeEvent<CompositeNodeSelection>(
          frame,
          "chips.composite:node-select",
          handler,
        );
      },
      onNodeError(frame, handler) {
        return subscribeToCompositeEvent<CompositeNodeError>(
          frame,
          "chips.composite:node-error",
          handler,
        );
      },
      onFatalError(frame, handler) {
        return subscribeToCompositeEvent(
          frame,
          "chips.composite:fatal-error",
          (payload: unknown) => {
            const err = normalizeCompositeError(payload);
            handler(err);
          },
        );
      },
    },
    baseCardEditor: {
      async render({ cardFile, nodeId, title }) {
        if (!cardFile) {
          throw createError("INVALID_ARGUMENT", "card.baseCardEditor.render: cardFile is required.");
        }
        if (!nodeId) {
          throw createError("INVALID_ARGUMENT", "card.baseCardEditor.render: nodeId is required.");
        }

        const { editor } = await client.invoke<
          { cardFile: string; nodeId: string },
          {
            editor: {
              title: string;
              body: string;
              protocolVersion: string;
              baseCard: BaseCardRecord;
            };
          }
        >("card.renderBaseCardEditor", { cardFile, nodeId });

        const result = createFrameRenderResult(editor.body, title ?? editor.title ?? "Base Card Editor");
        return {
          ...result,
          protocolVersion: editor.protocolVersion,
          baseCard: editor.baseCard,
        };
      },
      onReady(frame, handler) {
        return subscribeToFrameEvent(frame, "chips.basecard-editor:ready", handler);
      },
      onConfigChange(frame, handler) {
        return subscribeToFrameEvent(frame, "chips.basecard-editor:config-change", handler);
      },
      onConfigSynced(frame, handler) {
        return subscribeToFrameEvent(frame, "chips.basecard-editor:config-synced", handler);
      },
      onFatalError(frame, handler) {
        return subscribeToFrameEvent(frame, "chips.basecard-editor:fatal-error", (payload: unknown) => {
          handler(normalizeCompositeError(payload));
        });
      },
      syncConfig(frame, config) {
        if (!config || typeof config !== "object" || Array.isArray(config)) {
          throw createError("INVALID_ARGUMENT", "card.baseCardEditor.syncConfig: config must be an object.");
        }
        frame.contentWindow?.postMessage(
          {
            type: "chips.basecard-editor:sync-config",
            payload: { config },
          },
          window.location.origin,
        );
      },
    },
  };
}

function createFrameRenderResult(body: string, title: string): FrameRenderResult {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw createError(
      "RUNTIME_ENV_UNSUPPORTED",
      "Rendering iframe documents requires a DOM environment.",
    );
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
  frame.setAttribute("loading", "lazy");
  frame.title = title;
  frame.srcdoc = body;

  return {
    frame,
    origin: window.location.origin,
  };
}

function subscribeToCompositeReady(
  frame: HTMLIFrameElement,
  handler: () => void,
): () => void {
  let settled = false;

  const invokeOnce = () => {
    if (settled) {
      return;
    }
    settled = true;
    handler();
  };

  const disposeMessage = subscribeToCompositeEvent(frame, "chips.composite:ready", () => {
    invokeOnce();
  });

  const handleLoad = () => {
    invokeOnce();
  };

  const canListenToLoad =
    typeof (frame as { addEventListener?: unknown }).addEventListener === "function" &&
    typeof (frame as { removeEventListener?: unknown }).removeEventListener === "function";

  if (canListenToLoad) {
    frame.addEventListener("load", handleLoad);
  }

  try {
    const readyState = frame.contentDocument?.readyState;
    if (readyState === "interactive" || readyState === "complete") {
      queueMicrotask(() => {
        invokeOnce();
      });
    }
  } catch {
    // ignore cross-context access errors and rely on load/message events
  }

  return () => {
    if (canListenToLoad) {
      frame.removeEventListener("load", handleLoad);
    }
    disposeMessage();
  };
}

function subscribeToFrameEvent<T = void>(
  frame: HTMLIFrameElement,
  type: string,
  handler: (payload: T) => void,
): () => void {
  if (typeof window === "undefined") {
    throw createError(
      "RUNTIME_ENV_UNSUPPORTED",
      "Frame events require a DOM environment.",
    );
  }

  const contentWindow = frame.contentWindow;
  const expectedOrigin = window.location.origin;

  const listener = (event: MessageEvent) => {
    if (!event || event.source !== contentWindow) return;
    if (event.origin !== expectedOrigin) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    const record = data as { type?: string; payload?: unknown };
    if (record.type !== type) return;
    handler(record.payload as T);
  };

  window.addEventListener("message", listener);

  return () => {
    window.removeEventListener("message", listener);
  };
}

function subscribeToCompositeEvent<T = void>(
  frame: HTMLIFrameElement,
  type: string,
  handler: (payload: T) => void,
): () => void {
  return subscribeToFrameEvent(frame, type, handler);
}

function normalizeCompositeError(payload: unknown): import("../types/errors").StandardError {
  const base = typeof payload === "object" && payload !== null ? (payload as any) : {};
  const code = typeof base.code === "string" ? base.code : "INTERNAL_ERROR";
  const message =
    typeof base.message === "string" ? base.message : "Composite window fatal error.";
  return {
    code,
    message,
    details: payload,
    retryable: false,
  };
}
