import type { PlatformLaunchContext } from "chips-sdk";
import {
  resolveFileExtension,
  resolveFileName,
  SUPPORTED_SHEET_EXTENSION_LABEL,
  type WorkbookFormat,
} from "../sheet/workbook-model";

export interface LaunchSheetTarget {
  /** 字节来源标识：本地路径、远程 URL 或资源 ID */
  sourceId: string;
  /** 本地文件路径（仅本地文件存在） */
  filePath?: string;
  fileName: string;
  mimeType?: string;
  title?: string;
  /** 目标写出格式（由扩展名推导） */
  format: WorkbookFormat;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isProbablyRemoteSource(sourceId: string): boolean {
  return /^https?:\/\//i.test(sourceId.trim());
}

export function isLikelyLocalPath(sourceId: string): boolean {
  const normalized = sourceId.trim();
  if (!normalized || isProbablyRemoteSource(normalized)) {
    return false;
  }
  if (normalized.startsWith("file://")) {
    return true;
  }
  // Host 托管资源（例如 chips-render://...）必须走 resource.readBinary，
  // 不能因 URI 末尾带 .xlsx 而被误判为本地文件路径。
  if (/^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(normalized)) {
    return false;
  }
  return /^[\\/]/.test(normalized) || /^[A-Za-z]:[\\/]/.test(normalized) || resolveFileExtension(normalized) !== "";
}

function normalizeFileUriToPath(uri: string): string {
  try {
    const parsed = new URL(uri);
    const pathname = decodeURIComponent(parsed.pathname);
    // file:///C:/... 在 Windows URL 语义下 pathname 会多一个根斜杠。
    if (/^\/[A-Za-z]:[\\/]/.test(pathname)) {
      return pathname.slice(1);
    }
    if (parsed.hostname && parsed.hostname !== "localhost") {
      return `//${parsed.hostname}${pathname}`;
    }
    return pathname;
  } catch {
    return uri;
  }
}

function resolveSourceExtension(sourceId: string): string {
  const normalized = sourceId.trim();
  try {
    const parsed = new URL(normalized);
    return resolveFileExtension(parsed.pathname);
  } catch {
    return resolveFileExtension(normalized.split(/[?#]/, 1)[0] ?? normalized);
  }
}

function resolveFormat(sourceId: string, mimeType?: string, fileName?: string): WorkbookFormat | null {
  const extension = resolveSourceExtension(sourceId);
  if (extension === "xlsx" || extension === "xlsm" || extension === "csv") {
    return extension;
  }
  if (mimeType === "text/csv") {
    return "csv";
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (mimeType === "application/vnd.ms-excel.sheet.macroenabled.12") {
    return "xlsm";
  }
  // 资源 ID 不含扩展名时（opaque id），文件名是最后的格式线索
  if (fileName) {
    const fileNameExtension = resolveFileExtension(fileName);
    if (fileNameExtension === "xlsx" || fileNameExtension === "xlsm" || fileNameExtension === "csv") {
      return fileNameExtension;
    }
  }
  return null;
}

/**
 * 解析启动参数中的表格文件目标。
 * 优先级：resourceOpen.filePath ?? launchParams.targetPath ?? resourceOpen.resourceId。
 * 无目标或格式不受支持时返回 null（停留在起始页）。
 */
export function resolveLaunchSheetTarget(launchContext: PlatformLaunchContext): LaunchSheetTarget | null {
  const launchParams = readRecord(launchContext.launchParams) ?? {};
  const resourceOpen = readRecord(launchParams.resourceOpen);

  const resourceFilePath = readNonEmptyString(resourceOpen?.filePath);
  const targetPath = readNonEmptyString(launchParams.targetPath);
  const resourceId = readNonEmptyString(resourceOpen?.resourceId);
  const sourceId = resourceFilePath ?? targetPath ?? resourceId;

  if (!sourceId) {
    return null;
  }

  const mimeType = readNonEmptyString(resourceOpen?.mimeType);
  const fileName = readNonEmptyString(resourceOpen?.fileName);
  const format = resolveFormat(sourceId, mimeType, fileName);
  if (!format) {
    return null;
  }

  const filePath = resourceFilePath ?? targetPath;
  const normalizedSourceId =
    filePath && filePath.startsWith("file://") ? normalizeFileUriToPath(filePath) : sourceId;

  return {
    sourceId: normalizedSourceId,
    filePath: filePath
      ? filePath.startsWith("file://")
        ? normalizeFileUriToPath(filePath)
        : filePath
      : undefined,
    fileName: fileName ?? resolveFileName(normalizedSourceId),
    mimeType,
    title: readNonEmptyString(resourceOpen?.title),
    format,
  };
}

export { SUPPORTED_SHEET_EXTENSION_LABEL, resolveFileName };
