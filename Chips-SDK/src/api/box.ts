import {
  createFileUrl,
  guessMimeType,
  joinResourcePath,
  normalizeRelativeResourcePath,
} from "../utils";
import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export type BoxTag = string | string[];
export type BoxEntryDetailField = "documentInfo" | "coverDescriptor" | "previewDescriptor" | "runtimeProps" | "status";
export type BoxEntryResourceKind = "cover" | "preview" | "documentFile" | "custom";
export type BoxPrefetchTarget = "cover" | "preview" | "documentInfo";
export type BoxEntryDocumentRenderMode = "view" | "preview";
export type BoxEntryDocumentInteractionPolicy = "native" | "delegate";

export interface BoxEntryDocumentRenderOptions {
  mode?: BoxEntryDocumentRenderMode;
  interactionPolicy?: BoxEntryDocumentInteractionPolicy;
  locale?: string;
  themeId?: string;
}

export interface BoxValidationResult {
  valid: boolean;
  errors: string[];
}

export interface BoxMetadata {
  chipStandardsVersion: string;
  boxId: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  activeLayoutType: string;
  coverRatio?: string;
  description?: string;
  tags?: BoxTag[];
  coverAsset?: string;
  owner?: string;
  source?: Record<string, unknown>;
}

export interface BoxEntrySnapshot {
  entryId: string;
  /**
   * 条目文档定位，支持两种形态：
   * - 外部引用：绝对 URL（`file://` / `http(s)://` / `webdav://` 等）；
   * - 内嵌引用：包内相对路径（如 `cards/day-01.card`），不以 `[a-z][a-z0-9+.-]*://` 形式开头、以 `.card` 结尾。
   * Host 与 SDK 均原样透传该字段，不做形态改写。
   */
  url: string;
  enabled: boolean;
  snapshot: {
    documentId?: string;
    title?: string;
    summary?: string;
    tags?: BoxTag[];
    cover?: {
      mode: "asset" | "runtime" | "none";
      assetPath?: string;
      mimeType?: string;
      width?: number;
      height?: number;
    };
    lastKnownModifiedAt?: string;
    contentType?: string;
  };
  layoutHints?: {
    sortKey?: string | number;
    aspectRatio?: number;
    group?: string;
    priority?: number;
  };
}

export interface BoxLayoutConfig {
  schemaVersion?: string;
  props?: Record<string, unknown>;
  assetRefs?: string[];
  [key: string]: unknown;
}

export interface BoxContent {
  activeLayoutType: string;
  layoutConfigs: Record<string, BoxLayoutConfig>;
}

export interface BoxInspectionResult {
  metadata: BoxMetadata;
  content: BoxContent;
  entries: BoxEntrySnapshot[];
  assets: string[];
}

export interface BoxEntryQuery {
  cursor?: string;
  limit?: number;
  filter?: Record<string, unknown>;
  sort?: {
    key: string;
    direction: "asc" | "desc";
  };
}

export interface BoxEntryPage {
  items: BoxEntrySnapshot[];
  total: number;
  nextCursor?: string;
}

export interface BoxSessionInfo {
  boxId: string;
  boxFile: string;
  name: string;
  activeLayoutType: string;
  availableLayouts: string[];
  coverRatio?: string;
  tags?: BoxTag[];
  coverAsset?: string;
  capabilities: {
    listEntries: true;
    readEntryDetail: true;
    renderEntryCover: true;
    renderEntryDocument: true;
    releaseEntryDocument: true;
    resolveEntryResource: true;
    readBoxAsset: true;
    prefetchEntries: true;
    openEntry: true;
  };
}

export interface BoxOpenViewResult {
  sessionId: string;
  box: BoxSessionInfo;
  initialView: BoxEntryPage;
}

export interface BoxEntryOpenResult {
  mode: "document-window" | "external";
  documentType?: "card" | "box";
  windowId?: string;
  pluginId?: string;
  url?: string;
}

export interface BoxCoverView {
  title: string;
  coverUrl: string;
  mimeType: "text/html";
  ratio?: string;
}

export interface BoxEntryCoverView {
  title: string;
  coverUrl: string;
  mimeType: string;
  ratio?: string;
}

export interface BoxEntryDocumentView {
  entryId: string;
  documentType: "card";
  title: string;
  documentUrl: string;
  renderSessionId: string;
}

export interface ResolvedRuntimeResource {
  resourceUrl: string;
  mimeType: string;
  cacheKey?: string;
  expiresAt?: string;
  width?: number;
  height?: number;
}

export interface BoxEntryDetailItem {
  entryId: string;
  detail: Record<string, unknown>;
}

export interface BoxLayoutDescriptor {
  pluginId: string;
  layoutType: string;
  displayName: string;
  description?: string;
  icon?: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
}

export interface BoxLayoutValidation {
  valid: boolean;
  errors: Record<string, string>;
}

export interface BoxLayoutFrameView {
  title: string;
  documentUrl: string;
  sessionId: string;
  layoutType: string;
  pluginId: string;
}

export interface BoxLayoutEditorView {
  title: string;
  documentUrl: string;
  sessionId: string;
  layoutType: string;
  pluginId: string;
}

export interface FrameRenderResult {
  frame: HTMLIFrameElement;
  origin: string;
  dispose: () => Promise<void>;
}

export interface BoxLayoutEditorAssetBridge {
  rootPath?: string;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource> | ResolvedRuntimeResource;
  importBoxAsset?: (
    input: { file: File; preferredPath?: string },
  ) => Promise<{ assetPath: string }> | { assetPath: string };
  deleteBoxAsset?: (assetPath: string) => Promise<void> | void;
}

export interface BoxLayoutEditorChangePayload {
  layoutType: string;
  pluginId: string;
  config: Record<string, unknown>;
}

export interface BoxLayoutEditorErrorPayload {
  layoutType: string;
  pluginId: string;
  code: string;
  message: string;
}

export interface BoxLayoutRenderErrorPayload {
  sessionId?: string;
  layoutType?: string;
  pluginId?: string;
  code: string;
  message: string;
}

export interface BoxSessionSnapshot {
  boxId: string;
  boxFile: string;
  workspaceDir: string;
  metadata: BoxMetadata;
  coverHtml: string;
  content: BoxContent;
  entries: BoxEntrySnapshot[];
  assets: string[];
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt?: string;
}

