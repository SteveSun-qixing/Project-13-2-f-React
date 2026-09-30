/**
 * 图标源图装载（旧 Chip-iconMaker/src/icon-workbench/image-loader.ts 逐字迁移）。
 *
 * 浏览器窗口内侧源图装载面：类型/扩展名白名单、`<img>` 解码与 `SourceIconImage` 构造；
 * 仅在渲染窗口内消费（主进程侧无 Image / URL.createObjectURL）。
 */

import { stripExtension, toSafeFileName } from './file-names';
import type { SourceIconImage } from './types';

const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

export function isSupportedIconSource(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    SUPPORTED_TYPES.has(file.type) ||
    ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].some((extension) => lowerName.endsWith(extension))
  );
}

export function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    image.src = objectUrl;
  });
}

export async function createSourceIconImage(file: File): Promise<SourceIconImage> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    return {
      id: `${file.name}-${file.size}-${file.lastModified}`,
      fileName: file.name,
      baseName: toSafeFileName(stripExtension(file.name)),
      objectUrl,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      file,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
