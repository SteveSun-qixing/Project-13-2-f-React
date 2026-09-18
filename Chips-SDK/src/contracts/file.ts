/**
 * 薯片生态万能文件处理链路（`file.*`）的纯类型契约。
 *
 * 适用范围：
 * - 应用插件、模块插件、SDK 调用方、Host 服务实现以及生态共用文档在描述
 *   万能文件处理协议时共享本文件中的类型；
 * - 本文件不导出任何运行时实现，只提供类型与常量字面量；运行时实现位于
 *   `Chips-SDK/src/api/file.ts`、`Chips-Host` 的 file 服务实现与各插件侧。
 *
 * 与运行时 API 的关系：
 * - `Chips-SDK/src/api/file.ts` 中的 `FileApi` 与各子 API 是对这套契约的类型化
 *   封装，并在请求/响应两侧补齐参数校验、二进制归一化等运行时处理；
 * - 任何想直接消费 `client.invoke('file.session.create', ...)` 的代码都可以
 *   引用本文件，避免重复声明请求/响应类型。
 *
 * 与协议文档的关系：
 * - 《生态共用技术文档/协议与契约/15-万能文件处理协议.md》是这套契约的权威
 *   描述，本文件是它的 TypeScript 实现；修改协议时请同时更新两边。
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 文件格式（与具体 MIME、扩展名或自定义格式字符串对应）。 */
export type FileFormat = string;

/**
 * 通用文件分类。`code` 指代代码、配置文件等文本类技术格式；`unknown` 用于无法
 * 归类的兜底类型。
 */
export type FileCategory =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "html"
  | "archive"
  | "code"
  | "unknown";

/**
 * 文件具体类型。
 * - `card` / `box` / `cpk` 是生态自有的容器格式；
 * - `word` / `slide` / `sheet` / `pdf` 是常见的办公文档；
 * - `image` / `video` / `audio` 是按主类型归类的具体格式大类；
 * - `archive` / `code` / `text` / `unknown` 是无法精确到具体格式时的兜底。
 */
export type FileDocumentType =
  | "card"
  | "box"
  | "cpk"
  | "word"
  | "slide"
  | "sheet"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "text"
  | "unknown";

/** 文件会话生命周期状态。 */
export type FileSessionStatus = "clean" | "dirty" | "watching" | "closed";

/** 文件系统监听事件。 */
export type FileWatchEvent = "rename" | "change" | "add" | "unlink";

/** 文本读取/写入编码。 */
export type FileTextEncoding = "utf-8" | "binary";

/** 预览输出图片格式。 */
export type FilePreviewImageFormat = "png" | "jpeg" | "webp";

/** 文件对比算法。 */
export type FileCompareAlgorithm = "hash" | "binary" | "semantic";

/** 版本差异输出格式。 */
export type FileVersionDiffFormat = "unified" | "side-by-side" | "html";

/** 检测类型时所依据的来源。 */
export type FileDetectSource = "extension" | "magic-number" | "content";

// ============================================================================
// 文件会话相关类型
// ============================================================================

/** 文件会话描述符，承载当前会话的全部可观测元信息。 */
export interface FileSessionDescriptor {
  sessionId: string;
  documentId: string;
  filePath: string;
  fileName: string;
  format: FileFormat;
  mimeType: string;
  size: number;
  revision: number;
  status: FileSessionStatus;
  createdAt: string;
  updatedAt: string;
}

/** 创建文件会话的请求。 */
export interface FileSessionCreateRequest {
  format?: FileFormat;
  fileName?: string;
  initialBytes?: Uint8Array;
  options?: {
    mimeType?: string;
    encoding?: FileTextEncoding;
  };
}

/** 打开文件会话的请求。 */
export interface FileSessionOpenRequest {
  filePath: string;
  format?: FileFormat;
  options?: {
    readOnly?: boolean;
    watch?: boolean;
  };
}

/** 读取文件会话的请求。 */
export interface FileSessionReadRequest {
  sessionId: string;
  options?: {
    offset?: number;
    length?: number;
    encoding?: FileTextEncoding;
  };
}

/** 读取文件会话的响应。 */
export interface FileSessionReadResult {
  sessionId: string;
  documentId: string;
  bytes: Uint8Array;
  offset: number;
  length: number;
  totalSize: number;
  revision: number;
}

/** 写入文件会话的请求。 */
export interface FileSessionWriteRequest {
  sessionId: string;
  bytes: Uint8Array;
  options?: {
    offset?: number;
  };
}