export interface BoxSessionHistoryView {
  undoAvailable: boolean;
  redoAvailable: boolean;
  undoStack: Array<{ label: string; recordedAt: number }>;
  redoStack: Array<{ label: string; recordedAt: number }>;
}

export interface BoxSessionApi {
  create(name: string, layoutType: string, parentPath: string): Promise<{ boxFile: string; metadata: BoxMetadata }>;
  rename(boxFile: string, newName: string): Promise<{ boxFile: string; metadata: BoxMetadata }>;
  open(boxFile: string): Promise<{ sessionId: string; snapshot: BoxSessionSnapshot }>;
  get(sessionId: string): Promise<BoxSessionSnapshot>;
  addEntry(sessionId: string, input: { url?: string; filePath?: string }): Promise<BoxSessionSnapshot>;
  addEmbeddedCard(sessionId: string, cardFile: string, preferredName?: string): Promise<BoxSessionSnapshot>;
  updateEntry(sessionId: string, entryId: string, patch: Partial<BoxEntrySnapshot>): Promise<BoxSessionSnapshot>;
  moveEntry(sessionId: string, entryId: string, targetIndex: number): Promise<BoxSessionSnapshot>;
  removeEntry(sessionId: string, entryId: string): Promise<BoxSessionSnapshot>;
  updateMetadata(
    sessionId: string,
    patch: { name?: string; description?: string; coverRatio?: string; tags?: Array<string | string[]>; coverAsset?: string },
  ): Promise<BoxSessionSnapshot>;
  updateLayoutConfig(sessionId: string, layoutType: string, config: Record<string, unknown>): Promise<BoxSessionSnapshot>;
  importAsset(sessionId: string, input: { data: Uint8Array; preferredPath?: string }): Promise<{ assetPath: string }>;
  deleteAsset(sessionId: string, assetPath: string): Promise<void>;
  updateCover(
    sessionId: string,
    input: { html: string; ratio?: string; resources?: Array<{ path: string; data: Uint8Array }> },
  ): Promise<BoxSessionSnapshot>;
  persist(sessionId: string): Promise<BoxSessionSnapshot>;
  undo(sessionId: string): Promise<BoxSessionSnapshot>;
  redo(sessionId: string): Promise<BoxSessionSnapshot>;
  history(sessionId: string): Promise<BoxSessionHistoryView>;
  close(sessionId: string): Promise<void>;
  onOpened(handler: (payload: { sessionId: string; boxId: string; snapshot: BoxSessionSnapshot }) => void): () => void;
  onPersisted(handler: (payload: { sessionId?: string; boxId: string; snapshot: BoxSessionSnapshot }) => void): () => void;
  onPersistError(handler: (payload: { sessionId?: string; boxId: string; error: unknown }) => void): () => void;
  onClosed(handler: (payload: { sessionId: string; boxId: string }) => void): () => void;
  onUndo(handler: (payload: { sessionId: string; boxId: string; snapshot: BoxSessionSnapshot }) => void): () => void;
  onRedo(handler: (payload: { sessionId: string; boxId: string; snapshot: BoxSessionSnapshot }) => void): () => void;
}

export interface BoxApi {
  session: BoxSessionApi;
  pack(boxDir: string, options?: { outputPath?: string }): Promise<string>;
  unpack(boxFile: string, outputDir: string): Promise<string>;
  inspect(boxFile: string): Promise<BoxInspectionResult>;
  validate(boxFile: string): Promise<BoxValidationResult>;
  readMetadata(boxFile: string): Promise<BoxMetadata>;
  renderCover(boxFile: string): Promise<BoxCoverView>;
  listLayoutDescriptors(): Promise<BoxLayoutDescriptor[]>;
  readLayoutDescriptor(layoutType: string): Promise<BoxLayoutDescriptor>;
  normalizeLayoutConfig(layoutType: string, config: Record<string, unknown>): Promise<Record<string, unknown>>;
  validateLayoutConfig(layoutType: string, config: Record<string, unknown>): Promise<BoxLayoutValidation>;
  getLayoutInitialQuery(layoutType: string, config: Record<string, unknown>): Promise<BoxEntryQuery | undefined>;
  openView(boxFile: string, options?: { layoutType?: string; initialQuery?: BoxEntryQuery }): Promise<BoxOpenViewResult>;
  listEntries(sessionId: string, query?: BoxEntryQuery): Promise<BoxEntryPage>;
  readEntryDetail(sessionId: string, entryIds: string[], fields: BoxEntryDetailField[]): Promise<BoxEntryDetailItem[]>;
  renderEntryCover(sessionId: string, entryId: string): Promise<BoxEntryCoverView>;
  renderEntryDocument(
    sessionId: string,
    entryId: string,
    options?: BoxEntryDocumentRenderOptions,
  ): Promise<BoxEntryDocumentView>;
  releaseEntryDocument(sessionId: string, renderSessionId: string): Promise<void>;
  openEntry(sessionId: string, entryId: string): Promise<BoxEntryOpenResult>;
  resolveEntryResource(
    sessionId: string,
    entryId: string,
    resource: {
      kind: BoxEntryResourceKind;
      key?: string;
      sizeHint?: {
        width?: number;
        height?: number;
      };
    },
  ): Promise<ResolvedRuntimeResource>;
  readBoxAsset(sessionId: string, assetPath: string): Promise<ResolvedRuntimeResource>;
  prefetchEntries(sessionId: string, entryIds: string[], targets: BoxPrefetchTarget[]): Promise<void>;
  closeView(sessionId: string): Promise<void>;
  releaseRenderSession(sessionId: string): Promise<void>;
  documentWindow: {
    render(options: {
      boxFile: string;
      layoutType?: string;
      locale?: string;
      themeId?: string;
    }): Promise<FrameRenderResult>;
    onReady(frame: HTMLIFrameElement, handler: () => void): () => void;
    onError(frame: HTMLIFrameElement, handler: (payload: BoxLayoutRenderErrorPayload) => void): () => void;
  };
  editorPanel: {
    render(options: {
      layoutType: string;
      entries: BoxEntrySnapshot[];
      initialConfig?: Record<string, unknown>;
      locale?: string;
      themeId?: string;
      resources?: BoxLayoutEditorAssetBridge;
    }): Promise<FrameRenderResult>;
    onReady(frame: HTMLIFrameElement, handler: () => void): () => void;
    onChange(frame: HTMLIFrameElement, handler: (payload: BoxLayoutEditorChangePayload) => void): () => void;
    onError(frame: HTMLIFrameElement, handler: (payload: BoxLayoutEditorErrorPayload) => void): () => void;
  };
}

