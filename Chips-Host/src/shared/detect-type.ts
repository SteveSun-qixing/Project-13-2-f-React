/**
 * 文件类型结构化识别公共工具（主进程侧实现）
 *
 * 生态统一文件类型识别语义（见工单152）：按路径识别 documentType/mimeType/category。
 * 渲染进程侧对应能力为 `client.file.detectType`（走本模块实现的动作）。
 */

import { guessMimeType } from './mime';

export type DetectDocumentType = 'card' | 'box';

export type DetectCategory =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'html'
  | 'archive'
  | 'unknown';

export interface DetectTypeResult {
  documentType: DetectDocumentType | null;
  mimeType: string;
  category: DetectCategory;
}

/** 按路径进行结构化文件类型识别。 */
export const detectTypeByPath = (path: string): DetectTypeResult => {
  const normalizedPath = path.replace(/\\/g, '/').trim();
  const lowerPath = normalizedPath.toLowerCase();

  let documentType: DetectDocumentType | null = null;
  if (lowerPath.endsWith('.card')) {
    documentType = 'card';
  } else if (lowerPath.endsWith('.box')) {
    documentType = 'box';
  }

  const mimeType = guessMimeType(normalizedPath);

  let category: DetectCategory;
  if (documentType === 'card' || documentType === 'box') {
    category = 'document';
  } else if (lowerPath.endsWith('.zip') || lowerPath.endsWith('.cpk')) {
    category = 'archive';
  } else if (mimeType.startsWith('image/')) {
    category = 'image';
  } else if (mimeType.startsWith('video/')) {
    category = 'video';
  } else if (mimeType.startsWith('audio/')) {
    category = 'audio';
  } else if (mimeType === 'text/html') {
    category = 'html';
  } else if (mimeType.startsWith('text/')) {
    category = 'text';
  } else if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/json' ||
    mimeType === 'application/yaml' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    category = 'document';
  } else {
    category = 'unknown';
  }

  return { documentType, mimeType, category };
};
