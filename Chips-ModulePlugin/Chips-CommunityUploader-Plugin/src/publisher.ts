import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { createCommunityUploaderError, type CommunityUploaderWarning } from "./errors";
import { normalizeBinaryPayload, toArrayBuffer } from "./binary";
import {
  collectFileBackedRichTextResourcePaths,
  isStructuralCardFile,
  normalizeCardPath,
  readTextFile,
  replaceCoverHtmlUrls,
  replaceYamlResourceUrls,
  restoreCoverHtmlPaths,
  restoreYamlResourcePaths,
} from "./card-rewrite";
import type {
  CommunityCardPublishContext,
  CommunityCardTransferBoxUploadedCard,
  CommunityCardTransferBoxUploadRequest,
  CommunityCardTransferBoxUploadResult,
  CommunityCardTransferBoxSkippedCard,
  CommunityCardTransferDownloadRequest,
  CommunityCardTransferDownloadResult,
  CommunityCardTransferOpenRemoteRequest,
  CommunityCardTransferOpenRemoteResult,
  CommunityCardTransferOpenRemoteBoxRequest,
  CommunityCardTransferOpenRemoteBoxResult,
  CommunityCardTransferUploadedResource,
  CommunityCardTransferUploadRequest,
  CommunityCardTransferUploadResult,
  HostCardReadInfo,
  HostFileListEntry,
  HostFileStatLike,
  HostZipEntryMeta,
  NormalizedCommunityCardTransferBoxUploadRequest,
  NormalizedCommunityCardTransferDownloadRequest,
  NormalizedCommunityCardTransferUploadRequest,
} from "./types";

interface LocalResource {
  absolutePath: string;
  relativePath: string;
  sizeBytes: number;
  mimeType: string;
}

interface ResourceCollection {
  resources: LocalResource[];
}

interface PresignedObject {
  role: "network-card" | "resource" | "box-file" | "cover-file" | "render-file";
  relativePath: string | null;
  bucket: string;
  objectKey: string;
  publicUrl: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

interface DownloadPlanResource {
  originalRelativePath: string;
  networkUrl: string;
  bucket: string;
  objectKey: string;
  publicUrl?: string | null;
  downloadUrl: string;
  method?: "GET";
  headers?: Record<string, string>;
  sizeBytes: number;
  mimeType?: string | null;
}

interface DownloadPlan {
  cardId: string;
  versionId?: string | null;
  suggestedFileName?: string;
  networkCard: {
    bucket: string;
    objectKey: string;
    publicUrl?: string | null;
    downloadUrl: string;
    method?: "GET";
    headers?: Record<string, string>;
    sizeBytes: number;
    mimeType?: string | null;
  };
  resources: DownloadPlanResource[];
  restoreManifest?: unknown;
  manifest?: unknown;
}

interface HostBoxEntry {
  entryId?: string;
  url?: string;
  enabled?: boolean;
  snapshot?: Record<string, unknown>;
}

interface HostBoxInspection {
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  entries?: HostBoxEntry[];
  assets?: string[];
}

interface BoxUploadSession {
  uploadId: string;
  boxId: string;
  versionId: string;
  resourcePrefix: string;
  boxFile: {
    bucket: string;
    objectKey: string;
    publicUrl: string;
  };
}

interface BoxCompleteResult {
  boxId: string;
  versionId: string;
  status: string;
  communityUrl: string;
  boxViewUrl?: string;
}

interface ScatteredCardReference {
  entryId?: string;
  documentId?: string;
  url: string;
  localPath: string;
}

const DEFAULT_CLIENT_NAME = "Chips Community Transfer Plugin";
const DEFAULT_CLIENT_VERSION = "0.1.0";
const CARD_MIME_TYPE = "application/vnd.chips.card+zip";
const BOX_MIME_TYPE = "application/vnd.chips.box+zip";
const CLIENT_RENDERER_VERSION = "chips-client-renderer-1";
const RENDER_HTML_CONVERT_CAPABILITY = "converter.file.convert";
const RENDER_HTML_CONVERT_METHOD = "convert";
const MODULE_JOB_POLL_MS = 200;
const WINDOWS_ABSOLUTE_PATTERN = /^[A-Za-z]:\//;
const SCHEME_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const FILE_URL_PATTERN = /^file:\/\//i;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const asString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const detectSeparator = (filePath: string): "/" | "\\" => {
  return filePath.includes("\\") || /^[A-Za-z]:[\\/]/.test(filePath) ? "\\" : "/";
};

const toNormalizedPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/") && normalized !== "/" && !WINDOWS_ABSOLUTE_PATTERN.test(normalized)) {
    return normalized.slice(0, -1);
  }
  return normalized;
};