type BoxLayoutRuntimeAction =
  | "listEntries"
  | "readEntryDetail"
  | "renderEntryCover"
  | "renderEntryDocument"
  | "releaseEntryDocument"
  | "resolveEntryResource"
  | "readBoxAsset"
  | "prefetchEntries"
  | "openEntry";

type BoxLayoutRuntimeRequestPayload = {
  requestId: string;
  action: BoxLayoutRuntimeAction;
  sessionId?: string;
  entryId?: string;
  renderSessionId?: string;
  options?: {
    mode?: BoxEntryDocumentRenderMode;
    interactionPolicy?: BoxEntryDocumentInteractionPolicy;
  };
  request?: {
    entryId?: string;
    entryIds?: string[];
    fields?: BoxEntryDetailField[];
    resource?: {
      kind: BoxEntryResourceKind;
      key?: string;
      sizeHint?: {
        width?: number;
        height?: number;
      };
    };
    targets?: BoxPrefetchTarget[];
    query?: BoxEntryQuery;
  };
  query?: BoxEntryQuery;
  assetPath?: string;
};

type BoxLayoutEditorAssetAction = "readBoxAsset" | "importBoxAsset" | "deleteBoxAsset";

type BoxLayoutEditorAssetRequestPayload = {
  requestId: string;
  action: BoxLayoutEditorAssetAction;
  assetPath?: string;
  preferredPath?: string;
  file?: File;
};

const BOX_LAYOUT_READY_EVENT = "chips.box-layout:ready";
const BOX_LAYOUT_ERROR_EVENT = "chips.box-layout:error";
const BOX_LAYOUT_RUNTIME_REQUEST_EVENT = "chips.box-layout:runtime-request";
const BOX_LAYOUT_RUNTIME_RESPONSE_EVENT = "chips.box-layout:runtime-response";
const BOX_LAYOUT_EDITOR_READY_EVENT = "chips.box-layout-editor:ready";
const BOX_LAYOUT_EDITOR_CHANGE_EVENT = "chips.box-layout-editor:change";
const BOX_LAYOUT_EDITOR_ERROR_EVENT = "chips.box-layout-editor:error";
const BOX_LAYOUT_EDITOR_ASSET_REQUEST_EVENT = "chips.box-layout-editor:asset-request";
const BOX_LAYOUT_EDITOR_ASSET_RESPONSE_EVENT = "chips.box-layout-editor:asset-response";

