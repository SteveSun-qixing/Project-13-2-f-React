/**
 * Markdown 文本处理测试
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeMarkdown,
  extractPlainTextFromMarkdown,
  countPlainTextLength,
  extractSummary,
} from '../../src/lib/markdown-text';

describe('normalizeMarkdown', () => {
  it('应统一 CRLF 为 LF', () => {
    expect(normalizeMarkdown('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('应去除行尾空白并压缩连续空行', () => {
    expect(normalizeMarkdown('a   \n\n\n\nb')).toBe('a\n\nb');
  });

  it('应去除首部空行并保留尾部单个换行以内内容', () => {
    expect(normalizeMarkdown('\n\n\nabc')).toBe('abc');
  });
});

describe('extractPlainTextFromMarkdown', () => {
  it('应去除标题标记', () => {
    expect(extractPlainTextFromMarkdown('# 标题\n正文')).toBe('标题 正文');
  });

  it('应去除加粗与斜体标记', () => {
    expect(extractPlainTextFromMarkdown('**加粗** *斜体*')).toBe('加粗 斜体');
  });

  it('应去除链接语法保留文本', () => {
    expect(extractPlainTextFromMarkdown('[薯片](https://chips.example)')).toBe('薯片');
  });

  it('应去除图片语法', () => {
    expect(extractPlainTextFromMarkdown('![图片](img.png)后文')).toBe('图片后文');
  });

  it('应去除列表与引用前缀', () => {
    expect(extractPlainTextFromMarkdown('- 项目\n> 引用')).toBe('项目 引用');
  });

  it('应去除代码块标记保留代码内容', () => {
    expect(extractPlainTextFromMarkdown('```\nconst a = 1;\n```')).toBe('const a = 1;');
  });

  it('空内容返回空字符串', () => {
    expect(extractPlainTextFromMarkdown('')).toBe('');
  });
});

describe('countPlainTextLength', () => {
  it('按 Unicode 码点计数', () => {
    // 🎉 占 2 个 UTF-16 码元但只有 1 个码点
    expect(countPlainTextLength('🎉')).toBe(1);
  });

  it('语法标记不计入长度', () => {
    expect(countPlainTextLength('# **标题**')).toBe(2);
  });
});

describe('extractSummary', () => {
  it('短文本直接返回', () => {
    expect(extractSummary('# 你好', 100)).toBe('你好');
  });

  it('超长文本截断到指定长度', () => {
    const summary = extractSummary('字'.repeat(300), 100);
    expect(summary).toHaveLength(100);
  });

  it('截断按 Unicode 码点计算', () => {
    const summary = extractSummary('🎉'.repeat(50), 10);
    expect(Array.from(summary)).toHaveLength(10);
  });
});