/** 写入文件会话的响应。 */
export interface FileSessionWriteResult {
  sessionId: string;
  documentId: string;
  revision: number;
  size: number;
  status: FileSessionStatus;
}

/** 持久化文件会话的请求。 */
export interface FileSessionPersistRequest {
  sessionId: string;
  options?: {
    filePath?: string;
    backup?: boolean;
  };
}

/** 关闭文件会话的请求。 */
export interface FileSessionCloseRequest {
  sessionId: string;
  options?: {
    persist?: boolean;
  };
}

/** 文件会话监听事件载荷。 */
export interface FileSessionWatchResult {
  event: FileWatchEvent;
  path: string;
  timestamp: number;
  oldPath?: string;
}

/** 文件会话监听参数。 */
export interface FileSessionWatchRequest {
  sessionId: string;
  timeoutMs?: number;
}

// ============================================================================
// 文件操作相关类型
// ============================================================================

export interface FileReadOptions {
  encoding?: FileTextEncoding;
}

export interface FileWriteOptions {
  encoding?: FileTextEncoding;
}

export interface FileStat {
  path: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtimeMs: number;
}

export interface FileListOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  filter?: string;
}

export interface FileWatchOptions {
  timeoutMs?: number;
  events?: FileWatchEvent[];
}

export interface FileMkdirOptions {
  recursive?: boolean;
}

export interface FileDeleteOptions {
  recursive?: boolean;
  safe?: boolean;
}

export interface FileMoveOptions {
  overwrite?: boolean;
  backup?: boolean;
}

export interface FileCopyOptions {
  overwrite?: boolean;
  recursive?: boolean;
}

export interface FileEntry {
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  size?: number;
  mtimeMs?: number;
  extension?: string;
}

export interface FileWatchEventPayload {
  type: FileWatchEvent;
  path: string;
  timestamp: number;
  oldPath?: string;
}

// ============================================================================
// 文件类型检测相关类型
// ============================================================================

export interface FileDetectTypeOptions {
  readHeader?: boolean;
  trustExtension?: boolean;
}

export interface FileDetectTypeResult {
  documentType: FileDocumentType | null;
  mimeType: string;
  category: FileCategory;
  extension: string | null;
  confidence: number;
  size: number | null;
  detectedBy: FileDetectSource;
}

// ============================================================================
// 文件预览相关类型
// ============================================================================

export interface FilePreviewRequest {
  filePath: string;
  options?: {
    width?: number;
    height?: number;
    format?: FilePreviewImageFormat;
    quality?: number;
    page?: number;
    thumbnail?: boolean;
  };
}

export interface FilePreviewResult {
  previewPath: string;
  format: FilePreviewImageFormat;
  width: number;
  height: number;
  isThumbnail: boolean;
  mimeType: string;
}

export interface FilePreviewCapabilitiesResult {
  supportedFormats: FileFormat[];
  unsupportedFormats: FileFormat[];
  maxPreviewSize: { width: number; height: number };
  thumbnailSizes: Array<{ width: number; height: number; name: string }>;
}

// ============================================================================
// 文件转换相关类型
// ============================================================================

export interface FileConvertSource {
  filePath: string;
  format?: FileFormat;
}

export interface FileConvertTarget {
  format: FileFormat;
  options?: Record<string, unknown>;
}

export interface FileConvertOutput {
  filePath: string;
  overwrite?: boolean;
}

export interface FileConvertOptions {
  quality?: number;
  pageSize?: "A4" | "A3" | "Letter";
  landscape?: boolean;
  marginMm?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface FileConvertRequest {
  source: FileConvertSource;
  target: FileConvertTarget;
  output: FileConvertOutput;
  options?: FileConvertOptions;
}

export interface FileConvertArtifact {
  type: string;
  path: string;
  mimeType?: string;
}

export interface FileConvertWarning {
  code: string;
  message: string;
}

export interface FileConvertResult {
  sourcePath: string;
  sourceFormat: FileFormat;
  targetPath: string;
  targetFormat: FileFormat;
  conversionTime: number;
  artifacts?: FileConvertArtifact[];
  warnings?: FileConvertWarning[];
}

export interface FileBatchConvertRequest {
  sources: FileConvertSource[];
  target: FileConvertTarget;
  outputDir: string;
  options?: {
    overwrite?: boolean;
    parallel?: boolean;
    concurrency?: number;
  };
}

export interface FileBatchConvertResult {
  results: Array<{
    sourcePath: string;
    targetPath: string;
    success: boolean;
    error?: { code: string; message: string };
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    totalTime: number;
  };
}

// ============================================================================
// 文件对比相关类型
// ============================================================================

export interface FileCompareRequest {
  left: FileConvertSource;
  right: FileConvertSource;
  options?: {
    algorithm?: FileCompareAlgorithm;
    context?: number;
    ignoreWhitespace?: boolean;
    ignoreCase?: boolean;
  };
}

export interface FileCompareDiff {
  type: "add" | "remove" | "modify";
  leftRange?: { start: number; end: number };
  rightRange?: { start: number; end: number };
  leftContent?: string;
  rightContent?: string;
}

export interface FileCompareResult {
  identical: boolean;
  diffs: FileCompareDiff[];
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
  };
}