export function createBoxApi(client: CoreClient): BoxApi {
  return {
    session: createBoxSessionApi(client),
    async pack(boxDir, options) {
      if (!boxDir) {
        throw createError("INVALID_ARGUMENT", "box.pack: boxDir is required.");
      }
      const result = await client.invoke<{ boxDir: string; outputPath?: string }, { boxFile: string }>("box.pack", {
        boxDir,
        outputPath: options?.outputPath,
      });
      return result.boxFile;
    },
    async unpack(boxFile, outputDir) {
      if (!boxFile || !outputDir) {
        throw createError("INVALID_ARGUMENT", "box.unpack: boxFile and outputDir are both required.");
      }
      const result = await client.invoke<{ boxFile: string; outputDir: string }, { outputDir: string }>("box.unpack", {
        boxFile,
        outputDir,
      });
      return result.outputDir;
    },
    async inspect(boxFile) {
      if (!boxFile) {
        throw createError("INVALID_ARGUMENT", "box.inspect: boxFile is required.");
      }
      const result = await client.invoke<{ boxFile: string }, { inspection: BoxInspectionResult }>("box.inspect", { boxFile });
      return result.inspection;
    },
    async validate(boxFile) {
      if (!boxFile) {
        throw createError("INVALID_ARGUMENT", "box.validate: boxFile is required.");
      }
      const result = await client.invoke<{ boxFile: string }, { validationResult: BoxValidationResult }>("box.validate", { boxFile });
      return result.validationResult;
    },
    async readMetadata(boxFile) {
      if (!boxFile) {
        throw createError("INVALID_ARGUMENT", "box.readMetadata: boxFile is required.");
      }
      const result = await client.invoke<{ boxFile: string }, { metadata: BoxMetadata }>("box.readMetadata", { boxFile });
      return result.metadata;
    },
    async renderCover(boxFile) {
      if (!boxFile) {
        throw createError("INVALID_ARGUMENT", "box.renderCover: boxFile is required.");
      }
      const result = await client.invoke<{ boxFile: string }, { view: BoxCoverView }>("box.renderCover", { boxFile });
      return result.view;
    },
    async listLayoutDescriptors() {
      const result = await client.invoke<Record<string, never>, { descriptors: BoxLayoutDescriptor[] }>(
        "box.listLayoutDescriptors",
        {},
      );
      return result.descriptors;
    },
    async readLayoutDescriptor(layoutType) {
      if (!layoutType) {
        throw createError("INVALID_ARGUMENT", "box.readLayoutDescriptor: layoutType is required.");
      }
      const result = await client.invoke<{ layoutType: string }, { descriptor: BoxLayoutDescriptor }>(
        "box.readLayoutDescriptor",
        { layoutType },
      );
      return result.descriptor;
    },
    async normalizeLayoutConfig(layoutType, config) {
      if (!layoutType) {
        throw createError("INVALID_ARGUMENT", "box.normalizeLayoutConfig: layoutType is required.");
      }
      const result = await client.invoke<{ layoutType: string; config: Record<string, unknown> }, { config: Record<string, unknown> }>(
        "box.normalizeLayoutConfig",
        {
          layoutType,
          config: config ?? {},
        },
      );
      return result.config;
    },
    async validateLayoutConfig(layoutType, config) {
      if (!layoutType) {
        throw createError("INVALID_ARGUMENT", "box.validateLayoutConfig: layoutType is required.");
      }
      const result = await client.invoke<{ layoutType: string; config: Record<string, unknown> }, { validation: BoxLayoutValidation }>(
        "box.validateLayoutConfig",
        {
          layoutType,
          config: config ?? {},
        },
      );
      return result.validation;
    },
    async getLayoutInitialQuery(layoutType, config) {
      if (!layoutType) {
        throw createError("INVALID_ARGUMENT", "box.getLayoutInitialQuery: layoutType is required.");
      }
      const result = await client.invoke<{ layoutType: string; config: Record<string, unknown> }, { query?: BoxEntryQuery }>(
        "box.getLayoutInitialQuery",
        {
          layoutType,
          config: config ?? {},
        },
      );
      return result.query;
    },
    async openView(boxFile, options) {
      if (!boxFile) {
        throw createError("INVALID_ARGUMENT", "box.openView: boxFile is required.");
      }
      return client.invoke<
        { boxFile: string; layoutType?: string; initialQuery?: BoxEntryQuery },
        BoxOpenViewResult
      >("box.openView", {
        boxFile,
        layoutType: options?.layoutType,
        initialQuery: options?.initialQuery,
      });
    },
    async listEntries(sessionId, query) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "box.listEntries: sessionId is required.");
      }
      const result = await client.invoke<{ sessionId: string; query?: BoxEntryQuery }, { page: BoxEntryPage }>("box.listEntries", {
        sessionId,
        query,
      });
      return result.page;
    },
    async readEntryDetail(sessionId, entryIds, fields) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "box.readEntryDetail: sessionId is required.");
      }
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
        throw createError("INVALID_ARGUMENT", "box.readEntryDetail: entryIds must be a non-empty array.");
      }
      if (!Array.isArray(fields) || fields.length === 0) {
        throw createError("INVALID_ARGUMENT", "box.readEntryDetail: fields must be a non-empty array.");
      }
      const result = await client.invoke<
        { sessionId: string; entryIds: string[]; fields: BoxEntryDetailField[] },
        { items: BoxEntryDetailItem[] }
      >("box.readEntryDetail", {
        sessionId,
        entryIds,
        fields,
      });
      return result.items;
    },
    async renderEntryCover(sessionId, entryId) {
      if (!sessionId || !entryId) {
        throw createError("INVALID_ARGUMENT", "box.renderEntryCover: sessionId and entryId are required.");
      }
      const result = await client.invoke<{ sessionId: string; entryId: string }, { view: BoxEntryCoverView }>(
        "box.renderEntryCover",
        {
          sessionId,
          entryId,
        },
      );
      return result.view;
    },
    async renderEntryDocument(sessionId, entryId, options) {
      if (!sessionId || !entryId) {
        throw createError("INVALID_ARGUMENT", "box.renderEntryDocument: sessionId and entryId are required.");
      }
      const result = await client.invoke<
        { sessionId: string; entryId: string; options?: BoxEntryDocumentRenderOptions },
        { view: BoxEntryDocumentView }
      >("box.renderEntryDocument", {
        sessionId,
        entryId,
        options,
      });
      return result.view;
    },
    async releaseEntryDocument(sessionId, renderSessionId) {
      if (!sessionId || !renderSessionId) {
        throw createError(
          "INVALID_ARGUMENT",
          "box.releaseEntryDocument: sessionId and renderSessionId are required.",
        );
      }
      await client.invoke("box.releaseEntryDocument", { sessionId, renderSessionId });
    },
    async openEntry(sessionId, entryId) {
      if (!sessionId || !entryId) {
        throw createError("INVALID_ARGUMENT", "box.openEntry: sessionId and entryId are required.");
      }
      const result = await client.invoke<{ sessionId: string; entryId: string }, { result: BoxEntryOpenResult }>(
        "box.openEntry",
        {
          sessionId,
          entryId,
        },
      );
      return result.result;
    },
    async resolveEntryResource(sessionId, entryId, resource) {
      if (!sessionId || !entryId) {
        throw createError("INVALID_ARGUMENT", "box.resolveEntryResource: sessionId and entryId are required.");
      }
      if (!resource?.kind) {
        throw createError("INVALID_ARGUMENT", "box.resolveEntryResource: resource.kind is required.");
      }
      const result = await client.invoke<
        {
          sessionId: string;
          entryId: string;
          resource: {
            kind: BoxEntryResourceKind;
            key?: string;
            sizeHint?: {
              width?: number;
              height?: number;
            };
          };
        },
        { resource: ResolvedRuntimeResource }
      >("box.resolveEntryResource", {
        sessionId,
        entryId,
        resource,
      });
      return result.resource;
    },
    async readBoxAsset(sessionId, assetPath) {
      if (!sessionId || !assetPath) {
        throw createError("INVALID_ARGUMENT", "box.readBoxAsset: sessionId and assetPath are required.");
      }
      const result = await client.invoke<
        { sessionId: string; assetPath: string },
        { resource: ResolvedRuntimeResource }
      >("box.readBoxAsset", {
        sessionId,
        assetPath,
      });
      return result.resource;
    },
    async prefetchEntries(sessionId, entryIds, targets) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "box.prefetchEntries: sessionId is required.");
      }
      if (!Array.isArray(entryIds) || entryIds.length === 0) {
        throw createError("INVALID_ARGUMENT", "box.prefetchEntries: entryIds must be a non-empty array.");
      }
      if (!Array.isArray(targets) || targets.length === 0) {
        throw createError("INVALID_ARGUMENT", "box.prefetchEntries: targets must be a non-empty array.");
      }
      await client.invoke("box.prefetchEntries", {
        sessionId,
        entryIds,
        targets,
      });
    },
    async closeView(sessionId) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "box.closeView: sessionId is required.");
      }
      await client.invoke("box.closeView", { sessionId });
    },
    async releaseRenderSession(sessionId) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "box.releaseRenderSession: sessionId is required.");
      }
      await client.invoke("box.releaseRenderSession", { sessionId });
    },
    documentWindow: {
      async render({ boxFile, layoutType, locale, themeId }) {
        if (!boxFile) {
          throw createError("INVALID_ARGUMENT", "box.documentWindow.render: boxFile is required.");
        }

        if (typeof document === "undefined") {
          throw createError(
            "RUNTIME_ENV_UNSUPPORTED",
            "box.documentWindow.render requires a DOM environment.",
          );
        }

        const inspection = await client.invoke<{ boxFile: string }, { inspection: BoxInspectionResult }>("box.inspect", {
          boxFile,
        });
        const resolvedLayoutType =
          normalizeString(layoutType)
          ?? normalizeString(inspection.inspection.content.activeLayoutType)
          ?? normalizeString(inspection.inspection.metadata.activeLayoutType);

        if (!resolvedLayoutType) {
          throw createError("BOX_LAYOUT_NOT_FOUND", "box.documentWindow.render: active layoutType is missing.");
        }

        const descriptor = await client.invoke<{ layoutType: string }, { descriptor: BoxLayoutDescriptor }>(
          "box.readLayoutDescriptor",
          {
            layoutType: resolvedLayoutType,
          },
        );
        const rawConfig = inspection.inspection.content.layoutConfigs[resolvedLayoutType] ?? descriptor.descriptor.defaultConfig ?? {};
        const normalizedConfig = await client.invoke<
          { layoutType: string; config: Record<string, unknown> },
          { config: Record<string, unknown> }
        >("box.normalizeLayoutConfig", {
          layoutType: resolvedLayoutType,
          config: rawConfig,
        });
        const initialQuery = await client.invoke<
          { layoutType: string; config: Record<string, unknown> },
          { query?: BoxEntryQuery }
        >("box.getLayoutInitialQuery", {
          layoutType: resolvedLayoutType,
          config: normalizedConfig.config,
        });
        const opened = await client.invoke<
          { boxFile: string; layoutType?: string; initialQuery?: BoxEntryQuery },
          BoxOpenViewResult
        >("box.openView", {
          boxFile,
          layoutType: resolvedLayoutType,
          initialQuery: initialQuery.query,
        });
        const rendered = await client.invoke<
          {
            layoutType: string;
            sessionId: string;
            box: BoxSessionInfo;
            initialView: BoxEntryPage;
            config: Record<string, unknown>;
            locale?: string;
            themeId?: string;
          },
          { view: BoxLayoutFrameView }
        >("box.renderLayoutFrame", {
          layoutType: resolvedLayoutType,
          sessionId: opened.sessionId,
          box: opened.box,
          initialView: opened.initialView,
          config: normalizedConfig.config,
          locale,
          themeId,
        });

        if (!rendered.view.documentUrl) {
          await safeCloseBoxView(client, opened.sessionId);
          throw createError(
            "INTERNAL_ERROR",
            "box.documentWindow.render requires Host to return view.documentUrl.",
          );
        }

        const frameResult = createFrameFromUrl(
          rendered.view.documentUrl,
          rendered.view.title ?? opened.box.name ?? "Box",
          "allow-scripts allow-forms",
          {
            release: async () => {
              await Promise.allSettled([
                client.invoke("box.releaseRenderSession", { sessionId: rendered.view.sessionId }),
                client.invoke("box.closeView", { sessionId: opened.sessionId }),
              ]);
            },
          },
        );
        const cleanupBridge = attachBoxLayoutRuntimeBridge(frameResult.frame, client, opened.sessionId, {
          locale,
          themeId,
        });
        const originalDispose = frameResult.dispose;
        frameResult.dispose = async () => {
          cleanupBridge();
          await originalDispose();
        };
        return frameResult;
      },
      onReady(frame, handler) {
        return subscribeToFrameReady(frame, [BOX_LAYOUT_READY_EVENT], handler);
      },
      onError(frame, handler) {
        return subscribeToFrameMessage<BoxLayoutRenderErrorPayload>(
          frame,
          BOX_LAYOUT_ERROR_EVENT,
          (payload) => {
            handler({
              code: typeof payload?.code === "string" ? payload.code : "BOX_LAYOUT_RENDER_FAILED",
              message: typeof payload?.message === "string" ? payload.message : "Box layout render failed.",
              layoutType: typeof payload?.layoutType === "string" ? payload.layoutType : undefined,
              pluginId: typeof payload?.pluginId === "string" ? payload.pluginId : undefined,
              sessionId: typeof payload?.sessionId === "string" ? payload.sessionId : undefined,
            });
          },
        );
      },
    },
    editorPanel: {
      async render({ layoutType, entries, initialConfig, locale, themeId, resources }) {
        if (!layoutType) {
          throw createError("INVALID_ARGUMENT", "box.editorPanel.render: layoutType is required.");
        }
        if (!Array.isArray(entries)) {
          throw createError("INVALID_ARGUMENT", "box.editorPanel.render: entries must be an array.");
        }
        if (typeof document === "undefined") {
          throw createError(
            "RUNTIME_ENV_UNSUPPORTED",
            "box.editorPanel.render requires a DOM environment.",
          );
        }

        const normalizedConfig = await client.invoke<
          { layoutType: string; config: Record<string, unknown> },
          { config: Record<string, unknown> }
        >("box.normalizeLayoutConfig", {
          layoutType,
          config: initialConfig ?? {},
        });
        const rendered = await client.invoke<
          {
            layoutType: string;
            entries: BoxEntrySnapshot[];
            initialConfig: Record<string, unknown>;
            locale?: string;
            themeId?: string;
          },
          { view: BoxLayoutEditorView }
        >("box.renderLayoutEditor", {
          layoutType,
          entries,
          initialConfig: normalizedConfig.config,
          locale,
          themeId,
        });

        if (!rendered.view.documentUrl) {
          throw createError(
            "INTERNAL_ERROR",
            "box.editorPanel.render requires Host to return view.documentUrl.",
          );
        }

        const frameResult = createFrameFromUrl(
          rendered.view.documentUrl,
          rendered.view.title ?? `${layoutType} Editor`,
          "allow-scripts allow-forms",
          {
            release: () => client.invoke("box.releaseRenderSession", { sessionId: rendered.view.sessionId }).then(() => undefined),
          },
        );
        const cleanupBridge = attachBoxLayoutEditorAssetBridge(frameResult.frame, resources);
        const originalDispose = frameResult.dispose;
        frameResult.dispose = async () => {
          cleanupBridge();
          await originalDispose();
        };
        return frameResult;
      },
      onReady(frame, handler) {
        return subscribeToFrameReady(frame, [BOX_LAYOUT_EDITOR_READY_EVENT], handler);
      },
      onChange(frame, handler) {
        return subscribeToFrameMessage<BoxLayoutEditorChangePayload>(frame, BOX_LAYOUT_EDITOR_CHANGE_EVENT, handler);
      },
      onError(frame, handler) {
        return subscribeToFrameMessage<BoxLayoutEditorErrorPayload>(frame, BOX_LAYOUT_EDITOR_ERROR_EVENT, handler);
      },
    },
  };
}

