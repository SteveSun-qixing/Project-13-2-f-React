import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";
import type { ResourceOpenPayload } from "./resource";

export interface CardDocument {
  // 这里使用宽松类型，具体结构由 Host 侧 schema 控制
  [key: string]: unknown;
}

export interface CardMetadata {
  [key: string]: unknown;
}

export type CardInfoField = "status" | "metadata" | "cover";

export interface CardInfoStatus {
  state: "ready" | "missing" | "invalid";
  exists: boolean;
  valid: boolean;
  errors?: string[];
}

export interface CardInfoMetadata {
  raw: Record<string, unknown>;
  chipStandardsVersion?: string;
  cardId?: string;
  name?: string;
  createdAt?: string;
  modifiedAt?: string;
  theme?: string;
  coverRatio?: string;
  tags?: Array<string | string[]>;
}

export interface CardInfoCover {
  title: string;
  resourceUrl: string;
  mimeType: "text/html";
  ratio?: string;
}

export interface CardInfoPayload {
  status?: CardInfoStatus;
  metadata?: CardInfoMetadata;
  cover?: CardInfoCover;
}

export interface CardReadInfoResult {
  cardFile: string;
  info: CardInfoPayload;
}

export interface CardOpenResult {
  mode: "card-window";
  windowId?: string;
  pluginId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
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
  themeId?: string;
  locale?: string;
  /**
   * 仅在复合卡片窗口场景下使用的渲染模式。
   * - view：正常查看模式；
   * - preview：预览模式（例如编辑器右侧预览）。
   *
   * 普通 `card.render` 调用可以忽略该字段。
   */
  mode?: CompositeMode;
  interactionPolicy?: CompositeInteractionPolicy;
}

export interface RenderNodeDiagnostic {
  nodeId: string;
  path: string;
  stage:
    | "node-normalize"
    | "contract-validate"
    | "theme-resolve"
    | "layout-compute"
    | "render-commit"
    | "effect-dispatch";
  severity: "P0" | "P1" | "P2" | "info";
  code: string;
  message: string;
  suggestion: string;
  qualityGateBlocking: boolean;
  details?: unknown;
}

export interface RenderQualityGateResult {
  passed: boolean;
  blockingCount: number;
  highestSeverity?: "P0" | "P1" | "P2" | "info";
  blockingDiagnostics: RenderNodeDiagnostic[];
}

export interface RenderConsistencyResult {
  consistent: boolean;
  hashByTarget: Record<string, string>;
  mismatches: string[];
}

export interface CardRenderView {
  title: string;
  body: string;
  documentUrl: string;
  sessionId: string;
  contentFiles: string[];
  target: string;
  semanticHash: string;
  diagnostics?: RenderNodeDiagnostic[];
  qualityGate?: RenderQualityGateResult;
  consistency?: RenderConsistencyResult;
}

export interface CardRenderResult {
  view: CardRenderView;
}

export interface CardCoverView {
  title: string;
  coverUrl: string;
  ratio?: string;
}

export interface CardCoverRenderResult {
  view: CardCoverView;
}

export interface CardCoverFrameRenderResult extends FrameRenderResult {
  title: string;
  ratio?: string;
}

export interface CardEditorRenderOptions {
  cardType: string;
  initialConfig?: Record<string, unknown>;
  baseCardId?: string;
  resources?: CardEditorResourceBridge;
}

export interface CardEditorView {
  title: string;
  body: string;
  documentUrl: string;
  sessionId: string;
  cardType: string;
  pluginId: string;
  baseCardId?: string;
}

export interface CardEditorRenderResult {
  view: CardEditorView;
}

export interface CardEditorResourceImportRequest {
  file: File;
  preferredPath?: string;
}

export interface CardEditorResourceImportResult {
  path: string;
}

export interface CardEditorArchiveImportFilter {
  mimeTypes?: string[];
  extensions?: string[];
}

export interface CardEditorArchiveImportRequest {
  file: File;
  preferredRootDir?: string;
  entryFile?: string;
  include?: CardEditorArchiveImportFilter;
  stripSingleRootDir?: boolean;
  excludeSystemArtifacts?: boolean;
}

export interface CardEditorArchiveImportedEntry {
  sourcePath: string;
  resourcePath: string;
  fileName: string;
  mimeType?: string;
  size: number;
  compressedSize: number;
  crc32: number;
  offset: number;
  isDirectory: boolean;
  compressionMethod: number;
  modifiedTime?: number;
}

