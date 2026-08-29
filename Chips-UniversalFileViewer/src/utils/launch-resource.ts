import type { PlatformLaunchContext } from "chips-sdk";
import { resolveFileName } from "./file-kind";

export interface LaunchFileResource {
  sourceId: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  relativePath?: string;
}

export interface LaunchViewerTarget {
  files: LaunchFileResource[];
  initialIndex: number;
  title?: string;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * 电子书图片包 payload（`chips.book-card` + `mode:"image-sequence"`）：
 * 专用图片查看器未安装时由本插件兜底消费，恢复有序图片队列。
 */
function readBookImageSequencePayload(value: unknown): Record<string, unknown> | null {
  const payload = readRecord(value);
  if (
    payload?.kind !== "chips.book-card" ||
    payload.mode !== "image-sequence" ||
    !readRecord(payload.resources)?.images
  ) {
    return null;
  }
  return payload as unknown as Record<string, unknown>;
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePlainPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function isSourceForRelativePath(sourceId: string, relativePath: string | undefined): boolean {
  if (!relativePath) {
    return false;
  }
  if (sourceId === relativePath) {
    return true;
  }
  try {
    const parsed = new URL(sourceId);
    const sourceSegments = parsed.pathname.split("/").filter(Boolean).map(decodePathSegment);
    const relativeSegments = normalizePlainPath(relativePath).split("/").filter(Boolean);
    return relativeSegments.length > 0
      && sourceSegments.slice(-relativeSegments.length).join("/") === relativeSegments.join("/");
  } catch {
    const normalizedSource = normalizePlainPath(sourceId);
    const normalizedRelative = normalizePlainPath(relativePath);
    return normalizedSource.endsWith(`/${normalizedRelative}`) || normalizedSource === normalizedRelative;
  }
}

function resolveResourceBaseFromDirectSource(
  directSource: string | undefined,
  directRelativePath: string | undefined,
): string | undefined {
  if (!directSource || !directRelativePath || !isSourceForRelativePath(directSource, directRelativePath)) {
    return undefined;
  }

  const relativeSegments = normalizePlainPath(directRelativePath).split("/").filter(Boolean);
  if (relativeSegments.length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(directSource);
    const sourceSegments = parsed.pathname.split("/").filter(Boolean);
    parsed.pathname = `/${sourceSegments.slice(0, -relativeSegments.length).join("/")}/`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    const normalizedSource = normalizePlainPath(directSource);
    const normalizedRelative = normalizePlainPath(directRelativePath);
    if (normalizedSource.endsWith(normalizedRelative)) {
      return normalizedSource.slice(0, normalizedSource.length - normalizedRelative.length);
    }
  }

  return undefined;
}

function resolvePayloadSourceId(
  sourceId: string | undefined,
  relativePath: string | undefined,
  resourceBaseUrl: string | undefined,
): string | undefined {
  if (sourceId && (!relativePath || sourceId !== relativePath)) {
    return sourceId;
  }
  if (relativePath && resourceBaseUrl) {
    try {
      return new URL(relativePath, resourceBaseUrl).toString();
    } catch {
      return `${resourceBaseUrl}${relativePath}`;
    }
  }
  return sourceId ?? relativePath;
}

function readPayloadImageResource(value: unknown, resourceBaseUrl?: string): LaunchFileResource | null {
  const record = readRecord(value);
  const sourceId = readNonEmptyString(record?.resourceId);
  const relativePath = readNonEmptyString(record?.relativePath);
  const resolvedSourceId = resolvePayloadSourceId(sourceId, relativePath, resourceBaseUrl);
  if (!resolvedSourceId) {
    return null;
  }

  return {
    sourceId: resolvedSourceId,
    fileName: readNonEmptyString(record?.fileName) ?? resolveFileName(relativePath ?? resolvedSourceId),
    mimeType: readNonEmptyString(record?.mimeType),
    relativePath,
  };
}

function resolveImageSequenceQueue(
  resourceOpen: Record<string, unknown>,
  payload: Record<string, unknown>,
): LaunchViewerTarget | null {
  const rawImages = ((payload.resources as Record<string, unknown>).images as unknown[]) ?? [];
  const directSources = [
    readNonEmptyString(resourceOpen.resourceId),
    readNonEmptyString(resourceOpen.filePath),
  ].filter((item): item is string => Boolean(item));
  const directImage = rawImages.find((image) => {
    const record = readRecord(image);
    const sourceId = readNonEmptyString(record?.resourceId);
    const relativePath = readNonEmptyString(record?.relativePath);
    return directSources.some((directSource) => (
      directSource === sourceId
      || directSource === relativePath
      || isSourceForRelativePath(directSource, relativePath)
    ));
  });
  const directImageRecord = readRecord(directImage);
  const directRelativePath = readNonEmptyString(directImageRecord?.relativePath)
    ?? readNonEmptyString(directImageRecord?.resourceId);
  const directSource = directSources.find((source) => (
    source === directRelativePath || isSourceForRelativePath(source, directRelativePath)
  ));
  const resourceBaseUrl = resolveResourceBaseFromDirectSource(directSource, directRelativePath);
  const files = rawImages
    .map((image) => readPayloadImageResource(image, resourceBaseUrl))
    .filter((image): image is LaunchFileResource => image !== null);
  if (files.length === 0) {
    return null;
  }

  const initialIndex = directSources.length > 0
    ? files.findIndex((file) => (
      directSources.includes(file.sourceId)
      || (file.relativePath ? directSources.includes(file.relativePath) || directSources.some((source) => isSourceForRelativePath(source, file.relativePath)) : false)
    ))
    : 0;

  const display = readRecord(payload.display);
  return {
    files,
    initialIndex: initialIndex < 0 ? 0 : initialIndex,
    title: readNonEmptyString(display?.title),
  };
}

/**
 * 归一启动目标：
 * 1. 电子书图片包 payload → 有序图片队列；
 * 2. 其余（含 ebook / video / music 卡片 payload）→ 顶层 resourceOpen.filePath
 *    ?? targetPath ?? resourceOpen.resourceId 作为唯一读取入口（契约要求）。
 */
export function resolveLaunchViewerTarget(launchContext: PlatformLaunchContext): LaunchViewerTarget | null {
  const launchParams = readRecord(launchContext.launchParams) ?? {};
  const resourceOpen = readRecord(launchParams.resourceOpen) ?? {};
  const payload = readRecord(resourceOpen.payload);

  if (payload) {
    const queueTarget = resolveImageSequenceQueue(resourceOpen, payload);
    if (queueTarget) {
      return queueTarget;
    }
  }

  const directTargetPath = readNonEmptyString(launchParams.targetPath);
  const resourceFilePath = readNonEmptyString(resourceOpen.filePath);
  const resourceId = readNonEmptyString(resourceOpen.resourceId);
  const sourceId = resourceFilePath ?? directTargetPath ?? resourceId;
  if (!sourceId) {
    return null;
  }

  return {
    files: [
      {
        sourceId,
        filePath: resourceFilePath ?? directTargetPath,
        fileName: readNonEmptyString(resourceOpen.fileName) ?? resolveFileName(sourceId),
        mimeType: readNonEmptyString(resourceOpen.mimeType),
      },
    ],
    initialIndex: 0,
    title: readNonEmptyString(resourceOpen.title),
  };
}