async function safeCloseBoxView(client: CoreClient, sessionId: string): Promise<void> {
  await client.invoke("box.closeView", { sessionId }).catch(() => undefined);
}

function attachBoxLayoutRuntimeBridge(
  frame: HTMLIFrameElement,
  client: CoreClient,
  sessionId: string,
  renderContext: { locale?: string; themeId?: string } = {},
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: MessageEvent) => {
    if (!event || event.source !== frame.contentWindow) {
      return;
    }
    if (!isAllowedFrameOrigin(frame, event.origin)) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    const record = data as { type?: string; payload?: unknown };
    if (record.type !== BOX_LAYOUT_RUNTIME_REQUEST_EVENT) {
      return;
    }

    const payload = record.payload as BoxLayoutRuntimeRequestPayload | undefined;
    const source = event.source as Window | null;
    if (!payload?.requestId || !source || typeof source.postMessage !== "function") {
      return;
    }

    void handleBoxLayoutRuntimeRequest(client, sessionId, payload, renderContext)
      .then((result) => {
        source.postMessage(
          {
            type: BOX_LAYOUT_RUNTIME_RESPONSE_EVENT,
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
            type: BOX_LAYOUT_RUNTIME_RESPONSE_EVENT,
            payload: {
              requestId: payload.requestId,
              ok: false,
              message: error instanceof Error ? error.message : String(error),
            },
          },
          "*",
        );
      });
  };

  window.addEventListener("message", listener);
  return () => {
    window.removeEventListener("message", listener);
  };
}