const toNativePath = (normalizedPath: string, referencePath: string): string => {
  return detectSeparator(referencePath) === "\\" ? normalizedPath.replace(/\//g, "\\") : normalizedPath;
};

const getRoot = (normalizedPath: string): string => {
  if (normalizedPath.startsWith("/")) {
    return "/";
  }
  const driveMatch = normalizedPath.match(/^[A-Za-z]:\//);
  if (driveMatch) {
    return driveMatch[0];
  }
  return "";
};

const splitSegments = (normalizedPath: string): string[] => normalizedPath.split("/").filter(Boolean);

const joinNormalized = (basePath: string, ...segments: string[]): string => {
  const normalizedBase = toNormalizedPath(basePath);
  const root = getRoot(normalizedBase);
  const nextSegments = [...splitSegments(normalizedBase), ...segments.flatMap((segment) => splitSegments(toNormalizedPath(segment)))];
  const joined = nextSegments.join("/");
  if (!root) {
    return joined;
  }
  if (root === "/") {
    return `/${joined}`;
  }
  return `${root}${joined}`;
};

const dirnameNormalized = (filePath: string): string => {
  const normalizedPath = toNormalizedPath(filePath);
  const root = getRoot(normalizedPath);
  const segments = splitSegments(normalizedPath);
  if (segments.length === 0) {
    return root || ".";
  }
  const parent = segments.slice(0, -1).join("/");
  if (!root) {
    return parent || ".";
  }
  if (root === "/") {
    return parent ? `/${parent}` : "/";
  }
  return parent ? `${root}${parent}` : root;
};

const basenameWithoutCardExtension = (filePath: string): string => {
  return path.posix.basename(toNormalizedPath(filePath), ".card");
};

const randomId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const normalizeServerBaseUrl = (value: string): string => {
  try {
    return new URL(value).toString().replace(/\/+$/, "");
  } catch {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "server.baseUrl must be a valid URL.");
  }
};

const buildApiUrl = (baseUrl: string, apiPath: string): string => {
  const normalizedBase = baseUrl.endsWith("/api/v1") ? baseUrl.slice(0, -"/api/v1".length) : baseUrl;
  const normalizedPath = apiPath.startsWith("/api/v1") ? apiPath.slice("/api/v1".length) : apiPath;
  return `${normalizedBase}/api/v1${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
};

const normalizeUploadRequest = (input: CommunityCardTransferUploadRequest): NormalizedCommunityCardTransferUploadRequest => {
  if (!isRecord(input)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "upload input must be an object.");
  }
  if (!asString(input.cardFile)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "cardFile is required.");
  }
  if (!isRecord(input.server) || !asString(input.server.baseUrl) || !asString(input.server.accessToken)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "server.baseUrl and server.accessToken are required.");
  }

  return {
    cardFile: input.cardFile,
    server: {
      baseUrl: normalizeServerBaseUrl(input.server.baseUrl),
      accessToken: input.server.accessToken,
    },
    publish: {
      roomId: input.publish?.roomId ?? null,
      ...(asString(input.publish?.idempotencyKey) ? { idempotencyKey: input.publish?.idempotencyKey } : undefined),
      includeRenderArtifacts: input.publish?.includeRenderArtifacts ?? false,
    },
    client: {
      name: input.client?.name ?? DEFAULT_CLIENT_NAME,
      version: input.client?.version ?? DEFAULT_CLIENT_VERSION,
      ...(asString(input.client?.platform) ? { platform: input.client?.platform } : undefined),
    },
    workspace: {
      tempDir: input.workspace?.tempDir,
      keepNetworkCard: input.workspace?.keepNetworkCard ?? false,
      networkCardPath: input.workspace?.networkCardPath,
    },
  };
};

const normalizeBoxUploadRequest = (input: CommunityCardTransferBoxUploadRequest): NormalizedCommunityCardTransferBoxUploadRequest => {
  if (!isRecord(input)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "uploadBox input must be an object.");
  }
  if (!asString(input.boxFile)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "boxFile is required.");
  }
  if (!isRecord(input.server) || !asString(input.server.baseUrl) || !asString(input.server.accessToken)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "server.baseUrl and server.accessToken are required.");
  }

  return {
    boxFile: input.boxFile,
    server: {
      baseUrl: normalizeServerBaseUrl(input.server.baseUrl),
      accessToken: input.server.accessToken,
    },
    publish: {
      roomId: input.publish?.roomId ?? null,
      ...(asString(input.publish?.idempotencyKey) ? { idempotencyKey: input.publish?.idempotencyKey } : undefined),
      includeRenderArtifacts: input.publish?.includeRenderArtifacts ?? false,
    },
    client: {
      name: input.client?.name ?? DEFAULT_CLIENT_NAME,
      version: input.client?.version ?? DEFAULT_CLIENT_VERSION,
      ...(asString(input.client?.platform) ? { platform: input.client?.platform } : undefined),
    },
    workspace: {
      tempDir: input.workspace?.tempDir,
    },
  };
};

const normalizeDownloadRequest = (input: CommunityCardTransferDownloadRequest): NormalizedCommunityCardTransferDownloadRequest => {
  if (!isRecord(input)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "download input must be an object.");
  }
  if (!asString(input.cardId)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "cardId is required.");
  }
  if (!asString(input.outputPath)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "outputPath is required.");
  }
  if (!isRecord(input.server) || !asString(input.server.baseUrl) || !asString(input.server.accessToken)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "server.baseUrl and server.accessToken are required.");
  }

  return {
    cardId: input.cardId,
    outputPath: input.outputPath,
    versionId: input.versionId,
    server: {
      baseUrl: normalizeServerBaseUrl(input.server.baseUrl),
      accessToken: input.server.accessToken,
    },
    client: {
      name: input.client?.name ?? DEFAULT_CLIENT_NAME,
      version: input.client?.version ?? DEFAULT_CLIENT_VERSION,
      ...(asString(input.client?.platform) ? { platform: input.client?.platform } : undefined),
    },
    workspace: {
      tempDir: input.workspace?.tempDir,
    },
  };
};

const reportProgress = async (
  ctx: CommunityCardPublishContext,
  stage: string,
  percent: number,
  message: string,
): Promise<void> => {
  if (!ctx.job) {
    return;
  }
  await ctx.job.reportProgress({ stage, percent, message });
};

const assertNotCancelled = (ctx: CommunityCardPublishContext): void => {
  if (ctx.job?.isCancelled()) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_CANCELLED", "Community card transfer was cancelled.");
  }
};

const jobSignal = (ctx: CommunityCardPublishContext): AbortSignal | undefined => {
  return ctx.job?.signal ?? undefined;
};

const withScaledJobProgress = (
  ctx: CommunityCardPublishContext,
  fromPercent: number,
  toPercent: number,
): CommunityCardPublishContext => {
  if (!ctx.job) {
    return ctx;
  }
  const job = ctx.job;
  const reportProgress = async (payload: Record<string, unknown>): Promise<void> => {
    const rawPercent = typeof payload.percent === "number" ? Math.min(100, Math.max(0, payload.percent)) : 0;
    await job.reportProgress({
      ...payload,
      percent: Math.round(fromPercent + (rawPercent / 100) * (toPercent - fromPercent)),
    });
  };
  return { ...ctx, job: { ...job, reportProgress } };
};

const getFileStat = async (ctx: CommunityCardPublishContext, filePath: string): Promise<HostFileStatLike> => {
  const response = await ctx.host.invoke<{ meta?: unknown }>("file.stat", { path: filePath });
  const meta = response && typeof response === "object" && "meta" in response ? response.meta : response;
  return isRecord(meta) ? {
    size: typeof meta.size === "number" ? meta.size : undefined,
    isFile: typeof meta.isFile === "boolean" ? meta.isFile : undefined,
    isDirectory: typeof meta.isDirectory === "boolean" ? meta.isDirectory : undefined,
  } : {};
};

const readBinaryFile = async (ctx: CommunityCardPublishContext, filePath: string): Promise<Uint8Array> => {
  const response = await ctx.host.invoke<{ content?: unknown }>("file.read", {
    path: filePath,
    options: {
      encoding: "binary",
    },
  });
  const payload = response && typeof response === "object" && "content" in response ? response.content : response;
  return normalizeBinaryPayload(payload);
};

const writeBinaryFile = async (ctx: CommunityCardPublishContext, filePath: string, bytes: Uint8Array): Promise<void> => {
  await ctx.host.invoke("file.write", {
    path: filePath,
    content: Array.from(bytes),
    encoding: "binary",
  });
};

const listFiles = async (ctx: CommunityCardPublishContext, dir: string): Promise<HostFileListEntry[]> => {
  const response = await ctx.host.invoke<{ entries?: unknown }>("file.list", {
    dir,
    options: { recursive: true },
  });
  const entries = response && typeof response === "object" && "entries" in response ? response.entries : response;
  if (!Array.isArray(entries)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_FILE_LIST_FAILED", `Host returned invalid file.list result for ${dir}.`);
  }
  return entries
    .filter(isRecord)
    .map((entry) => ({
      path: String(entry.path ?? ""),
      isFile: entry.isFile === true,
      isDirectory: entry.isDirectory === true,
    }))
    .filter((entry) => entry.path.length > 0);
};

const createWorkspaceRoot = async (ctx: CommunityCardPublishContext, baseFilePath: string, tempDir?: string): Promise<{
  rootDir: string;
  createdByModule: boolean;
}> => {
  if (tempDir) {
    const rootDir = toNormalizedPath(tempDir);
    await ctx.host.invoke("file.mkdir", {
      path: toNativePath(rootDir, baseFilePath),
      options: { recursive: true },
    });
    return { rootDir, createdByModule: false };
  }

  const rootDir = joinNormalized(dirnameNormalized(baseFilePath), `.chips-community-transfer-${randomId()}`);
  await ctx.host.invoke("file.mkdir", {
    path: toNativePath(rootDir, baseFilePath),
    options: { recursive: true },
  });
  return { rootDir, createdByModule: true };
};

const resolveNetworkCardPath = (
  request: NormalizedCommunityCardTransferUploadRequest,
  workspaceRoot: string,
): string => {
  if (request.workspace.networkCardPath) {
    return toNormalizedPath(request.workspace.networkCardPath);
  }

  return joinNormalized(workspaceRoot, `${basenameWithoutCardExtension(request.cardFile)}.network.card`);
};

const detectMimeType = (relativePath: string): string => {
  const ext = path.posix.extname(relativePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".pdf": "application/pdf",
    ".card": CARD_MIME_TYPE,
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".yaml": "application/yaml; charset=utf-8",
    ".yml": "application/yaml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".vtt": "text/vtt; charset=utf-8",
    ".srt": "application/x-subrip; charset=utf-8",
  };
  return map[ext] ?? "application/octet-stream";
};

const collectResources = async (ctx: CommunityCardPublishContext, unpackedDir: string): Promise<ResourceCollection> => {
  const entries = await listFiles(ctx, unpackedDir);
  const resources: LocalResource[] = [];
  const normalizedRoot = toNormalizedPath(unpackedDir);

  for (const entry of entries) {
    if (!entry.isFile) {
      continue;
    }
    const absolutePath = toNormalizedPath(entry.path);
    const relativePath = normalizeCardPath(path.posix.relative(normalizedRoot, absolutePath));
    if (!relativePath || isStructuralCardFile(relativePath)) {
      continue;
    }

    const stat = await getFileStat(ctx, toNativePath(absolutePath, unpackedDir));
    const sizeBytes = typeof stat.size === "number" && stat.size > 0 ? stat.size : (await readBinaryFile(ctx, toNativePath(absolutePath, unpackedDir))).byteLength;
    resources.push({
      absolutePath,
      relativePath,
      sizeBytes,
      mimeType: detectMimeType(relativePath),
    });
  }

  resources.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
  return { resources };
};

const authorizedHeaders = (server: { accessToken: string }): HeadersInit => ({
  authorization: `Bearer ${server.accessToken}`,
});

const jsonHeaders = (server: { accessToken: string }): HeadersInit => ({
  ...authorizedHeaders(server),
  "content-type": "application/json",
});

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isTransientHttpStatus = (status: number): boolean => {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
};

const isAuthExpiredStatus = (status: number): boolean => {
  return status === 401 || status === 403;
};

interface RetryOptions {
  label: string;
  maxAttempts: number;
  signal?: AbortSignal;
}

const fetchWithRetry = async (
  url: string,
  init: RequestInit,
  options: RetryOptions,
): Promise<Response> => {
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw createCommunityUploaderError(
        "COMMUNITY_TRANSFER_CANCELLED",
        "Community card transfer was cancelled.",
      );
    }

    try {
      const response = await fetch(url, init);
      if (!isTransientHttpStatus(response.status)) {
        if (isAuthExpiredStatus(response.status)) {
          throw createCommunityUploaderError(
            "COMMUNITY_TRANSFER_AUTH_EXPIRED",
            `${options.label}: access token expired or invalid (HTTP ${response.status}).`,
            { status: response.status },
            false,
          );
        }
        return response;
      }

      lastResponse = response;
      await response.arrayBuffer().catch(() => undefined);
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        throw error;
      }
      lastError = error;
    }

    if (attempt < options.maxAttempts) {
      const backoffMs = Math.min(100 * 2 ** (attempt - 1), 2_000);
      await sleep(backoffMs);
    }
  }

  if (lastError) {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_NETWORK_FAILED",
      `${options.label}: network request failed after ${options.maxAttempts} attempts.`,
      { label: options.label, attempts: options.maxAttempts, error: lastError instanceof Error ? lastError.message : String(lastError) },
      true,
    );
  }

  throw createCommunityUploaderError(
    "COMMUNITY_TRANSFER_HTTP_ERROR",
    `${options.label}: HTTP ${lastResponse?.status ?? "unknown"} after ${options.maxAttempts} attempts.`,
    { label: options.label, status: lastResponse?.status, attempts: options.maxAttempts },
    true,
  );
};

const fetchControlPlane = async (
  request: { server: { baseUrl: string; accessToken: string } },
  apiPath: string,
  init: RequestInit,
  label: string,
  signal?: AbortSignal,
): Promise<Response> => {
  return fetchWithRetry(buildApiUrl(request.server.baseUrl, apiPath), init, {
    label,
    maxAttempts: 3,
    signal,
  });
};

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  let payload: unknown = null;
  const text = await response.text();
  if (text.trim().length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", `${fallbackMessage}: invalid JSON response.`, {
        status: response.status,
        body: text.slice(0, 500),
      });
    }
  }

  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    throw createCommunityUploaderError(
      asString(error.code) ?? "COMMUNITY_TRANSFER_HTTP_ERROR",
      asString(error.message) ?? `${fallbackMessage}: HTTP ${response.status}`,
      {
        status: response.status,
        response: payload,
      },
      response.status >= 500,
    );
  }

  return payload as T;
};

const createUploadSession = async (
  request: NormalizedCommunityCardTransferUploadRequest,
  fileName: string,
  signal?: AbortSignal,
): Promise<{ uploadId: string; cardId: string; versionId: string; resourcePrefix: string }> => {
  const response = await fetchControlPlane(
    request,
    "/card-transfer/upload-sessions",
    {
      method: "POST",
      headers: jsonHeaders(request.server),
      body: JSON.stringify({
        fileName,
        roomId: request.publish.roomId ?? null,
        includeRenderArtifacts: request.publish.includeRenderArtifacts,
        idempotencyKey: request.publish.idempotencyKey,
        client: request.client,
      }),
    },
    "create upload session",
    signal,
  );
  const payload = await parseJsonResponse<{ data?: unknown }>(response, "Failed to create upload session");
  if (!isRecord(payload.data)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Upload session response is missing identifiers.");
  }
  const uploadId = asString(payload.data.uploadId);
  const cardId = asString(payload.data.cardId);
  const versionId = asString(payload.data.versionId);
  if (!uploadId || !cardId || !versionId) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Upload session response is missing identifiers.");
  }
  return {
    uploadId,
    cardId,
    versionId,
    resourcePrefix: String(payload.data.resourcePrefix ?? ""),
  };
};

const presignObjects = async (
  request: { server: { baseUrl: string; accessToken: string } },
  uploadId: string,
  objects: Array<{
    role: "network-card" | "resource" | "box-file" | "cover-file" | "render-file";
    relativePath?: string;
    sizeBytes: number;
    mimeType: string;
  }>,
  signal?: AbortSignal,
): Promise<PresignedObject[]> => {
  if (objects.length === 0) {
    return [];
  }

  const response = await fetchControlPlane(
    request,
    `/card-transfer/upload-sessions/${uploadId}/objects:presign`,
    {
      method: "POST",
      headers: jsonHeaders(request.server),
      body: JSON.stringify({ objects }),
    },
    "presign transfer objects",
    signal,
  );
  const payload = await parseJsonResponse<{ data?: unknown }>(response, "Failed to presign transfer objects");
  if (!isRecord(payload.data) || !Array.isArray(payload.data.objects)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Presign response is missing objects.");
  }

  return payload.data.objects.filter(isRecord).map((object) => ({
    role: object.role === "network-card"
      ? "network-card"
      : object.role === "box-file"
        ? "box-file"
        : object.role === "cover-file"
          ? "cover-file"
          : object.role === "render-file"
            ? "render-file"
            : "resource",
    relativePath: object.relativePath === null || typeof object.relativePath === "undefined" ? null : String(object.relativePath),
    bucket: String(object.bucket ?? ""),
    objectKey: String(object.objectKey ?? ""),
    publicUrl: String(object.publicUrl ?? ""),
    uploadUrl: String(object.uploadUrl ?? ""),
    method: object.method === "PUT" ? "PUT" : "PUT",
    headers: isRecord(object.headers)
      ? Object.fromEntries(Object.entries(object.headers).map(([key, value]) => [key, String(value)]))
      : {},
  }));
};

const uploadBytesToStorage = async (
  label: string,
  bytes: Uint8Array,
  presigned: PresignedObject,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await fetchWithRetry(
    presigned.uploadUrl,
    {
      method: presigned.method,
      headers: presigned.headers,
      body: toArrayBuffer(bytes),
    },
    {
      label: `upload ${label}`,
      maxAttempts: 3,
      signal,
    },
  );

  if (!response.ok) {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_OBJECT_UPLOAD_FAILED",
      `Failed to upload ${label}: HTTP ${response.status}`,
      { label, status: response.status },
      response.status >= 500,
    );
  }
};

const downloadBinary = async (
  resource: { downloadUrl: string; headers?: Record<string, string> },
  label: string,
  signal?: AbortSignal,
): Promise<Uint8Array> => {
  const response = await fetchWithRetry(
    resource.downloadUrl,
    {
      method: "GET",
      headers: resource.headers ?? {},
    },
    {
      label: `download ${label}`,
      maxAttempts: 3,
      signal,
    },
  );
  if (!response.ok) {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_OBJECT_DOWNLOAD_FAILED",
      `Failed to download ${label}: HTTP ${response.status}`,
      { label, status: response.status },
      response.status >= 500,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
};

const getZipEntries = async (ctx: CommunityCardPublishContext, cardFile: string): Promise<HostZipEntryMeta[]> => {
  const response = await ctx.host.invoke<{ entries?: unknown }>("zip.list", {
    zipPath: cardFile,
  });
  const entries = response && typeof response === "object" && "entries" in response ? response.entries : response;
  return Array.isArray(entries) ? entries.filter(isRecord).map((entry) => ({
    path: String(entry.path ?? ""),
    size: Number(entry.size ?? 0),
    compressedSize: Number(entry.compressedSize ?? 0),
    crc32: Number(entry.crc32 ?? 0),
    offset: Number(entry.offset ?? 0),
    isDirectory: entry.isDirectory === true,
    compressionMethod: Number(entry.compressionMethod ?? 0),
    modifiedTime: typeof entry.modifiedTime === "number" ? entry.modifiedTime : undefined,
  })) : [];
};

const assertZipStoreEntries = (entries: HostZipEntryMeta[]): void => {
  const compressed = entries.filter((entry) => !entry.isDirectory && entry.compressionMethod !== 0);
  if (compressed.length > 0) {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_CARD_NOT_STORE_ZIP",
      ".card ZIP entries must use Store mode before publishing.",
      { entries: compressed.slice(0, 20).map((entry) => entry.path) },
    );
  }
};

const writeRewrittenCard = async (
  ctx: CommunityCardPublishContext,
  unpackedDir: string,
  resources: LocalResource[],
  resourceUrlMap: Map<string, string>,
  textResourceMap: Map<string, string>,
): Promise<void> => {
  const entries = await listFiles(ctx, unpackedDir);
  const normalizedRoot = toNormalizedPath(unpackedDir);

  for (const entry of entries) {
    if (!entry.isFile) {
      continue;
    }

    const absolutePath = toNormalizedPath(entry.path);
    const relativePath = normalizeCardPath(path.posix.relative(normalizedRoot, absolutePath));

    if (relativePath.startsWith("content/") && relativePath.endsWith(".yaml")) {
      const raw = await readTextFile(ctx, toNativePath(absolutePath, unpackedDir));
      await ctx.host.invoke("file.write", {
        path: toNativePath(absolutePath, unpackedDir),
        content: replaceYamlResourceUrls(raw, resourceUrlMap, relativePath, textResourceMap),
      });
    }

    if (relativePath === ".card/cover.html") {
      const raw = await readTextFile(ctx, toNativePath(absolutePath, unpackedDir));
      await ctx.host.invoke("file.write", {
        path: toNativePath(absolutePath, unpackedDir),
        content: replaceCoverHtmlUrls(raw, resourceUrlMap),
      });
    }
  }

  for (const resource of resources) {
    await ctx.host.invoke("file.delete", {
      path: toNativePath(resource.absolutePath, unpackedDir),
    });
  }
};

const collectTextResourceMap = async (
  ctx: CommunityCardPublishContext,
  unpackedDir: string,
): Promise<Map<string, string>> => {
  const textResourceMap = new Map<string, string>();
  const entries = await listFiles(ctx, unpackedDir);
  const normalizedRoot = toNormalizedPath(unpackedDir);

  for (const entry of entries) {
    if (!entry.isFile) {
      continue;
    }
    const absolutePath = toNormalizedPath(entry.path);
    const relativePath = normalizeCardPath(path.posix.relative(normalizedRoot, absolutePath));
    if (!relativePath.startsWith("content/") || !relativePath.endsWith(".yaml")) {
      continue;
    }

    const raw = await readTextFile(ctx, toNativePath(absolutePath, unpackedDir));
    for (const candidatePath of collectFileBackedRichTextResourcePaths(raw, relativePath)) {
      const candidateAbsolutePath = joinNormalized(unpackedDir, candidatePath);
      const text = await readTextFile(ctx, toNativePath(candidateAbsolutePath, unpackedDir))
        .catch(() => null);
      if (text !== null) {
        textResourceMap.set(candidatePath, text);
      }
    }
  }

  return textResourceMap;
};

const collectRichTextContentFileMap = async (
  ctx: CommunityCardPublishContext,
  unpackedDir: string,
): Promise<Map<string, string>> => {
  const richTextContentFileMap = new Map<string, string>();
  const entries = await listFiles(ctx, unpackedDir);
  const normalizedRoot = toNormalizedPath(unpackedDir);

  for (const entry of entries) {
    if (!entry.isFile) {
      continue;
    }
    const absolutePath = toNormalizedPath(entry.path);
    const relativePath = normalizeCardPath(path.posix.relative(normalizedRoot, absolutePath));
    if (!relativePath.startsWith("content/") || !relativePath.endsWith(".yaml")) {
      continue;
    }

    const raw = await readTextFile(ctx, toNativePath(absolutePath, unpackedDir));
    const candidatePaths = collectFileBackedRichTextResourcePaths(raw, relativePath);
    if (candidatePaths.length > 0) {
      richTextContentFileMap.set(relativePath, candidatePaths[0]!);
    }
  }

  return richTextContentFileMap;
};

const extractRichTextContentFileMap = (restoreManifest: unknown): Map<string, string> => {
  const map = new Map<string, string>();
  if (!isRecord(restoreManifest) || !Array.isArray(restoreManifest.richTextContentFiles)) {
    return map;
  }

  for (const item of restoreManifest.richTextContentFiles) {
    if (!isRecord(item)) {
      continue;
    }
    const configPath = asString(item.configPath);
    const contentFile = asString(item.contentFile);
    if (configPath && contentFile) {
      map.set(configPath, contentFile);
    }
  }

  return map;
};

const restoreDownloadedCard = async (
  ctx: CommunityCardPublishContext,
  unpackedDir: string,
  resources: DownloadPlanResource[],
  restoreManifest: unknown,
): Promise<void> => {
  const pathMap = new Map<string, string>();
  for (const resource of resources) {
    pathMap.set(resource.networkUrl, resource.originalRelativePath);
    if (resource.publicUrl) {
      pathMap.set(resource.publicUrl, resource.originalRelativePath);
    }
  }
  const richTextContentFileMap = extractRichTextContentFileMap(restoreManifest);

  const entries = await listFiles(ctx, unpackedDir);
  const normalizedRoot = toNormalizedPath(unpackedDir);
  for (const entry of entries) {
    if (!entry.isFile) {
      continue;
    }
    const absolutePath = toNormalizedPath(entry.path);
    const relativePath = normalizeCardPath(path.posix.relative(normalizedRoot, absolutePath));
    if (relativePath.startsWith("content/") && relativePath.endsWith(".yaml")) {
      const raw = await readTextFile(ctx, toNativePath(absolutePath, unpackedDir));
      await ctx.host.invoke("file.write", {
        path: toNativePath(absolutePath, unpackedDir),
        content: restoreYamlResourcePaths(raw, pathMap, relativePath, richTextContentFileMap),
      });
    }
    if (relativePath === ".card/cover.html") {
      const raw = await readTextFile(ctx, toNativePath(absolutePath, unpackedDir));
      await ctx.host.invoke("file.write", {
        path: toNativePath(absolutePath, unpackedDir),
        content: restoreCoverHtmlPaths(raw, pathMap),
      });
    }
  }

  for (const resource of resources) {
    const targetPath = joinNormalized(unpackedDir, resource.originalRelativePath);
    const parentDir = dirnameNormalized(targetPath);
    await ctx.host.invoke("file.mkdir", {
      path: toNativePath(parentDir, unpackedDir),
      options: { recursive: true },
    });
    const bytes = await downloadBinary(resource, resource.originalRelativePath, jobSignal(ctx));
    await writeBinaryFile(ctx, toNativePath(targetPath, unpackedDir), bytes);
  }
};

const createRestoreManifest = (params: {
  originalFileName: string;
  cardId: string;
  versionId: string;
  zipEntries: HostZipEntryMeta[];
  resources: CommunityCardTransferUploadedResource[];
  richTextContentFileMap?: Map<string, string>;
}): Record<string, unknown> => {
  return {
    schemaVersion: "1.0.0",
    originalFileName: params.originalFileName,
    cardId: params.cardId,
    versionId: params.versionId,
    resources: params.resources.map((resource) => ({
      originalRelativePath: resource.originalRelativePath,
      networkUrl: resource.networkUrl,
      bucket: resource.bucket,
      objectKey: resource.objectKey,
      sizeBytes: resource.sizeBytes,
      mimeType: resource.mimeType,
    })),
    zipEntries: params.zipEntries.map((entry, index) => ({
      order: index,
      path: entry.path,
      size: entry.size,
      compressedSize: entry.compressedSize,
      crc32: entry.crc32,
      isDirectory: entry.isDirectory,
      compressionMethod: entry.compressionMethod,
      modifiedTime: entry.modifiedTime,
    })),
    richTextContentFiles: params.richTextContentFileMap
      ? Array.from(params.richTextContentFileMap.entries()).map(([configPath, contentFile]) => ({
          configPath,
          contentFile,
        }))
      : [],
  };
};

const extractEntryPlan = (restoreManifest: unknown): Array<{ path: string; modifiedTime?: number }> => {
  if (!isRecord(restoreManifest) || !Array.isArray(restoreManifest.zipEntries)) {
    return [];
  }

  const entries = restoreManifest.zipEntries
    .filter(isRecord)
    .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))
    .map((entry) => ({
      path: normalizeCardPath(String(entry.path ?? "")),
      ...(typeof entry.modifiedTime === "number" ? { modifiedTime: entry.modifiedTime } : undefined),
    }))
    .filter((entry) => entry.path.length > 0);

  return entries;
};

/**
 * 调用 Host 的转换模块（converter.file.convert）把 .card 渲染为 HTML 产物目录。
 * 渲染任务以 job 模式执行，这里负责创建并轮询到完成。
 */
const renderCardViewHtml = async (
  ctx: CommunityCardPublishContext,
  params: {
    cardFile: string;
    outputDir: string;
  },
): Promise<void> => {
  if (!ctx.module?.invoke || !ctx.module.job?.get) {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_RENDER_UNAVAILABLE",
      "Render artifacts mode requires the file conversion module (converter.file.convert); it is not available in this Host.",
      { capability: RENDER_HTML_CONVERT_CAPABILITY },
      true,
    );
  }

  const started = await ctx.module.invoke({
    capability: RENDER_HTML_CONVERT_CAPABILITY,
    method: RENDER_HTML_CONVERT_METHOD,
    input: {
      source: {
        type: "card",
        path: params.cardFile,
      },
      target: {
        type: "html",
      },
      output: {
        path: params.outputDir,
        overwrite: true,
      },
      options: {
        html: {
          packageMode: "directory",
          includeAssets: true,
          includeManifest: false,
        },
      },
    },
  });

  if (started.mode === "sync") {
    return;
  }

  const { jobId } = started;
  for (;;) {
    assertNotCancelled(ctx);
    await sleep(MODULE_JOB_POLL_MS);
    const snapshot = await ctx.module.job.get(jobId);
    if (!isRecord(snapshot)) {
      throw createCommunityUploaderError(
        "COMMUNITY_TRANSFER_RENDER_FAILED",
        `Card HTML render returned an invalid job snapshot.`,
        { jobId },
        true,
      );
    }
    const status = snapshot.status;
    if (status === "completed") {
      return;
    }
    if (status === "failed" || status === "cancelled") {
      const errorMessage = isRecord(snapshot.error)
        ? String(snapshot.error.message ?? "unknown error")
        : "unknown error";
      throw createCommunityUploaderError(
        "COMMUNITY_TRANSFER_RENDER_FAILED",
        `Card HTML render ${String(status)}: ${errorMessage}`,
        { jobId, status, error: snapshot.error },
        true,
      );
    }
  }
};

/** 枚举渲染产物目录内所有文件（相对路径、大小、MIME） */
const collectRenderDirectoryFiles = async (
  ctx: CommunityCardPublishContext,
  rootDir: string,
): Promise<LocalResource[]> => {
  const entries = await listFiles(ctx, rootDir);
  const normalizedRoot = toNormalizedPath(rootDir);
  const files: LocalResource[] = [];

  for (const entry of entries) {
    if (!entry.isFile) {
      continue;
    }
    const absolutePath = toNormalizedPath(entry.path);
    const relativePath = normalizeCardPath(path.posix.relative(normalizedRoot, absolutePath));
    if (!relativePath) {
      continue;
    }
    const stat = await getFileStat(ctx, toNativePath(absolutePath, rootDir));
    const sizeBytes = typeof stat.size === "number" && stat.size > 0
      ? stat.size
      : (await readBinaryFile(ctx, toNativePath(absolutePath, rootDir))).byteLength;
    files.push({
      absolutePath,
      relativePath,
      sizeBytes,
      mimeType: detectMimeType(relativePath),
    });
  }

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
  return files;
};

/** 生成简单的默认封面 HTML（卡片没有正式封面时兜底） */
const createClientDefaultCoverHtml = (title: string): string => {
  const safeTitle = title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; min-height: 100%; }
      body {
        min-height: 100vh;
        display: grid;
        place-items: end stretch;
        padding: clamp(18px, 5vw, 32px);
        background: linear-gradient(155deg, #f8fbff 0%, #dfeeff 44%, #b7d7ff 100%);
        color: #101828;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
      }
      h1 { margin: 0; font-size: clamp(28px, 7vw, 54px); line-height: 1; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
  </body>
</html>`;
};

const isBlankHtml = (html: string): boolean => html.replace(/\s+/g, " ").trim().length === 0;

/**
 * 从卡片解包目录组装封面产物目录：
 * - `.card/cover.html` → `index.html`；
 * - `.card/cardcover/*` → `cardcover/*`（相对引用保持不变）。
 * cover.html 缺失或空白时生成默认封面。
 * 返回产物目录文件清单；目录本身由调用方清理。
 */
const buildCoverArtifactDir = async (
  ctx: CommunityCardPublishContext,
  params: {
    unpackedDir: string;
    coverDir: string;
    cardTitle: string;
  },
): Promise<void> => {
  await ctx.host.invoke("file.mkdir", {
    path: toNativePath(params.coverDir, params.unpackedDir),
    options: { recursive: true },
  });

  const coverHtmlSource = joinNormalized(params.unpackedDir, ".card", "cover.html");
  const coverHtml = await readTextFile(ctx, toNativePath(coverHtmlSource, params.unpackedDir))
    .catch(() => null);
  const indexHtml = coverHtml && !isBlankHtml(coverHtml)
    ? coverHtml
    : createClientDefaultCoverHtml(params.cardTitle);

  await ctx.host.invoke("file.write", {
    path: toNativePath(joinNormalized(params.coverDir, "index.html"), params.unpackedDir),
    content: indexHtml,
  });

  const coverAssetDir = joinNormalized(params.unpackedDir, ".card", "cardcover");
  const coverAssetEntries = await listFiles(ctx, coverAssetDir).catch(() => []);
  for (const entry of coverAssetEntries) {
    if (!entry.isFile) {
      continue;
    }
    const sourcePath = toNormalizedPath(entry.path);
    const relativePath = normalizeCardPath(path.posix.relative(toNormalizedPath(coverAssetDir), sourcePath));
    if (!relativePath) {
      continue;
    }
    const bytes = await readBinaryFile(ctx, toNativePath(sourcePath, params.unpackedDir));
    const targetDir = joinNormalized(params.coverDir, "cardcover");
    await ctx.host.invoke("file.mkdir", {
      path: toNativePath(targetDir, params.unpackedDir),
      options: { recursive: true },
    });
    await writeBinaryFile(ctx, toNativePath(joinNormalized(targetDir, relativePath), params.unpackedDir), bytes);
  }
};

/**
 * 上传渲染产物（view + cover）到对象存储，并汇总产物摘要供 complete 提交。
 */
const uploadRenderArtifacts = async (
  ctx: CommunityCardPublishContext,
  request: NormalizedCommunityCardTransferUploadRequest,
  session: { uploadId: string },
  artifacts: Array<{
    role: "render-file" | "cover-file";
    rootDir: string;
  }>,
  signal?: AbortSignal,
): Promise<{
  view: { entryRelativePath: string; fileCount: number; sizeBytes: number };
  cover?: { entryRelativePath: string; fileCount: number; sizeBytes: number };
} | null> => {
  if (artifacts.length === 0) {
    return null;
  }

  const collected = await Promise.all(
    artifacts.map(async (artifact) => ({
      role: artifact.role,
      rootDir: artifact.rootDir,
      files: await collectRenderDirectoryFiles(ctx, artifact.rootDir),
    })),
  );
  const totalFiles = collected.reduce((total, item) => total + item.files.length, 0);
  if (totalFiles === 0) {
    return null;
  }

  const presignedObjects = collected.flatMap((item) =>
    item.files.map((file) => ({
      role: item.role as "render-file" | "cover-file",
      relativePath: file.relativePath,
      sizeBytes: file.sizeBytes,
      mimeType: file.mimeType,
    })),
  );
  const presigned = await presignObjects(request, session.uploadId, presignedObjects, signal);
  const presignedByPath = new Map(
    presigned
      .filter((item) => item.role === "render-file" || item.role === "cover-file")
      .map((item) => [`${item.role}:${normalizeCardPath(item.relativePath ?? "")}`, item]),
  );

  const result: {
    view: { entryRelativePath: string; fileCount: number; sizeBytes: number };
    cover?: { entryRelativePath: string; fileCount: number; sizeBytes: number };
  } = {
    view: { entryRelativePath: "", fileCount: 0, sizeBytes: 0 },
  };

  for (const item of collected) {
    let sizeBytes = 0;
    for (const file of item.files) {
      const target = presignedByPath.get(`${item.role}:${file.relativePath}`);
      if (!target) {
        throw createCommunityUploaderError(
          "COMMUNITY_TRANSFER_RESPONSE_INVALID",
          `Presign response is missing ${item.role} object for ${file.relativePath}.`,
        );
      }
      const bytes = await readBinaryFile(ctx, toNativePath(file.absolutePath, item.rootDir));
      await uploadBytesToStorage(`${item.role}:${file.relativePath}`, bytes, target, signal);
      sizeBytes += bytes.byteLength;
    }

    const entry = item.files.find((file) => file.relativePath === "index.html")
      ?? item.files[0];
    if (!entry) {
      continue;
    }
    const summary = {
      entryRelativePath: entry.relativePath,
      fileCount: item.files.length,
      sizeBytes,
    };
    if (item.role === "cover-file") {
      result.cover = summary;
    } else {
      result.view = summary;
    }
  }

  return result;
};

const completeUpload = async (
  request: NormalizedCommunityCardTransferUploadRequest,
  uploadId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<CommunityCardTransferUploadResult> => {
  const response = await fetchControlPlane(
    request,
    `/card-transfer/upload-sessions/${uploadId}/complete`,
    {
      method: "POST",
      headers: jsonHeaders(request.server),
      body: JSON.stringify(body),
    },
    "complete card transfer upload",
    signal,
  );
  const payload = await parseJsonResponse<{ data?: unknown }>(response, "Failed to complete card transfer upload");

  if (!isRecord(payload.data)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Complete response is missing cardId.");
  }
  const cardId = asString(payload.data.cardId);
  if (!cardId) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Complete response is missing cardId.");
  }

  return {
    cardId,
    versionId: String(payload.data.versionId ?? ""),
    status: String(payload.data.status ?? "ready"),
    renderStatus: String(payload.data.renderStatus ?? payload.data.status ?? "queued"),
    renderStatusUrl: String(payload.data.renderStatusUrl ?? `/api/v1/cards/${cardId}/render-status`),
    communityUrl: String(payload.data.communityUrl ?? `${request.server.baseUrl}/cards/${cardId}`),
    uploadedResources: [],
  };
};

const pushWarning = (
  warnings: CommunityUploaderWarning[],
  code: string,
  message: string,
  details?: unknown,
): void => {
  warnings.push({ code, message, ...(details === undefined ? undefined : { details }) });
};

const createBoxUploadSession = async (
  request: NormalizedCommunityCardTransferBoxUploadRequest,
  fileName: string,
  signal?: AbortSignal,
): Promise<BoxUploadSession> => {
  const response = await fetchControlPlane(
    request,
    "/card-transfer/upload-sessions",
    {
      method: "POST",
      headers: jsonHeaders(request.server),
      body: JSON.stringify({
        contentType: "box",
        fileName,
        roomId: request.publish.roomId ?? null,
        idempotencyKey: request.publish.idempotencyKey,
        client: request.client,
      }),
    },
    "create box upload session",
    signal,
  );
  const payload = await parseJsonResponse<{ data?: unknown }>(response, "Failed to create box upload session");
  if (!isRecord(payload.data)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Box upload session response is missing identifiers.");
  }
  const uploadId = asString(payload.data.uploadId);
  const boxId = asString(payload.data.boxId);
  const versionId = asString(payload.data.versionId);
  if (!uploadId || !boxId || !versionId) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Box upload session response is missing identifiers.");
  }
  const boxFile = isRecord(payload.data.boxFile) ? payload.data.boxFile : {};
  return {
    uploadId,
    boxId,
    versionId,
    resourcePrefix: String(payload.data.resourcePrefix ?? ""),
    boxFile: {
      bucket: String(boxFile.bucket ?? ""),
      objectKey: String(boxFile.objectKey ?? ""),
      publicUrl: String(boxFile.publicUrl ?? ""),
    },
  };
};

