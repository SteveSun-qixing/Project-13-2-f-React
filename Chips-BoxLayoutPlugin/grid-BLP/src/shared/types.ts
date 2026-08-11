export interface ResolvedRuntimeResource {
  resourceUrl: string;
  mimeType: string;
  cacheKey?: string;
  expiresAt?: string;
  width?: number;
  height?: number;
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

export interface BoxSessionInfo {
  boxId: string;
  boxFile: string;
  name: string;
  activeLayoutType: string;
  availableLayouts: string[];
  coverRatio?: string;
  tags?: Array<string | string[]>;
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

export interface BoxEntrySnapshot {
  entryId: string;
  url: string;
  enabled: boolean;
  snapshot: {
    documentId?: string;
    title?: string;
    summary?: string;
    tags?: Array<string | string[]>;
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

export interface BoxEntryPage {
  items: BoxEntrySnapshot[];
  total: number;
  nextCursor?: string;
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

export interface BoxLayoutRuntime {
  listEntries(query?: BoxEntryQuery): Promise<BoxEntryPage>;
  readEntryDetail(request: {
    entryIds: string[];
    fields: Array<"documentInfo" | "coverDescriptor" | "previewDescriptor" | "runtimeProps" | "status">;
  }): Promise<Array<{ entryId: string; detail: Record<string, unknown> }>>;
  renderEntryCover(entryId: string): Promise<BoxEntryCoverView>;
  renderEntryDocument(
    entryId: string,
    options?: {
      mode?: "view" | "preview";
      interactionPolicy?: "native" | "delegate";
    },
  ): Promise<BoxEntryDocumentView>;
  releaseEntryDocument(renderSessionId: string): Promise<void>;
  resolveEntryResource(request: {
    entryId: string;
    resource: {
      kind: "cover" | "preview" | "documentFile" | "custom";
      key?: string;
      sizeHint?: { width?: number; height?: number };
    };
  }): Promise<ResolvedRuntimeResource>;
  readBoxAsset(assetPath: string): Promise<ResolvedRuntimeResource>;
  prefetchEntries(request: {
    entryIds: string[];
    targets: Array<"cover" | "preview" | "documentInfo">;
  }): Promise<void>;
  openEntry(entryId: string): Promise<{
    mode: "document-window" | "external";
    documentType?: "card" | "box";
    windowId?: string;
    pluginId?: string;
    url?: string;
  }>;
}