async function handleBoxLayoutRuntimeRequest(
  client: CoreClient,
  sessionId: string,
  payload: BoxLayoutRuntimeRequestPayload,
  renderContext: { locale?: string; themeId?: string },
): Promise<unknown> {
  const effectiveSessionId = normalizeString(sessionId);
  if (!effectiveSessionId) {
    throw createError("INVALID_ARGUMENT", "box.documentWindow.runtime: sessionId is required.");
  }

  switch (payload.action) {
    case "listEntries": {
      const result = await client.invoke<{ sessionId: string; query?: BoxEntryQuery }, { page: BoxEntryPage }>(
        "box.listEntries",
        {
          sessionId: effectiveSessionId,
          query: payload.query ?? payload.request?.query,
        },
      );
      return result.page;
    }
    case "readEntryDetail": {
      const entryIds = Array.isArray(payload.request?.entryIds) ? payload.request?.entryIds : [];
      const fields = Array.isArray(payload.request?.fields) ? payload.request?.fields : [];
      const result = await client.invoke<
        { sessionId: string; entryIds: string[]; fields: BoxEntryDetailField[] },
        { items: BoxEntryDetailItem[] }
      >("box.readEntryDetail", {
        sessionId: effectiveSessionId,
        entryIds,
        fields,
      });
      return result.items;
    }
    case "renderEntryCover": {
      const entryId = normalizeString(payload.entryId);
      if (!entryId) {
        throw createError("INVALID_ARGUMENT", "box.documentWindow.runtime.renderEntryCover: entryId is required.");
      }
      const result = await client.invoke<{ sessionId: string; entryId: string }, { view: BoxEntryCoverView }>(
        "box.renderEntryCover",
        {
          sessionId: effectiveSessionId,
          entryId,
        },
      );
      return result.view;
    }
    case "renderEntryDocument": {
      const entryId = normalizeString(payload.entryId);
      if (!entryId) {
        throw createError(
          "INVALID_ARGUMENT",
          "box.documentWindow.runtime.renderEntryDocument: entryId is required.",
        );
      }
      const result = await client.invoke<
        {
          sessionId: string;
          entryId: string;
          options?: BoxEntryDocumentRenderOptions;
        },
        { view: BoxEntryDocumentView }
      >("box.renderEntryDocument", {
        sessionId: effectiveSessionId,
        entryId,
        options: {
          mode: payload.options?.mode,
          interactionPolicy: payload.options?.interactionPolicy,
          locale: renderContext.locale,
          themeId: renderContext.themeId,
        },
      });
      return result.view;
    }
    case "releaseEntryDocument": {
      const renderSessionId = normalizeString(payload.renderSessionId);
      if (!renderSessionId) {
        throw createError(
          "INVALID_ARGUMENT",
          "box.documentWindow.runtime.releaseEntryDocument: renderSessionId is required.",
        );
      }
      await client.invoke("box.releaseEntryDocument", {
        sessionId: effectiveSessionId,
        renderSessionId,
      });
      return null;
    }
    case "resolveEntryResource": {
      const entryId = normalizeString(payload.request?.entryId) ?? normalizeString(payload.entryId);
      const resource = payload.request?.resource;
      if (!entryId || !resource?.kind) {
        throw createError(
          "INVALID_ARGUMENT",
          "box.documentWindow.runtime.resolveEntryResource: entryId and resource.kind are required.",
        );
      }
      const result = await client.invoke<
        {
          sessionId: string;
          entryId: string;
          resource: {
            kind: BoxEntryResourceKind;
            key?: string;
            sizeHint?: {
              width?: number;
              height?: number;
            };
          };
        },
        { resource: ResolvedRuntimeResource }
      >("box.resolveEntryResource", {
        sessionId: effectiveSessionId,
        entryId,
        resource,
      });
      return result.resource;
    }
    case "readBoxAsset": {
      const assetPath = normalizeString(payload.assetPath);
      if (!assetPath) {
        throw createError("INVALID_ARGUMENT", "box.documentWindow.runtime.readBoxAsset: assetPath is required.");
      }
      const result = await client.invoke<{ sessionId: string; assetPath: string }, { resource: ResolvedRuntimeResource }>(
        "box.readBoxAsset",
        {
          sessionId: effectiveSessionId,
          assetPath,
        },
      );
      return result.resource;
    }
    case "prefetchEntries": {
      const entryIds = Array.isArray(payload.request?.entryIds) ? payload.request.entryIds : [];
      const targets = Array.isArray(payload.request?.targets) ? payload.request.targets : [];
      await client.invoke("box.prefetchEntries", {
        sessionId: effectiveSessionId,
        entryIds,
        targets,
      });
      return null;
    }
    case "openEntry": {
      const entryId = normalizeString(payload.entryId);
      if (!entryId) {
        throw createError("INVALID_ARGUMENT", "box.documentWindow.runtime.openEntry: entryId is required.");
      }
      const result = await client.invoke<{ sessionId: string; entryId: string }, { result: BoxEntryOpenResult }>(
        "box.openEntry",
        {
          sessionId: effectiveSessionId,
          entryId,
        },
      );
      return result.result;
    }
    default:
      throw createError("INVALID_ARGUMENT", `Unsupported box layout runtime action: ${String(payload.action)}`);
  }
}