const completeBoxUpload = async (
  request: NormalizedCommunityCardTransferBoxUploadRequest,
  uploadId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<BoxCompleteResult> => {
  const response = await fetchControlPlane(
    request,
    `/card-transfer/upload-sessions/${uploadId}/complete`,
    {
      method: "POST",
      headers: jsonHeaders(request.server),
      body: JSON.stringify(body),
    },
    "complete box transfer upload",
    signal,
  );
  const payload = await parseJsonResponse<{ data?: unknown }>(response, "Failed to complete box transfer upload");

  if (!isRecord(payload.data)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Box complete response is missing boxId.");
  }
  const boxId = asString(payload.data.boxId);
  if (!boxId) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Box complete response is missing boxId.");
  }

  return {
    boxId,
    versionId: String(payload.data.versionId ?? ""),
    status: String(payload.data.status ?? "ready"),
    communityUrl: String(payload.data.communityUrl ?? `${request.server.baseUrl}/boxes/${boxId}`),
    boxViewUrl: typeof payload.data.boxViewUrl === "string" && payload.data.boxViewUrl.trim().length > 0
      ? payload.data.boxViewUrl
      : undefined,
  };
};

const isEmbeddedEntryUrl = (url: string): boolean => !SCHEME_URL_PATTERN.test(url);

