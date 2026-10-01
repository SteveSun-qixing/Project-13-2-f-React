/**
 * 资源读取投递：把查看队列项装载为引擎预览源（旧仓 `src/utils/source-loader.ts` 的重写面）。
 *
 * 正式面：
 * - 受管资源（`chips-resource://`）经 `chips.resource(uri)` 句柄读取（06-资源协议规范）；
 *   `read()` 命中 `RESOURCE_TOO_LARGE` 时按《15-文件处理契约》§五降级 `stream()` 流式合并，
 *   不在界面层设 8MiB 上限；
 * - 远程 http(s) 引用不读取字节，直接交引擎按 URL 加载（媒体可流式播放）；
 * - 字节统一构造带 MIME 的 `File`，探测与渲染由引擎格式插件链承担。
 */

import { chips, type IResourceHandle } from '@chips/sdk';
import type { PreviewItem, PreviewSource } from '../engine';
import { isHttpUrl } from './file-kind';
import type { ViewerQueueItem } from './viewer-target';

/** 装载完成的查看文件：`origin` 区分受管资源与远程引用。 */
export interface LoadedViewerFile {
  readonly source: PreviewSource;
  readonly fileName: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly origin: 'managed' | 'remote';
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'UNKNOWN';
}

/** 《15-文件处理契约》§五：>8MiB 资源降级流式读取并合并（预览装载是一次性消费面）。 */
async function readHandleBytes(handle: IResourceHandle): Promise<Uint8Array> {
  try {
    return await handle.read();
  } catch (error) {
    if (errorCode(error) !== 'RESOURCE_TOO_LARGE') {
      throw error;
    }
    const reader = handle.stream().getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }
}

/**
 * 装载单项资源：远程 http(s) 直通 URL（媒体可流式播放）；受管资源读字节构造 `File`，
 * MIME 随 Blob 携带（音视频解码与文本解码都依赖它）。
 */
export async function loadViewerFile(item: ViewerQueueItem): Promise<LoadedViewerFile> {
  if (isHttpUrl(item.uri)) {
    return {
      source: item.uri,
      fileName: item.fileName,
      ...(item.mimeType === undefined ? {} : { mimeType: item.mimeType }),
      origin: 'remote',
    };
  }

  const handle = chips.resource(item.uri);
  try {
    const bytes = await readHandleBytes(handle);
    // Uint8Array 是 Blob 合法的二进制视图；此处的类型收窄仅为跨 lib 的 ArrayBufferLike 泛型差异。
    const blob = new Blob([bytes as unknown as BlobPart], { type: item.mimeType ?? '' });
    return {
      source: new File([blob], item.fileName, { type: blob.type }),
      fileName: item.fileName,
      ...(item.mimeType === undefined ? {} : { mimeType: item.mimeType }),
      size: blob.size,
      origin: 'managed',
    };
  } finally {
    handle.release();
  }
}

/** 装载结果 → 引擎队列项（引擎按 mimeType/扩展名探测路由到对应格式插件）。 */
export function toPreviewItems(files: readonly LoadedViewerFile[]): PreviewItem[] {
  return files.map((file) => ({
    file: file.source,
    fileName: file.fileName,
    ...(file.mimeType === undefined ? {} : { mimeType: file.mimeType }),
  }));
}
