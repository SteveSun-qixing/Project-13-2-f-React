/**
 * 富文本基础卡片（base.richtext）文件构建与解析
 *
 * 严格遵循《生态共用技术文档/文件格式规范/01-卡片文件格式规范.md》：
 * - metadata.yaml：chip_standards_version / card_id / name / created_at / modified_at（必填），
 *   cover_ratio / tags 等可选字段；不写入规范之外的字段。
 * - structure.yaml：structure 数组（id / type）+ manifest（card_count / resource_count / resources）。
 * - content/<baseCardId>.yaml：base.richtext 配置，markdown_capabilities 7 项全部显式写入。
 * - 内联与文件两种存储模式互斥：纯文本字符数 ≤ 200 写 content_text；
 *   > 200 写入卡片根目录 .md 资源文件并用 content_file 引用。
 * - cover.html：标准 HTML 文档，内联样式，居中布局。
 */

import YAML from 'yaml';
import type { MarkdownCapabilities, NoteDocument, RichTextNoteConfig } from '../types';
import {
  CHIP_STANDARDS_VERSION,
  CONTENT_LOCALE,
  DEFAULT_COVER_RATIO,
  MARKDOWN_MIME_TYPE,
  MAX_INLINE_RICHTEXT_LENGTH,
  RICHTEXT_CARD_TYPE,
  RICHTEXT_CONTENT_FORMAT,
  RICHTEXT_RESOURCE_DIR,
} from '../lib/constants';
import { countPlainTextLength, normalizeMarkdown } from '../lib/markdown-text';

/**
 * 默认能力声明：本应用渲染 CommonMark + GFM，不渲染数学公式、
 * 代码高亮、下划线、上下标，因此对应能力声明为 false
 */
export const DEFAULT_MARKDOWN_CAPABILITIES: MarkdownCapabilities = {
  commonmark: true,
  gfm: true,
  math: false,
  highlight: false,
  underline: false,
  superscript: false,
  subscript: false,
};

/**
 * 是否应该使用文件存储（纯文本字符数超过内联阈值）
 */
export function shouldUseFileStorage(markdown: string): boolean {
  return countPlainTextLength(markdown) > MAX_INLINE_RICHTEXT_LENGTH;
}

/**
 * 计算 Markdown 的 UTF-8 字节数
 */
export function countMarkdownBytes(markdown: string): number {
  return new TextEncoder().encode(normalizeMarkdown(markdown)).length;
}

/**
 * 构造 file 存储模式的资源路径（卡片根目录相对路径）
 */
export function buildMarkdownResourcePath(baseCardId: string): string {
  return `${RICHTEXT_RESOURCE_DIR}/${baseCardId}.md`;
}

/**
 * 构建 base.richtext 基础卡片配置
 * 根据 Markdown 纯文本长度自动选择 inline / file 存储模式
 */
export function buildRichTextNoteConfig(markdown: string, baseCardId: string): RichTextNoteConfig {
  const normalized = normalizeMarkdown(markdown);

  if (shouldUseFileStorage(normalized)) {
    return {
      card_type: RICHTEXT_CARD_TYPE,
      theme: '',
      locale: CONTENT_LOCALE,
      content_format: RICHTEXT_CONTENT_FORMAT,
      content_source: 'file',
      content_file: buildMarkdownResourcePath(baseCardId),
      markdown_capabilities: { ...DEFAULT_MARKDOWN_CAPABILITIES },
    };
  }

  return {
    card_type: RICHTEXT_CARD_TYPE,
    theme: '',
    locale: CONTENT_LOCALE,
    content_format: RICHTEXT_CONTENT_FORMAT,
    content_source: 'inline',
    content_text: normalized,
    markdown_capabilities: { ...DEFAULT_MARKDOWN_CAPABILITIES },
  };
}

/**
 * 复合卡片文件集合（解包态目录内的全部正式文件）
 */
export interface RichTextCardFiles {
  metadataYaml: string;
  structureYaml: string;
  coverHtml: string;
  contentYaml: string;
  /** content_source=file 时需要额外写入的 .md 资源（路径相对卡片根目录） */
  markdownResource?: {
    path: string;
    content: string;
  };
}

export interface BuildRichTextCardFilesInput {
  cardId: string;
  baseCardId: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  markdown: string;
}

/**
 * 构建富文本复合卡片的全部文件内容
 */
