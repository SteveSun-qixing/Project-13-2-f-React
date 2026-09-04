import type { PlatformLaunchContext } from "chips-sdk";

export interface LaunchPdfTarget {
  /** 读取源标识：本地路径、http(s) 地址或宿主资源 ID */
  sourceId: string;
  /** 本地文件路径（仅当来源是本地文件时存在） */
  filePath?: string;
  fileName: string;
  mimeType?: string;
  title?: string;
}

/** 启动目标解析只依赖 launchParams，允许从合并后的运行时环境直接调用。 */
export type LaunchParamsSource = Pick<PlatformLaunchContext, "launchParams">;

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
  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

/**
 * 解析启动参数中的 PDF 打开目标。
 * 优先级：resourceOpen.filePath ?? launchParams.targetPath ?? resourceOpen.resourceId。
 */
export function resolveLaunchPdfTarget(
  launchContext: LaunchParamsSource | null,
): LaunchPdfTarget | null {
  const launchParams = readRecord(launchContext?.launchParams) ?? {};
  const resourceOpen = readRecord(launchParams.resourceOpen);
  const payload = readRecord(resourceOpen?.payload);

  const payloadResource = readRecord(payload?.resource);
  const resourceFilePath =
    readNonEmptyString(resourceOpen?.filePath) ?? readNonEmptyString(payloadResource?.filePath);
  const targetPath = readNonEmptyString(launchParams.targetPath);
  const resourceId =
    readNonEmptyString(resourceOpen?.resourceId) ?? readNonEmptyString(payloadResource?.resourceId);
  const sourceId = resourceFilePath ?? targetPath ?? resourceId;

  if (!sourceId) {
    return null;
  }

  const filePath = resourceFilePath ?? targetPath;

  return {
    sourceId,
    filePath,
    fileName:
      readNonEmptyString(resourceOpen?.fileName) ??
      readNonEmptyString(payloadResource?.fileName) ??
      resolveFileName(filePath ?? sourceId),
    mimeType:
      readNonEmptyString(resourceOpen?.mimeType) ?? readNonEmptyString(payloadResource?.mimeType),
    title: readNonEmptyString(resourceOpen?.title) ?? readNonEmptyString(payload?.title),
  };
}

/** 把打开对话框返回的路径包装为打开目标 */
export function createDialogPdfTarget(filePath: string): LaunchPdfTarget {
  return {
    sourceId: filePath,
    filePath,
    fileName: resolveFileName(filePath),
  };
}

/** 把拖放的文件包装为打开目标（优先使用宿主解析出的本地路径） */
export function createDroppedPdfTarget(
  file: File,
  resolvePath: (file: File) => string | null,
): LaunchPdfTarget | null {
  const filePath = resolvePath(file);
  const sourceId = filePath ?? file.name;
  if (!sourceId) {
    return null;
  }
  return {
    sourceId,
    filePath: filePath ?? undefined,
    fileName: file.name,
    mimeType: file.type || undefined,
  };
}
