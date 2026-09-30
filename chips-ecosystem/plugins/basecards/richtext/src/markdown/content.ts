/**
 * Markdown 内容域纯逻辑（旧 `richtext-BCP/src/shared/utils.ts` 迁移）。
 *
 * - Markdown 唯一持久化（01-卡片文件格式 §6.6）：正文只存 Markdown，不存编辑器内部 HTML；
 * - `MAX_INLINE_RICHTEXT_LENGTH = 200`：提取纯文本后 ≤200 字写 `content_text`，
 *   >200 字文件化为卡片根目录相对 `.md` 并以 `content_file` 引用（存储闸唯一口径）；
 * - 旧 `LEGACY_RICHTEXT_CARD_TYPE`（`RichTextCard`）兼容面**不迁移**：AGENTS.md 宪法
 *   「无第一版发布、零兼容」与 ADR-010「不留旧 ID 别名」优先于矩阵「随迁」措辞
 *   （W4迁移-richtext-开发计划与日志-2026-09-30 §三.1）；
 * - 旧 `createRichTextMarkdownFileName` 不迁移：依赖 `crypto.randomUUID` 与时间，
 *   违反主进程纯函数禁令（08-基础卡片插件接口 §2.4.4 规则 1），文件化命名归编辑链路保存面。
 */

import {
  collectMarkdownResourcePaths,
  isMarkdownFilePath,
  normalizeResourcePath,
} from './resource-links';

/** 内容格式正式值：富文本基础卡片只保存 Markdown。 */
export const MARKDOWN_CONTENT_FORMAT = 'markdown';

/** 内联阈值：提取纯文本字符数超过该值时正文必须文件化存储（01.12 §6.6）。 */
export const MAX_INLINE_RICHTEXT_LENGTH = 200;

/** 新节点的默认正文（有语义内容，保证初始内容可通过内容校验）。 */
export const DEFAULT_RICHTEXT_MARKDOWN = '# 富文本\n\n开始写点什么。';

/** 归一 Markdown 源文：换行、不间断空格、行尾空白与多余空行收敛。 */
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+$/gm, '')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** 按 Unicode 码点计数（旧实现迁移； surrogate 对计 1）。 */
export function countUnicodeCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * 从 Markdown 源文提取纯文本并计数（`content_source` 存储闸与字数提示的唯一口径）。
 *
 * 剥除数学定界符、代码定界符、链接/图片记号、标题/引用/列表前缀、强调与扩展语法标记
 * （`==`、`++`、`^`、`~`）与内联 HTML 标签形态。
 */
export function extractPlainTextFromMarkdown(markdown: string): string {
  const normalized = normalizeMarkdown(markdown);
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, '$1')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}(?:[-*+] |\d+\. )/gm, '')
    .replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\+\+([^+]+)\+\+/g, '$1')
    .replace(/\^([^^]+)\^/g, '$1')
    .replace(/~([^~]+)~/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\\([\\`*{}[\]()#+.!_>~|])/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 从 Markdown 源文计提取纯文本字符数（Unicode 码点）。 */
export function countPlainTextLengthFromMarkdown(markdown: string): number {
  return countUnicodeCharacters(extractPlainTextFromMarkdown(markdown));
}

/**
 * 判定 Markdown 源文是否有可持久化的语义内容：纯文本非空，或存在水平分隔线
 * （旧实现迁移：只含分隔线的正文同样具备呈现语义）。
 */
export function hasMeaningfulMarkdownContent(markdown: string): boolean {
  if (countPlainTextLengthFromMarkdown(markdown) > 0) {
    return true;
  }

  const normalized = normalizeMarkdown(markdown);
  if (!normalized) {
    return false;
  }

  return /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/m.test(normalized);
}

/**
 * 存储闸：提取纯文本字符数超过 `MAX_INLINE_RICHTEXT_LENGTH` 时正文必须文件化。
 */
export function shouldUseFileStorage(plainTextLength: number): boolean {
  return plainTextLength > MAX_INLINE_RICHTEXT_LENGTH;
}

/**
 * 收集内联正文引用的包内相对资源路径（`collectResourcePaths` 的 inline 臂）。
 *
 * @param markdown - Markdown 源文
 * @returns 去重且稳定排序的资源路径
 */
export function collectInlineResourcePaths(markdown: string): string[] {
  return collectMarkdownResourcePaths(markdown);
}

/**
 * 判定 file 来源正文引用是否合法（卡片根目录相对 `.md`），并给出归一值。
 *
 * @param contentFile - `content_file` 原始值
 * @returns 合法时返回归一路径，否则空串
 */
export function normalizeContentFilePath(contentFile: unknown): string {
  if (!isMarkdownFilePath(typeof contentFile === 'string' ? contentFile : undefined)) {
    return '';
  }
  return normalizeResourcePath(contentFile);
}