export function buildRichTextCardFiles(input: BuildRichTextCardFilesInput): RichTextCardFiles {
  const config = buildRichTextNoteConfig(input.markdown, input.baseCardId);

  const metadata = {
    chip_standards_version: CHIP_STANDARDS_VERSION,
    card_id: input.cardId,
    name: input.title,
    created_at: input.createdAt,
    modified_at: input.modifiedAt,
    cover_ratio: DEFAULT_COVER_RATIO,
    tags: [],
  };

  const isFileMode = config.content_source === 'file';
  const markdownResource = isFileMode
    ? {
        path: buildMarkdownResourcePath(input.baseCardId),
        content: normalizeMarkdown(input.markdown),
      }
    : undefined;

  const structure = {
    structure: [
      {
        id: input.baseCardId,
        type: RICHTEXT_CARD_TYPE,
        created_at: input.createdAt,
        modified_at: input.modifiedAt,
      },
    ],
    manifest: {
      card_count: 1,
      resource_count: markdownResource ? 1 : 0,
      resources: markdownResource
        ? [
            {
              path: markdownResource.path,
              size: countMarkdownBytes(markdownResource.content),
              type: MARKDOWN_MIME_TYPE,
            },
          ]
        : [],
    },
  };

  return {
    metadataYaml: YAML.stringify(metadata),
    structureYaml: YAML.stringify(structure),
    coverHtml: buildDefaultCoverHtml(input.title),
    contentYaml: YAML.stringify(config),
    markdownResource,
  };
}

/**
 * 解析富文本复合卡片文件
 * 同时兼容读取历史别名 RichTextCard（仅读取归一，不作为新写入值）
 */
export function parseRichTextCardFiles(input: {
  metadataYaml: string;
  structureYaml: string;
  contentYaml: string;
  markdownResourceContent?: string;
}): NoteDocument {
  const metadata = (YAML.parse(input.metadataYaml) ?? {}) as Record<string, unknown>;
  const structure = (YAML.parse(input.structureYaml) ?? {}) as {
    structure?: Array<{ id?: unknown; type?: unknown }>;
  };
  const config = (YAML.parse(input.contentYaml) ?? {}) as Record<string, unknown>;

  const baseCardId = String(structure.structure?.[0]?.id ?? '');
  if (!baseCardId) {
    throw new Error('卡片 structure.yaml 缺少基础卡片 ID');
  }

  const contentSource = config.content_source === 'file' ? 'file' : 'inline';
  let markdown = '';
  if (contentSource === 'inline') {
    markdown = typeof config.content_text === 'string' ? config.content_text : '';
  } else {
    markdown = input.markdownResourceContent ?? '';
  }

  return {
    cardId: String(metadata.card_id ?? ''),
    baseCardId,
    title: String(metadata.name ?? ''),
    createdAt: String(metadata.created_at ?? ''),
    modifiedAt: String(metadata.modified_at ?? ''),
    coverRatio: String(metadata.cover_ratio ?? DEFAULT_COVER_RATIO),
    config: {
      card_type: RICHTEXT_CARD_TYPE,
      theme: String(config.theme ?? ''),
      locale: String(config.locale ?? CONTENT_LOCALE),
      content_format: RICHTEXT_CONTENT_FORMAT,
      content_source: contentSource,
      content_text: contentSource === 'inline' ? markdown : undefined,
      content_file: contentSource === 'file' ? String(config.content_file ?? '') : undefined,
      markdown_capabilities: parseMarkdownCapabilities(config.markdown_capabilities),
    },
    markdown,
  };
}

/**
 * 解析能力声明：缺失项按 false 处理（读取归一）
 */
function parseMarkdownCapabilities(value: unknown): MarkdownCapabilities {
  const record = (value ?? {}) as Record<string, unknown>;
  const defaults = DEFAULT_MARKDOWN_CAPABILITIES;
  return {
    commonmark: record.commonmark === undefined ? defaults.commonmark : record.commonmark === true,
    gfm: record.gfm === undefined ? defaults.gfm : record.gfm === true,
    math: record.math === undefined ? defaults.math : record.math === true,
    highlight: record.highlight === undefined ? defaults.highlight : record.highlight === true,
    underline: record.underline === undefined ? defaults.underline : record.underline === true,
    superscript: record.superscript === undefined ? defaults.superscript : record.superscript === true,
    subscript: record.subscript === undefined ? defaults.subscript : record.subscript === true,
  };
}

/**
 * 生成默认封面 HTML（渐变背景 + 居中标题）
 */
export function buildDefaultCoverHtml(title: string): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
    '      background: linear-gradient(135deg, #4a90e2 0%, #7b5ce0 100%);',
    '      color: #ffffff;',
    '      font: 600 24px/1.35 "PingFang SC", "Noto Sans CJK SC", sans-serif;',
    '      text-align: center;',
    '      padding: 24px;',
    '      box-sizing: border-box;',
    '      overflow: hidden;',
    '    }',
    '  </style>',
    '</head>',
    `  <body>${safeTitle}</body>`,
    '</html>',
  ].join('\n');
}