function attachBoxLayoutEditorAssetBridge(
  frame: HTMLIFrameElement,
  resources?: BoxLayoutEditorAssetBridge,
): () => void {
  if (typeof window === "undefined" || !resources) {
    return () => undefined;
  }

  const listener = (event: MessageEvent) => {
    if (!event || event.source !== frame.contentWindow) {
      return;
    }
    if (!isAllowedFrameOrigin(frame, event.origin)) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    const record = data as { type?: string; payload?: unknown };
    if (record.type !== BOX_LAYOUT_EDITOR_ASSET_REQUEST_EVENT) {
      return;
    }

    const payload = record.payload as BoxLayoutEditorAssetRequestPayload | undefined;
    const source = event.source as Window | null;
    if (!payload?.requestId || !source || typeof source.postMessage !== "function") {
      return;
    }

    void handleBoxLayoutEditorAssetRequest(resources, payload)
      .then((result) => {
        source.postMessage(
          {
            type: BOX_LAYOUT_EDITOR_ASSET_RESPONSE_EVENT,
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
            type: BOX_LAYOUT_EDITOR_ASSET_RESPONSE_EVENT,
            payload: {
              requestId: payload.requestId,
              ok: false,
              message: error instanceof Error ? error.message : String(error),
            },
          },
          "*",
        );
      });
  };

  window.addEventListener("message", listener);
  return () => {
    window.removeEventListener("message", listener);
  };
}

async function handleBoxLayoutEditorAssetRequest(
  resources: BoxLayoutEditorAssetBridge,
  payload: BoxLayoutEditorAssetRequestPayload,
): Promise<unknown> {
  switch (payload.action) {
    case "readBoxAsset": {
      const assetPath = normalizeRelativePath(payload.assetPath);
      if (!assetPath) {
        throw createError("INVALID_ARGUMENT", "box.editorPanel.asset.read: assetPath is required.");
      }
      if (resources.readBoxAsset) {
        return resources.readBoxAsset(assetPath);
      }
      if (resources.rootPath) {
        return {
          resourceUrl: createFileUrl(joinResourcePath(resources.rootPath, assetPath)),
          mimeType: guessMimeType(assetPath),
        } satisfies ResolvedRuntimeResource;
      }
      throw createError(
        "RUNTIME_ENV_UNSUPPORTED",
        "box.editorPanel.asset.read requires resources.readBoxAsset or resources.rootPath.",
      );
    }
    case "importBoxAsset": {
      if (!resources.importBoxAsset) {
        throw createError(
          "RUNTIME_ENV_UNSUPPORTED",
          "box.editorPanel.asset.import requires resources.importBoxAsset.",
        );
      }
      if (!(payload.file instanceof File)) {
        throw createError("INVALID_ARGUMENT", "box.editorPanel.asset.import requires a File payload.");
      }
      return resources.importBoxAsset({
        file: payload.file,
        preferredPath: normalizeRelativePath(payload.preferredPath ?? payload.file.name) ?? undefined,
      });
    }
    case "deleteBoxAsset": {
      const assetPath = normalizeRelativePath(payload.assetPath);
      if (!assetPath) {
        throw createError("INVALID_ARGUMENT", "box.editorPanel.asset.delete: assetPath is required.");
      }
      if (!resources.deleteBoxAsset) {
        throw createError(
          "RUNTIME_ENV_UNSUPPORTED",
          "box.editorPanel.asset.delete requires resources.deleteBoxAsset.",
        );
      }
      await resources.deleteBoxAsset(assetPath);
      return null;
    }
    default:
      throw createError("INVALID_ARGUMENT", `Unsupported box editor asset action: ${String(payload.action)}`);
  }
}

function subscribeToFrameReady(
  frame: HTMLIFrameElement,
  eventTypes: string[],
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

  const cleanupTasks = eventTypes.map((type) => subscribeToFrameMessage(frame, type, () => invokeOnce()));
  const handleLoad = () => {
    invokeOnce();
  };

  if (typeof frame.addEventListener === "function" && typeof frame.removeEventListener === "function") {
    frame.addEventListener("load", handleLoad);
    cleanupTasks.push(() => frame.removeEventListener("load", handleLoad));
  }

  return () => {
    cleanupTasks.forEach((task) => task());
  };
}

function subscribeToFrameMessage<T>(
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

  const listener = (event: MessageEvent) => {
    if (!event || event.source !== frame.contentWindow) {
      return;
    }
    if (!isAllowedFrameOrigin(frame, event.origin)) {
      return;
    }
    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    const record = data as { type?: string; payload?: unknown };
    if (record.type !== type) {
      return;
    }
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
    // keep current origin as safe fallback
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
    typeof (window as { addEventListener?: unknown }).addEventListener === "function"
    && typeof (window as { removeEventListener?: unknown }).removeEventListener === "function"
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

function normalizeRelativePath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\\/g, "/").trim();
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

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}


