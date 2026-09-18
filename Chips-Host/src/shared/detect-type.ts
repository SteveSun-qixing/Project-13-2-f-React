/**
 * 文件类型结构化识别公共工具（主进程侧实现）
 *
 * 生态统一文件类型识别语义（见工单152）：按路径识别 documentType/mimeType/category。
 * 渲染进程侧对应能力为 `client.file.detectType`（走本模块实现的动作）。
 */

import { getFileExtension, guessMimeType } from './mime';

export type DetectDocumentType = 'card' | 'box' | 'word' | 'slide' | 'sheet' | 'pdf';

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
  extension: string | null;
  size: number | null;
}

/** 按路径进行结构化文件类型识别。 */
export const detectTypeByPath = (path: string, size: number | null = null): DetectTypeResult => {
  const normalizedPath = path.replace(/\\/g, '/').trim();
  const extension = getFileExtension(normalizedPath);

  let documentType: DetectDocumentType | null = null;
  if (extension === 'card') {
    documentType = 'card';
  } else if (extension === 'box') {
    documentType = 'box';
  } else if (['doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'rtf', 'odt'].includes(extension ?? '')) {
    documentType = 'word';
  } else if (['ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp'].includes(extension ?? '')) {
    documentType = 'slide';
  } else if (['xls', 'xlsx', 'xlsm', 'xlsb', 'xlt', 'xltx', 'xltm', 'ods', 'csv', 'tsv'].includes(extension ?? '')) {
    documentType = 'sheet';
  } else if (extension === 'pdf') {
    documentType = 'pdf';
  }

  const mimeType = guessMimeType(normalizedPath);

  let category: DetectCategory;
  if (documentType !== null) {
    category = 'document';
  } else if (extension === 'zip' || extension === 'cpk' || extension === '7z' || extension === 'tar' || extension === 'gz' || extension === 'rar') {
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
    mimeType === 'application/xml' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType.startsWith('application/vnd.openxmlformats-officedocument.') ||
    mimeType.startsWith('application/vnd.ms-') ||
    mimeType.startsWith('application/vnd.oasis.opendocument.') ||
    mimeType === 'application/rtf' ||
    mimeType === 'application/epub+zip' ||
    mimeType === 'application/x-mobipocket-ebook' ||
    mimeType === 'application/vnd.amazon.ebook' ||
    mimeType === 'application/x-fictionbook+xml'
  ) {
    category = 'document';
  } else {
    category = 'unknown';
  }

  return { documentType, mimeType, category, extension, size };
};
