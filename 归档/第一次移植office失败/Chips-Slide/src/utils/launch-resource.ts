/**
 * 启动资源解析与字节读取（Chips 文件打开链路）：
 * - 解析目标：launchParams.resourceOpen 优先，targetPath 兼容回退；
 *   打开目标优先级 resourceOpen.filePath ?? launchParams.targetPath ?? resourceOpen.resourceId。
 * - 本地 PPTX 的正式运行时入口优先使用 client.office 会话；本模块保留
 *   client.file.read 与 client.resource.readBinary 作为非会话资源回退。
 */
import type { Client } from "chips-sdk";

export interface LaunchFileTarget {
  /** 解析后的打开目标：本地路径 / http(s) 地址 / 资源源 id */
  sourceId: string;
  /** 本地路径（仅当目标为本地文件时存在） */
  filePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  title: string | null;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveFileName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const index = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

export function resolveLaunchFileTarget(launchContext: {
  launchParams?: Record<string, unknown>;
} | null): LaunchFileTarget | null {
  const launchParams = readRecord(launchContext?.launchParams) ?? {};
  const resourceOpen = readRecord(launchParams.resourceOpen);

  const resourceFilePath = readNonEmptyString(resourceOpen?.filePath);
  const targetPath = readNonEmptyString(launchParams.targetPath);
  const resourceId = readNonEmptyString(resourceOpen?.resourceId);
  const sourceId = resourceFilePath ?? targetPath ?? resourceId;

  if (!sourceId) {
    return null;
  }

  const filePath = resourceFilePath ?? targetPath;

  return {
    sourceId,
    filePath: filePath ?? null,
    fileName:
      readNonEmptyString(resourceOpen?.fileName) ?? resolveFileName(filePath ?? sourceId),
    mimeType: readNonEmptyString(resourceOpen?.mimeType) ?? null,
    title: readNonEmptyString(resourceOpen?.title) ?? null,
  };
}

type BufferLikeJson = { data?: unknown; content?: unknown; type?: unknown };

/** client.file.read 的返回可能是 Uint8Array 或 Buffer 的 JSON 包装（{data}/{content}/裸值）。 */
export function unwrapBinaryPayload(payload: unknown): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload);
  }
  if (typeof payload === "string") {
    return decodeBase64OrLatin(payload);
  }
  const record = readRecord(payload) as BufferLikeJson | null;
  if (record) {
    if (record.data !== undefined) {
      return unwrapBinaryPayload(record.data);
    }
    if (record.content !== undefined) {
      return unwrapBinaryPayload(record.content);
    }
  }
  if (Array.isArray(payload)) {
    return Uint8Array.from(payload.map((item) => Number(item) & 0xff));
  }
  throw new Error("无法识别的二进制载荷格式");
}

function decodeBase64OrLatin(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/]+=*$/.test(normalized) && normalized.length % 4 === 0) {
    try {
      const binary = globalThis.atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    } catch {
      // 回退为逐字符字节解码
    }
  }
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function isFileSystemPath(value: string): boolean {
  // Resource IDs may be URLs (including file://); only plain paths use file.read.
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

/** 按 Host 通道读取打开目标的字节。 */
export async function readLaunchFileBytes(
  client: Client,
  target: LaunchFileTarget,
): Promise<Uint8Array> {
  const { sourceId, filePath } = target;
  if (filePath && isFileSystemPath(sourceId)) {
    const payload = await client.file.read(filePath, { encoding: "binary" });
    return unwrapBinaryPayload(payload);
  }
  // All non-path resource IDs are Host-managed, including HTTP and file URLs.
  const payload = await client.resource.readBinary(sourceId);
  return unwrapBinaryPayload(payload);
}