export interface CardEditorArchiveDiscardedEntry {
  sourcePath: string;
  reason: "directory" | "system-artifact" | "filter-mismatch" | "unsafe-path";
  fileName?: string;
  mimeType?: string;
}

export interface CardEditorArchiveImportResult {
  rootDir: string;
  entryFile?: string;
  resourcePaths: string[];
  entries: CardEditorArchiveImportedEntry[];
  discardedEntries: CardEditorArchiveDiscardedEntry[];
}

export interface CardEditorTiffToPngRequest {
  resourcePath: string;
  outputPath: string;
  overwrite?: boolean;
}

export interface CardEditorTiffToPngResult {
  path: string;
  mimeType: "image/png";
  sourceMimeType: "image/tiff";
  width?: number;
  height?: number;
}

export interface CardEditorVideoThumbnailRequest {
  resourcePath: string;
  outputPath: string;
  overwrite?: boolean;
  options?: {
    timeSeconds?: number;
    format?: "png" | "jpeg";
    width?: number;
    height?: number;
    fit?: "contain" | "cover";
    quality?: number;
  };
}

export interface CardEditorVideoThumbnailResult {
  path: string;
  mimeType: "image/png" | "image/jpeg";
  sourceMimeType: string;
  width: number;
  height: number;
  format: "png" | "jpeg";
  frameTimeSeconds: number;
  durationSeconds?: number;
}

export interface CardEditorResourceBridge {
  rootPath?: string;
  resolveResourceUrl?: (resourcePath: string) => Promise<string> | string;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: CardEditorResourceImportRequest,
  ) => Promise<CardEditorResourceImportResult> | CardEditorResourceImportResult;
  importArchiveBundle?: (
    input: CardEditorArchiveImportRequest,
  ) => Promise<CardEditorArchiveImportResult> | CardEditorArchiveImportResult;
  deleteResource?: (resourcePath: string) => Promise<void> | void;
  convertTiffToPng?: (
    input: CardEditorTiffToPngRequest,
  ) => Promise<CardEditorTiffToPngResult> | CardEditorTiffToPngResult;
  extractVideoThumbnail?: (
    input: CardEditorVideoThumbnailRequest,
  ) => Promise<CardEditorVideoThumbnailResult> | CardEditorVideoThumbnailResult;
}

export interface FrameRenderResult {
  frame: HTMLIFrameElement;
  origin: string;
  dispose: () => Promise<void>;
}

export type CompositeMode = "view" | "preview";
export type CompositeInteractionPolicy = "native" | "delegate";
export type CompositeInteractionIntent = "scroll" | "zoom";
export type CompositeInteractionDevice = "wheel" | "touch";
export type CompositeInteractionSource = "basecard-frame" | "composite-shell" | "degraded-node";

export interface CompositeNodeError {
  nodeId: string;
  code: string;
  message: string;
  stage?: string;
  details?: unknown;
}

export interface CompositeNodeSelectPayload {
  nodeId: string;
  cardType: string;
  pluginId?: string;
  state?: "ready" | "degraded";
  source?: string;
}

export interface CompositeResourceOpenPayload {
  nodeId: string;
  cardType: string;
  pluginId?: string;
  intent: string;
  resourceId: string;
  mimeType?: string;
  title?: string;
  fileName?: string;
  payload?: ResourceOpenPayload;
}

export type CompositeResizeReason =
  | "initial"
  | "ready"
  | "node-load"
  | "node-height"
  | "resize-observer";

export interface CompositeResizePayload {
  height: number;
  nodeCount: number;
  reason: CompositeResizeReason;
}

export interface CompositeInteractionPayload {
  cardId: string;
  nodeId?: string;
  cardType?: string;
  source: CompositeInteractionSource;
  device: CompositeInteractionDevice;
  intent: CompositeInteractionIntent;
  deltaX: number;
  deltaY: number;
  zoomDelta?: number;
  clientX: number;
  clientY: number;
  pointerCount: number;
}

export interface CardEditorChangePayload {
  baseCardId?: string;
  cardType: string;
  pluginId: string;
  config: Record<string, unknown>;
}

export interface CardEditorErrorPayload {
  baseCardId?: string;
  cardType: string;
  pluginId: string;
  code: string;
  message: string;
}

