import {
  DEFAULT_RICHTEXT_MARKDOWN,
  MARKDOWN_CONTENT_FORMAT,
  RICHTEXT_CARD_TYPE,
  collectMarkdownResourcePaths,
  countPlainTextLengthFromMarkdown,
  dedupeResourcePaths,
  hasMeaningfulMarkdownContent,
  isMarkdownFilePath,
  isNonEmptyString,
  normalizeMarkdown,
  normalizeResourcePath,
} from "../shared/utils";

export type RichTextContentSource = "inline" | "file";

export interface RichTextMarkdownCapabilities {
  commonmark: boolean;
  gfm: boolean;
  math: boolean;
  highlight: boolean;
  underline: boolean;
  superscript: boolean;
  subscript: boolean;
}

export interface BasecardConfig extends Record<string, unknown> {
  card_type: typeof RICHTEXT_CARD_TYPE;
  theme?: string;
  locale?: string;
  content_format: "markdown";
  content_source: RichTextContentSource;
  content_text?: string;
  content_file?: string;
  markdown_capabilities: RichTextMarkdownCapabilities;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const defaultBasecardConfig: BasecardConfig = {
  card_type: RICHTEXT_CARD_TYPE,
  theme: "",
  locale: "zh-CN",
  content_format: MARKDOWN_CONTENT_FORMAT,
  content_source: "inline",
  content_text: "",
  markdown_capabilities: {
    commonmark: true,
    gfm: true,
    math: true,
    highlight: true,
    underline: true,
    superscript: true,
    subscript: true,
  },
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function inferContentSource(record: Record<string, unknown>): RichTextContentSource {
  const rawSource = asString(record.content_source);
  if (rawSource === "file") {
    return "file";
  }
  if (rawSource === "inline") {
    return "inline";
  }
  if (isNonEmptyString(record.content_file)) {
    return "file";
  }
  return "inline";
}

function normalizeCardType(_input: unknown): typeof RICHTEXT_CARD_TYPE {
  return RICHTEXT_CARD_TYPE;
}

function normalizeCapabilities(input: unknown): RichTextMarkdownCapabilities {
  const record = typeof input === "object" && input ? input as Record<string, unknown> : {};
  const defaults = defaultBasecardConfig.markdown_capabilities;

  return {
    commonmark: record.commonmark === false ? false : defaults.commonmark,
    gfm: record.gfm === false ? false : defaults.gfm,
    math: record.math === false ? false : defaults.math,
    highlight: record.highlight === false ? false : defaults.highlight,
    underline: record.underline === false ? false : defaults.underline,
    superscript: record.superscript === false ? false : defaults.superscript,
    subscript: record.subscript === false ? false : defaults.subscript,
  };
}

export function createInlineBasecardConfig(markdown: string, locale = "zh-CN", theme = ""): BasecardConfig {
  return {
    card_type: RICHTEXT_CARD_TYPE,
    theme,
    locale,
    content_format: MARKDOWN_CONTENT_FORMAT,
    content_source: "inline",
    content_text: normalizeMarkdown(markdown),
    markdown_capabilities: { ...defaultBasecardConfig.markdown_capabilities },
  };
}

export function createFileBasecardConfig(
  resourcePath: string,
  locale = "zh-CN",
  theme = "",
): BasecardConfig {
  return {
    card_type: RICHTEXT_CARD_TYPE,
    theme,
    locale,
    content_format: MARKDOWN_CONTENT_FORMAT,
    content_source: "file",
    content_file: normalizeResourcePath(resourcePath),
    markdown_capabilities: { ...defaultBasecardConfig.markdown_capabilities },
  };
}

export function normalizeBasecardConfig(
  input: Partial<BasecardConfig> | Record<string, unknown> | null | undefined,
): BasecardConfig {
  const record = (input ?? {}) as Record<string, unknown>;
  const contentSource = inferContentSource(record);
  const locale = asString(record.locale) ?? defaultBasecardConfig.locale;
  const theme = asString(record.theme) ?? defaultBasecardConfig.theme;
  const markdownCapabilities = normalizeCapabilities(record.markdown_capabilities);
  const cardType = normalizeCardType(record.card_type);

  if (contentSource === "file") {
    const contentFile = normalizeResourcePath(asString(record.content_file) ?? "");
    return {
      card_type: cardType,
      theme,
      locale,
      content_format: MARKDOWN_CONTENT_FORMAT,
      content_source: "file",
      content_file: contentFile,
      markdown_capabilities: markdownCapabilities,
    };
  }

  const contentText = normalizeMarkdown(
    typeof record.content_text === "string"
      ? record.content_text
      : typeof record.markdown === "string"
        ? record.markdown
        : "",
  );

  return {
    card_type: cardType,
    theme,
    locale,
    content_format: MARKDOWN_CONTENT_FORMAT,
    content_source: "inline",
    content_text: contentText,
    markdown_capabilities: markdownCapabilities,
  };
}

export function createInitialBasecardConfig(): BasecardConfig {
  return createInlineBasecardConfig(DEFAULT_RICHTEXT_MARKDOWN);
}

export function validateBasecardConfig(config: BasecardConfig): ConfigValidationResult {
  const errors: Record<string, string> = {};

  if (config.card_type !== RICHTEXT_CARD_TYPE) {
    errors.card_type = `card_type 必须为 ${RICHTEXT_CARD_TYPE}`;
  }

  if (config.content_format !== MARKDOWN_CONTENT_FORMAT) {
    errors.content_format = "content_format 必须为 markdown";
  }

  if (!isNonEmptyString(config.locale)) {
    errors.locale = "locale 不能为空";
  }

  if (config.content_source === "inline") {
    if (!hasMeaningfulMarkdownContent(config.content_text ?? "")) {
      errors.content_text = "Markdown 内容不能为空";
    }
  } else {
    if (!isMarkdownFilePath(config.content_file)) {
      errors.content_file = "content_file 必须为卡片根目录相对 .md 路径";
    }
  }

  const capabilities = config.markdown_capabilities;
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
    errors.markdown_capabilities = "markdown_capabilities 必须显式声明当前富文本 Markdown 能力矩阵";
  }

  if (config.content_source === "inline" && isNonEmptyString(config.content_file)) {
    errors.content_source = "inline 模式下不能同时保存 content_file";
  }

  if (config.content_source === "file" && isNonEmptyString(config.content_text)) {
    errors.content_source = "file 模式下不能同时保存 content_text";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function collectRichTextResourcePaths(config: BasecardConfig): string[] {
  const resourcePaths = config.content_source === "inline"
    ? collectMarkdownResourcePaths(config.content_text ?? "")
    : [
        isMarkdownFilePath(config.content_file) ? normalizeResourcePath(config.content_file) : "",
      ];

  return dedupeResourcePaths(resourcePaths);
}

export function getPlainTextLength(config: BasecardConfig): number {
  if (config.content_source === "file") {
    return 0;
  }
  return countPlainTextLengthFromMarkdown(config.content_text ?? "");
}