export interface FileVersionDiffRequest {
  filePath: string;
  versionA: number | string;
  versionB: number | string;
  format?: FileVersionDiffFormat;
}

export interface FileVersionDiffResult {
  filePath: string;
  versionA: number | string;
  versionB: number | string;
  format: FileVersionDiffFormat;
  diffOutput: string;
  stats: {
    additions: number;
    deletions: number;
  };
}

// ============================================================================
// 文件处理器能力声明
// ============================================================================

/** 万能文件处理器能力声明支持的操作。 */
export type FileHandlerAction =
  | "view"
  | "edit"
  | "convert"
  | "preview"
  | "compare"
  | "metadata";

/** 处理器层级后缀。 */
export type FileHandlerTier = "primary" | "fallback";

/**
 * 万能文件处理器能力声明的归一化形态。
 *
 * 原始声明 `file-handler:<action>:<mime-or-ext>[@tier]` 在解析后归一为该结构。
 * - `action`：`view` / `edit` / `convert` / `preview` / `compare` / `metadata`；
 * - `target`：精确 MIME（例如 `application/pdf`）、主类型通配（例如 `image/*`）、
 *   扩展名（带点，例如 `.pdf`）或全局通配 `*`；
 * - `tier`：`primary`（默认）/ `fallback`（显式 `@fallback`）。
 */
export interface FileHandlerCapability {
  kind: "file-handler";
  action: FileHandlerAction;
  target: string;
  tier: FileHandlerTier;
}

/**
 * 万能文件处理链路的处理器匹配结果。
 *
 * 用于 `resource.open` / `file.session.open` / `file.preview.generate` /
 * `file.convert` 等动作的处理器选择结果，由 Host 内部生成并透传给调用方做
 * 诊断、审计或用户提示。
 */
export interface FileHandlerResolution {
  capability: FileHandlerCapability;
  matchedBy: "exact-mime" | "wildcard-mime" | "extension" | "wildcard" | "user-default";
  pluginId: string;
  pluginName?: string;
  isPreferred: boolean;
}

// ============================================================================
// 文件会话事件（事件总线 payload）
// ============================================================================

export interface FileSessionCreatedEvent {
  sessionId: string;
  filePath: string;
  format: FileFormat;
  status: FileSessionStatus;
}

export interface FileSessionStatusChangedEvent {
  sessionId: string;
  oldStatus: FileSessionStatus;
  newStatus: FileSessionStatus;
  revision: number;
}

export interface FileSessionClosedEvent {
  sessionId: string;
  persisted: boolean;
  finalRevision: number;
}

export interface FileSessionChangedEvent {
  sessionId: string;
  event: FileWatchEvent;
  path: string;
  timestamp: number;
}

/** 文件会话事件总线名称常量。 */
export const FILE_SESSION_EVENTS = {
  Created: "file.session.created",
  StatusChanged: "file.session.statusChanged",
  Closed: "file.session.closed",
  Changed: "file.session.changed",
} as const;

export type FileSessionEventName =
  (typeof FILE_SESSION_EVENTS)[keyof typeof FILE_SESSION_EVENTS];

// ============================================================================
// 错误码
// ============================================================================

/**
 * 万能文件处理链路使用的错误码常量。
 *
 * 错误对象本身仍然遵循 `StandardError` 规范（见 `Chips-SDK/src/types/errors.ts`），
 * 这里仅给出链路内部约定使用的错误码集合，便于插件在捕获异常后做分支处理。
 */
