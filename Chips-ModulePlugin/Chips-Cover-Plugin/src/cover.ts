/**
 * 封面能力实现（chips.module.cover）
 *
 * 语义来源：Chips-EditingEngine `src/utils/card-cover.ts` 与 `src/core/card-service.ts`
 * （task034 M5 上移）。与 Host 内置兜底实现（packages/card-service/src/session/default-cover.ts、
 * session/cover-reconcile.ts、session/document-codec.ts）保持同语义。
 */

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const DEFAULT_COVER_RATIO = '3:4';

/** 生成默认封面 HTML（白底 + 居中卡片名称）。 */
export function createDefaultCoverHtml(input: { name: string }): string {
  const safeCardName = escapeHtml(input.name);
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <style>',
    '    html, body { margin: 0; width: 100%; height: 100%; }',
    '    body {',
    '      display: grid;',
    '      place-items: center;',
    '      background: #ffffff;',
    '      color: #1d1d1f;',
    '      font: 600 24px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '      text-align: center;',
    '      padding: 24px;',
    '      box-sizing: border-box;',
    '      overflow: hidden;',
    '    }',
    '    @media (orientation: landscape) {',
    '      body { font-size: 20px; }',
    '    }',
    '  </style>',
    '</head>',
    `  <body>${safeCardName}</body>`,
    '</html>',
  ].join('\n');
}

/** 生成图片封面 HTML（object-fit: cover + 图片来源标记）。 */
export function createImageHtml(input: { imageSrc: string }): string {
  const safeImageSrc = escapeHtml(input.imageSrc);
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <style>',
    '    html, body { margin: 0; width: 100%; height: 100%; background: #000; }',
    '    body {',
    '      overflow: hidden;',
    '    }',
    '    img {',
    '      width: 100%;',
    '      height: 100%;',
    '      object-fit: cover;',
    '      display: block;',
    '    }',
    '  </style>',
    '</head>',
    `  <body data-chips-cover-mode="image" data-chips-cover-image-source="${safeImageSrc}">`,
    `    <img src="${safeImageSrc}" alt="" />`,
    '  </body>',
    '</html>',
  ].join('\n');
}

/** 规范化封面比例：容忍 / 与 : 混写，解析任意数值比例，非法回退默认 3:4。 */
export function normalizeRatio(input: { value?: unknown }): string {
  const value = input.value;
  if (typeof value !== 'string') {
    return DEFAULT_COVER_RATIO;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_COVER_RATIO;
  }

  const normalized = trimmed.replace('/', ':');
  const parts = normalized.split(':').map((part) => part.trim());
  if (parts.length !== 2) {
    return DEFAULT_COVER_RATIO;
  }

  const [width, height] = parts;
  const widthValue = Number(width);
  const heightValue = Number(height);
  if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
    return DEFAULT_COVER_RATIO;
  }

  return `${width}:${height}`;
}

/** 校验封面比例是否合法（可解析为数值比例）。 */
export function validateRatio(input: { value?: unknown }): { valid: boolean; normalized?: string } {
  const normalized = normalizeRatio(input);
  if (input.value === undefined || input.value === null || String(input.value).trim() === '') {
    return { valid: false };
  }
  const trimmed = String(input.value).trim().replace('/', ':');
  return {
    valid: trimmed === normalized,
    ...(trimmed === normalized ? { normalized } : {}),
  };
}

/** 收集 cover.html 中被引用的 .card/cardcover/ 相对资源路径。 */
export function collectReferences(input: { html: string }): string[] {
  const references = new Set<string>();
  const attributePattern = /\b(?:src|href|poster|data-chips-cover-image-source)\s*=\s*["']([^"']+)["']/gi;
  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

  for (const pattern of [attributePattern, urlPattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input.html)) !== null) {
      const normalizedPath = normalizeCoverReferencePath(match[1] ?? '');
      if (normalizedPath) {
        references.add(normalizedPath);
      }
    }
  }

  return [...references];
}

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
