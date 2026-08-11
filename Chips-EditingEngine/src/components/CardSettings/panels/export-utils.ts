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