const isFileEntryUrl = (url: string): boolean => FILE_URL_PATTERN.test(url);

const entryFileUrlToPath = (url: string): string | undefined => {
  try {
    return toNormalizedPath(fileURLToPath(url));
  } catch {
    return undefined;
  }
};

const collectScatteredCards = async (
  ctx: CommunityCardPublishContext,
  entries: HostBoxEntry[],
  warnings: CommunityUploaderWarning[],
): Promise<{ collected: ScatteredCardReference[]; skipped: CommunityCardTransferBoxSkippedCard[] }> => {
  const collected: ScatteredCardReference[] = [];
  const skipped: CommunityCardTransferBoxSkippedCard[] = [];

  for (const entry of entries) {
    const url = asString(entry.url);
    if (!url) {
      continue;
    }
    const entryId = asString(entry.entryId);
    const documentId = asString(isRecord(entry.snapshot) ? entry.snapshot.documentId : undefined);

    if (isEmbeddedEntryUrl(url)) {
      skipped.push({ entryId, documentId, url, reason: "embedded" });
      continue;
    }

    if (!isFileEntryUrl(url)) {
      skipped.push({ entryId, documentId, url, reason: "network" });
      continue;
    }

    const localPath = entryFileUrlToPath(url);
    if (!localPath) {
      pushWarning(warnings, "COMMUNITY_TRANSFER_BOX_ENTRY_URL_INVALID", `Scattered card entry has an unresolvable file URL: ${url}`, {
        entryId,
        documentId,
        url,
      });
      continue;
    }

    const stat = await getFileStat(ctx, toNativePath(localPath, url));
    if (stat.isFile !== true) {
      pushWarning(warnings, "COMMUNITY_TRANSFER_BOX_CARD_FILE_MISSING", `Scattered card file not found: ${localPath}`, {
        entryId,
        documentId,
        url,
      });
      continue;
    }

    collected.push({ entryId, documentId, url, localPath });
  }

  return { collected, skipped };
};