export interface CardApi {
  pack(cardDir: string, outputPath: string): Promise<string>;
  unpack(cardFile: string, outputDir: string): Promise<void>;
  readMetadata(cardFile: string): Promise<CardMetadata>;
  readInfo(cardFile: string, fields?: CardInfoField[]): Promise<CardReadInfoResult>;
  parse(cardFile: string): Promise<CardDocument>;
  validate(cardFile: string): Promise<ValidationResult>;
  resolveDocumentPath(documentUrl: string): Promise<string>;
  resolveResourceUrl(cardRootDir: string, resourcePath: string): Promise<string>;
  open(cardFile: string): Promise<CardOpenResult>;
  render(cardFile: string, options?: CardRenderOptions): Promise<CardRenderResult>;
  releaseRenderSession(sessionId: string): Promise<void>;
  coverFrame: {
    render(options: { cardFile: string }): Promise<CardCoverFrameRenderResult>;
  };
  compositeWindow: {
    render(options: {
      cardFile: string;
      mode?: CompositeMode;
      interactionPolicy?: CompositeInteractionPolicy;
    }): Promise<FrameRenderResult>;
    onReady(frame: HTMLIFrameElement, handler: () => void): () => void;
    onResize(
      frame: HTMLIFrameElement,
      handler: (payload: CompositeResizePayload) => void,
    ): () => void;
    onInteraction(
      frame: HTMLIFrameElement,
      handler: (payload: CompositeInteractionPayload) => void,
    ): () => void;
    onNodeSelect(
      frame: HTMLIFrameElement,
      handler: (payload: CompositeNodeSelectPayload) => void,
    ): () => void;
    onResourceOpen(
      frame: HTMLIFrameElement,
      handler: (payload: CompositeResourceOpenPayload) => void,
    ): () => void;
    onNodeError(
      frame: HTMLIFrameElement,
      handler: (payload: CompositeNodeError) => void,
    ): () => void;
    onFatalError(frame: HTMLIFrameElement, handler: (error: import("../types/errors").StandardError) => void): () => void;
  };
  editorPanel: {
    render(options: CardEditorRenderOptions): Promise<FrameRenderResult>;
    onReady(frame: HTMLIFrameElement, handler: () => void): () => void;
    onChange(frame: HTMLIFrameElement, handler: (payload: CardEditorChangePayload) => void): () => void;
    onError(frame: HTMLIFrameElement, handler: (payload: CardEditorErrorPayload) => void): () => void;
  };
}

