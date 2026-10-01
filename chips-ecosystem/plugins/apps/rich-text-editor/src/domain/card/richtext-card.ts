/**
 * base.richtext 内容配置模型（《01-卡片文件格式》§6.1 通用字段、§6.6 富文本卡片）。
 *
 * G-5 对照（旧仓 `src/lib/richtext-card.ts:157` 迁移适配，矩阵裁决「迁移」）：
 * - 旧 `LEGACY_RICHTEXT_CARD_TYPE`（`RichTextCard`）别名不迁移：零兼容宪法
 *   （AGENTS.md「无第一版发布、零兼容」）与 ADR-010「不留旧 ID 别名」优先，
 *   正式类型只有 `base.richtext`（§6.6 `card_type` const）；
 * - 旧 `normalizeBasecardConfig` 消费的 `markdown` 字段别名与「有 `content_file`
 *   即判 file 来源」推断不迁移：`content_source` 是 §6.6 必填枚举字段，
 *   非法取值由文档校验闸（card-document）如实报告，读取面不做猜测；
 * - 能力矩阵七项与 §6.6 Schema 同名同判：必须显式写入，缺省语义全部为 `true`；
 * - `theme` 为 §6.1 保留字段，装配面写空字符串；`locale` 缺省 `zh-CN`（§6.6 示例）。
 */

import { normalizeRelativeResourcePath } from './path';

/** 内容格式正式值：富文本基础卡片只保存 Markdown（§6.6 `content_format` const）。 */
export const MARKDOWN_CONTENT_FORMAT = 'markdown' as const;

/** 内容语言缺省值（§6.6 示例口径）。 */
export const DEFAULT_RICHTEXT_LOCALE = 'zh-CN' as const;

/** 富文本基础卡片正式类型标识（§6.6 `card_type` const）。 */
export const RICHTEXT_CARD_TYPE = 'base.richtext' as const;

/** Markdown 内容来源（§6.6 `content_source` 枚举：内联或文件化，二者互斥）。 */
export type RichTextContentSource = 'inline' | 'file';

/** 富文本 Markdown 能力矩阵（§6.6：必须显式声明，默认全部为 `true`）。 */
export interface RichTextMarkdownCapabilities {
  commonmark: boolean;
  gfm: boolean;
  math: boolean;
  highlight: boolean;
  underline: boolean;
  superscript: boolean;
  subscript: boolean;
}

/** 富文本基础卡片内容配置（content/*.yaml 根；字段面与 §6.6 Schema 一致）。 */
export interface RichTextBaseCardConfig {
  card_type: typeof RICHTEXT_CARD_TYPE;
  theme?: string | undefined;
  locale?: string | undefined;
  content_format: typeof MARKDOWN_CONTENT_FORMAT;
  content_source: RichTextContentSource;
  content_text?: string | undefined;
  content_file?: string | undefined;
  markdown_capabilities: RichTextMarkdownCapabilities;
}

/** 能力矩阵声明顺序（校验闸逐项点名用，§6.6 required 顺序）。 */
const MARKDOWN_CAPABILITY_KEYS = [
  'commonmark',
  'gfm',
  'math',
  'highlight',
  'underline',
  'superscript',
  'subscript',
] as const satisfies readonly (keyof RichTextMarkdownCapabilities)[];

/** 能力矩阵缺省值（§6.6：默认全部为 `true`）。 */
export const DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES: RichTextMarkdownCapabilities = {
  commonmark: true,
  gfm: true,
  math: true,
  highlight: true,
  underline: true,
  superscript: true,
  subscript: true,
};

/**
 * Markdown 正文中的包内相对资源引用：Markdown 链接 / 图片与内联 `<img src>`、`<a href>`
 * （含可选标题）。协议化与绝对路径由路径文法过滤，不进入清单。
 */
const MARKDOWN_RESOURCE_PATTERN =
  /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)|<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>|<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

/** 归一 Markdown 换行：CRLF / CR 统一为 LF（§9.4 正斜杠同源的跨平台口径）。 */
function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** 读取字符串字段：非字符串返回 `undefined`，字符串去首尾空白。 */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

/** 归一能力矩阵：仅显式 `false` 关闭，缺失与非布尔取缺省 `true`。 */
function normalizeCapabilities(input: unknown): RichTextMarkdownCapabilities {
  const record =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const resolved = { ...DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES };
  for (const key of MARKDOWN_CAPABILITY_KEYS) {
    if (record[key] === false) {
      resolved[key] = false;
    }
  }
  return resolved;
}