export const FILE_ERROR_CODES = {
  SessionNotFound: "FILE_SESSION_NOT_FOUND",
  SessionClosed: "FILE_SESSION_CLOSED",
  SessionDirty: "FILE_SESSION_DIRTY",
  ContentInvalid: "FILE_CONTENT_INVALID",
  ContentTooLarge: "FILE_CONTENT_TOO_LARGE",
  FormatUnsupported: "FILE_FORMAT_UNSUPPORTED",
  FormatMismatch: "FILE_FORMAT_MISMATCH",
  ConvertFailed: "FILE_CONVERT_FAILED",
  ConvertOutputExists: "FILE_CONVERT_OUTPUT_EXISTS",
  CompareFailed: "FILE_COMPARE_FAILED",
  PreviewFailed: "FILE_PREVIEW_FAILED",
  PreviewUnsupported: "FILE_PREVIEW_UNSUPPORTED",
  HandlerMissing: "FILE_HANDLER_MISSING",
  WatchTimeout: "FILE_WATCH_TIMEOUT",
} as const;

export type FileErrorCode = (typeof FILE_ERROR_CODES)[keyof typeof FILE_ERROR_CODES];

// ============================================================================
// Host 路由常量（与服务注册、Route Manifest、SDK 调用统一）
// ============================================================================

/**
 * 万能文件处理链路在 Host 路由层的全部 action 名称。
 *
 * 与 `Chips-SDK/src/contracts/route-manifest.json`、`Chips-Host/src/main/services/
 * register-host-services.ts`、`生态共用技术文档/协议与契约/15-万能文件处理协议.md`
 * 保持同步；任何新增/移除动作都必须同时更新四个位置。
 */
export const FILE_ACTIONS = {
  // 基础文件操作
  Read: "file.read",
  Write: "file.write",
  Stat: "file.stat",
  List: "file.list",
  Watch: "file.watch",
  Mkdir: "file.mkdir",
  Delete: "file.delete",
  Move: "file.move",
  Copy: "file.copy",
  DetectType: "file.detectType",

  // 文件会话
  SessionCreate: "file.session.create",
  SessionOpen: "file.session.open",
  SessionRead: "file.session.read",
  SessionWrite: "file.session.write",
  SessionGet: "file.session.get",
  SessionPersist: "file.session.persist",
  SessionClose: "file.session.close",
  SessionWatch: "file.session.watch",

  // 文件预览
  PreviewGenerate: "file.preview.generate",
  PreviewGetCapabilities: "file.preview.getCapabilities",

  // 文件转换
  Convert: "file.convert",
  BatchConvert: "file.batchConvert",

  // 文件对比
  Compare: "file.compare",
  VersionDiff: "file.versionDiff",
} as const;

export type FileAction = (typeof FILE_ACTIONS)[keyof typeof FILE_ACTIONS];

/** 各路由对应的权限要求。 */
export const FILE_ACTION_PERMISSIONS: Readonly<Record<FileAction, readonly string[]>> = {
  [FILE_ACTIONS.Read]: ["file.read"],
  [FILE_ACTIONS.Write]: ["file.write"],
  [FILE_ACTIONS.Stat]: ["file.read"],
  [FILE_ACTIONS.List]: ["file.read"],
  [FILE_ACTIONS.Watch]: ["file.read"],
  [FILE_ACTIONS.Mkdir]: ["file.write"],
  [FILE_ACTIONS.Delete]: ["file.write"],
  [FILE_ACTIONS.Move]: ["file.write"],
  [FILE_ACTIONS.Copy]: ["file.write"],
  [FILE_ACTIONS.DetectType]: ["file.read"],

  [FILE_ACTIONS.SessionCreate]: ["file.write"],
  [FILE_ACTIONS.SessionOpen]: ["file.read"],
  [FILE_ACTIONS.SessionRead]: ["file.read"],
  [FILE_ACTIONS.SessionWrite]: ["file.write"],
  [FILE_ACTIONS.SessionGet]: ["file.read"],
  [FILE_ACTIONS.SessionPersist]: ["file.write"],
  [FILE_ACTIONS.SessionClose]: ["file.write"],
  [FILE_ACTIONS.SessionWatch]: ["file.read"],

  [FILE_ACTIONS.PreviewGenerate]: ["file.read"],
  [FILE_ACTIONS.PreviewGetCapabilities]: ["file.read"],

  [FILE_ACTIONS.Convert]: ["file.read", "file.write"],
  [FILE_ACTIONS.BatchConvert]: ["file.read", "file.write"],

  [FILE_ACTIONS.Compare]: ["file.read"],
  [FILE_ACTIONS.VersionDiff]: ["file.read"],
};
