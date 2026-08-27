/**
 * 封面资源 reconcile：扫描 cover.html 引用并清理未引用资源、剪枝空目录
 *
 * 逻辑来源：Chips-EditingEngine `src/core/card-service.ts`（task034 M2 上移）。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeRelativeResourcePath } from '../../../../src/shared/resource-path';

/** 从 cover.html 中收集被引用的 .card/cardcover/ 相对资源路径。 */
export const collectCoverResourceReferences = (html: string): Set<string> => {
  const references = new Set<string>();
  const attributePattern = /\b(?:src|href|poster|data-chips-cover-image-source)\s*=\s*["']([^"']+)["']/gi;
  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

  for (const pattern of [attributePattern, urlPattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const normalizedPath = normalizeCoverReferencePath(match[1] ?? '');
      if (normalizedPath) {
        references.add(normalizedPath);
      }
    }
  }

  return references;
};

const normalizeCoverReferencePath = (resourcePath: string): string | null => {
  let normalized = resourcePath
    .replace(/&amp;/g, '&')
    .replace(/\\/g, '/')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!normalized || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(normalized)) {
    return null;
  }

  normalized = normalized.split(/[?#]/)[0] ?? '';
  normalized = normalized.replace(/^\.?\//, '');
  if (normalized.startsWith('.card/')) {
    normalized = normalized.slice('.card/'.length);
  }
  if (!normalized.startsWith('cardcover/')) {
    return null;
  }

  const segments = normalized
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    return null;
  }

  return segments.join('/');
};

const sanitizeCoverResourcePath = (resourcePath: string): string => {
  let normalized = resourcePath.replace(/\\/g, '/').trim().replace(/^\.?\//, '');
  if (normalized.startsWith('.card/')) {
    normalized = normalized.slice('.card/'.length);
  }

  const segments = normalized
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    throw new Error(`Invalid cover resource path: ${resourcePath}`);
  }

  const safeSegments = segments
    .map((segment) =>
      segment
        .replace(/[\u0000-\u001f]/g, '')
        .replace(/[<>:"\\|?*]/g, '')
        .trim()
    )
    .filter(Boolean);

  if (safeSegments.length === 0) {
    throw new Error(`Invalid cover resource path: ${resourcePath}`);
  }

  const rootedSegments = safeSegments[0] === 'cardcover' ? safeSegments : ['cardcover', ...safeSegments];
  return rootedSegments.join('/');
};

/** 规范化封面资源写入路径（相对 .card/ 目录，强制 cardcover/ 根）。 */
export const sanitizeCoverResourcePathForWrite = sanitizeCoverResourcePath;

/** 清理封面目录中未被 cover.html 引用的资源，并剪枝空目录。 */
export async function reconcileCoverResources(
  cardDir: string,
  coverHtml: string,
): Promise<void> {
  const coverRoot = path.join(cardDir, '.card', 'cardcover');
  let entries;
  try {
    entries = await fs.readdir(coverRoot, { withFileTypes: true });
  } catch {
    return;
  }

  const referencedPaths = collectCoverResourceReferences(coverHtml);

  const walk = async (dir: string, relativeDir: string): Promise<void> => {
    let children;
    try {
      children = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of children) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        try {
          const remaining = await fs.readdir(absolutePath);
          if (remaining.length === 0) {
            await fs.rmdir(absolutePath);
          }
        } catch {
          // 忽略目录清理失败
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const coverResourcePath = `cardcover/${relativePath}`;
      if (!referencedPaths.has(coverResourcePath)) {
        await fs.rm(absolutePath, { force: true });
      }
    }
  };

  await walk(coverRoot, '');
}

/** 物理写入封面资源到 .card/cardcover/ 并清理旧目录（先删后写）。 */
export async function writeCoverResources(
  cardDir: string,
  resources: Array<{ path: string; data: Uint8Array }>,
): Promise<void> {
  const coverRoot = path.join(cardDir, '.card', 'cardcover');
  await fs.rm(coverRoot, { recursive: true, force: true });

  for (const resource of resources) {
    const normalizedPath = normalizeRelativeResourcePath(resource.path);
    if (!normalizedPath) {
      continue;
    }
    const safePath = sanitizeCoverResourcePath(normalizedPath);
    const absolutePath = path.join(cardDir, '.card', safePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, resource.data);
  }
}
