import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";
import type {
  FileBatchConvertRequest,
  FileBatchConvertResult,
  FileCompareRequest,
  FileCompareResult,
  FileConvertRequest,
  FileConvertResult,
  FileDeleteOptions,
  FileDetectTypeOptions,
  FileDetectTypeResult,
  FileEntry,
  FileListOptions,
  FileMkdirOptions,
  FilePreviewCapabilitiesResult,
  FilePreviewRequest,
  FilePreviewResult,
  FileReadOptions,
  FileSessionCloseRequest,
  FileSessionCreateRequest,
  FileSessionDescriptor,
  FileSessionOpenRequest,
  FileSessionPersistRequest,
  FileSessionReadRequest,
  FileSessionReadResult,
  FileSessionWatchResult,
  FileSessionWriteRequest,
  FileSessionWriteResult,
  FileStat,
  FileVersionDiffRequest,
  FileVersionDiffResult,
  FileWatchEvent,
  FileWatchEventPayload,
  FileWatchOptions,
  FileWriteOptions,
} from "../contracts/file";

/**
 * 万能文件处理链路（`file.*`）运行时 API 封装层。
 *
 * 所有与 `file.*` 协议相关的共享类型以 `../contracts/file.ts` 为唯一类型源：
 * 本文件从契约层导入并在下方统一再导出，不再重复定义；这里只保留 API 封装层
 * 特有的类型（`FileContent` 与各子 API 接口），以及带参数校验、二进制归一化
 * 等运行时处理的实现。
 */
export type {
  FileBatchConvertRequest,
  FileBatchConvertResult,
  FileCategory,
  FileCompareDiff,
  FileCompareRequest,
  FileCompareResult,
  FileConvertRequest,
  FileConvertResult,
  FileDeleteOptions,
  FileDetectTypeOptions,
  FileDetectTypeResult,
  FileDocumentType,
  FileEntry,
  FileFormat,
  FileListOptions,
  FileMkdirOptions,
  FilePreviewCapabilitiesResult,
  FilePreviewRequest,
  FilePreviewResult,
  FileReadOptions,
  FileSessionCloseRequest,
  FileSessionCreateRequest,
  FileSessionDescriptor,
  FileSessionOpenRequest,
  FileSessionPersistRequest,
  FileSessionReadRequest,
  FileSessionReadResult,
  FileSessionStatus,
  FileSessionWatchResult,
  FileSessionWriteRequest,
  FileSessionWriteResult,
  FileStat,
  FileVersionDiffRequest,
  FileVersionDiffResult,
  FileWatchEvent,
  FileWatchEventPayload,
  FileWatchOptions,
} from "../contracts/file";

/** 文件读写内容：文本字符串或二进制字节。 */
export type FileContent = string | Uint8Array;

// ============================================================================
// API 接口定义
// ============================================================================

/**
 * 文件会话 API
 * 提供文件的完整生命周期管理：创建、打开、读写、持久化、关闭
 */
export interface FileSessionApi {
  create(input: FileSessionCreateRequest): Promise<FileSessionDescriptor>;
  open(input: FileSessionOpenRequest): Promise<FileSessionDescriptor>;
  read(input: FileSessionReadRequest): Promise<FileSessionReadResult>;
  write(input: FileSessionWriteRequest): Promise<FileSessionWriteResult>;
  get(sessionId: string): Promise<FileSessionDescriptor>;
  persist(input: FileSessionPersistRequest): Promise<FileSessionDescriptor>;
  close(input: FileSessionCloseRequest): Promise<void>;
  watch(sessionId: string, options?: { timeoutMs?: number }): Promise<FileSessionWatchResult | null>;
}

/**
 * 文件操作 API
 * 提供基础的文件系统操作
 */
export interface FileOperationsApi {
  stat(path: string): Promise<FileStat>;
  list(dir: string, options?: FileListOptions): Promise<FileEntry[]>;
  mkdir(dir: string, options?: FileMkdirOptions): Promise<void>;
  delete(path: string, options?: FileDeleteOptions): Promise<void>;
  move(sourcePath: string, destPath: string, options?: { overwrite?: boolean }): Promise<void>;
  copy(sourcePath: string, destPath: string, options?: { overwrite?: boolean }): Promise<void>;
  watch(path: string, options?: FileWatchOptions): Promise<FileWatchEventPayload | null>;
}

