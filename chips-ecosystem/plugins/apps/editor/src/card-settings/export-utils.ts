/**
 * 导出文件名与路径纯工具（矩阵裁决件：迁移自旧仓 Chips-EditingEngine
 * `src/components/CardSettings/panels/export-utils.ts:1-50`，
 * 零 Host 零 UI 纯函数；编辑器主体卡片设置导出面板重写时消费，
 * 落盘动作面候 `document:export` 提供方（第十三项），本件不涉任何能力调用）。
 *
 * 迁移适配：逐字迁移，零语义差、零依赖变更。
 */

export function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export function getParentPath(filePath: string): string {
  const normalized = normalizePathForCompare(filePath);
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex < 0) {
    return '';
  }
  return lastSlashIndex === 0 ? '/' : normalized.slice(0, lastSlashIndex);
}

function stripSourceExtension(fileName: string, extension: string): string {
  return fileName.toLowerCase().endsWith(extension.toLowerCase())
    ? fileName.slice(0, -extension.length)
    : fileName;
}

export function sanitizeExportFileName(fileName: string, sourceExtension = ''): string {
  return stripSourceExtension(fileName.trim(), sourceExtension)
    // 控制字符剥离是本函数的清洗语义而非缺陷（同 packages/host/src/loader/validate.ts 判例）。
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim();
}

export function ensureFileExtension(filePath: string, extension: string): string {
  return filePath.toLowerCase().endsWith(extension.toLowerCase())
    ? filePath
    : `${filePath}${extension}`;
}

export function buildDefaultExportPath(options: {
  sourcePath: string;
  displayName: string | undefined;
  fallbackName: string;
  sourceExtension: string;
  targetExtension: string;
}): string {
  const parentPath = getParentPath(options.sourcePath);
  const stem = sanitizeExportFileName(options.displayName ?? '', options.sourceExtension) || options.fallbackName;
  const defaultPath = `${parentPath}/${stem}${options.targetExtension}`;

  if (normalizePathForCompare(defaultPath) === normalizePathForCompare(options.sourcePath)) {
    return `${parentPath}/${stem}-export${options.targetExtension}`;
  }

  return defaultPath;
}
