export type BasecardConfigRecord = Record<string, unknown>;

export interface EditorValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface BasecardResourceImportRequest {
  file: File;
  preferredPath?: string;
}

export interface BasecardResourceImportResult {
  path: string;
}

export interface BasecardPendingResourceImport {
  path: string;
  data: Uint8Array;
  mimeType?: string;
}

export interface BasecardResourceOperations {
  imports: BasecardPendingResourceImport[];
  deletions: string[];
}

export interface BasecardRenderContext {
  container: HTMLElement;
  config: BasecardConfigRecord;
  themeCssText?: string;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
}

export interface BasecardEditorContext {
  container: HTMLElement;
  initialConfig: BasecardConfigRecord;
  onChange: (next: BasecardConfigRecord) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (input: BasecardResourceImportRequest) => Promise<BasecardResourceImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
}

export interface BasecardDescriptor {
  pluginId: string;
  cardType: string;
  displayName: string;
  commitDebounceMs?: number;
  createInitialConfig: (baseCardId: string) => BasecardConfigRecord;
  normalizeConfig: (input: BasecardConfigRecord, baseCardId: string) => BasecardConfigRecord;
  validateConfig: (config: BasecardConfigRecord) => EditorValidationResult;
  collectResourcePaths?: (config: BasecardConfigRecord) => string[];
  renderView: (ctx: BasecardRenderContext) => (() => void) | void;
  renderEditor?: (ctx: BasecardEditorContext) => (() => void) | void;
}
