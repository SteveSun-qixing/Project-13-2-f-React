import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export interface FileReadOptions {
  encoding?: "utf-8" | "binary";
}

export type FileContent = string | Uint8Array;

export interface FileStat {
  path: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtimeMs: number;
}

export interface FileListOptions {
  recursive?: boolean;
}

export interface FileWatchOptions {
  timeoutMs?: number;
}

export interface FileMkdirOptions {
  recursive?: boolean;
}

export interface FileDeleteOptions {
  recursive?: boolean;
}

export interface FileEntry {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface FileWatchEvent {
  type: "rename" | "change";
  path: string;
  timestamp: number;
}

export type FileDocumentType = "card" | "box";
export type FileCategory =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "html"
  | "archive"
  | "unknown";

export interface FileDetectTypeResult {
  documentType: FileDocumentType | null;
  mimeType: string;
  category: FileCategory;
}

export interface FileApi {
  read(path: string, options?: FileReadOptions): Promise<FileContent>;
  write(path: string, content: FileContent, options?: { encoding?: "utf-8" | "binary" }): Promise<void>;
  stat(path: string): Promise<FileStat>;
  list(dir: string, options?: FileListOptions): Promise<FileEntry[]>;
  watch(path: string, options?: FileWatchOptions): Promise<FileWatchEvent | null>;
  mkdir(path: string, options?: FileMkdirOptions): Promise<void>;
  delete(path: string, options?: FileDeleteOptions): Promise<void>;
  move(sourcePath: string, destPath: string): Promise<void>;
  copy(sourcePath: string, destPath: string): Promise<void>;
  detectType(path: string): Promise<FileDetectTypeResult>;
}

function unwrapFileReadContent(value: unknown): unknown {
  if (value && typeof value === "object" && "content" in value) {
    return (value as { content?: unknown }).content;
  }

  return value;
}

function toOwnedBytes(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }

  const copy = new Uint8Array(value.byteLength);
  copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return copy;
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

function decodeBase64ToBytes(input: string): Uint8Array {
  const bufferCtor = (globalThis as typeof globalThis & {
    Buffer?: {
      from(data: string, encoding: string): Uint8Array;
    };
  }).Buffer;

  if (bufferCtor) {
    const buffer = bufferCtor.from(input, "base64");
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  const normalized = input.replace(/\s+/g, "");
  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function decodeByteString(input: string): Uint8Array {
  const bytes = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    bytes[index] = input.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function shouldDecodeStringAsBase64(input: string): boolean {
  const normalized = input.replace(/\s+/g, "");
  if (normalized.length === 0 || normalized.length % 4 !== 0) {
    return false;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return false;
  }

  return normalized.includes("=") || normalized.includes("+") || normalized.includes("/") || /\s/.test(input);
}

function normalizeBinaryPayload(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) {
    return toOwnedBytes(value);
  }

  if (ArrayBuffer.isView(value)) {
    return toOwnedBytes(value);
  }

  if (typeof value === "string") {
    return shouldDecodeStringAsBase64(value) ? decodeBase64ToBytes(value) : decodeByteString(value);
  }

  if (isBufferJsonPayload(value)) {
    return Uint8Array.from(value.data);
  }

  if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
    return Uint8Array.from(value);
  }

  if (value && typeof value === "object" && "data" in value) {
    return normalizeBinaryPayload((value as { data?: unknown }).data);
  }

  throw createError("INVALID_RESPONSE", "file.read: response is not binary content.");
}

export function createFileApi(client: CoreClient): FileApi {
  return {
    async read(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.read: path is required.");
      }
      const result = await client.invoke("file.read", { path, options });
      const content = unwrapFileReadContent(result);

      if (options?.encoding === "utf-8") {
        if (typeof content !== "string") {
          throw createError("INVALID_RESPONSE", "file.read: response is not text content.");
        }
        return content;
      }

      if (options?.encoding === "binary") {
        return normalizeBinaryPayload(content);
      }

      return content as FileContent;
    },
    async write(path, content, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.write: path is required.");
      }
      await client.invoke("file.write", { path, content, ...options });
    },
    async stat(path) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.stat: path is required.");
      }
      const result = await client.invoke<{ path: string }, { meta: FileStat }>("file.stat", { path });
      return result.meta;
    },
    async list(dir, options) {
      if (!dir) {
        throw createError("INVALID_ARGUMENT", "file.list: dir is required.");
      }
      const result = await client.invoke<
        { dir: string; options?: FileListOptions },
        { entries: FileEntry[] }
      >("file.list", { dir, options });
      return result.entries;
    },
    async watch(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.watch: path is required.");
      }
      const result = await client.invoke<
        { path: string; timeoutMs?: number },
        { event: FileWatchEvent | null }
      >("file.watch", {
        path,
        timeoutMs: options?.timeoutMs,
      });
      return result.event;
    },
    async mkdir(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.mkdir: path is required.");
      }
      await client.invoke("file.mkdir", { path, options });
    },
    async delete(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.delete: path is required.");
      }
      await client.invoke("file.delete", { path, options });
    },
    async move(sourcePath, destPath) {
      if (!sourcePath || !destPath) {
        throw createError("INVALID_ARGUMENT", "file.move: sourcePath and destPath are required.");
      }
      await client.invoke("file.move", { sourcePath, destPath });
    },
    async copy(sourcePath, destPath) {
      if (!sourcePath || !destPath) {
        throw createError("INVALID_ARGUMENT", "file.copy: sourcePath and destPath are required.");
      }
      await client.invoke("file.copy", { sourcePath, destPath });
    },
    async detectType(path) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.detectType: path is required.");
      }
      const result = await client.invoke<
        { path: string },
        { documentType: FileDocumentType | null; mimeType: string; category: FileCategory }
      >("file.detectType", { path });
      return result;
    },
  };
}