/**
 * 文件类型检测 API
 */
export interface FileTypeDetectionApi {
  detectType(path: string, options?: FileDetectTypeOptions): Promise<FileDetectTypeResult>;
}

/**
 * 文件预览 API
 */
export interface FilePreviewApi {
  generate(request: FilePreviewRequest): Promise<FilePreviewResult>;
  getCapabilities(): Promise<FilePreviewCapabilitiesResult>;
}

/**
 * 文件转换 API
 */
export interface FileConvertApi {
  convert(request: FileConvertRequest): Promise<FileConvertResult>;
  batchConvert(request: FileBatchConvertRequest): Promise<FileBatchConvertResult>;
}

/**
 * 文件对比 API
 */
export interface FileCompareApi {
  compare(request: FileCompareRequest): Promise<FileCompareResult>;
  versionDiff(request: FileVersionDiffRequest): Promise<FileVersionDiffResult>;
}

/**
 * 主文件 API 入口
 * 包含所有文件处理能力，按功能模块组织
 */
export interface FileApi {
  // 基础操作（向后兼容）
  read(path: string, options?: FileReadOptions): Promise<FileContent>;
  write(path: string, content: FileContent, options?: FileWriteOptions): Promise<void>;
  stat(path: string): Promise<FileStat>;
  list(dir: string, options?: FileListOptions): Promise<FileEntry[]>;
  watch(path: string, options?: FileWatchOptions): Promise<FileWatchEventPayload | null>;
  mkdir(path: string, options?: FileMkdirOptions): Promise<void>;
  delete(path: string, options?: FileDeleteOptions): Promise<void>;
  move(sourcePath: string, destPath: string): Promise<void>;
  copy(sourcePath: string, destPath: string): Promise<void>;
  detectType(path: string): Promise<FileDetectTypeResult>;

  // 高级操作模块
  session: FileSessionApi;
  ops: FileOperationsApi;
  detect: FileTypeDetectionApi;
  preview: FilePreviewApi;
  convert: FileConvertApi;
  compare: FileCompareApi;
}

// ============================================================================
// 辅助函数
// ============================================================================

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

function normalizeUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  if (isBufferJsonPayload(value)) return normalizeUint8Array(value.data);
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return Uint8Array.from(value as number[]);
  }
  if (typeof value === "string") {
    try {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch { /* not base64 */ }
  }
  if (value && typeof value === "object" && "data" in value) {
    return normalizeUint8Array((value as { data: unknown }).data);
  }
  throw createError("INVALID_RESPONSE", "file.session.read: response is not binary content.");
}

function extractFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

// ============================================================================
// 文件会话 API 实现
// ============================================================================

