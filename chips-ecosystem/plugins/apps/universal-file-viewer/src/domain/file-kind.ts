/**
 * 文件类型工具：基于引擎能力归类文件，决定资源读取策略。
 */

export type FileDeliveryKind = "uri" | "bytes";

/** 音视频使用 URI 串流，其余格式统一读取字节交给引擎。 */
const STREAMING_MEDIA_PREFIXES = ["video/", "audio/"];

export function isStreamingMediaMime(mimeType: string | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  const normalized = mimeType.trim().toLowerCase();
  return STREAMING_MEDIA_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function resolveDeliveryKind(mimeType: string | undefined): FileDeliveryKind {
  return isStreamingMediaMime(mimeType) ? "uri" : "bytes";
}

export function resolveFileName(source: string): string {
  const withoutQuery = source.split(/[?#]/, 1)[0] ?? source;
  const segments = withoutQuery.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? source;
}

export function resolveFileExtension(fileName: string): string {
  const clean = fileName.split("?")[0]?.split("#")[0] ?? "";
  const index = clean.lastIndexOf(".");
  return index >= 0 ? clean.slice(index + 1).toLowerCase() : "";
}

export function isHttpUrl(source: string): boolean {
  try {
    const parsed = new URL(source);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** 判断资源标识是否像本地文件路径（含 file:// URL）。 */
export function isLikelyLocalPath(sourceId: string): boolean {
  if (sourceId.startsWith("file://")) {
    return true;
  }
  if (sourceId.startsWith("/") || sourceId.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(sourceId)) {
    return true;
  }
  if (isHttpUrl(sourceId) || /^[a-z][a-z0-9+.-]*:/i.test(sourceId)) {
    return false;
  }
  return false;
}

/** 将 file:// URL 解码为本地路径；其余原样返回。 */
export function fileUrlToPathLike(sourceId: string): string {
  if (!sourceId.startsWith("file://")) {
    return sourceId;
  }
  try {
    const parsed = new URL(sourceId);
    let pathname = decodeURIComponent(parsed.pathname);
    if (/^\/[a-zA-Z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    if (parsed.host && parsed.host !== "localhost") {
      return `//${parsed.host}${pathname}`;
    }
    return pathname;
  } catch {
    return sourceId;
  }
}

export function formatFileSize(size: number | undefined): string | undefined {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
    return undefined;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}
