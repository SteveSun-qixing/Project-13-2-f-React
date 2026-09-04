import type { IconDescriptor } from "chips-sdk";

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

export interface BasecardArchiveImportFilter {
  mimeTypes?: string[];
  extensions?: string[];
}

export interface BasecardArchiveImportRequest {
  file: File;
  preferredRootDir?: string;
  entryFile?: string;
  include?: BasecardArchiveImportFilter;
  stripSingleRootDir?: boolean;
  excludeSystemArtifacts?: boolean;
}

export interface BasecardArchiveImportedEntry {
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

export interface BasecardArchiveDiscardedEntry {
  sourcePath: string;
  reason: 'directory' | 'system-artifact' | 'filter-mismatch' | 'unsafe-path';
  fileName?: string;
  mimeType?: string;
}

export interface BasecardArchiveImportResult {
  rootDir: string;
  entryFile?: string;
  resourcePaths: string[];
  entries: BasecardArchiveImportedEntry[];
  discardedEntries: BasecardArchiveDiscardedEntry[];
}

export interface BasecardTiffToPngRequest {
  resourcePath: string;
  outputPath: string;
  overwrite?: boolean;
}

export interface BasecardTiffToPngResult {
  path: string;
  mimeType: "image/png";
  sourceMimeType: "image/tiff";
  width?: number;
  height?: number;
}

export interface BasecardVideoThumbnailRequest {
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

export interface BasecardVideoThumbnailResult {
  path: string;
  mimeType: "image/png" | "image/jpeg";
  sourceMimeType: string;
  width: number;
  height: number;
  format: "png" | "jpeg";
  frameTimeSeconds: number;
  durationSeconds?: number;
}

export interface BasecardPendingResourceImport {
  path: string;
  data: Uint8Array;
  mimeType?: string;
  token?: string;
}

export interface BasecardResourceOperations {
  imports: BasecardPendingResourceImport[];
  deletions: string[];
}

export interface BasecardOpenResourceInput {
  resourceId: string;
  mimeType?: string;
  title?: string;
  fileName?: string;
  payload?: Record<string, unknown>;
}

export interface BasecardRenderContext {
  container: HTMLElement;
  config: BasecardConfigRecord;
  themeCssText?: string;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: BasecardOpenResourceInput) => void;
}

export interface BasecardEditorContext {
  container: HTMLElement;
  initialConfig: BasecardConfigRecord;
  onChange: (next: BasecardConfigRecord) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (input: BasecardResourceImportRequest) => Promise<BasecardResourceImportResult>;
  importArchiveBundle?: (input: BasecardArchiveImportRequest) => Promise<BasecardArchiveImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  convertTiffToPng?: (input: BasecardTiffToPngRequest) => Promise<BasecardTiffToPngResult>;
  extractVideoThumbnail?: (input: BasecardVideoThumbnailRequest) => Promise<BasecardVideoThumbnailResult>;
}

export interface BasecardDescriptor {
  pluginId: string;
  cardType: string;
  displayName: string;
  description?: string;
  icon?: IconDescriptor;
  aliases?: readonly string[];
  commitDebounceMs?: number;
  previewPointerEvents?: 'native' | 'shielded';
  createInitialConfig: (baseCardId: string) => BasecardConfigRecord;
  normalizeConfig: (input: BasecardConfigRecord, baseCardId: string) => BasecardConfigRecord;
  validateConfig: (config: BasecardConfigRecord) => EditorValidationResult;
  collectResourcePaths?: (config: BasecardConfigRecord) => string[];
  renderView: (ctx: BasecardRenderContext) => (() => void) | void;
  renderEditor?: (ctx: BasecardEditorContext) => (() => void) | void;
}