/** 创建内联来源配置（§6.6：短内容写 `content_text`；换行归一为 LF）。 */
export function createInlineBasecardConfig(
  markdown: string,
  locale: string = DEFAULT_RICHTEXT_LOCALE,
  theme = ''
): RichTextBaseCardConfig {
  return {
    card_type: RICHTEXT_CARD_TYPE,
    theme,
    locale,
    content_format: MARKDOWN_CONTENT_FORMAT,
    content_source: 'inline',
    content_text: normalizeMarkdown(markdown),
    markdown_capabilities: { ...DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES },
  };
}

/** 创建文件化来源配置（§6.6：卡片根相对 `.md` 路径；路径非法置空交校验闸报告）。 */
export function createFileBasecardConfig(
  resourcePath: string,
  locale: string = DEFAULT_RICHTEXT_LOCALE,
  theme = ''
): RichTextBaseCardConfig {
  return {
    card_type: RICHTEXT_CARD_TYPE,
    theme,
    locale,
    content_format: MARKDOWN_CONTENT_FORMAT,
    content_source: 'file',
    content_file: normalizeRelativeResourcePath(resourcePath) ?? '',
    markdown_capabilities: { ...DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES },
  };
}

/** 创建新文档的初始配置：以标题生成有语义的内联正文。 */
export function createInitialBasecardConfig(
  title: string,
  locale: string = DEFAULT_RICHTEXT_LOCALE
): RichTextBaseCardConfig {
  return createInlineBasecardConfig(`# ${title}\n\n`, locale, '');
}

/**
 * 收集配置引用的卡片根相对资源路径（结构清单对照源，§5.3）：
 * - `file` 来源：`content_file` 本身（仅 `.md`）；
 * - `inline` 来源：扫描正文中的链接 / 图片 / 内联 HTML 相对引用。
 *
 * 返回去重且按字典序稳定排序。
 */
export function collectRichTextResourcePaths(config: RichTextBaseCardConfig): string[] {
  const paths: string[] = [];

  if (config.content_source === 'file') {
    const resourcePath = normalizeRelativeResourcePath(config.content_file);
    if (resourcePath && resourcePath.toLowerCase().endsWith('.md')) {
      paths.push(resourcePath);
    }
  } else {
    const markdown = config.content_text ?? '';
    for (const match of markdown.matchAll(MARKDOWN_RESOURCE_PATTERN)) {
      const rawPath = match[1] ?? match[2] ?? match[3] ?? '';
      const resourcePath = normalizeRelativeResourcePath(rawPath);
      if (resourcePath) {
        paths.push(resourcePath);
      }
    }
  }

  return Array.from(new Set(paths)).sort((left, right) => left.localeCompare(right));
}

/**
 * 从文档字节读取视角归一内容配置（读取总容面；正式合法性由 card-document 校验闸裁决）：
 * - `content_source === 'file'` 按 file 收敛，路径非法置空交校验闸报告；
 * - 其余取值（含缺失与非法枚举）一律按 inline 收敛，正文缺失取空串；
 * - 不消费任何旧字段别名（`markdown`）。
 */
export function normalizeBasecardConfig(
  input: Record<string, unknown> | null | undefined
): RichTextBaseCardConfig {
  const record = input ?? {};
  const locale = readString(record.locale) ?? DEFAULT_RICHTEXT_LOCALE;
  const theme = readString(record.theme) ?? '';
  const markdownCapabilities = normalizeCapabilities(record.markdown_capabilities);

  if (record.content_source === 'file') {
    const contentFile = normalizeRelativeResourcePath(readString(record.content_file)) ?? '';
    return {
      card_type: RICHTEXT_CARD_TYPE,
      theme,
      locale,
      content_format: MARKDOWN_CONTENT_FORMAT,
      content_source: 'file',
      content_file: contentFile,
      markdown_capabilities: markdownCapabilities,
    };
  }

  const markdown = typeof record.content_text === 'string' ? record.content_text : '';

  return {
    card_type: RICHTEXT_CARD_TYPE,
    theme,
    locale,
    content_format: MARKDOWN_CONTENT_FORMAT,
    content_source: 'inline',
    content_text: normalizeMarkdown(markdown),
    markdown_capabilities: markdownCapabilities,
  };
}
