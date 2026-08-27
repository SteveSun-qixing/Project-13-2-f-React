import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export interface ResourceUri {
  uri: string;
}

export type ResourceOpenPayload = Record<string, unknown>;

export interface MusicCardOpenTeamRole {
  id: string;
  role: string;
  people: string[];
}

export interface MusicCardOpenResource {
  resourceId: string;
  relativePath: string;
  fileName?: string;
  mimeType?: string;
}

export interface MusicCardOpenPayload {
  kind: "chips.music-card";
  version: "1.0.0";
  cardType: "base.music";
  config: {
    card_type: "MusicCard";
    theme?: string;
    audio_file: string;
    music_name: string;
    album_cover: string;
    lyrics_file: string;
    production_team: MusicCardOpenTeamRole[];
    release_date: string;
    album_name: string;
    language: string;
    genre: string;
  };
  resources: {
    audio: MusicCardOpenResource;
    cover?: MusicCardOpenResource;
    lyrics?: MusicCardOpenResource;
  };
  display: {
    title: string;
    artist: string;
  };
}

export interface BookCardOpenResource {
  resourceId: string;
  relativePath: string;
  fileName?: string;
  mimeType?: string;
}

export interface BookCardOpenPayload {
  kind: "chips.book-card";
  version: "1.0.0";
  cardType: "base.book";
  mode: "ebook" | "image-sequence";
  resources: {
    book?: BookCardOpenResource;
    images?: BookCardOpenResource[];
  };
  display: {
    title: string;
    author?: string;
  };
}

export interface VideoCardOpenResource {
  resourceId: string;
  relativePath: string;
  fileName?: string;
  mimeType?: string;
}

export interface VideoCardOpenSubtitleResource extends VideoCardOpenResource {
  id: string;
  label?: string;
  language?: string;
  kind: "subtitles" | "captions";
  default?: boolean;
}

export interface VideoCardOpenPayload {
  kind: "chips.video-card";
  version: "1.0.0";
  cardType: "base.video";
  config: {
    card_type: "VideoCard";
    theme?: string;
    video_file: string;
    cover_image: string;
    subtitles: Array<{
      id: string;
      label: string;
      language: string;
      kind: "subtitles" | "captions";
      file_path: string;
      default: boolean;
    }>;
    playback: {
      autoplay: boolean;
      loop: boolean;
      muted: boolean;
      playback_rate: number;
      start_time: number;
    };
    video_title: string;
    publish_time: string;
    creator: string;
  };
  resources: {
    video: VideoCardOpenResource;
    cover?: VideoCardOpenResource;
    subtitles?: VideoCardOpenSubtitleResource[];
  };
  display: {
    title: string;
    creator?: string;
    publishTime?: string;
  };
  playback: {
    autoplay: boolean;
    loop: boolean;
    muted: boolean;
    playbackRate: number;
    startTime: number;
  };
}

export interface ResourceOpenRequest {
  intent?: string;
  resource: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    payload?: ResourceOpenPayload;
  };
}

export interface ResourceOpenResolvedResource {
  resourceId: string;
  filePath?: string;
  mimeType?: string;
  extension?: string;
  fileName?: string;
}

export interface ResourceOpenResult {
  mode: "plugin" | "shell" | "external";
  pluginId?: string;
  windowId?: string;
  matchedCapability?: string;
  resolved: ResourceOpenResolvedResource;
}

export interface ResourceMeta {
  path?: string;
  mimeType?: string;
  size?: number;
  isFile?: boolean;
  isDirectory?: boolean;
  mtimeMs?: number;
  [key: string]: unknown;
}

export interface ResourceConvertTiffToPngRequest {
  resourceId: string;
  outputFile: string;
  overwrite?: boolean;
}

export interface ResourceConvertTiffToPngResult {
  outputFile: string;
  mimeType: "image/png";
  sourceMimeType: "image/tiff";
  width?: number;
  height?: number;
}