export function createCardApi(client: CoreClient): CardApi {
  return {
    async pack(cardDir, outputPath) {
      if (!cardDir || !outputPath) {
        throw createError("INVALID_ARGUMENT", "card.pack: cardDir and outputPath are both required.");
      }
      const result = await client.invoke<
        { cardDir: string; outputPath: string },
        { cardFile: string }
      >("card.pack", { cardDir, outputPath });
      return result.cardFile;
    },
    async unpack(cardFile, outputDir) {
      if (!cardFile || !outputDir) {
        throw createError("INVALID_ARGUMENT", "card.unpack: cardFile and outputDir are both required.");
      }
      await client.invoke("card.unpack", { cardFile, outputDir });
    },
    async readMetadata(cardFile) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.readMetadata: cardFile is required.");
      }
      const result = await client.invoke<{ cardFile: string }, { metadata: CardMetadata }>(
        "card.readMetadata",
        { cardFile },
      );
      return result.metadata;
    },
    async readInfo(cardFile, fields) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.readInfo: cardFile is required.");
      }
      const result = await client.invoke<{ cardFile: string; fields?: CardInfoField[] }, { info: CardReadInfoResult }>(
        "card.readInfo",
        { cardFile, fields },
      );
      return result.info;
    },
    async parse(cardFile) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.parse: cardFile is required.");
      }
      const result = await client.invoke<{ cardFile: string }, { ast: CardDocument }>("card.parse", { cardFile });
      return result.ast;
    },
    async validate(cardFile) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.validate: cardFile is required.");
      }
      return client.invoke<{ cardFile: string }, ValidationResult>("card.validate", { cardFile });
    },
    async resolveDocumentPath(documentUrl) {
      if (!documentUrl) {
        throw createError("INVALID_ARGUMENT", "card.resolveDocumentPath: documentUrl is required.");
      }
      const result = await client.invoke<{ documentUrl: string }, { path: string }>(
        "card.resolveDocumentPath",
        { documentUrl },
      );
      return result.path;
    },
    async resolveResourceUrl(cardRootDir, resourcePath) {
      if (!cardRootDir || typeof cardRootDir !== "string") {
        throw createError("INVALID_ARGUMENT", "card.resolveResourceUrl: cardRootDir is required.");
      }
      if (!resourcePath || typeof resourcePath !== "string") {
        throw createError("INVALID_ARGUMENT", "card.resolveResourceUrl: resourcePath is required.");
      }
      const result = await client.invoke<{ cardRootDir: string; resourcePath: string }, { uri: string }>(
        "card.resolveResourceUrl",
        { cardRootDir, resourcePath },
      );
      return result.uri;
    },
    async open(cardFile) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.open: cardFile is required.");
      }
      const result = await client.invoke<{ cardFile: string }, { result: CardOpenResult }>("card.open", { cardFile });
      return result.result;
    },
    async render(cardFile, options) {
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "card.render: cardFile is required.");
      }
      return client.invoke("card.render", { cardFile, options });
    },
    async releaseRenderSession(sessionId) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "card.releaseRenderSession: sessionId is required.");
      }
      await client.invoke("card.releaseRenderSession", { sessionId });
    },
    coverFrame: {
      async render({ cardFile }) {
        if (!cardFile) {
          throw createError("INVALID_ARGUMENT", "card.coverFrame.render: cardFile is required.");
        }

        if (typeof document === "undefined") {
          throw createError(
            "RUNTIME_ENV_UNSUPPORTED",
            "card.coverFrame.render requires a DOM environment.",
          );
        }

        const { view } = await client.invoke<{ cardFile: string }, CardCoverRenderResult>(
          "card.renderCover",
          {
            cardFile,
          },
        );

        const frameResult = createFrameFromUrl(
          view.coverUrl,
          view.title ?? "Card Cover",
          "allow-scripts",
        );
        return {
          ...frameResult,
          title: view.title,
          ratio: view.ratio,
        };
      },
    },
    compositeWindow: {
      async render({ cardFile, mode = "view", interactionPolicy }) {
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
        if (
          typeof interactionPolicy !== "undefined" &&
          interactionPolicy !== "native" &&
          interactionPolicy !== "delegate"
        ) {
          throw createError(
            "INVALID_ARGUMENT",
            "card.compositeWindow.render: interactionPolicy must be 'native' or 'delegate'.",
          );
        }

        const { view } = await client.invoke<{ cardFile: string; options: CardRenderOptions }, CardRenderResult>(
          "card.render",
          {
            cardFile,
            options: {
              target: "card-iframe",
              mode,
              interactionPolicy,
            },
          },
        );

        if (typeof document === "undefined") {
          throw createError(
            "RUNTIME_ENV_UNSUPPORTED",
            "card.compositeWindow.render requires a DOM environment.",
          );
        }

        if (!view.documentUrl) {
          throw createError(
            "INTERNAL_ERROR",
            "card.compositeWindow.render requires Host to return view.documentUrl.",
          );
        }

        return createFrameFromUrl(
          view.documentUrl,
          view.title ?? "Card",
          "allow-scripts allow-forms",
          {
            release: view.sessionId
              ? () => client.invoke("card.releaseRenderSession", { sessionId: view.sessionId }).then(() => undefined)
              : undefined,
          },
        );
      },
      onReady(frame, handler) {
        return subscribeToCompositeReady(frame, handler);
      },
      onResize(frame, handler) {
        return subscribeToCompositeEvent<CompositeResizePayload>(
          frame,
          "chips.composite:resize",
          handler,
        );
      },
      onInteraction(frame, handler) {
        return subscribeToCompositeEvent<CompositeInteractionPayload>(
          frame,
          "chips.composite:interaction",
          handler,
        );
      },
      onNodeSelect(frame, handler) {
        return subscribeToCompositeEvent<CompositeNodeSelectPayload>(
          frame,
          "chips.composite:node-select",
          handler,
        );
      },
      onResourceOpen(frame, handler) {
        return subscribeToCompositeEvent<CompositeResourceOpenPayload>(
          frame,
          "chips.composite:resource-open",
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
    editorPanel: {
      async render({ cardType, initialConfig, baseCardId, resources }) {
        if (!cardType) {
          throw createError(
            "INVALID_ARGUMENT",
            "card.editorPanel.render: cardType is required.",
          );
        }

        const { view } = await client.invoke<CardEditorRenderOptions, CardEditorRenderResult>(
          "card.renderEditor",
          {
            cardType,
            initialConfig: initialConfig ?? {},
            baseCardId,
          },
        );

        if (typeof document === "undefined") {
          throw createError(
            "RUNTIME_ENV_UNSUPPORTED",
            "card.editorPanel.render requires a DOM environment.",
          );
        }

        if (!view.documentUrl) {
          throw createError(
            "INTERNAL_ERROR",
            "card.editorPanel.render requires Host to return view.documentUrl.",
          );
        }

        const frameResult = createFrameFromUrl(
          view.documentUrl,
          view.title ?? `${cardType} Editor`,
          "allow-scripts allow-forms",
          {
            release: view.sessionId
              ? () => client.invoke("card.releaseRenderSession", { sessionId: view.sessionId }).then(() => undefined)
              : undefined,
          },
        );
        const cleanupBridge = attachCardEditorResourceBridge(frameResult.frame, resources, client);
        const originalDispose = frameResult.dispose;
        frameResult.dispose = async () => {
          cleanupBridge();
          await originalDispose();
        };
        return frameResult;
      },
      onReady(frame, handler) {
        return subscribeToFrameMessage(frame, "chips.card-editor:ready", () => handler());
      },
      onChange(frame, handler) {
        return subscribeToFrameMessage<CardEditorChangePayload>(frame, "chips.card-editor:change", handler);
      },
      onError(frame, handler) {
        return subscribeToFrameMessage<CardEditorErrorPayload>(frame, "chips.card-editor:error", handler);
      },
    },
  };
}

type CardEditorResourceAction =
  | "resolve"
  | "import"
  | "importArchiveBundle"
  | "delete"
  | "convertTiffToPng"
  | "extractVideoThumbnail";

type CardEditorResourceRequestPayload = {
  requestId: string;
  action: CardEditorResourceAction;
  resourcePath?: string;
  outputPath?: string;
  preferredPath?: string;
  preferredRootDir?: string;
  entryFile?: string;
  include?: CardEditorArchiveImportFilter;
  stripSingleRootDir?: boolean;
  excludeSystemArtifacts?: boolean;
  file?: File;
  overwrite?: boolean;
  options?: CardEditorVideoThumbnailRequest["options"];
};

function attachCardEditorResourceBridge(
  frame: HTMLIFrameElement,
  resources?: CardEditorResourceBridge,
  client?: CoreClient,
): () => void {
  if (typeof window === "undefined" || !resources) {
    return () => undefined;
  }

  const cleanup = () => {
    window.removeEventListener("message", listener);
  };

  const listener = (event: MessageEvent) => {
    if (!frame.isConnected) {
      cleanup();
      return;
    }

    if (!event || event.source !== frame.contentWindow) return;
    if (!isAllowedFrameOrigin(frame, event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;

    const record = data as { type?: string; payload?: unknown };
    if (record.type === "chips.card-editor:resource-release") {
      const payload = record.payload as { resourcePath?: unknown } | undefined;
      const resourcePath = normalizeRelativeResourcePath(payload?.resourcePath);
      if (resourcePath) {
        void Promise.resolve(resources.releaseResourceUrl?.(resourcePath)).catch(() => undefined);
      }
      return;
    }

    if (record.type !== "chips.card-editor:resource-request") {
      return;
    }

    const payload = record.payload as CardEditorResourceRequestPayload | undefined;
    const source = event.source as Window | null;
    if (!payload?.requestId || !source || typeof source.postMessage !== "function") {
      return;
    }

    void handleCardEditorResourceRequest(resources, payload, client)
      .then((result) => {
        source.postMessage(
          {
            type: "chips.card-editor:resource-response",
            payload: {
              requestId: payload.requestId,
              ok: true,
              result,
            },
          },
          "*",
        );
      })
      .catch((error) => {
        source.postMessage(
          {
            type: "chips.card-editor:resource-response",
            payload: {
              requestId: payload.requestId,
              ok: false,
              message: getErrorMessage(error),
            },
          },
          "*",
        );
      });
  };

  window.addEventListener("message", listener);
  return cleanup;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }

  return String(error);
}

async function handleCardEditorResourceRequest(
  resources: CardEditorResourceBridge,
  payload: CardEditorResourceRequestPayload,
  client?: CoreClient,
): Promise<unknown> {
  switch (payload.action) {
    case "resolve": {
      const resourcePath = normalizeRelativeResourcePath(payload.resourcePath);
      if (!resourcePath) {
        throw createError("INVALID_ARGUMENT", "card.editorPanel.resource.resolve: resourcePath is required.");
      }
      if (resources.resolveResourceUrl) {
        return resources.resolveResourceUrl(resourcePath);
      }
      if (resources.rootPath) {
        return {
          url: createFileUrl(joinPath(resources.rootPath, resourcePath)),
        }.url;
      }
      throw createError(
        "RUNTIME_ENV_UNSUPPORTED",
        "card.editorPanel.resource.resolve requires resources.resolveResourceUrl or resources.rootPath.",
      );
    }
    case "import": {
      if (!resources.importResource) {
        throw createError(
          "RUNTIME_ENV_UNSUPPORTED",
          "card.editorPanel.resource.import requires resources.importResource.",
        );
      }
      if (!(payload.file instanceof File)) {
        throw createError("INVALID_ARGUMENT", "card.editorPanel.resource.import requires a File payload.");
      }
      return resources.importResource({
        file: payload.file,
        preferredPath: typeof payload.preferredPath === "string" ? payload.preferredPath : undefined,
      });
    }
    case "importArchiveBundle": {
      if (!resources.importArchiveBundle) {
        throw createError(
          "RUNTIME_ENV_UNSUPPORTED",
          "card.editorPanel.resource.importArchiveBundle requires resources.importArchiveBundle.",
        );
      }
      if (!(payload.file instanceof File)) {
        throw createError(
          "INVALID_ARGUMENT",
          "card.editorPanel.resource.importArchiveBundle requires a File payload.",
        );
      }
      return resources.importArchiveBundle({
        file: payload.file,
        preferredRootDir:
          typeof payload.preferredRootDir === "string" ? payload.preferredRootDir : undefined,
        entryFile: typeof payload.entryFile === "string" ? payload.entryFile : undefined,
        include: normalizeArchiveImportFilter(payload.include),
        stripSingleRootDir: typeof payload.stripSingleRootDir === "boolean" ? payload.stripSingleRootDir : undefined,
        excludeSystemArtifacts: typeof payload.excludeSystemArtifacts === "boolean"
          ? payload.excludeSystemArtifacts
          : undefined,
      });
    }
    case "delete": {
      const resourcePath = normalizeRelativeResourcePath(payload.resourcePath);
      if (!resourcePath) {
        throw createError("INVALID_ARGUMENT", "card.editorPanel.resource.delete: resourcePath is required.");
      }
      if (!resources.deleteResource) {
        throw createError(
          "RUNTIME_ENV_UNSUPPORTED",
          "card.editorPanel.resource.delete requires resources.deleteResource.",
        );
      }
      await resources.deleteResource(resourcePath);
      return null;
    }
    case "convertTiffToPng": {
      const resourcePath = normalizeRelativeResourcePath(payload.resourcePath);
      if (!resourcePath) {
        throw createError(
          "INVALID_ARGUMENT",
          "card.editorPanel.resource.convertTiffToPng: resourcePath is required.",
        );
      }

      const outputPath = normalizeRelativeResourcePath(payload.outputPath);
      if (!outputPath) {
        throw createError(
          "INVALID_ARGUMENT",
          "card.editorPanel.resource.convertTiffToPng: outputPath is required.",
        );
      }

      if (typeof payload.overwrite !== "undefined" && typeof payload.overwrite !== "boolean") {
        throw createError(
          "INVALID_ARGUMENT",
          "card.editorPanel.resource.convertTiffToPng: overwrite must be a boolean when provided.",
        );
      }

      if (resources.convertTiffToPng) {
        return resources.convertTiffToPng({
          resourcePath,
          outputPath,
          ...(typeof payload.overwrite === "boolean" ? { overwrite: payload.overwrite } : undefined),
        });
      }

      if (!resources.rootPath || !client) {
        throw createError(
          "RUNTIME_ENV_UNSUPPORTED",
          "card.editorPanel.resource.convertTiffToPng requires resources.convertTiffToPng or resources.rootPath.",
        );
      }

      const result = await client.invoke<
        { resourceId: string; outputFile: string; overwrite?: boolean },
        { outputFile: string; mimeType: "image/png"; sourceMimeType: "image/tiff"; width?: number; height?: number }
      >("resource.convertTiffToPng", {
        resourceId: joinPath(resources.rootPath, resourcePath),
        outputFile: joinPath(resources.rootPath, outputPath),
        ...(typeof payload.overwrite === "boolean" ? { overwrite: payload.overwrite } : undefined),
      });

      return {
        path: outputPath,
        mimeType: result.mimeType,
        sourceMimeType: result.sourceMimeType,
        width: result.width,
        height: result.height,
      };
    }
    case "extractVideoThumbnail": {
      const resourcePath = normalizeRelativeResourcePath(payload.resourcePath);
      if (!resourcePath) {
        throw createError(
          "INVALID_ARGUMENT",
          "card.editorPanel.resource.extractVideoThumbnail: resourcePath is required.",
        );
      }

      const outputPath = normalizeRelativeResourcePath(payload.outputPath);
      if (!outputPath) {
        throw createError(
          "INVALID_ARGUMENT",
          "card.editorPanel.resource.extractVideoThumbnail: outputPath is required.",
        );
      }

      if (typeof payload.overwrite !== "undefined" && typeof payload.overwrite !== "boolean") {
        throw createError(
          "INVALID_ARGUMENT",
          "card.editorPanel.resource.extractVideoThumbnail: overwrite must be a boolean when provided.",
        );
      }

      const options = normalizeVideoThumbnailOptions(payload.options);

      if (resources.extractVideoThumbnail) {
        return resources.extractVideoThumbnail({
          resourcePath,
          outputPath,
          ...(typeof payload.overwrite === "boolean" ? { overwrite: payload.overwrite } : undefined),
          ...(options ? { options } : undefined),
        });
      }

      if (!resources.rootPath || !client) {
        throw createError(
          "RUNTIME_ENV_UNSUPPORTED",
          "card.editorPanel.resource.extractVideoThumbnail requires resources.extractVideoThumbnail or resources.rootPath.",
        );
      }

      const result = await client.invoke<
        {
          resourceId: string;
          outputFile: string;
          overwrite?: boolean;
          options?: CardEditorVideoThumbnailRequest["options"];
        },
        {
          outputFile: string;
          mimeType: "image/png" | "image/jpeg";
          sourceMimeType: string;
          width: number;
          height: number;
          format: "png" | "jpeg";
          frameTimeSeconds: number;
          durationSeconds?: number;
        }
      >("resource.extractVideoFrame", {
        resourceId: joinPath(resources.rootPath, resourcePath),
        outputFile: joinPath(resources.rootPath, outputPath),
        ...(typeof payload.overwrite === "boolean" ? { overwrite: payload.overwrite } : undefined),
        ...(options ? { options } : undefined),
      });

      return {
        path: outputPath,
        mimeType: result.mimeType,
        sourceMimeType: result.sourceMimeType,
        width: result.width,
        height: result.height,
        format: result.format,
        frameTimeSeconds: result.frameTimeSeconds,
        durationSeconds: result.durationSeconds,
      };
    }
    default:
      throw createError("INVALID_ARGUMENT", `Unsupported editor resource action: ${String(payload.action)}`);
  }
}

function normalizeArchiveImportFilter(input: unknown): CardEditorArchiveImportFilter | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const mimeTypes = Array.isArray(record.mimeTypes)
    ? record.mimeTypes.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const extensions = Array.isArray(record.extensions)
    ? record.extensions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;

  if ((!mimeTypes || mimeTypes.length === 0) && (!extensions || extensions.length === 0)) {
    return undefined;
  }

  return {
    ...(mimeTypes && mimeTypes.length > 0 ? { mimeTypes } : undefined),
    ...(extensions && extensions.length > 0 ? { extensions } : undefined),
  };
}

function normalizeVideoThumbnailOptions(
  input: unknown,
): CardEditorVideoThumbnailRequest["options"] | undefined {
  if (typeof input === "undefined") {
    return undefined;
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError(
      "INVALID_ARGUMENT",
      "card.editorPanel.resource.extractVideoThumbnail: options must be an object when provided.",
    );
  }

  const options = input as Record<string, unknown>;
  const normalized: CardEditorVideoThumbnailRequest["options"] = {};

  if (typeof options.timeSeconds !== "undefined") {
    if (typeof options.timeSeconds !== "number" || !Number.isFinite(options.timeSeconds) || options.timeSeconds < 0) {
      throw createError(
        "INVALID_ARGUMENT",
        "card.editorPanel.resource.extractVideoThumbnail: options.timeSeconds must be >= 0 when provided.",
      );
    }
    normalized.timeSeconds = options.timeSeconds;
  }

  if (typeof options.format !== "undefined") {
    if (options.format !== "png" && options.format !== "jpeg") {
      throw createError(
        "INVALID_ARGUMENT",
        "card.editorPanel.resource.extractVideoThumbnail: options.format must be png or jpeg when provided.",
      );
    }
    normalized.format = options.format;
  }

  if (typeof options.width !== "undefined") {
    if (typeof options.width !== "number" || !Number.isFinite(options.width) || options.width <= 0) {
      throw createError(
        "INVALID_ARGUMENT",
        "card.editorPanel.resource.extractVideoThumbnail: options.width must be > 0 when provided.",
      );
    }
    normalized.width = options.width;
  }

  if (typeof options.height !== "undefined") {
    if (typeof options.height !== "number" || !Number.isFinite(options.height) || options.height <= 0) {
      throw createError(
        "INVALID_ARGUMENT",
        "card.editorPanel.resource.extractVideoThumbnail: options.height must be > 0 when provided.",
      );
    }
    normalized.height = options.height;
  }

  if (typeof options.fit !== "undefined") {
    if (options.fit !== "contain" && options.fit !== "cover") {
      throw createError(
        "INVALID_ARGUMENT",
        "card.editorPanel.resource.extractVideoThumbnail: options.fit must be contain or cover when provided.",
      );
    }
    normalized.fit = options.fit;
  }

  if (typeof options.quality !== "undefined") {
    if (typeof options.quality !== "number" || !Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100) {
      throw createError(
        "INVALID_ARGUMENT",
        "card.editorPanel.resource.extractVideoThumbnail: options.quality must be between 1 and 100 when provided.",
      );
    }
    normalized.quality = options.quality;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRelativeResourcePath(resourcePath: unknown): string | null {
  if (typeof resourcePath !== "string") {
    return null;
  }

  const normalized = resourcePath.replace(/\\/g, "/").trim();
  if (!normalized) {
    return null;
  }

  const segments = normalized
    .replace(/^\.?\//, "")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.length === 0 || segments.some((segment) => segment === "..")) {
    return null;
  }

  return segments.join("/");
}

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replace(/\\/g, "/").replace(/\/+/g, "/");
}

function createFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }

  const absolutePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return encodeURI(`file://${absolutePath}`);
}