const parseBoxYaml = (rawText: string, label: string): unknown => {
  try {
    return parse(rawText);
  } catch (error) {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_BOX_INVALID",
      `Box ${label} is not valid YAML.`,
      { label, error: error instanceof Error ? error.message : String(error) },
    );
  }
};

const readBoxYamlFile = async (
  ctx: CommunityCardPublishContext,
  filePath: string,
  label: string,
): Promise<unknown> => {
  const rawText = await readTextFile(ctx, filePath);
  return parseBoxYaml(rawText, label);
};

/**
 * 从箱子解包目录解析正式封面图片路径。
 *
 * 优先读取 `.box/cover.html` 的 `data-chips-cover-image-source` 属性（图片模式封面，
 * 路径相对于 `.box/` 目录），其次取 `metadata.cover_asset`（指向 `assets/` 的图片）。
 * 返回包内相对路径与 MIME。
 */
const coverImageMimeType = (relativePath: string): string | null => {
  if (relativePath.endsWith(".png")) {
    return "image/png";
  }
  if (relativePath.endsWith(".jpg") || relativePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (relativePath.endsWith(".webp")) {
    return "image/webp";
  }
  if (relativePath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (relativePath.endsWith(".gif")) {
    return "image/gif";
  }
  return null;
};

const coverFileMimeType = (relativePath: string): string => {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "text/html";
  }
  if (lower.endsWith(".css")) {
    return "text/css";
  }
  if (lower.endsWith(".js")) {
    return "application/javascript";
  }
  if (lower.endsWith(".woff2")) {
    return "font/woff2";
  }
  if (lower.endsWith(".woff")) {
    return "font/woff";
  }
  if (lower.endsWith(".ttf")) {
    return "font/ttf";
  }
  return coverImageMimeType(relativePath) ?? "application/octet-stream";
};

interface BoxCoverFile {
  /** 解包目录内的源路径（含 .box 前缀） */
  sourcePath: string;
  /** 对象存储发布路径（cover 目录内相对路径） */
  publishPath: string;
  mimeType: string;
}

/**
 * 收集箱子封面的完整文件清单。
 *
 * 箱子封面正式形态是 `.box/cover.html`（HTML 文档），其附属资源位于 `.box/boxcover/`。
 * 发布时把 cover.html 映射为 `index.html`，boxcover 资源保持相对路径，保证 HTML 内
 * 相对引用（如 `./boxcover/cover-image.png`）在对象存储上继续有效。
 */
const collectBoxCoverFiles = async (
  ctx: CommunityCardPublishContext,
  unpackedDir: string,
  warnings: CommunityUploaderWarning[],
  boxId: string,
): Promise<BoxCoverFile[]> => {
  const files: BoxCoverFile[] = [];
  const coverHtmlSource = joinNormalized(unpackedDir, ".box", "cover.html");
  const coverHtml = await readTextFile(ctx, toNativePath(coverHtmlSource, unpackedDir)).catch(() => null);
  if (coverHtml === null) {
    return files;
  }
  files.push({
    sourcePath: joinNormalized(".box", "cover.html"),
    publishPath: "index.html",
    mimeType: "text/html",
  });

  const referencedAssets = new Set<string>();
  const sourceMatches = coverHtml.matchAll(/(?:src|href|data-chips-cover-image-source)=["']([^"']+)["']/g);
  for (const match of sourceMatches) {
    const source = match[1]?.trim() ?? "";
    if (!source || source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:")) {
      continue;
    }
    const normalized = normalizeCardPath(source).replace(/^\.\//, "");
    if (normalized === "boxcover" || normalized.startsWith("boxcover/")) {
      referencedAssets.add(normalized);
    }
  }

  for (const assetPath of referencedAssets) {
    const sourceFull = joinNormalized(unpackedDir, ".box", assetPath);
    const exists = await getFileStat(ctx, toNativePath(sourceFull, unpackedDir));
    if (exists.isFile !== true) {
      pushWarning(warnings, "COMMUNITY_TRANSFER_BOX_COVER_ASSET_MISSING", `Box cover asset missing: ${assetPath}`, { boxId, assetPath });
      continue;
    }
    files.push({
      sourcePath: joinNormalized(".box", assetPath),
      publishPath: assetPath,
      mimeType: coverFileMimeType(assetPath),
    });
  }

  return files;
};

/**
 * 发布箱子封面 HTML 目录到对象存储。
 *
 * 通过 box 上传会话的 `cover-file` 角色直传：`cover.html` → `boxes/{boxId}/cover/index.html`，
 * `boxcover/*` 资源 → `boxes/{boxId}/cover/boxcover/*`（相对路径保持不变）。
 * 返回封面入口对象位置（`{ bucket, objectKey }`），供 complete 提交 `coverObject`。
 * 提取或上传失败不阻断箱子上传，记入 warning。
 */
const publishBoxCover = async (
  ctx: CommunityCardPublishContext,
  request: NormalizedCommunityCardTransferBoxUploadRequest,
  session: BoxUploadSession,
  unpackedDir: string,
  boxId: string,
  signal?: AbortSignal,
  warnings: CommunityUploaderWarning[] = [],
): Promise<{ bucket: string; objectKey: string } | null> => {
  try {
    const files = await collectBoxCoverFiles(ctx, unpackedDir, warnings, boxId);
    if (files.length === 0) {
      return null;
    }

    const presigned = await presignObjects(request, session.uploadId, files.map((file) => ({
      role: "cover-file",
      relativePath: file.publishPath,
      sizeBytes: 0,
      mimeType: file.mimeType,
    })), signal);
    const presignedByPath = new Map(presigned.map((item) => [normalizeCardPath(item.relativePath ?? ""), item]));

    for (const file of files) {
      const target = presignedByPath.get(file.publishPath);
      if (!target) {
        throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", `Cover presign response is missing ${file.publishPath}.`);
      }
      const fileBytes = await readBinaryFile(ctx, toNativePath(joinNormalized(unpackedDir, file.sourcePath), unpackedDir));
      await uploadBytesToStorage(file.publishPath, fileBytes, target, signal);
    }

    const indexTarget = presignedByPath.get("index.html");
    if (!indexTarget || !indexTarget.bucket || !indexTarget.objectKey) {
      return null;
    }
    return { bucket: indexTarget.bucket, objectKey: indexTarget.objectKey };
  } catch (error) {
    const errorCode = isRecord(error) ? String((error as { code?: unknown }).code ?? "") : "";
    const errorMessage = error instanceof Error ? error.message : String(error);
    pushWarning(warnings, "COMMUNITY_TRANSFER_BOX_COVER_UPLOAD_FAILED", `Box cover upload failed: ${errorCode} ${errorMessage}`, {
      boxId,
      code: errorCode,
      error: errorMessage,
    });
    ctx.logger.warn("Box cover upload failed; cover URL stays unset.", { boxId, code: errorCode });
    return null;
  }
};

export const uploadCommunityCard = async (
  ctx: CommunityCardPublishContext,
  input: CommunityCardTransferUploadRequest,
): Promise<CommunityCardTransferUploadResult> => {
  const request = normalizeUploadRequest(input);
  const warnings: CommunityUploaderWarning[] = [];
  const cardStat = await getFileStat(ctx, request.cardFile);
  if (cardStat.isFile !== true) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", `cardFile is not a readable file: ${request.cardFile}`);
  }

  await reportProgress(ctx, "inspect", 2, "Reading card metadata");
  const [cardInfoResponse, zipEntries] = await Promise.all([
    ctx.host.invoke<{ info?: HostCardReadInfo }>("card.readInfo", {
      cardFile: request.cardFile,
    }),
    getZipEntries(ctx, request.cardFile),
  ]);
  assertZipStoreEntries(zipEntries);
  const cardInfo = isRecord(cardInfoResponse?.info)
    ? (isRecord(cardInfoResponse.info.info) ? cardInfoResponse.info : cardInfoResponse)
    : cardInfoResponse;
  const cardInfoInfo = isRecord(cardInfo?.info) ? cardInfo.info : {};
  const cardMetadata = isRecord(cardInfoInfo.metadata) ? cardInfoInfo.metadata : {};
  const cardName = asString(cardMetadata.name) ?? asString(cardMetadata.title) ?? path.basename(request.cardFile);

  const workspace = await createWorkspaceRoot(ctx, request.cardFile, request.workspace.tempDir);
  const unpackedDir = joinNormalized(workspace.rootDir, "unpacked.card");
  const networkCardPath = resolveNetworkCardPath(request, workspace.rootDir);

  try {
    assertNotCancelled(ctx);
    await reportProgress(ctx, "unpack", 8, "Unpacking card");
    await ctx.host.invoke("card.unpack", {
      cardFile: request.cardFile,
      outputDir: toNativePath(unpackedDir, request.cardFile),
    });

    assertNotCancelled(ctx);
    await reportProgress(ctx, "scan", 18, "Scanning card resources");
    const { resources } = await collectResources(ctx, unpackedDir);

    assertNotCancelled(ctx);
    await reportProgress(ctx, "session", 26, "Creating community transfer session");
    const uploadSession = await createUploadSession(request, path.basename(request.cardFile), jobSignal(ctx));

    assertNotCancelled(ctx);
    await reportProgress(ctx, "upload-resources", 38, "Uploading resources");
    const resourcePresigned = await presignObjects(
      request,
      uploadSession.uploadId,
      resources.map((resource) => ({
        role: "resource",
        relativePath: resource.relativePath,
        sizeBytes: resource.sizeBytes,
        mimeType: resource.mimeType,
      })),
      jobSignal(ctx),
    );
    const presignedByPath = new Map(resourcePresigned.map((item) => [normalizeCardPath(item.relativePath ?? ""), item]));

    const resourceUrlMap = new Map<string, string>();
    const uploadedResources: CommunityCardTransferUploadedResource[] = [];
    for (const resource of resources) {
      const target = presignedByPath.get(resource.relativePath);
      if (!target) {
        throw createCommunityUploaderError(
          "COMMUNITY_TRANSFER_RESPONSE_INVALID",
          `Presign response did not include ${resource.relativePath}.`,
        );
      }
      const resourceBytes = await readBinaryFile(ctx, toNativePath(resource.absolutePath, unpackedDir));
      await uploadBytesToStorage(resource.relativePath, resourceBytes, target, jobSignal(ctx));
      resourceUrlMap.set(resource.relativePath, target.publicUrl);
      uploadedResources.push({
        originalRelativePath: resource.relativePath,
        networkUrl: target.publicUrl,
        publicUrl: target.publicUrl,
        bucket: target.bucket,
        objectKey: target.objectKey,
        sizeBytes: resource.sizeBytes,
        mimeType: resource.mimeType,
      });
    }

    assertNotCancelled(ctx);
    await reportProgress(ctx, "rewrite", 58, "Generating network resource card");
    const textResourceMap = await collectTextResourceMap(ctx, unpackedDir);
    const richTextContentFileMap = await collectRichTextContentFileMap(ctx, unpackedDir);
    await writeRewrittenCard(ctx, unpackedDir, resources, resourceUrlMap, textResourceMap);

    // ─── 渲染产物（includeRenderArtifacts 模式） ────────────────────
    const renderArtifactsWorkspace = joinNormalized(workspace.rootDir, "render-artifacts");
    let renderArtifactsSummary: NonNullable<Awaited<ReturnType<typeof uploadRenderArtifacts>>> | null = null;
    if (request.publish.includeRenderArtifacts) {
      assertNotCancelled(ctx);
      await reportProgress(ctx, "render", 62, "Rendering card view HTML");
      const viewRenderDir = joinNormalized(renderArtifactsWorkspace, "view");
      await renderCardViewHtml(ctx, {
        cardFile: request.cardFile,
        outputDir: viewRenderDir,
      });

      assertNotCancelled(ctx);
      await reportProgress(ctx, "render-cover", 66, "Preparing card cover");
      const coverRenderDir = joinNormalized(renderArtifactsWorkspace, "cover");
      await buildCoverArtifactDir(ctx, {
        unpackedDir,
        coverDir: coverRenderDir,
        cardTitle: cardName,
      });

      assertNotCancelled(ctx);
      await reportProgress(ctx, "upload-render", 70, "Uploading render artifacts");
      renderArtifactsSummary = await uploadRenderArtifacts(ctx, request, uploadSession, [
        { role: "render-file", rootDir: viewRenderDir },
        { role: "cover-file", rootDir: coverRenderDir },
      ], jobSignal(ctx));
      if (!renderArtifactsSummary) {
        pushWarning(warnings, "COMMUNITY_TRANSFER_RENDER_ARTIFACTS_EMPTY", "Render artifacts were requested but no files were produced; the card stays pending render.");
      }
    }

    assertNotCancelled(ctx);
    await reportProgress(ctx, "pack", 72, "Packing network resource card");
    await ctx.host.invoke("card.pack", {
      cardDir: toNativePath(unpackedDir, request.cardFile),
      outputPath: toNativePath(networkCardPath, request.cardFile),
    });
    const networkCardBytes = await readBinaryFile(ctx, toNativePath(networkCardPath, request.cardFile));
    const [networkCardPresigned] = await presignObjects(request, uploadSession.uploadId, [
      {
        role: "network-card",
        sizeBytes: networkCardBytes.byteLength,
        mimeType: CARD_MIME_TYPE,
      },
    ], jobSignal(ctx));
    if (!networkCardPresigned || networkCardPresigned.role !== "network-card") {
      throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Presign response is missing network card object.");
    }
    await uploadBytesToStorage("network-card", networkCardBytes, networkCardPresigned, jobSignal(ctx));

    assertNotCancelled(ctx);
    await reportProgress(ctx, "submit", 86, "Submitting transfer manifest");
    const restoreManifest = createRestoreManifest({
      originalFileName: path.basename(request.cardFile),
      cardId: uploadSession.cardId,
      versionId: uploadSession.versionId,
      zipEntries,
      resources: uploadedResources,
      richTextContentFileMap,
    });
    const submitResult = await completeUpload(request, uploadSession.uploadId, {
      title: cardName,
      cardFileId: asString(cardMetadata.card_id) ?? asString(cardMetadata.cardId) ?? null,
      coverRatio: asString(cardMetadata.cover_ratio) ?? null,
      networkCard: {
        bucket: networkCardPresigned.bucket,
        objectKey: networkCardPresigned.objectKey,
        publicUrl: networkCardPresigned.publicUrl,
        sizeBytes: networkCardBytes.byteLength,
        mimeType: CARD_MIME_TYPE,
      },
      resources: uploadedResources,
      restoreManifest,
      cardMetadata,
      ...(renderArtifactsSummary
        ? {
            renderArtifacts: {
              rendererVersion: CLIENT_RENDERER_VERSION,
              view: renderArtifactsSummary.view,
              ...(renderArtifactsSummary.cover ? { cover: renderArtifactsSummary.cover } : {}),
            },
          }
        : {}),
    }, jobSignal(ctx));

    await reportProgress(ctx, "completed", 100, "Community card transfer upload completed");
    ctx.logger.info("Community card transfer upload completed.", {
      cardId: submitResult.cardId,
      resourceCount: uploadedResources.length,
    });

    return {
      ...submitResult,
      uploadedResources,
      ...(request.workspace.keepNetworkCard || request.workspace.networkCardPath
        ? { networkCardPath: toNativePath(networkCardPath, request.cardFile) }
        : undefined),
      ...(warnings.length > 0 ? { warnings } : undefined),
    };
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error;
    }
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_UPLOAD_FAILED",
      error instanceof Error ? error.message : String(error),
      { cardFile: request.cardFile },
      true,
    );
  } finally {
    if (request.publish.includeRenderArtifacts) {
      await ctx.host.invoke("file.delete", {
        path: toNativePath(joinNormalized(workspace.rootDir, "render-artifacts"), request.cardFile),
        options: { recursive: true },
      }).catch(() => undefined);
    }

    if (!request.workspace.keepNetworkCard && !request.workspace.networkCardPath) {
      await ctx.host.invoke("file.delete", {
        path: toNativePath(networkCardPath, request.cardFile),
      }).catch(() => undefined);
    } else if (request.workspace.keepNetworkCard && !request.workspace.networkCardPath) {
      pushWarning(warnings, "COMMUNITY_TRANSFER_NETWORK_CARD_KEPT", "Network resource card file was kept in the temporary workspace.", {
        networkCardPath,
      });
    }

    await ctx.host.invoke("file.delete", {
      path: toNativePath(unpackedDir, request.cardFile),
      options: { recursive: true },
    }).catch(() => undefined);

    if (workspace.createdByModule && !request.workspace.keepNetworkCard && !request.workspace.networkCardPath) {
      await ctx.host.invoke("file.delete", {
        path: toNativePath(workspace.rootDir, request.cardFile),
        options: { recursive: true },
      }).catch(() => undefined);
    }
  }
};