export interface ResourceExtractVideoFrameRequest {
  resourceId: string;
  outputFile: string;
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

export interface ResourceExtractVideoFrameResult {
  outputFile: string;
  mimeType: "image/png" | "image/jpeg";
  sourceMimeType: string;
  width: number;
  height: number;
  format: "png" | "jpeg";
  frameTimeSeconds: number;
  durationSeconds?: number;
}

export interface ResourceArchiveImportFilter {
  mimeTypes?: string[];
  extensions?: string[];
}

export interface ResourceArchiveImportedEntry {
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

export interface ResourceArchiveDiscardedEntry {
  sourcePath: string;
  reason: "directory" | "system-artifact" | "filter-mismatch" | "unsafe-path";
  fileName?: string;
  mimeType?: string;
}

export interface ResourceArchiveImportRequest {
  zipFile: string;
  targetRoot: string;
  preferredRootDir?: string;
  entryFile?: string;
  include?: ResourceArchiveImportFilter;
  stripSingleRootDir?: boolean;
  excludeSystemArtifacts?: boolean;
}

export interface ResourceArchiveImportResult {
  rootDir: string;
  entryFile?: string;
  resourcePaths: string[];
  entries: ResourceArchiveImportedEntry[];
  discardedEntries: ResourceArchiveDiscardedEntry[];
}

export interface ResourceApi {
  resolve(resourceId: string): Promise<ResourceUri>;
  open(request: ResourceOpenRequest): Promise<ResourceOpenResult>;
  readMetadata(resourceId: string): Promise<ResourceMeta>;
  readBinary(resourceId: string): Promise<ArrayBuffer>;
  convertTiffToPng(request: ResourceConvertTiffToPngRequest): Promise<ResourceConvertTiffToPngResult>;
  extractVideoFrame(request: ResourceExtractVideoFrameRequest): Promise<ResourceExtractVideoFrameResult>;
  importArchive(request: ResourceArchiveImportRequest): Promise<ResourceArchiveImportResult>;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toOwnedArrayBuffer(value: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  const copy = new Uint8Array(value.byteLength);
  copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return copy.buffer;
}

function isBufferJsonPayload(value: unknown): value is { type: "Buffer"; data: number[] } {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type?: unknown }).type === "Buffer" &&
    "data" in value &&
    Array.isArray((value as { data?: unknown }).data)
  );
}

function normalizeBinaryPayload(value: unknown): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return toOwnedArrayBuffer(value);
  }

  if (ArrayBuffer.isView(value)) {
    return toOwnedArrayBuffer(value);
  }

  if (isBufferJsonPayload(value)) {
    return Uint8Array.from(value.data).buffer;
  }

  if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
    return Uint8Array.from(value).buffer;
  }

  if (value && typeof value === "object" && "data" in value) {
    return normalizeBinaryPayload((value as { data?: unknown }).data);
  }

  throw createError("INVALID_RESPONSE", "resource.readBinary: response is not binary content.");
}