function createFileSessionApi(client: CoreClient): FileSessionApi {
  return {
    async create(input) {
      if (!input?.format && !input?.fileName) {
        throw createError("INVALID_ARGUMENT", "file.session.create: format or fileName is required.");
      }
      const result = await client.invoke<
        FileSessionCreateRequest,
        { document: FileSessionDescriptor }
      >("file.session.create", {
        format: input.format,
        fileName: input.fileName,
        initialBytes: input.initialBytes,
        options: input.options,
      });
      return result.document;
    },

    async open(input) {
      if (!input?.filePath) {
        throw createError("INVALID_ARGUMENT", "file.session.open: filePath is required.");
      }
      const result = await client.invoke<
        FileSessionOpenRequest,
        { document: FileSessionDescriptor }
      >("file.session.open", {
        filePath: input.filePath,
        format: input.format,
        options: input.options,
      });
      return result.document;
    },

    async read(input) {
      if (!input?.sessionId) {
        throw createError("INVALID_ARGUMENT", "file.session.read: sessionId is required.");
      }
      const result = await client.invoke<
        FileSessionReadRequest,
        { document: FileSessionDescriptor; bytes: unknown; offset: number; totalSize: number }
      >("file.session.read", {
        sessionId: input.sessionId,
        ...input.options,
      });
      return {
        sessionId: result.document.sessionId,
        documentId: result.document.documentId,
        bytes: normalizeUint8Array(result.bytes),
        offset: result.offset,
        length: normalizeUint8Array(result.bytes).byteLength,
        totalSize: result.totalSize,
        revision: result.document.revision,
      };
    },

    async write(input) {
      if (!input?.sessionId) {
        throw createError("INVALID_ARGUMENT", "file.session.write: sessionId is required.");
      }
      if (!(input.bytes instanceof Uint8Array)) {
        throw createError("INVALID_ARGUMENT", "file.session.write: bytes must be Uint8Array.");
      }
      const result = await client.invoke<
        FileSessionWriteRequest,
        { document: FileSessionDescriptor }
      >("file.session.write", {
        sessionId: input.sessionId,
        bytes: input.bytes,
        options: input.options,
      });
      return {
        sessionId: result.document.sessionId,
        documentId: result.document.documentId,
        revision: result.document.revision,
        size: result.document.size,
        status: result.document.status,
      };
    },

    async get(sessionId) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "file.session.get: sessionId is required.");
      }
      const result = await client.invoke<
        { sessionId: string },
        { document: FileSessionDescriptor }
      >("file.session.get", { sessionId });
      return result.document;
    },

    async persist(input) {
      if (!input?.sessionId) {
        throw createError("INVALID_ARGUMENT", "file.session.persist: sessionId is required.");
      }
      const result = await client.invoke<
        FileSessionPersistRequest,
        { document: FileSessionDescriptor }
      >("file.session.persist", {
        sessionId: input.sessionId,
        options: input.options,
      });
      return result.document;
    },

    async close(input) {
      if (!input?.sessionId) {
        throw createError("INVALID_ARGUMENT", "file.session.close: sessionId is required.");
      }
      await client.invoke<FileSessionCloseRequest, { ack: true }>("file.session.close", {
        sessionId: input.sessionId,
        options: input.options,
      });
    },

    async watch(sessionId, options) {
      if (!sessionId) {
        throw createError("INVALID_ARGUMENT", "file.session.watch: sessionId is required.");
      }
      const result = await client.invoke<
        { sessionId: string; timeoutMs?: number },
        { event: FileSessionWatchResult | null }
      >("file.session.watch", {
        sessionId,
        timeoutMs: options?.timeoutMs,
      });
      return result.event;
    },
  };
}

// ============================================================================
// 文件操作 API 实现
// ============================================================================

function createFileOperationsApi(client: CoreClient): FileOperationsApi {
  return {
    async stat(path) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.ops.stat: path is required.");
      }
      const result = await client.invoke<{ path: string }, { meta: FileStat }>("file.stat", { path });
      return result.meta;
    },

    async list(dir, options) {
      if (!dir) {
        throw createError("INVALID_ARGUMENT", "file.ops.list: dir is required.");
      }
      const result = await client.invoke<
        { dir: string; options?: FileListOptions },
        { entries: FileEntry[] }
      >("file.list", { dir, options });
      return result.entries;
    },

    async mkdir(dir, options) {
      if (!dir) {
        throw createError("INVALID_ARGUMENT", "file.ops.mkdir: dir is required.");
      }
      await client.invoke("file.mkdir", { path: dir, options });
    },

    async delete(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.ops.delete: path is required.");
      }
      await client.invoke("file.delete", { path, options });
    },

    async move(sourcePath, destPath, options) {
      if (!sourcePath || !destPath) {
        throw createError("INVALID_ARGUMENT", "file.ops.move: sourcePath and destPath are required.");
      }
      await client.invoke("file.move", { sourcePath, destPath, ...options });
    },

    async copy(sourcePath, destPath, options) {
      if (!sourcePath || !destPath) {
        throw createError("INVALID_ARGUMENT", "file.ops.copy: sourcePath and destPath are required.");
      }
      await client.invoke("file.copy", { sourcePath, destPath, ...options });
    },

    async watch(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.ops.watch: path is required.");
      }
      const result = await client.invoke<
        { path: string; timeoutMs?: number; events?: FileWatchEvent[] },
        { event: FileWatchEventPayload | null }
      >("file.watch", {
        path,
        timeoutMs: options?.timeoutMs,
        events: options?.events,
      });
      return result.event;
    },
  };
}

// ============================================================================
// 文件类型检测 API 实现
// ============================================================================

