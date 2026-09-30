/**
 * 卡片文档模型 → 独立 HTML 产物的纯转换核心（块级映射、内联呈现样式、资源引用与布局容器）。
 *
 * - 输入是新生态在册形状（`ICardDocumentModel`，来自 document:open/read 消费面），
 *   不解析 `.card` 包字节（04-能力契约规范 §8.3 约束 4）；
 * - 输出为结构化克隆兼容的字符串与引用清单，复制产物由编排层经 `file:*` 落盘；
 * - 全部插值经过 `escapeHtml` 转义（文本、属性与 URL 路径段），映射结果对同一输入确定。
 */

import type {
  ICardDocumentModel,
  ICardMetadataView,
  ICardResourceEntry,
  ICardToHtmlWarning,
  ICardContentNodeModel,
} from './types.js';
import { encodeRelativeUrlPath, isSafePackageRelativePath } from './paths.js';
import { escapeHtml, escapeHtmlTextBody } from './html-escape.js';

/** 导出入口文件名（输出 schema 枚举的单一事实源）。 */
export const ENTRY_FILE = 'index.html' as const;

/** 导出清单文件名。 */
export const MANIFEST_FILE = 'conversion-manifest.json' as const;

/** 产物内资源目录（包内相对形态，URL 与落盘共用同一事实源）。 */
export const CONTENT_ASSET_DIR = 'assets/content';

/** 嵌套映射最大深度；达到即把该层剩余子树折叠为单行 JSON 文本，防失控递归。 */
export const MAX_RENDER_DEPTH = 6;

/** 块级映射上下文：资源索引 + 引用收集器（单次渲染确定性收集）。 */
export interface IRenderContext {
  readonly resources: ReadonlyMap<string, ICardResourceEntry>;
  readonly includeAssets: boolean;
  readonly references: Set<string>;
}

export interface ICardHtmlBuildResult {
  readonly html: string;
  /** 渲染中命中的资源引用（包内相对路径，去重后按首次命中顺序）。 */
  readonly assetReferences: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const resourceUrl = (resourcePath: string, includeAssets: boolean): string => {
  if (!includeAssets) {
    return resourcePath;
  }
  return `./${CONTENT_ASSET_DIR}/${encodeRelativeUrlPath(resourcePath)}`;
};

/** 依据资源类型把引用渲染为对应资产元素（图片/视频/音频/通用链接）。 */
export function renderAssetElement(
  resource: ICardResourceEntry,
  resourcePath: string,
  includeAssets: boolean
): string {
  const url = escapeHtml(resourceUrl(resourcePath, includeAssets));
  const type = resource.type.toLowerCase();
  if (type.startsWith('image/')) {
    const width =
      typeof resource.width === 'number' && Number.isFinite(resource.width) && resource.width > 0
        ? ` width="${Math.round(resource.width)}"`
        : '';
    const height =
      typeof resource.height === 'number' && Number.isFinite(resource.height) && resource.height > 0
        ? ` height="${Math.round(resource.height)}"`
        : '';
    return `<img class="chips-export-asset" src="${url}" alt="${escapeHtml(resourcePath)}"${width}${height}>`;
  }
  if (type.startsWith('video/')) {
    return `<video class="chips-export-asset" src="${url}" controls></video>`;
  }
  if (type.startsWith('audio/')) {
    return `<audio class="chips-export-asset" src="${url}" controls></audio>`;
  }
  const fileName = resourcePath.split('/').at(-1) ?? resourcePath;
  return `<a class="chips-export-asset-link" href="${url}">${escapeHtml(fileName)}</a>`;
}

/** 单个叶子值的块级渲染。 */
export function renderBlockValue(value: unknown, ctx: IRenderContext, depth: number): string {
  if (depth >= MAX_RENDER_DEPTH) {
    // 达到最大深度即收口：剩余子树折叠为单行 JSON 文本（文本节点体转义，
    // 引号保留字面形），既防失控递归又不产生可执行标记。
    return `<p class="chips-export-text">${escapeHtmlTextBody(JSON.stringify(value) ?? '')}</p>`;
  }
  if (typeof value === 'string') {
    const resource = ctx.resources.get(value);
    if (resource && isSafePackageRelativePath(value)) {
      ctx.references.add(value);
      return renderAssetElement(resource, value, ctx.includeAssets);
    }
    return `<p class="chips-export-text">${renderInlineText(value)}</p>`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `<p class="chips-export-text">${escapeHtml(String(value))}</p>`;
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => renderBlockValue(item, ctx, depth + 1))
      .filter((html) => html.length > 0)
      .map((html) => `<li class="chips-export-list__item">${html}</li>`)
      .join('');
    return items.length > 0 ? `<ul class="chips-export-list">${items}</ul>` : '';
  }
  if (isRecord(value)) {
    const fields = Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== null && fieldValue !== undefined)
      .map(
        ([key, fieldValue]) =>
          `<div class="chips-export-field"><dt class="chips-export-field__key">${escapeHtml(key)}</dt>` +
          `<dd class="chips-export-field__value">${renderBlockValue(fieldValue, ctx, depth + 1)}</dd></div>`
      )
      .join('');
    return fields.length > 0 ? `<dl class="chips-export-fields">${fields}</dl>` : '';
  }
  return '';
}