export function createResourceApi(client: CoreClient): ResourceApi {
  return {
    async resolve(resourceId) {
      if (!resourceId) {
        throw createError("INVALID_ARGUMENT", "resource.resolve: resourceId is required.");
      }
      return client.invoke("resource.resolve", { resourceId });
    },
    async open(request) {
      if (!request?.resource || typeof request.resource !== "object") {
        throw createError("INVALID_ARGUMENT", "resource.open: request.resource is required.");
      }
      const resourceId = normalizeOptionalString(request.resource.resourceId);
      if (!resourceId) {
        throw createError("INVALID_ARGUMENT", "resource.open: resource.resourceId is required.");
      }
      const payload: ResourceOpenRequest = {
        ...(normalizeOptionalString(request.intent) ? { intent: normalizeOptionalString(request.intent) } : undefined),
        resource: {
          resourceId,
          ...(normalizeOptionalString(request.resource.mimeType)
            ? { mimeType: normalizeOptionalString(request.resource.mimeType) }
            : undefined),
          ...(normalizeOptionalString(request.resource.title)
            ? { title: normalizeOptionalString(request.resource.title) }
            : undefined),
          ...(normalizeOptionalString(request.resource.fileName)
            ? { fileName: normalizeOptionalString(request.resource.fileName) }
            : undefined),
          ...(normalizeOptionalRecord(request.resource.payload)
            ? { payload: normalizeOptionalRecord(request.resource.payload) }
            : undefined),
        },
      };
      const result = await client.invoke<ResourceOpenRequest, { result: ResourceOpenResult }>("resource.open", payload);
      return result.result;
    },
    async readMetadata(resourceId) {
      if (!resourceId) {
        throw createError("INVALID_ARGUMENT", "resource.readMetadata: resourceId is required.");
      }
      const result = await client.invoke<{ resourceId: string }, { metadata: ResourceMeta }>(
        "resource.readMetadata",
        { resourceId },
      );
      return result.metadata;
    },
    async readBinary(resourceId) {
      if (!resourceId) {
        throw createError("INVALID_ARGUMENT", "resource.readBinary: resourceId is required.");
      }
      const result = await client.invoke("resource.readBinary", { resourceId });
      return normalizeBinaryPayload(result);
    },
    async convertTiffToPng(request) {
      const resourceId = normalizeOptionalString(request?.resourceId);
      if (!resourceId) {
        throw createError("INVALID_ARGUMENT", "resource.convertTiffToPng: resourceId is required.");
      }

      const outputFile = normalizeOptionalString(request?.outputFile);
      if (!outputFile) {
        throw createError("INVALID_ARGUMENT", "resource.convertTiffToPng: outputFile is required.");
      }

      if (typeof request?.overwrite !== "undefined" && typeof request.overwrite !== "boolean") {
        throw createError("INVALID_ARGUMENT", "resource.convertTiffToPng: overwrite must be a boolean when provided.");
      }

      const payload: ResourceConvertTiffToPngRequest = {
        resourceId,
        outputFile,
        ...(typeof request?.overwrite === "boolean" ? { overwrite: request.overwrite } : undefined),
      };
      return client.invoke("resource.convertTiffToPng", payload);
    },
    async extractVideoFrame(request) {
      const resourceId = normalizeOptionalString(request?.resourceId);
      if (!resourceId) {
        throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: resourceId is required.");
      }

      const outputFile = normalizeOptionalString(request?.outputFile);
      if (!outputFile) {
        throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: outputFile is required.");
      }

      if (typeof request?.overwrite !== "undefined" && typeof request.overwrite !== "boolean") {
        throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: overwrite must be a boolean when provided.");
      }

      const options = request.options;
      if (typeof options !== "undefined") {
        if (!options || typeof options !== "object" || Array.isArray(options)) {
          throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: options must be an object when provided.");
        }
        if (typeof options.timeSeconds !== "undefined" && (!Number.isFinite(options.timeSeconds) || options.timeSeconds < 0)) {
          throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: options.timeSeconds must be >= 0 when provided.");
        }
        if (typeof options.format !== "undefined" && options.format !== "png" && options.format !== "jpeg") {
          throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: options.format must be png or jpeg when provided.");
        }
        if (typeof options.width !== "undefined" && (!Number.isFinite(options.width) || options.width <= 0)) {
          throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: options.width must be > 0 when provided.");
        }
        if (typeof options.height !== "undefined" && (!Number.isFinite(options.height) || options.height <= 0)) {
          throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: options.height must be > 0 when provided.");
        }
        if (typeof options.fit !== "undefined" && options.fit !== "contain" && options.fit !== "cover") {
          throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: options.fit must be contain or cover when provided.");
        }
        if (
          typeof options.quality !== "undefined" &&
          (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100)
        ) {
          throw createError("INVALID_ARGUMENT", "resource.extractVideoFrame: options.quality must be between 1 and 100 when provided.");
        }
      }

      const payload: ResourceExtractVideoFrameRequest = {
        resourceId,
        outputFile,
        ...(typeof request?.overwrite === "boolean" ? { overwrite: request.overwrite } : undefined),
        ...(options ? { options } : undefined),
      };
      return client.invoke("resource.extractVideoFrame", payload);
    },
    async importArchive(request) {
      if (!request.zipFile || !request.targetRoot) {
        throw createError("INVALID_ARGUMENT", "resource.importArchive: zipFile and targetRoot are required.");
      }
      return client.invoke<ResourceArchiveImportRequest, ResourceArchiveImportResult>(
        "resource.importArchive",
        {
          zipFile: request.zipFile,
          targetRoot: request.targetRoot,
          preferredRootDir: request.preferredRootDir,
          entryFile: request.entryFile,
          include: request.include,
          stripSingleRootDir: request.stripSingleRootDir,
          excludeSystemArtifacts: request.excludeSystemArtifacts,
        },
      );
    },
  };
}