function createBoxSessionApi(client: CoreClient): BoxSessionApi {
  const subscribe = <T>(event: string, handler: (payload: T) => void): (() => void) => {
    return client.events.on(event, (payload) => {
      handler(payload as T);
    });
  };

  const require = (sessionId: string): void => {
    if (!sessionId) {
      throw createError("INVALID_ARGUMENT", "box.session: sessionId is required.");
    }
  };

  return {
    async create(name, layoutType, parentPath) {
      if (!name || !layoutType || !parentPath) {
        throw createError("INVALID_ARGUMENT", "box.session.create: name, layoutType and parentPath are required.");
      }
      return client.invoke<{ name: string; layoutType: string; parentPath: string }, { boxFile: string; metadata: BoxMetadata }>(
        "box.create",
        { name, layoutType, parentPath },
      );
    },
    async rename(boxFile, newName) {
      if (!boxFile || !newName) {
        throw createError("INVALID_ARGUMENT", "box.session.rename: boxFile and newName are required.");
      }
      return client.invoke<{ boxFile: string; newName: string }, { boxFile: string; metadata: BoxMetadata }>(
        "box.rename",
        { boxFile, newName },
      );
    },
    async open(boxFile) {
      if (!boxFile) {
        throw createError("INVALID_ARGUMENT", "box.session.open: boxFile is required.");
      }
      return client.invoke<{ boxFile: string }, { sessionId: string; snapshot: BoxSessionSnapshot }>(
        "box.session.open",
        { boxFile },
      );
    },
    async get(sessionId) {
      require(sessionId);
      const result = await client.invoke<{ sessionId: string }, { snapshot: BoxSessionSnapshot }>(
        "box.session.get",
        { sessionId },
      );
      return result.snapshot;
    },
    async addEntry(sessionId, input) {
      require(sessionId);
      const result = await client.invoke<{ sessionId: string; url?: string; filePath?: string }, { snapshot: BoxSessionSnapshot }>(
        "box.session.addEntry",
        { sessionId, url: input.url, filePath: input.filePath },
      );
      return result.snapshot;
    },
    async addEmbeddedCard(sessionId, cardFile, preferredName) {
      require(sessionId);
      if (!cardFile) {
        throw createError("INVALID_ARGUMENT", "box.session.addEmbeddedCard: cardFile is required.");
      }
      const result = await client.invoke<{ sessionId: string; cardFile: string; preferredName?: string }, { snapshot: BoxSessionSnapshot }>(
        "box.session.addEmbeddedCard",
        { sessionId, cardFile, preferredName },
      );
      return result.snapshot;
    },
    async updateEntry(sessionId, entryId, patch) {
      require(sessionId);
      if (!entryId) {
        throw createError("INVALID_ARGUMENT", "box.session.updateEntry: entryId is required.");
      }
      const result = await client.invoke<{ sessionId: string; entryId: string; patch: Partial<BoxEntrySnapshot> }, { snapshot: BoxSessionSnapshot }>(
        "box.session.updateEntry",
        { sessionId, entryId, patch },
      );
      return result.snapshot;
    },
    async moveEntry(sessionId, entryId, targetIndex) {
      require(sessionId);
      if (!entryId) {
        throw createError("INVALID_ARGUMENT", "box.session.moveEntry: entryId is required.");
      }
      const result = await client.invoke<{ sessionId: string; entryId: string; targetIndex: number }, { snapshot: BoxSessionSnapshot }>(
        "box.session.moveEntry",
        { sessionId, entryId, targetIndex },
      );
      return result.snapshot;
    },
    async removeEntry(sessionId, entryId) {
      require(sessionId);
      if (!entryId) {
        throw createError("INVALID_ARGUMENT", "box.session.removeEntry: entryId is required.");
      }
      const result = await client.invoke<{ sessionId: string; entryId: string }, { snapshot: BoxSessionSnapshot }>(
        "box.session.removeEntry",
        { sessionId, entryId },
      );
      return result.snapshot;
    },
    async updateMetadata(sessionId, patch) {
      require(sessionId);
      const result = await client.invoke<
        {
          sessionId: string;
          patch: { name?: string; description?: string; coverRatio?: string; tags?: Array<string | string[]>; coverAsset?: string };
        },
        { snapshot: BoxSessionSnapshot }
      >("box.session.updateMetadata", { sessionId, patch });
      return result.snapshot;
    },
    async updateLayoutConfig(sessionId, layoutType, config) {
      require(sessionId);
      if (!layoutType) {
        throw createError("INVALID_ARGUMENT", "box.session.updateLayoutConfig: layoutType is required.");
      }
      const result = await client.invoke<{ sessionId: string; layoutType: string; config: Record<string, unknown> }, { snapshot: BoxSessionSnapshot }>(
        "box.session.updateLayoutConfig",
        { sessionId, layoutType, config },
      );
      return result.snapshot;
    },
    async importAsset(sessionId, input) {
      require(sessionId);
      if (!input.data) {
        throw createError("INVALID_ARGUMENT", "box.session.importAsset: data is required.");
      }
      return client.invoke<{ sessionId: string; data: Uint8Array; preferredPath?: string }, { assetPath: string }>(
        "box.session.importAsset",
        {
          sessionId,
          data: new Uint8Array(input.data.buffer.slice(input.data.byteOffset, input.data.byteOffset + input.data.byteLength)),
          preferredPath: input.preferredPath,
        },
      );
    },
    async deleteAsset(sessionId, assetPath) {
      require(sessionId);
      if (!assetPath) {
        throw createError("INVALID_ARGUMENT", "box.session.deleteAsset: assetPath is required.");
      }
      await client.invoke("box.session.deleteAsset", { sessionId, assetPath });
    },
    async updateCover(sessionId, input) {
      require(sessionId);
      if (!input.html) {
        throw createError("INVALID_ARGUMENT", "box.session.updateCover: html is required.");
      }
      const result = await client.invoke<
        { sessionId: string; html: string; ratio?: string; resources?: Array<{ path: string; data: Uint8Array }> },
        { snapshot: BoxSessionSnapshot }
      >("box.session.updateCover", {
        sessionId,
        html: input.html,
        ratio: input.ratio,
        resources: input.resources
          ? input.resources.map((resource) => ({
              path: resource.path,
              data: new Uint8Array(resource.data.buffer.slice(resource.data.byteOffset, resource.data.byteOffset + resource.data.byteLength)),
            }))
          : undefined,
      });
      return result.snapshot;
    },
    async persist(sessionId) {
      require(sessionId);
      const result = await client.invoke<{ sessionId: string }, { snapshot: BoxSessionSnapshot }>(
        "box.session.persist",
        { sessionId },
      );
      return result.snapshot;
    },
    async undo(sessionId) {
      require(sessionId);
      const result = await client.invoke<{ sessionId: string }, { snapshot: BoxSessionSnapshot }>(
        "box.session.undo",
        { sessionId },
      );
      return result.snapshot;
    },
    async redo(sessionId) {
      require(sessionId);
      const result = await client.invoke<{ sessionId: string }, { snapshot: BoxSessionSnapshot }>(
        "box.session.redo",
        { sessionId },
      );
      return result.snapshot;
    },
    async history(sessionId) {
      require(sessionId);
      const result = await client.invoke<{ sessionId: string }, { history: BoxSessionHistoryView }>(
        "box.session.history",
        { sessionId },
      );
      return result.history;
    },
    async close(sessionId) {
      require(sessionId);
      await client.invoke("box.session.close", { sessionId });
    },
    onOpened(handler) {
      return subscribe("box.session.opened", handler);
    },
    onPersisted(handler) {
      return subscribe("box.session.persisted", handler);
    },
    onPersistError(handler) {
      return subscribe("box.session.persist-error", handler);
    },
    onClosed(handler) {
      return subscribe("box.session.closed", handler);
    },
    onUndo(handler) {
      return subscribe("box.session.undo", handler);
    },
    onRedo(handler) {
      return subscribe("box.session.redo", handler);
    },
  };
}
