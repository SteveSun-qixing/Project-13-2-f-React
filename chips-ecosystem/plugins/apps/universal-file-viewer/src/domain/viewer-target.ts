/**
 * 打开投递 → 查看目标解析（《14-资源打开与默认处理器契约》§5 消费规则的重写面，
 * 裁决自旧仓 `src/utils/launch-resource.ts`：旧 PlatformLaunchContext 解析面作废，
 * 相对路径归一由平台完成、载荷内 relativePath 只用于日志与展示，不参与读取）。
 *
 * - 单资源主投递：`resourceOpen.uri` 是唯一读取入口，展示字段缺失时按自身能力回补、
 *   不因缺失拒绝；
 * - 图包载荷：`chips.book-card` + `mode: 'image-sequence'` 按 `resources.images[]` 顺序
 *   建队（专用图片查看器缺位时的兜底消费面），主资源必须是序列命中项；版本按主版本
 *   判定兼容（§5.3），未知/不兼容载荷忽略后仍按主资源打开。
 */

import type { IResourceOpenContext } from '@chips/sdk';
import { resolveFileName } from './file-kind';

/** 队列中的单项资源：`uri` 是唯一读取入口，其余字段仅承载展示与日志。 */
export interface ViewerQueueItem {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType?: string;
  readonly title?: string;
  /** 发起方视角的包内相对路径；仅展示与日志（《14》§5.2），不用于读取。 */
  readonly relativePath?: string;
}

/** 一次打开投递建立的查看目标。 */
export interface ViewerTarget {
  readonly items: readonly ViewerQueueItem[];
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

/** 读取图包业务载荷（《14》§5.3：`kind` + `version` 主版本兼容判定，不兼容即忽略 payload）。 */
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

function readQueueItem(entry: unknown): ViewerQueueItem | null {
  const record = readRecord(entry);
  const uri = readNonEmptyString(record?.['uri']);
  if (uri === undefined) {
    return null;
  }

  const mimeType = readNonEmptyString(record?.['mimeType']);
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
 * 由打开上下文解析查看目标：图包载荷命中时按 `resources.images[]` 建队并以主资源命中项
 * 为初始位置（契约要求序列命中项，未命中时防御性回退首项）；否则按主资源建立单项目标；
 * `uri` 为空白时返回 `null`（无读取入口）。
 */
export function resolveViewerTarget(context: IResourceOpenContext): ViewerTarget | null {
  const uri = context.uri.trim();
  if (uri.length === 0) {
    return null;
  }

  const payload = readBookImageSequencePayload(context.payload);
  if (payload !== null) {
    const items = payload.images
      .map(readQueueItem)
      .filter((item): item is ViewerQueueItem => item !== null);
    if (items.length > 0) {
      const matchedIndex = items.findIndex((item) => item.uri === uri);
      const title = payload.title;
      return {
        items,
        initialIndex: matchedIndex >= 0 ? matchedIndex : 0,
        ...(title === undefined ? {} : { title }),
      };
    }
  }

  const mimeType = readNonEmptyString(context.mimeType);
  const fileName = readNonEmptyString(context.fileName) ?? resolveFileName(uri);
  const title = readNonEmptyString(context.title);

  return {
    items: [
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
