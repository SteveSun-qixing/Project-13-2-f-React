import { describe, expect, it } from 'vitest';
import {
  dirnameEpubPath,
  joinEpubHref,
  normalizeEpubPath,
  resolveEpubHref,
  resolveEpubPath,
  resolveEpubPathFromDirectory,
} from '../../src/domain/epub/path';

describe('EPUB 路径工具', () => {
  it('规范化相对路径并移除点段', () => {
    expect(normalizeEpubPath('OPS/./chapters/../chapter-1.xhtml')).toBe('OPS/chapter-1.xhtml');
  });

  it('能从当前章节解析相对资源路径', () => {
    expect(resolveEpubPath('OPS/text/chapter-1.xhtml', '../styles/book.css')).toBe(
      'OPS/styles/book.css'
    );
  });

  it('能从 OPF 所在目录解析 manifest 资源路径', () => {
    expect(resolveEpubPathFromDirectory('OEBPS', 'cover.xhtml')).toBe('OEBPS/cover.xhtml');
  });

  it('能解析带片段的内部链接', () => {
    expect(resolveEpubHref('OPS/text/chapter-1.xhtml', '../text/chapter-2.xhtml#part-3')).toEqual({
      path: 'OPS/text/chapter-2.xhtml',
      fragment: 'part-3',
    });
  });

  it('能拼回规范的 href', () => {
    expect(joinEpubHref('OPS/text/chapter-2.xhtml', 'part-3')).toBe(
      'OPS/text/chapter-2.xhtml#part-3'
    );
  });

  it('能返回目录路径', () => {
    expect(dirnameEpubPath('OPS/text/chapter-1.xhtml')).toBe('OPS/text');
  });
});