export const uploadCommunityBox = async (
  ctx: CommunityCardPublishContext,
  input: CommunityCardTransferBoxUploadRequest,
): Promise<CommunityCardTransferBoxUploadResult> => {
  const request = normalizeBoxUploadRequest(input);
  const warnings: CommunityUploaderWarning[] = [];

  const boxStat = await getFileStat(ctx, request.boxFile);
  if (boxStat.isFile !== true) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", `boxFile is not a readable file: ${request.boxFile}`);
  }
  if (!path.basename(request.boxFile).toLowerCase().endsWith(".box")) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", `boxFile must use the .box extension: ${request.boxFile}`);
  }

  await reportProgress(ctx, "inspect", 3, "Reading box metadata");
  const inspectionResponse = await ctx.host.invoke<{ inspection?: HostBoxInspection }>("box.inspect", {
    boxFile: request.boxFile,
  });
  const inspection = isRecord(inspectionResponse) && isRecord(inspectionResponse.inspection)
    ? inspectionResponse.inspection
    : (inspectionResponse as HostBoxInspection);
  const inspectedMetadata = isRecord(inspection.metadata) ? inspection.metadata : {};
  const entries = Array.isArray(inspection.entries) ? inspection.entries.filter(isRecord) : [];

  const workspace = await createWorkspaceRoot(ctx, request.boxFile, request.workspace.tempDir);
  const unpackedDir = joinNormalized(workspace.rootDir, "unpacked.box");
  const repackedBoxPath = joinNormalized(workspace.rootDir, "upload.box");
  const scatteredCardsRoot = joinNormalized(workspace.rootDir, "scattered-cards");

  try {
    assertNotCancelled(ctx);
    await reportProgress(ctx, "unpack", 8, "Unpacking box");
    await ctx.host.invoke("box.unpack", {
      boxFile: request.boxFile,
      outputDir: toNativePath(unpackedDir, request.boxFile),
    });

    assertNotCancelled(ctx);
    await reportProgress(ctx, "collect", 12, "Collecting scattered card entries");
    const { collected, skipped } = await collectScatteredCards(ctx, entries, warnings);

    const uploadedCards: CommunityCardTransferBoxUploadedCard[] = [];
    for (let index = 0; index < collected.length; index += 1) {
      const reference = collected[index]!;
      assertNotCancelled(ctx);
      const windowStart = 16 + (index / collected.length) * 56;
      const windowEnd = 16 + ((index + 1) / collected.length) * 56;
      await reportProgress(ctx, "upload-cards", Math.round(windowStart), `Uploading scattered card ${index + 1}/${collected.length}`);
      try {
        const cardResult = await uploadCommunityCard(withScaledJobProgress(ctx, windowStart, windowEnd), {
          cardFile: reference.localPath,
          server: request.server,
          publish: {
            ...(request.publish.roomId ? { roomId: request.publish.roomId } : {}),
            ...(request.publish.idempotencyKey ? { idempotencyKey: request.publish.idempotencyKey } : {}),
            includeRenderArtifacts: request.publish.includeRenderArtifacts,
          },
          client: request.client,
          workspace: {
            tempDir: joinNormalized(scatteredCardsRoot, String(index)),
          },
        });
        uploadedCards.push({
          entryId: reference.entryId,
          documentId: reference.documentId,
          cardFile: reference.localPath,
          communityCardId: cardResult.cardId,
          communityUrl: cardResult.communityUrl,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        pushWarning(warnings, "COMMUNITY_TRANSFER_BOX_CARD_UPLOAD_FAILED", `Scattered card upload failed: ${reference.documentId ?? reference.localPath}`, {
          entryId: reference.entryId,
          documentId: reference.documentId,
          cardFile: reference.localPath,
          error: errorMessage,
        });
        ctx.logger.warn("Scattered card upload failed; entry keeps its file:// URL.", {
          entryId: reference.entryId,
          cardFile: reference.localPath,
        });
      }
    }

    assertNotCancelled(ctx);
    await reportProgress(ctx, "box-session", 78, "Creating box upload session");
    const session = await createBoxUploadSession(request, path.basename(request.boxFile), jobSignal(ctx));

    assertNotCancelled(ctx);
    await reportProgress(ctx, "box-pack", 84, "Packing box");
    await ctx.host.invoke("box.pack", {
      boxDir: toNativePath(unpackedDir, request.boxFile),
      outputPath: toNativePath(repackedBoxPath, request.boxFile),
    });
    const boxBytes = await readBinaryFile(ctx, toNativePath(repackedBoxPath, request.boxFile));

    assertNotCancelled(ctx);
    await reportProgress(ctx, "box-presign", 88, "Presigning box object");
    const [boxPresigned] = await presignObjects(request, session.uploadId, [
      {
        role: "box-file",
        sizeBytes: boxBytes.byteLength,
        mimeType: BOX_MIME_TYPE,
      },
    ], jobSignal(ctx));
    if (!boxPresigned || boxPresigned.role !== "box-file") {
      throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Box presign response is missing the box-file object.");
    }
    await uploadBytesToStorage("box", boxBytes, boxPresigned, jobSignal(ctx));

    assertNotCancelled(ctx);
    await reportProgress(ctx, "box-cover", 90, "Publishing box cover");
    const coverObject = await publishBoxCover(ctx, request, session, unpackedDir, session.boxId, jobSignal(ctx), warnings);

    assertNotCancelled(ctx);
    await reportProgress(ctx, "box-submit", 94, "Submitting box transfer manifest");
    const metadataFilePath = joinNormalized(unpackedDir, ".box", "metadata.yaml");
    const structureFilePath = joinNormalized(unpackedDir, ".box", "structure.yaml");
    const contentFilePath = joinNormalized(unpackedDir, ".box", "content.yaml");
    const metadata = await readBoxYamlFile(ctx, toNativePath(metadataFilePath, request.boxFile), "metadata.yaml");
    const structure = await readBoxYamlFile(ctx, toNativePath(structureFilePath, request.boxFile), "structure.yaml");
    const content = await readBoxYamlFile(ctx, toNativePath(contentFilePath, request.boxFile), "content.yaml");
    const rawMetadata = isRecord(metadata) ? metadata : {};
    const submitResult = await completeBoxUpload(request, session.uploadId, {
      title: asString(rawMetadata.name) ?? asString(inspectedMetadata.name) ?? path.basename(request.boxFile, ".box"),
      boxFileId: asString(rawMetadata.box_id) ?? asString(inspectedMetadata.boxId) ?? null,
      layoutPlugin: asString(rawMetadata.active_layout_type) ?? asString(inspectedMetadata.activeLayoutType) ?? null,
      coverRatio: asString(rawMetadata.cover_ratio) ?? asString(inspectedMetadata.coverRatio) ?? null,
      ...(coverObject ? { coverObject } : undefined),
      boxFile: {
        bucket: boxPresigned.bucket,
        objectKey: boxPresigned.objectKey,
        publicUrl: boxPresigned.publicUrl.trim().length > 0 ? boxPresigned.publicUrl : null,
        sizeBytes: boxBytes.byteLength,
        mimeType: BOX_MIME_TYPE,
      },
      metadata: rawMetadata,
      structure,
      content: content ?? {},
    }, jobSignal(ctx));

    await reportProgress(ctx, "completed", 100, "Community box transfer upload completed");
    ctx.logger.info("Community box transfer upload completed.", {
      boxId: submitResult.boxId,
      uploadedCardCount: uploadedCards.length,
      skippedCardCount: skipped.length,
    });

    return {
      boxId: submitResult.boxId,
      versionId: submitResult.versionId,
      status: submitResult.status,
      communityUrl: submitResult.communityUrl,
      ...(submitResult.boxViewUrl ? { boxViewUrl: submitResult.boxViewUrl } : undefined),
      uploadedCards,
      skippedCards: skipped,
      ...(warnings.length > 0 ? { warnings } : undefined),
    };
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error;
    }
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_BOX_UPLOAD_FAILED",
      error instanceof Error ? error.message : String(error),
      { boxFile: request.boxFile },
      true,
    );
  } finally {
    await ctx.host.invoke("file.delete", {
      path: toNativePath(unpackedDir, request.boxFile),
      options: { recursive: true },
    }).catch(() => undefined);
    await ctx.host.invoke("file.delete", {
      path: toNativePath(repackedBoxPath, request.boxFile),
    }).catch(() => undefined);
    await ctx.host.invoke("file.delete", {
      path: toNativePath(scatteredCardsRoot, request.boxFile),
      options: { recursive: true },
    }).catch(() => undefined);
    if (workspace.createdByModule) {
      await ctx.host.invoke("file.delete", {
        path: toNativePath(workspace.rootDir, request.boxFile),
        options: { recursive: true },
      }).catch(() => undefined);
    }
  }
};

