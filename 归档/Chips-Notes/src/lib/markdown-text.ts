/**
 * Markdown 文本处理工具
 *
 * 与 richtext-BCP（base.richtext 基础卡片插件）的文本归一口径保持一致，
 * 用于纯文本长度统计（inline/file 存储阈值判断）与摘要提取。
 */

/**
 * 归一化 Markdown：统一换行符、去行尾空白、压缩连续空行
 */
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+$/gm, '')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/**
 * 从 Markdown 中提取纯文本（去除各类语法标记）
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
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\\([\\`*{}[\]()#+\-.!_>~|])/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 统计 Markdown 纯文本长度（Unicode 码点计数）
 */
export function countPlainTextLength(markdown: string): number {
  return Array.from(extractPlainTextFromMarkdown(markdown)).length;
}

/**
 * 提取笔记摘要：纯文本前 N 个字符
 */
export function extractSummary(markdown: string, maxLength: number): string {
  const text = extractPlainTextFromMarkdown(markdown);
  if (text.length <= maxLength) {
    return text;
  }
  return Array.from(text).slice(0, maxLength).join('');
}