function createFrameFromUrl(
  url: string,
  title: string,
  sandbox: string,
  options?: {
    release?: () => Promise<void> | void;
  },
): FrameRenderResult {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", sandbox);
  frame.setAttribute("loading", "lazy");
  frame.title = title;
  frame.src = url;

  let origin = window.location.origin;
  try {
    origin = new URL(url, window.location.href).origin;
  } catch {
    // keep the current window origin as a safe fallback for malformed urls
  }

  const frameWithDataset = frame as HTMLIFrameElement & { dataset?: DOMStringMap };
  if (!frameWithDataset.dataset) {
    frameWithDataset.dataset = {} as DOMStringMap;
  }
  frameWithDataset.dataset.chipsOrigin = origin;

  const cleanupTasks: Array<() => void> = [];
  let hasBeenConnected = false;
  let disposed = false;
  const dispose = async () => {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const task of cleanupTasks.splice(0)) {
      task();
    }
    await options?.release?.();
  };

  const handlePageHide = () => {
    void dispose().catch(() => undefined);
  };
  if (
    typeof (window as { addEventListener?: unknown }).addEventListener === "function" &&
    typeof (window as { removeEventListener?: unknown }).removeEventListener === "function"
  ) {
    window.addEventListener("pagehide", handlePageHide);
    cleanupTasks.push(() => {
      window.removeEventListener("pagehide", handlePageHide);
    });
  }

  if (typeof MutationObserver === "function" && document.documentElement) {
    const checkConnection = () => {
      if (frame.isConnected) {
        hasBeenConnected = true;
        return;
      }
      if (hasBeenConnected) {
        void dispose().catch(() => undefined);
      }
    };
    const observer = new MutationObserver(checkConnection);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    cleanupTasks.push(() => {
      observer.disconnect();
    });
    queueMicrotask(checkConnection);
  }

  return {
    frame,
    origin,
    dispose,
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

function subscribeToCompositeEvent<T = void>(
  frame: HTMLIFrameElement,
  type: string,
  handler: (payload: T) => void,
): () => void {
  return subscribeToFrameMessage(frame, type, handler);
}

function subscribeToFrameMessage<T = void>(
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

  const listener = (event: MessageEvent) => {
    if (!event || event.source !== contentWindow) return;
    if (!isAllowedFrameOrigin(frame, event.origin)) return;
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

function isAllowedFrameOrigin(frame: HTMLIFrameElement, origin: string): boolean {
  if (origin === "null") {
    return true;
  }

  const allowedOrigins = new Set<string>();
  if (typeof window !== "undefined") {
    allowedOrigins.add(window.location.origin);
  }

  const frameOrigin = frame.dataset?.chipsOrigin;
  if (frameOrigin) {
    allowedOrigins.add(frameOrigin);
  }

  return allowedOrigins.has(origin);
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
