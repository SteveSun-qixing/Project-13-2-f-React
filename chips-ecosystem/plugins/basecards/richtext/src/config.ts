/**
 * 富文本卡片配置模型（旧 `richtext-BCP/src/schema/card-config.ts` 迁移重构）。
 *
 * 两层模型（01-卡片文件格式 §6.6、04-基础卡片插件开发指南 §六）：
 * - **内容字段**（content 根）：`card_type` / `content_format` / `content_source` /
 *   `content_text` / `content_file` / `locale` / `markdown_capabilities`——Markdown
 *   唯一持久化口径，字段级约束与 01.12 §6.6 Schema 同一判定；
 * - **展示配置**（`config` 字段）：`fontSize` / `lineHeight`——与
 *   `assets/schemas/richtext-config.schema.json` 同一口径（08 §7.3：validateConfig
 *   不得比 schema 宽松）。
 *
 * 迁移差异：旧 `LEGACY_RICHTEXT_CARD_TYPE` 兼容面不迁移（零兼容裁决）；
 * 旧 `createFileBasecardConfig` / `createInlineBasecardConfig` 的装配面并入
 * `buildContent`；展示 `config` 字段按 04 §9.3/§9.5 契约形制并入内容根。
 */

import {
  MARKDOWN_CONTENT_FORMAT,
  countPlainTextLengthFromMarkdown,
  hasMeaningfulMarkdownContent,
  normalizeContentFilePath,
  normalizeMarkdown,
  shouldUseFileStorage,
} from './markdown/content';
import { isNonEmptyString, isMarkdownFilePath } from './markdown/resource-links';

/** 卡片类型正式 ID（与 manifest `capabilities.cardTypes[0].id`、09 目录登记一致）。 */
export const CARD_TYPE_ID = 'base.richtext';

/** Markdown 内容来源：内联（≤200 字）或文件化（卡片根目录相对 `.md`）。 */
export type RichTextContentSource = 'inline' | 'file';

/** Markdown 能力矩阵（01.12 §6.6：必须显式声明，默认全部为 true）。 */
export interface IRichTextMarkdownCapabilities {
  commonmark: boolean;
  gfm: boolean;
  math: boolean;
  highlight: boolean;
  underline: boolean;
  superscript: boolean;
  subscript: boolean;
}

/** 富文本卡片内容字段（content 根；与 01.12 §6.6 字段级约束同口径）。 */
export interface IRichTextContent {
  card_type: typeof CARD_TYPE_ID;
  content_format: typeof MARKDOWN_CONTENT_FORMAT;
  content_source: RichTextContentSource;
  content_text?: string;
  content_file?: string;
  locale: string;
  markdown_capabilities: IRichTextMarkdownCapabilities;
}

/** 展示配置（`config` 字段；与 assets/schemas/richtext-config.schema.json 同口径）。 */
export interface IRichTextDisplayConfig {
  fontSize: number;
  lineHeight: number;
}

/** 展示配置默认值（04 §9.5）。 */
export const DEFAULT_DISPLAY_CONFIG: IRichTextDisplayConfig = { fontSize: 16, lineHeight: 1.6 };
/** 字号下限（px）。 */
export const MIN_FONT_SIZE = 12;
/** 字号上限（px）。 */
export const MAX_FONT_SIZE = 48;
/** 行高倍数下限。 */
export const MIN_LINE_HEIGHT = 1;

/** 默认能力矩阵：全部开启（01.12 §6.6「默认全部为 true」）。 */
export const DEFAULT_CAPABILITIES: IRichTextMarkdownCapabilities = {
  commonmark: true,
  gfm: true,
  math: true,
  highlight: true,
  underline: true,
  superscript: true,
  subscript: true,
};

/** 默认内容语言。 */
export const DEFAULT_LOCALE = 'zh-CN';