/** 行内文本：转义后换行转 `<br>`。 */
export function renderInlineText(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

function renderTagListItem(tag: string | readonly string[]): string {
  if (typeof tag === 'string') {
    return `<li class="chips-export-card__tag">${escapeHtml(tag)}</li>`;
  }
  const [key, ...rest] = tag;
  if (key === undefined) {
    return '';
  }
  const label = rest.length > 0 ? `${key}：${rest.join(' / ')}` : key;
  return `<li class="chips-export-card__tag" data-chips-tag-key="${escapeHtml(key)}">${escapeHtml(label)}</li>`;
}

function renderHeader(metadata: ICardMetadataView): string {
  const title = `<h1 class="chips-export-card__title">${escapeHtml(metadata.name)}</h1>`;
  const times =
    metadata.createdAt !== undefined || metadata.modifiedAt !== undefined
      ? `<p class="chips-export-card__meta">` +
        (metadata.createdAt !== undefined
          ? `<time datetime="${escapeHtml(metadata.createdAt)}">${escapeHtml(metadata.createdAt)}</time>`
          : '') +
        (metadata.createdAt !== undefined && metadata.modifiedAt !== undefined ? ' · ' : '') +
        (metadata.modifiedAt !== undefined
          ? `<time datetime="${escapeHtml(metadata.modifiedAt)}">${escapeHtml(metadata.modifiedAt)}</time>`
          : '') +
        `</p>`
      : '';
  const tags =
    metadata.tags.length > 0
      ? `<ul class="chips-export-card__tags">${metadata.tags.map(renderTagListItem).join('')}</ul>`
      : '';
  return `<header class="chips-export-card__header">${title}${times}${tags}</header>`;
}

function renderNode(
  node: ICardContentNodeModel,
  ctx: IRenderContext
): string {
  const body = renderBlockValue(node.value, ctx, 0);
  return (
    `<section class="chips-export-node" data-chips-node-id="${escapeHtml(node.nodeId)}"` +
    ` data-chips-card-type="${escapeHtml(node.cardType)}">` +
    `${body}</section>`
  );
}

/** 导出呈现样式（独立 HTML 产物的自包含样式；非应用 UI 面）。 */
export const EXPORT_PRESENTATION_STYLE = `
body[data-chips-export-presentation="card-html"] {
  margin: 0;
  background: #ffffff;
  color: #111111;
  overflow: auto;
}

.chips-export-stage {
  box-sizing: border-box;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 0;
}

.chips-export-stage__viewport {
  width: min(100%, clamp(640px, 78vw, 1040px));
  min-width: 0;
  min-height: 100vh;
}

.chips-export-stage__content {
  width: 100%;
  min-width: 0;
  min-height: 100vh;
}

.chips-export-card {
  width: 100%;
}

.chips-export-card__tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  margin: 8px 0 0;
}

.chips-export-asset {
  max-width: 100%;
}

.chips-export-fields {
  margin: 0;
}

.chips-export-field__key {
  font-weight: 600;
}
`.trim();

function buildHead(model: ICardDocumentModel): string {
  return (
    `<head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(model.metadata.name)}</title>` +
    `<meta name="generator" content="chips.service.cardtohtml">` +
    `<meta name="chips-card-id" content="${escapeHtml(model.metadata.cardId)}">` +
    `<meta name="chips-document-id" content="${escapeHtml(model.documentId)}">` +
    `<meta name="chips-digest" content="${escapeHtml(model.digest)}">` +
    (model.metadata.theme !== undefined
      ? `<meta name="chips-theme" content="${escapeHtml(model.metadata.theme)}">`
      : '') +
    `<style data-chips-export-shell="card-html">${EXPORT_PRESENTATION_STYLE}</style>` +
    `</head>`
  );
}

/**
 * 组装完整 HTML 产物文档。
 *
 * 结构分层（布局容器面）：`chips-export-stage` 舞台容器 → 视口 → 内容列 →
 * `article.chips-export-card` 卡片容器（头部元数据 + 每结构节点一个 `section.chips-export-node`）。
 */
export function buildCardHtml(
  model: ICardDocumentModel,
  options: { readonly includeAssets: boolean }
): ICardHtmlBuildResult {
  const references: Set<string> = new Set();
  const ctx: IRenderContext = {
    resources: new Map(model.resources.map((resource) => [resource.path, resource])),
    includeAssets: options.includeAssets,
    references,
  };

  const nodes = model.nodes.map((node) => renderNode(node, ctx)).join('');
  const html =
    `<!doctype html>` +
    `<html lang="zh-CN">` +
    buildHead(model) +
    `<body data-chips-export-presentation="card-html">` +
    `<div class="chips-export-stage"><div class="chips-export-stage__viewport">` +
    `<div class="chips-export-stage__content">` +
    `<article class="chips-export-card" data-chips-card-id="${escapeHtml(model.metadata.cardId)}">` +
    renderHeader(model.metadata) +
    nodes +
    `</article>` +
    `</div></div></div>` +
    `</body>` +
    `</html>`;

  return { html, assetReferences: [...references] };
}

/** 组装 conversion-manifest.json 内容（写盘前的对象形态）。 */
export function buildConversionManifest(input: {
  readonly documentId: string;
  readonly source: string;
  readonly model: ICardDocumentModel;
  readonly packageMode: 'directory';
  readonly includeAssets: boolean;
  readonly assetCount: number;
  readonly warnings: readonly ICardToHtmlWarning[];
}): Record<string, unknown> {
  const { documentId, source, model, includeAssets, assetCount, warnings } = input;
  return {
    schemaVersion: '1.0.0',
    type: 'card-to-html',
    generatedAt: new Date().toISOString(),
    source: {
      documentId,
      cardId: model.metadata.cardId,
      title: model.metadata.name,
      digest: model.digest,
      reference: source,
    },
    output: {
      packageMode: 'directory',
      entryFile: ENTRY_FILE,
      manifestFile: MANIFEST_FILE,
    },
    assets: {
      included: includeAssets,
      root: includeAssets ? CONTENT_ASSET_DIR : null,
      count: assetCount,
    },
    diagnostics: {
      nodes: model.nodes.map((node) => ({
        nodeId: node.nodeId,
        cardType: node.cardType,
        diagnostics: node.diagnostics,
      })),
    },
    warnings,
  };
}