function createFileTypeDetectionApi(client: CoreClient): FileTypeDetectionApi {
  return {
    async detectType(path, options) {
      if (!path) {
        throw createError("INVALID_ARGUMENT", "file.detect.detectType: path is required.");
      }
      const result = await client.invoke<
        { path: string; options?: FileDetectTypeOptions },
        FileDetectTypeResult
      >("file.detectType", { path, options });
      return result;
    },
  };
}

// ============================================================================
// 文件预览 API 实现
// ============================================================================

function createFilePreviewApi(client: CoreClient): FilePreviewApi {
  return {
    async generate(request) {
      if (!request?.filePath) {
        throw createError("INVALID_ARGUMENT", "file.preview.generate: filePath is required.");
      }
      return client.invoke<FilePreviewRequest, FilePreviewResult>("file.preview.generate", request);
    },

    async getCapabilities() {
      return client.invoke<{}, FilePreviewCapabilitiesResult>("file.preview.getCapabilities", {});
    },
  };
}

// ============================================================================
// 文件转换 API 实现
// ============================================================================

function createFileConvertApi(client: CoreClient): FileConvertApi {
  return {
    async convert(request) {
      if (!request?.source?.filePath) {
        throw createError("INVALID_ARGUMENT", "file.convert.convert: source.filePath is required.");
      }
      if (!request?.target?.format) {
        throw createError("INVALID_ARGUMENT", "file.convert.convert: target.format is required.");
      }
      if (!request?.output?.filePath) {
        throw createError("INVALID_ARGUMENT", "file.convert.convert: output.filePath is required.");
      }
      return client.invoke<FileConvertRequest, FileConvertResult>("file.convert", request);
    },

    async batchConvert(request) {
      if (!request?.sources?.length) {
        throw createError("INVALID_ARGUMENT", "file.convert.batchConvert: sources is required and non-empty.");
      }
      if (!request?.outputDir) {
        throw createError("INVALID_ARGUMENT", "file.convert.batchConvert: outputDir is required.");
      }
      return client.invoke<FileBatchConvertRequest, FileBatchConvertResult>("file.batchConvert", request);
    },
  };
}

// ============================================================================
// 文件对比 API 实现
// ============================================================================

function createFileCompareApi(client: CoreClient): FileCompareApi {
  return {
    async compare(request) {
      if (!request?.left?.filePath) {
        throw createError("INVALID_ARGUMENT", "file.compare.compare: left.filePath is required.");
      }
      if (!request?.right?.filePath) {
        throw createError("INVALID_ARGUMENT", "file.compare.compare: right.filePath is required.");
      }
      return client.invoke<FileCompareRequest, FileCompareResult>("file.compare", request);
    },

    async versionDiff(request) {
      if (!request?.filePath) {
        throw createError("INVALID_ARGUMENT", "file.compare.versionDiff: filePath is required.");
      }
      if (request.versionA === undefined || request.versionB === undefined) {
        throw createError("INVALID_ARGUMENT", "file.compare.versionDiff: versionA and versionB are required.");
      }
      return client.invoke<FileVersionDiffRequest, FileVersionDiffResult>("file.versionDiff", request);
    },
  };
}

// ============================================================================
// 主 API 创建函数
// ============================================================================

export function createFileApi(client: CoreClient): FileApi {
  const sessionApi = createFileSessionApi(client);
  const operationsApi = createFileOperationsApi(client);
  const typeDetectionApi = createFileTypeDetectionApi(client);
  const previewApi = createFilePreviewApi(client);
  const convertApi = createFileConvertApi(client);
  const compareApi = createFileCompareApi(client);

  return {
    // 基础操作（向后兼容）
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
        { path: string; timeoutMs?: number; events?: FileWatchEvent[] },
        { event: FileWatchEventPayload | null }
      >("file.watch", {
        path,
        timeoutMs: options?.timeoutMs,
        events: options?.events,
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
      const result = await client.invoke<{ path: string }, FileDetectTypeResult>("file.detectType", { path });
      return result;
    },

    // 高级操作模块
    session: sessionApi,
    ops: operationsApi,
    detect: typeDetectionApi,
    preview: previewApi,
    convert: convertApi,
    compare: compareApi,
  };
}