// ---------- 归一（读取任意输入回退默认值，08 §7.1 规则 2） ----------

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function inferContentSource(record: Readonly<Record<string, unknown>>): RichTextContentSource {
  const rawSource = asString(record['content_source']);
  if (rawSource === 'file') {
    return 'file';
  }
  if (rawSource === 'inline') {
    return 'inline';
  }
  if (isNonEmptyString(record['content_file'])) {
    return 'file';
  }
  return 'inline';
}

function normalizeCapabilities(input: unknown): IRichTextMarkdownCapabilities {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const normalized = {} as IRichTextMarkdownCapabilities;
  for (const key of Object.keys(DEFAULT_CAPABILITIES) as readonly (keyof IRichTextMarkdownCapabilities)[]) {
    normalized[key] = record[key] === false ? false : DEFAULT_CAPABILITIES[key];
  }
  return normalized;
}

/**
 * 归一任意输入为完整内容字段：缺失或非法字段回退默认值（旧 `normalizeBasecardConfig`
 * 语义迁移；兼容读取旧 `markdown` 字段别名的口径由 content_text 缺省回退承载后收口，
 * 正式写入值只有 `content_text`）。
 */
export function readContent(input: unknown): IRichTextContent {
  const record = (typeof input === 'object' && input !== null ? input : {}) as Readonly<
    Record<string, unknown>
  >;
  const contentSource = inferContentSource(record);
  const locale = asString(record['locale']) ?? DEFAULT_LOCALE;
  const markdownCapabilities = normalizeCapabilities(record['markdown_capabilities']);

  if (contentSource === 'file') {
    return {
      card_type: CARD_TYPE_ID,
      content_format: MARKDOWN_CONTENT_FORMAT,
      content_source: 'file',
      content_file: normalizeContentFilePath(asString(record['content_file']) ?? ''),
      locale,
      markdown_capabilities: markdownCapabilities,
    };
  }

  const rawText = record['content_text'];
  const contentText = normalizeMarkdown(
    typeof rawText === 'string'
      ? rawText
      : typeof record['markdown'] === 'string'
        ? record['markdown']
        : ''
  );

  return {
    card_type: CARD_TYPE_ID,
    content_format: MARKDOWN_CONTENT_FORMAT,
    content_source: 'inline',
    content_text: contentText,
    locale,
    markdown_capabilities: markdownCapabilities,
  };
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * 读取展示配置并回退默认值；越界值同样回退（04 §9.5 readConfig 同型）。
 */
export function readDisplayConfig(input: unknown): IRichTextDisplayConfig {
  const record =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const raw = typeof record['config'] === 'object' && record['config'] !== null
    ? (record['config'] as Record<string, unknown>)
    : {};
  const fontSize = toFiniteNumber(raw['fontSize']);
  const lineHeight = toFiniteNumber(raw['lineHeight']);
  return {
    fontSize:
      fontSize !== undefined && Number.isInteger(fontSize) && fontSize >= MIN_FONT_SIZE && fontSize <= MAX_FONT_SIZE
        ? fontSize
        : DEFAULT_DISPLAY_CONFIG.fontSize,
    lineHeight: lineHeight !== undefined && lineHeight >= MIN_LINE_HEIGHT
      ? lineHeight
      : DEFAULT_DISPLAY_CONFIG.lineHeight,
  };
}

// ---------- 校验 ----------

/**
 * 校验展示配置（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供，必须返回 `true`；
 * 判定与 `assets/schemas/richtext-config.schema.json` 同口径（出现即校验，缺席回退默认值）。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;
  const fontSize = record['fontSize'];
  if (fontSize !== undefined) {
    if (typeof fontSize !== 'number' || !Number.isInteger(fontSize)) {
      return false;
    }
    if (fontSize < MIN_FONT_SIZE || fontSize > MAX_FONT_SIZE) {
      return false;
    }
  }
  const lineHeight = record['lineHeight'];
  if (lineHeight !== undefined) {
    if (typeof lineHeight !== 'number' || !Number.isFinite(lineHeight)) {
      return false;
    }
    if (lineHeight < MIN_LINE_HEIGHT) {
      return false;
    }
  }
  return true;
}

/** 内容字段校验结果（旧 `ConfigValidationResult` 迁移；错误文案简体中文直写）。 */
export interface IContentValidationResult {
  valid: boolean;
  errors: Readonly<Record<string, string>>;
}

/**
 * 校验内容字段（旧 `validateBasecardConfig` 迁移重构）：inline/file 互斥、
 * 来源形态、能力矩阵显式声明与 01.12 §6.6 同口径。
 */
export function validateRichTextContent(content: unknown): IContentValidationResult {
  const errors: Record<string, string> = {};
  const resolved = readContent(content);

  if (resolved.card_type !== CARD_TYPE_ID) {
    errors['card_type'] = `card_type 必须为 ${String(CARD_TYPE_ID)}`;
  }
  if (resolved.content_format !== MARKDOWN_CONTENT_FORMAT) {
    errors['content_format'] = 'content_format 必须为 markdown';
  }
  if (!isNonEmptyString(resolved.locale)) {
    errors['locale'] = 'locale 不能为空';
  }

  if (resolved.content_source === 'inline') {
    if (!hasMeaningfulMarkdownContent(resolved.content_text ?? '')) {
      errors['content_text'] = 'Markdown 内容不能为空';
    }
  } else if (!isMarkdownFilePath(resolved.content_file)) {
    errors['content_file'] = 'content_file 必须为卡片根目录相对 .md 路径';
  }

  const capabilities = resolved.markdown_capabilities;
  if (
    !capabilities ||
    capabilities.commonmark !== true ||
    capabilities.gfm !== true ||
    capabilities.math !== true ||
    capabilities.highlight !== true ||
    capabilities.underline !== true ||
    capabilities.superscript !== true ||
    capabilities.subscript !== true
  ) {
    errors['markdown_capabilities'] = 'markdown_capabilities 必须显式声明当前富文本 Markdown 能力矩阵';
  }

  const record = (typeof content === 'object' && content !== null ? content : {}) as Readonly<
    Record<string, unknown>
  >;
  if (resolved.content_source === 'inline' && isNonEmptyString(record['content_file'])) {
    errors['content_source'] = 'inline 模式下不能同时保存 content_file';
  }
  if (resolved.content_source === 'file' && isNonEmptyString(record['content_text'])) {
    errors['content_source'] = 'file 模式下不能同时保存 content_text';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------- 内容组装 ----------

/**
 * 由内容字段与展示配置组装节点内容（`createInitialContent` 与编辑器 replace 变更共用）。
 *
 * 归一先于组装：正文经 `normalizeMarkdown`，资源路径经 `normalizeResourcePath`；
 * 展示配置原样并入 `config` 字段。
 */
export function buildContent(
  content: Partial<IRichTextContent>,
  displayConfig?: IRichTextDisplayConfig
): Record<string, unknown> {
  const resolved = readContent({
    ...content,
    markdown_capabilities: content.markdown_capabilities ?? DEFAULT_CAPABILITIES,
  });
  const built: Record<string, unknown> = {
    card_type: resolved.card_type,
    content_format: resolved.content_format,
    content_source: resolved.content_source,
    locale: resolved.locale,
    markdown_capabilities: { ...resolved.markdown_capabilities },
    config: { ...(displayConfig ?? DEFAULT_DISPLAY_CONFIG) },
  };
  if (resolved.content_source === 'file') {
    built['content_file'] = resolved.content_file ?? '';
  } else {
    built['content_text'] = resolved.content_text ?? '';
  }
  return built;
}

/** 内联正文的提取纯文本字数与存储闸判定（编辑器字数提示唯一口径）。 */
export function inlineStorageGate(contentText: string): { length: number; shouldUseFile: boolean } {
  const length = countPlainTextLengthFromMarkdown(contentText);
  return { length, shouldUseFile: shouldUseFileStorage(length) };
}