const createDownloadSession = async (
  request: NormalizedCommunityCardTransferDownloadRequest,
  signal?: AbortSignal,
): Promise<{ planUrl: string; cardId: string; versionId?: string | null }> => {
  const response = await fetchControlPlane(
    request,
    "/card-transfer/download-sessions",
    {
      method: "POST",
      headers: jsonHeaders(request.server),
      body: JSON.stringify({
        cardId: request.cardId,
        versionId: request.versionId,
        client: request.client,
      }),
    },
    "create download session",
    signal,
  );
  const payload = await parseJsonResponse<{ data?: unknown }>(response, "Failed to create download session");
  if (!isRecord(payload.data)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Download session response is missing planUrl.");
  }
  const planUrl = asString(payload.data.planUrl);
  if (!planUrl) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Download session response is missing planUrl.");
  }
  return {
    planUrl,
    cardId: String(payload.data.cardId ?? request.cardId),
    versionId: typeof payload.data.versionId === "string" ? payload.data.versionId : null,
  };
};

const getDownloadPlan = async (
  request: NormalizedCommunityCardTransferDownloadRequest,
  planUrl: string,
  signal?: AbortSignal,
): Promise<DownloadPlan> => {
  const response = await fetchControlPlane(
    request,
    planUrl,
    {
      method: "GET",
      headers: authorizedHeaders(request.server),
    },
    "get download plan",
    signal,
  );
  const payload = await parseJsonResponse<{ data?: unknown }>(response, "Failed to get download plan");
  if (!isRecord(payload.data) || !isRecord(payload.data.networkCard) || !Array.isArray(payload.data.resources)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Download plan is missing networkCard or resources.");
  }
  return {
    cardId: String(payload.data.cardId ?? request.cardId),
    versionId: typeof payload.data.versionId === "string" ? payload.data.versionId : null,
    suggestedFileName: typeof payload.data.suggestedFileName === "string" ? payload.data.suggestedFileName : undefined,
    networkCard: {
      bucket: String(payload.data.networkCard.bucket ?? ""),
      objectKey: String(payload.data.networkCard.objectKey ?? ""),
      publicUrl: typeof payload.data.networkCard.publicUrl === "string" ? payload.data.networkCard.publicUrl : null,
      downloadUrl: String(payload.data.networkCard.downloadUrl ?? ""),
      headers: isRecord(payload.data.networkCard.headers)
        ? Object.fromEntries(Object.entries(payload.data.networkCard.headers).map(([key, value]) => [key, String(value)]))
        : {},
      sizeBytes: Number(payload.data.networkCard.sizeBytes ?? 0),
      mimeType: typeof payload.data.networkCard.mimeType === "string" ? payload.data.networkCard.mimeType : null,
    },
    resources: payload.data.resources.filter(isRecord).map((resource) => ({
      originalRelativePath: normalizeCardPath(String(resource.originalRelativePath ?? "")),
      networkUrl: String(resource.networkUrl ?? resource.publicUrl ?? ""),
      bucket: String(resource.bucket ?? ""),
      objectKey: String(resource.objectKey ?? ""),
      publicUrl: typeof resource.publicUrl === "string" ? resource.publicUrl : null,
      downloadUrl: String(resource.downloadUrl ?? resource.publicUrl ?? resource.networkUrl ?? ""),
      headers: isRecord(resource.headers)
        ? Object.fromEntries(Object.entries(resource.headers).map(([key, value]) => [key, String(value)]))
        : {},
      sizeBytes: Number(resource.sizeBytes ?? 0),
      mimeType: typeof resource.mimeType === "string" ? resource.mimeType : null,
    })),
    restoreManifest: payload.data.restoreManifest,
    manifest: payload.data.manifest,
  };
};

