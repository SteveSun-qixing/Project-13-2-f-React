/**
 * 来源图路径装载臂：经 `file:read` 正式能力链读取输入图片并构造窗口内源图。
 *
 * 与 `iconSave` 同属 filesystem 臂：filesystem 域宿主处理器未就绪（工单061 在册）时
 * `file:read` 以 ChipsError 拒绝，本模块不做兜底旁路，异常原样上抛由界面诚实呈现。
 * 路径文件名/扩展名与 MIME 推断逻辑自旧 cli-runner（重写面）收编为纯函数。
 */

import { chips } from '@chips/sdk';
import { createSourceIconImage, isSupportedIconSource } from '../domain/image-loader';
import type { SourceIconImage } from '../domain/types';

/** 由扩展名推断 MIME（与 image-loader 支持面一致；未知扩展名回落八位流）。 */
export function inferMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

/** 取路径末端文件名（兼容正反斜杠分隔；空段过滤）。 */
export function inferFileName(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? 'icon';
}

function createFileFromBytes(filePath: string, bytes: Uint8Array): File {
  const ownedBytes = new Uint8Array(bytes);
  return new File([ownedBytes.buffer], inferFileName(filePath), {
    type: inferMimeType(filePath),
    lastModified: Date.now(),
  });
}

/**
 * 读取路径图片并装载为窗口内源图；解码失败或来源格式不支持时抛出领域错误。
 * `file:read` 返回 base64 文本，本地解码为字节后走与文件选择器相同的装载链路。
 */
export async function loadImageSourceFromPath(path: string): Promise<SourceIconImage> {
  const content = await chips.request('file:read', { path, encoding: 'base64' });
  if (typeof content !== 'object' || content === null || typeof (content as { content?: unknown }).content !== 'string') {
    throw new Error('ICONMAKER_INPUT_NOT_BINARY');
  }

  const binary = atob((content as { content: string }).content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const sourceFile = createFileFromBytes(path, bytes);
  if (!isSupportedIconSource(sourceFile)) {
    throw new Error('ICONMAKER_INPUT_UNSUPPORTED');
  }

  return createSourceIconImage(sourceFile);
}
