/**
 * 打开投递 → 图片队列解析（《14-资源打开与默认处理器契约》§5.1/§5.2/§5.4 消费规则的重写面，
 * 裁决自旧仓 `src/utils/launch-resource.ts`：旧 PlatformLaunchContext 解析面作废，
 * 相对路径归一由平台完成、载荷内 relativePath 只用于日志与展示，不参与读取）。
 *
 * - 单图主资源：`resourceOpen.uri` 是唯一读取入口，展示字段缺失时按自身能力回补、不因缺失拒绝；
 * - 图包载荷：`chips.book-card` + `mode: 'image-sequence'` 按 `resources.images[]` 顺序建队，
 *   主资源必须是序列首项（`resourceOpen.uri` 指向该项）；版本按主版本判定兼容（§5.3），
 *   未知/不兼容载荷忽略后仍按主资源打开。
 */

import type { IResourceOpenContext } from '@chips/sdk';
import { normalizeImageExtension, resolveFileName, SUPPORTED_IMAGE_EXTENSIONS } from './image-viewer';

/** 支持格式表对应的 MIME 推断（与 manifest `fileAssociations` 的 mimeTypes 逐项同源）。 */
const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

/** 按路径扩展名推断图片 MIME；支持表外返回 undefined。 */
export function inferImageMimeTypeFromPath(path: string): string | undefined {
  return IMAGE_MIME_BY_EXTENSION[normalizeImageExtension(path)];
}

/** 受支持图片扩展名（打开对话框过滤器与格式守卫共用，顺序与 manifest 声明一致）。 */
export const SUPPORTED_OPEN_EXTENSIONS: readonly string[] = SUPPORTED_IMAGE_EXTENSIONS;

/** 队列中的单张图片：`uri` 是唯一读取入口，其余字段仅承载展示与日志。 */
export interface QueueImage {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType?: string;
  readonly title?: string;
  /** 发起方视角的包内相对路径；仅展示与日志（《14》§5.2），不用于读取。 */
  readonly relativePath?: string;
}

/** 一次打开投递建立的查看队列。 */
export interface ImageQueue {
  readonly images: readonly QueueImage[];
  readonly initialIndex: number;
  readonly title?: string;
}

interface BookImageSequenceCandidate {
  readonly images: readonly unknown[];
  readonly title?: string;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * 读取图包业务载荷（《14》§5.3：`kind` + `version` 主版本兼容判定，不兼容即忽略 payload）。
 */
function readBookImageSequencePayload(payload: unknown): BookImageSequenceCandidate | null {
  const record = readRecord(payload);
  if (record === null) {
    return null;
  }

  const version = readNonEmptyString(record['version']);
  if (
    record['kind'] !== 'chips.book-card' ||
    version === undefined ||
    !/^1\./.test(version) ||
    record['cardType'] !== 'base.book' ||
    record['mode'] !== 'image-sequence'
  ) {
    return null;
  }

  const resources = readRecord(record['resources']);
  const images = resources?.['images'];
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const display = readRecord(record['display']);
  const title = readNonEmptyString(display?.['title']);
  return {
    images,
    ...(title === undefined ? {} : { title }),
  };
}

function readQueueImage(entry: unknown): QueueImage | null {
  const record = readRecord(entry);
  const uri = readNonEmptyString(record?.['uri']);
  if (uri === undefined) {
    return null;
  }

  const mimeType = readNonEmptyString(record?.['mimeType']) ?? inferImageMimeTypeFromPath(uri);
  const fileName = readNonEmptyString(record?.['fileName']) ?? resolveFileName(uri);
  const relativePath = readNonEmptyString(record?.['relativePath']);

  return {
    uri,
    fileName: fileName.length > 0 ? fileName : uri,
    ...(mimeType === undefined ? {} : { mimeType }),
    ...(relativePath === undefined ? {} : { relativePath }),
  };
}

/**
 * 由打开上下文解析查看队列：图包载荷命中时按 `resources.images[]` 建队并以主资源命中项为初始
 * 位置（契约要求序列首项，未命中时防御性回退首项）；否则按主资源建立单图队列；
 * `uri` 为空白时返回 `null`（无读取入口）。
 */
export function resolveImageQueue(context: IResourceOpenContext): ImageQueue | null {
  const uri = context.uri.trim();
  if (uri.length === 0) {
    return null;
  }

  const payload = readBookImageSequencePayload(context.payload);
  if (payload !== null) {
    const images = payload.images
      .map(readQueueImage)
      .filter((image): image is QueueImage => image !== null);
    if (images.length > 0) {
      const matchedIndex = images.findIndex((image) => image.uri === uri);
      const title = payload.title;
      return {
        images,
        initialIndex: matchedIndex >= 0 ? matchedIndex : 0,
        ...(title === undefined ? {} : { title }),
      };
    }
  }

  const mimeType = readNonEmptyString(context.mimeType) ?? inferImageMimeTypeFromPath(uri);
  const fileName = readNonEmptyString(context.fileName) ?? resolveFileName(uri);
  const title = readNonEmptyString(context.title);

  return {
    images: [
      {
        uri,
        fileName: fileName.length > 0 ? fileName : uri,
        ...(mimeType === undefined ? {} : { mimeType }),
        ...(title === undefined ? {} : { title }),
      },
    ],
    initialIndex: 0,
    ...(title === undefined ? {} : { title }),
  };
}