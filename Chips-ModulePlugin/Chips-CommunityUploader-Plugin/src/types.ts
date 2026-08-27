import type { CommunityUploaderWarning } from "./errors";

export interface CommunityCardTransferServer {
  baseUrl: string;
  accessToken: string;
}

export interface CommunityCardTransferClientInfo {
  name?: string;
  version?: string;
  platform?: string;
}

export interface CommunityCardTransferUploadRequest {
  cardFile: string;
  server: CommunityCardTransferServer;
  publish?: {
    roomId?: string | null;
    idempotencyKey?: string;
    /**
     * 是否随本地上传一并上传客户端渲染产物（查看 HTML 与封面 HTML）。
     * - true：个人服务器模式，客户端渲染后直传产物，服务器直接发布；
     * - false（默认）：仅上传源文件，由服务器自行处理渲染。
     */
    includeRenderArtifacts?: boolean;
  };
  client?: CommunityCardTransferClientInfo;
  workspace?: {
    tempDir?: string;
    keepNetworkCard?: boolean;
    networkCardPath?: string;
  };
}

export interface NormalizedCommunityCardTransferUploadRequest {
  cardFile: string;
  server: CommunityCardTransferServer;
  publish: {
    roomId?: string | null;
    idempotencyKey?: string;
    includeRenderArtifacts: boolean;
  };
  client: Required<Pick<CommunityCardTransferClientInfo, "name" | "version">> & {
    platform?: string;
  };
  workspace: {
    tempDir?: string;
    keepNetworkCard: boolean;
    networkCardPath?: string;
  };
}

export interface CommunityCardTransferUploadedResource {
  originalRelativePath: string;
  networkUrl: string;
  publicUrl: string;
  bucket: string;
  objectKey: string;
  sizeBytes: number;
  mimeType: string;
}

/** 客户端渲染产物摘要（随 complete 提交给服务器） */
export interface CommunityCardTransferRenderArtifacts {
  rendererVersion: string;
  themeId?: string;
  locale?: string;
  view: {
    entryRelativePath: string;
    fileCount: number;
    sizeBytes: number;
  };
  cover?: {
    entryRelativePath: string;
    fileCount: number;
    sizeBytes: number;
  };
}

export interface CommunityCardTransferUploadResult {
  cardId: string;
  versionId: string;
  status: string;
  renderStatus: string;
  renderStatusUrl: string;
  communityUrl: string;
  networkCardPath?: string;
  uploadedResources: CommunityCardTransferUploadedResource[];
  warnings?: CommunityUploaderWarning[];
}

export interface CommunityCardTransferBoxUploadRequest {
  boxFile: string;
  server: CommunityCardTransferServer;
  publish?: {
    roomId?: string | null;
    idempotencyKey?: string;
    /** 透传给箱子内散落卡片上传（见 CommunityCardTransferUploadRequest.publish.includeRenderArtifacts） */
    includeRenderArtifacts?: boolean;
  };
  client?: CommunityCardTransferClientInfo;
  workspace?: {
    tempDir?: string;
  };
}

export interface NormalizedCommunityCardTransferBoxUploadRequest {
  boxFile: string;
  server: CommunityCardTransferServer;
  publish: {
    roomId?: string | null;
    idempotencyKey?: string;
    includeRenderArtifacts: boolean;
  };
  client: Required<Pick<CommunityCardTransferClientInfo, "name" | "version">> & {
    platform?: string;
  };
  workspace: {
    tempDir?: string;
  };
}

export interface CommunityCardTransferBoxUploadedCard {
  entryId?: string;
  documentId?: string;
  cardFile: string;
  communityCardId: string;
  communityUrl: string;
}

export interface CommunityCardTransferBoxSkippedCard {
  entryId?: string;
  documentId?: string;
  url: string;
  reason: "embedded" | "network";
}

export interface CommunityCardTransferBoxUploadResult {
  boxId: string;
  versionId: string;
  status: string;
  communityUrl: string;
  boxViewUrl?: string;
  uploadedCards: CommunityCardTransferBoxUploadedCard[];
  skippedCards: CommunityCardTransferBoxSkippedCard[];
  warnings?: CommunityUploaderWarning[];
}

export interface CommunityCardTransferDownloadRequest {
  cardId: string;
  server: CommunityCardTransferServer;
  outputPath: string;
  versionId?: string;
  client?: CommunityCardTransferClientInfo;
  workspace?: {
    tempDir?: string;
  };
}

export interface NormalizedCommunityCardTransferDownloadRequest {
  cardId: string;
  server: CommunityCardTransferServer;
  outputPath: string;
  versionId?: string;
  client: Required<Pick<CommunityCardTransferClientInfo, "name" | "version">> & {
    platform?: string;
  };
  workspace: {
    tempDir?: string;
  };
}

export interface CommunityCardTransferDownloadResult {
  cardId: string;
  versionId?: string | null;
  outputPath: string;
  restoredResourceCount: number;
  suggestedFileName?: string;
}

export interface CommunityCardTransferOpenRemoteRequest {
  cardId?: string;
  url?: string;
  server?: CommunityCardTransferServer;
  workspace?: {
    tempDir?: string;
  };
}

export interface CommunityCardTransferOpenRemoteResult {
  opened: true;
  url: string;
  localCardPath?: string;
  surfaceId?: string;
}

export interface CommunityCardTransferOpenRemoteBoxRequest {
  boxId: string;
  server: CommunityCardTransferServer;
  workspace?: {
    tempDir?: string;
  };
}

export interface CommunityCardTransferOpenRemoteBoxResult {
  opened: true;
  url: string;
  localBoxPath?: string;
  surfaceId?: string;
}

export interface HostFileStatLike {
  size?: number;
  isFile?: boolean;
  isDirectory?: boolean;
}

export interface HostFileListEntry {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface HostCardReadInfo {
  metadata?: Record<string, unknown>;
  status?: unknown;
}

export interface HostZipEntryMeta {
  path: string;
  size: number;
  compressedSize: number;
  crc32: number;
  offset: number;
  isDirectory: boolean;
  compressionMethod: number;
  modifiedTime?: number;
}

export interface CommunityCardPublishContext {
  logger: {
    debug(message: string, metadata?: Record<string, unknown>): void;
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, metadata?: Record<string, unknown>): void;
  };
  host: {
    invoke<TOutput = unknown>(action: string, payload?: Record<string, unknown>): Promise<TOutput>;
  };
  /**
   * 模块间调用代理：允许本模块调用其他已安装模块的能力
   * （如 converter.file.convert 渲染卡片 HTML）。
   */
  module?: {
    invoke(request: {
      capability: string;
      method: string;
      input: Record<string, unknown>;
      pluginId?: string;
      timeoutMs?: number;
    }): Promise<{ mode: 'sync'; output: unknown } | { mode: 'job'; jobId: string }>;
    job?: {
      get(jobId: string): Promise<unknown>;
      cancel?(jobId: string): Promise<void>;
    };
  };
  job?: {
    id: string;
    signal: AbortSignal;
    reportProgress(payload: Record<string, unknown>): Promise<void>;
    isCancelled(): boolean;
  };
}