const verifyRestoredCard = async (
  ctx: CommunityCardPublishContext,
  restoredCardPath: string,
): Promise<void> => {
  const info = await ctx.host.invoke<{ info?: unknown }>("card.readInfo", {
    cardFile: restoredCardPath,
  });
  if (!info || !isRecord(info.info)) {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_DOWNLOAD_VERIFY_FAILED",
      `Restored card failed readInfo verification: ${restoredCardPath}`,
      { restoredCardPath },
    );
  }

  await ctx.host.invoke("card.render", {
    cardFile: restoredCardPath,
  }).catch((error) => {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_DOWNLOAD_VERIFY_FAILED",
      `Restored card failed render verification: ${restoredCardPath}`,
      {
        restoredCardPath,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  });

  await ctx.host.invoke("card.open", {
    cardFile: restoredCardPath,
  }).catch((error) => {
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_DOWNLOAD_VERIFY_FAILED",
      `Restored card failed open verification: ${restoredCardPath}`,
      {
        restoredCardPath,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  });
};

const completeDownload = async (
  ctx: CommunityCardPublishContext,
  plan: DownloadPlan,
  unpackedDir: string,
  outputPath: string,
  request: NormalizedCommunityCardTransferDownloadRequest,
): Promise<CommunityCardTransferDownloadResult> => {
  assertNotCancelled(ctx);
  await reportProgress(ctx, "pack", 85, "Packing restored card");
  const entryPlan = extractEntryPlan(plan.restoreManifest ?? plan.manifest);
  await ctx.host.invoke("card.pack", {
    cardDir: toNativePath(unpackedDir, outputPath),
    outputPath: toNativePath(outputPath, outputPath),
    ...(entryPlan.length > 0 ? { entryPlan } : undefined),
  });

  assertNotCancelled(ctx);
  await reportProgress(ctx, "verify", 95, "Verifying restored card");
  await verifyRestoredCard(ctx, toNativePath(outputPath, outputPath));

  await reportProgress(ctx, "completed", 100, "Community card transfer download completed");
  ctx.logger.info("Community card transfer download completed.", {
    cardId: plan.cardId,
    resourceCount: plan.resources.length,
  });

  return {
    cardId: plan.cardId,
    versionId: plan.versionId,
    outputPath: toNativePath(outputPath, outputPath),
    restoredResourceCount: plan.resources.length,
    suggestedFileName: plan.suggestedFileName,
  };
};

export const downloadCommunityCard = async (
  ctx: CommunityCardPublishContext,
  input: CommunityCardTransferDownloadRequest,
): Promise<CommunityCardTransferDownloadResult> => {
  const request = normalizeDownloadRequest(input);
  const outputPath = toNormalizedPath(request.outputPath);
  const workspace = await createWorkspaceRoot(ctx, outputPath, request.workspace.tempDir);
  const networkCardPath = joinNormalized(workspace.rootDir, "network.card");
  const unpackedDir = joinNormalized(workspace.rootDir, "restored.card");

  try {
    assertNotCancelled(ctx);
    await reportProgress(ctx, "session", 10, "Creating download session");
    const session = await createDownloadSession(request, jobSignal(ctx));
    const plan = await getDownloadPlan(request, session.planUrl, jobSignal(ctx));

    assertNotCancelled(ctx);
    await reportProgress(ctx, "download-card", 25, "Downloading network resource card");
    const networkCardBytes = await downloadBinary(plan.networkCard, "network-card", jobSignal(ctx));
    await writeBinaryFile(ctx, toNativePath(networkCardPath, outputPath), networkCardBytes);

    assertNotCancelled(ctx);
    await reportProgress(ctx, "unpack", 35, "Unpacking network resource card");
    await ctx.host.invoke("card.unpack", {
      cardFile: toNativePath(networkCardPath, outputPath),
      outputDir: toNativePath(unpackedDir, outputPath),
    });

    assertNotCancelled(ctx);
    await reportProgress(ctx, "restore", 55, "Restoring original card resources");
    await restoreDownloadedCard(ctx, unpackedDir, plan.resources, plan.restoreManifest ?? plan.manifest);

    return await completeDownload(ctx, plan, unpackedDir, outputPath, request);
  } catch (error) {
    await ctx.host.invoke("file.delete", {
      path: toNativePath(outputPath, outputPath),
    }).catch(() => undefined);
    if (error instanceof Error && "code" in error) {
      throw error;
    }
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_DOWNLOAD_FAILED",
      error instanceof Error ? error.message : String(error),
      { cardId: request.cardId },
      true,
    );
  } finally {
    await ctx.host.invoke("file.delete", {
      path: toNativePath(networkCardPath, outputPath),
    }).catch(() => undefined);
    await ctx.host.invoke("file.delete", {
      path: toNativePath(unpackedDir, outputPath),
      options: { recursive: true },
    }).catch(() => undefined);
    if (workspace.createdByModule) {
      await ctx.host.invoke("file.delete", {
        path: toNativePath(workspace.rootDir, outputPath),
        options: { recursive: true },
      }).catch(() => undefined);
    }
  }
};

export const openRemoteCommunityCard = async (
  ctx: CommunityCardPublishContext,
  input: CommunityCardTransferOpenRemoteRequest,
): Promise<CommunityCardTransferOpenRemoteResult> => {
  const cardId = asString(input.cardId);
  if (!cardId) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "openRemote requires cardId.");
  }
  if (!isRecord(input.server) || !asString(input.server.baseUrl) || !asString(input.server.accessToken)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "openRemote requires server.baseUrl and server.accessToken.");
  }

  const server = {
    baseUrl: normalizeServerBaseUrl(input.server.baseUrl),
    accessToken: input.server.accessToken,
  };

  try {
    const request: NormalizedCommunityCardTransferDownloadRequest = {
      cardId,
      server,
      outputPath: "",
      client: {
        name: DEFAULT_CLIENT_NAME,
        version: DEFAULT_CLIENT_VERSION,
      },
      workspace: {
        tempDir: input.workspace?.tempDir,
      },
    };

    assertNotCancelled(ctx);
    await reportProgress(ctx, "session", 10, "Creating download session");
    const session = await createDownloadSession(request, jobSignal(ctx));
    const plan = await getDownloadPlan(request, session.planUrl, jobSignal(ctx));

    assertNotCancelled(ctx);
    await reportProgress(ctx, "download-card", 40, "Downloading network resource card");
    const networkCardBytes = await downloadBinary(plan.networkCard, "network-card", jobSignal(ctx));

    const workspace = await createWorkspaceRoot(
      ctx,
      path.join(os.tmpdir(), `community-open-remote-${randomId()}`),
      request.workspace.tempDir,
    );
    const localCardPath = joinNormalized(workspace.rootDir, `${plan.suggestedFileName ?? `${cardId}.card`}`);
    await writeBinaryFile(ctx, toNativePath(localCardPath, os.tmpdir()), networkCardBytes);

    assertNotCancelled(ctx);
    await reportProgress(ctx, "open", 80, "Opening card in local viewer");

    const surface = await ctx.host.invoke<{ surface: { id: string } }>("surface.open", {
      request: {
        kind: "window",
        target: {
          type: "plugin",
          pluginId: "com.chips.card-viewer",
          launchParams: {
            trigger: "community-open-remote",
            cardSource: {
              kind: "local-file",
              documentKind: "card",
              filePath: toNativePath(localCardPath, os.tmpdir()),
            },
            communityServer: {
              baseUrl: server.baseUrl,
              accessToken: server.accessToken,
            },
          },
        },
        presentation: {
          title: plan.suggestedFileName ?? "社区卡片",
          width: 1024,
          height: 720,
          resizable: true,
        },
      },
    });

    await reportProgress(ctx, "completed", 100, "Remote card opened in local viewer");
    return {
      opened: true,
      url: `${server.baseUrl}/cards/${cardId}`,
      localCardPath: toNativePath(localCardPath, os.tmpdir()),
      surfaceId: isRecord(surface.surface) ? String(surface.surface.id ?? "") : undefined,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error;
    }
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_OPEN_REMOTE_FAILED",
      "Failed to open remote community card locally.",
      {
        cardId,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorDetail: isRecord(error)
          ? {
              code: String((error as { code?: unknown }).code ?? ""),
              message: String((error as { message?: unknown }).message ?? ""),
              details: (error as { details?: unknown }).details,
            }
          : undefined,
      },
    );
  }
};

/**
 * 在本地查看器中打开社区箱子。
 *
 * 链路：下载会话（预签名 GET）→ 下载 `.box` 到临时目录 → `surface.open` 启动
 * 卡片查看器（`com.chips.card-viewer`），以 `documentKind: 'box'` 渲染箱子。
 */
export const openRemoteCommunityBox = async (
  ctx: CommunityCardPublishContext,
  input: CommunityCardTransferOpenRemoteBoxRequest,
): Promise<CommunityCardTransferOpenRemoteBoxResult> => {
  const boxId = asString(input.boxId);
  if (!boxId) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "openRemoteBox requires boxId.");
  }
  if (!isRecord(input.server) || !asString(input.server.baseUrl) || !asString(input.server.accessToken)) {
    throw createCommunityUploaderError("COMMUNITY_TRANSFER_INPUT_INVALID", "openRemoteBox requires server.baseUrl and server.accessToken.");
  }

  const server = {
    baseUrl: normalizeServerBaseUrl(input.server.baseUrl),
    accessToken: input.server.accessToken,
  };

  try {
    assertNotCancelled(ctx);
    await reportProgress(ctx, "session", 10, "Requesting box download plan");
    const planResponse = await fetchControlPlane(
      { server },
      `/boxes/${encodeURIComponent(boxId)}/download`,
      {
        method: "GET",
        headers: jsonHeaders(server),
      },
      "fetch box download plan",
      jobSignal(ctx),
    );
    const payload = await parseJsonResponse<{ data?: unknown }>(planResponse, "Failed to fetch box download plan");
    if (!isRecord(payload.data)) {
      throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Box download plan is missing data.");
    }
    const downloadUrl = asString(payload.data.downloadUrl);
    const suggestedFileName = asString(payload.data.suggestedFileName) ?? `${boxId}.box`;
    if (!downloadUrl) {
      throw createCommunityUploaderError("COMMUNITY_TRANSFER_RESPONSE_INVALID", "Box download plan is missing downloadUrl.");
    }

    assertNotCancelled(ctx);
    await reportProgress(ctx, "download-box", 40, "Downloading box file");
    const boxBytes = await downloadBinary({ downloadUrl, headers: {} }, "box", jobSignal(ctx));

    const workspace = await createWorkspaceRoot(
      ctx,
      path.join(os.tmpdir(), `community-open-remote-box-${randomId()}`),
      input.workspace?.tempDir,
    );
    const localBoxPath = joinNormalized(workspace.rootDir, suggestedFileName.endsWith(".box") ? suggestedFileName : `${suggestedFileName}.box`);
    await writeBinaryFile(ctx, toNativePath(localBoxPath, os.tmpdir()), boxBytes);

    assertNotCancelled(ctx);
    await reportProgress(ctx, "open", 80, "Opening box in local viewer");

    const surface = await ctx.host.invoke<{ surface: { id: string } }>("surface.open", {
      request: {
        kind: "window",
        target: {
          type: "plugin",
          pluginId: "com.chips.card-viewer",
          launchParams: {
            trigger: "community-open-remote-box",
            cardSource: {
              kind: "local-file",
              documentKind: "box",
              filePath: toNativePath(localBoxPath, os.tmpdir()),
            },
            communityServer: {
              baseUrl: server.baseUrl,
              accessToken: server.accessToken,
            },
          },
        },
        presentation: {
          title: suggestedFileName,
          width: 1024,
          height: 720,
          resizable: true,
        },
      },
    });

    await reportProgress(ctx, "completed", 100, "Remote box opened in local viewer");
    return {
      opened: true,
      url: `${server.baseUrl}/boxes/${boxId}`,
      localBoxPath: toNativePath(localBoxPath, os.tmpdir()),
      surfaceId: isRecord(surface.surface) ? String(surface.surface.id ?? "") : undefined,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      throw error;
    }
    throw createCommunityUploaderError(
      "COMMUNITY_TRANSFER_OPEN_REMOTE_BOX_FAILED",
      "Failed to open remote community box locally.",
      {
        boxId,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorDetail: isRecord(error)
          ? {
              code: String((error as { code?: unknown }).code ?? ""),
              message: String((error as { message?: unknown }).message ?? ""),
              details: (error as { details?: unknown }).details,
            }
          : undefined,
      },
    );
  }
};
