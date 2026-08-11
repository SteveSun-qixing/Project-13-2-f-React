/**
 * URL 替换模块
 * 将卡片内部引用的资源相对路径替换为对应的 CDN URL
 */
import * as path from 'path';

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

function normalizeCardPath(value: string): string {
  return path.posix.normalize(normalizeSlashes(value)).replace(/^\.\/+/, '');
}

function isExternalReference(value: string): boolean {
  return /^(?:[a-z][a-z0-9+\-.]*:|\/\/|#)/i.test(value);
}

function splitReferenceSuffix(value: string): { path: string; suffix: string } {
  const match = /[?#]/.exec(value);
  if (!match || match.index < 0) {
    return { path: value, suffix: '' };
  }

  return {
    path: value.slice(0, match.index),
    suffix: value.slice(match.index),
  };
}

function buildCandidatePaths(referencePath: string, sourceFilePath: string): string[] {
  if (!referencePath.trim()) {
    return [];
  }

  const normalizedReferencePath = normalizeSlashes(referencePath.trim());
  if (isExternalReference(normalizedReferencePath)) {
    return [];
  }

  const candidates: string[] = [];
  const normalizedAsRoot = normalizeCardPath(normalizedReferencePath.replace(/^\/+/, ''));
  if (normalizedAsRoot && !normalizedAsRoot.startsWith('../')) {
    candidates.push(normalizedAsRoot);
  }

  if (!normalizedReferencePath.startsWith('/')) {
    const sourceDir = path.posix.dirname(normalizeCardPath(sourceFilePath));
    const relativeToSource = normalizeCardPath(path.posix.join(sourceDir, normalizedReferencePath));
    if (relativeToSource && !relativeToSource.startsWith('../')) {
      candidates.push(relativeToSource);
    }
  }

  return [...new Set(candidates)];
}

function resolveReferenceUrl(
  rawReference: string,
  urlMap: Map<string, string>,
  sourceFilePath: string,
): string | undefined {
  const { path: referencePath, suffix } = splitReferenceSuffix(rawReference);
  for (const candidatePath of buildCandidatePaths(referencePath, sourceFilePath)) {
    const cdnUrl = urlMap.get(candidatePath);
    if (cdnUrl) {
      return `${cdnUrl}${suffix}`;
    }
  }

  return undefined;
}

/**
 * 深度遍历对象，对所有字符串值检查是否为卡片内部资源引用，若是则替换
 */
function replaceInValue(
  value: unknown,
  urlMap: Map<string, string>,
  sourceFilePath: string,
): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const source = record.source;
    const rawFilePath = typeof record.file_path === 'string' ? record.file_path : undefined;
    const cdnUrl = rawFilePath ? resolveReferenceUrl(rawFilePath, urlMap, sourceFilePath) : undefined;

    if (source === 'file' && cdnUrl) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(record)) {
        if (key === 'source') {
          result[key] = 'url';
          continue;
        }
        if (key === 'file_path') {
          continue;
        }
        result[key] = replaceInValue(val, urlMap, sourceFilePath);
      }
      result.url = cdnUrl;
      return result;
    }
  }

  if (typeof value === 'string') {
    const cdnUrl = resolveReferenceUrl(value, urlMap, sourceFilePath);
    return cdnUrl ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceInValue(item, urlMap, sourceFilePath));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = replaceInValue(val, urlMap, sourceFilePath);
    }
    return result;
  }

  return value;
}

/**
 * 对整个 contentMap 执行 URL 替换，返回替换后的新 Map
 * 原 contentMap 不被修改（返回深拷贝后的替换版本）
 */
export function replaceContentUrls(
  contentMap: Map<string, Record<string, unknown>>,
  urlMap: Map<string, string>,
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();

  for (const [id, content] of contentMap) {
    result.set(
      id,
      replaceInValue(content, urlMap, `content/${id}.yaml`) as Record<string, unknown>,
    );
  }

  return result;
}

/**
 * 替换 cover.html 中的资源路径引用
 */
export function replaceCoverHtmlUrls(coverHtml: string, urlMap: Map<string, string>): string {
  let result = coverHtml;

  result = result.replace(/=([\"'])([^\"']+)\1/g, (match, quote: string, value: string) => {
    const resolved = resolveReferenceUrl(value, urlMap, '.card/cover.html');
    return resolved ? `=${quote}${resolved}${quote}` : match;
  });

  result = result.replace(/url\(([\"']?)([^)"']+)\1\)/g, (match, quote: string, value: string) => {
    const resolved = resolveReferenceUrl(value, urlMap, '.card/cover.html');
    return resolved ? `url(${quote}${resolved}${quote})` : match;
  });

  return result;
}
