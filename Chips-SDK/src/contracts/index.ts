/**
 * 薯片生态 SDK 公共契约聚合入口。
 *
 * 与运行时 API 入口 (`./index.ts`) 的差异：
 * - `./index.ts` 面向调用方打包 SDK 客户端，导出运行时实现与对应的类型；
 * - 本文件只导出跨模块可复用的纯类型契约，便于宿主、协议文档、插件工具链
 *   在不依赖具体实现的情况下引用同一份类型定义。
 */

export type {
  FileAction,
  FileBatchConvertRequest,
  FileBatchConvertResult,
  FileCategory,
  FileCompareAlgorithm,
  FileCompareDiff,
  FileCompareRequest,
  FileCompareResult,
  FileConvertArtifact,
  FileConvertOptions,
  FileConvertOutput,
  FileConvertRequest,
  FileConvertResult,
  FileConvertSource,
  FileConvertTarget,
  FileConvertWarning,
  FileCopyOptions,
  FileDeleteOptions,
  FileDetectSource,
  FileDetectTypeOptions,
  FileDetectTypeResult,
  FileDocumentType,
  FileEntry,
  FileFormat,
  FileHandlerAction,
  FileHandlerCapability,
  FileHandlerResolution,
  FileHandlerTier,
  FileListOptions,
  FileMkdirOptions,
  FileMoveOptions,
  FilePreviewCapabilitiesResult,
  FilePreviewImageFormat,
  FilePreviewRequest,
  FilePreviewResult,
  FileReadOptions,
  FileSessionChangedEvent,
  FileSessionClosedEvent,
  FileSessionCloseRequest,
  FileSessionCreateRequest,
  FileSessionCreatedEvent,
  FileSessionDescriptor,
  FileSessionEventName,
  FileSessionOpenRequest,
  FileSessionPersistRequest,
  FileSessionReadRequest,
  FileSessionReadResult,
  FileSessionStatus,
  FileSessionStatusChangedEvent,
  FileSessionWatchRequest,
  FileSessionWatchResult,
  FileSessionWriteRequest,
  FileSessionWriteResult,
  FileStat,
  FileTextEncoding,
  FileVersionDiffFormat,
  FileVersionDiffRequest,
  FileVersionDiffResult,
  FileWatchEvent,
  FileWatchEventPayload,
  FileWatchOptions,
  FileWriteOptions,
} from "./file";

export {
  FILE_ACTIONS,
  FILE_ACTION_PERMISSIONS,
  FILE_ERROR_CODES,
  FILE_SESSION_EVENTS,
} from "./file";

export type { FileErrorCode } from "./file";
