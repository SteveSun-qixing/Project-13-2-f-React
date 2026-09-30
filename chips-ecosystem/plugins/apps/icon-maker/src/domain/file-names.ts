/**
 * 输出文件名归一（旧 Chip-iconMaker/src/icon-workbench/file-names.ts 逐字迁移）。
 */

const EXTENSION_PATTERN = /\.[^.\\/]+$/;

export function stripExtension(fileName: string): string {
  const normalized = fileName.trim();
  return normalized.replace(EXTENSION_PATTERN, '') || 'icon';
}

export function toSafeFileName(name: string): string {
  const normalized = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');

  return normalized || 'icon';
}
