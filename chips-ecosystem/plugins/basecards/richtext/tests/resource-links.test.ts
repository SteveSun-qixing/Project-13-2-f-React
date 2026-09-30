import { describe, expect, it } from 'vitest';
import {
  ANCHOR_SAFE_ATTRIBUTES,
  classifyMarkdownAnchor,
  collectMarkdownResourcePaths,
  dedupeResourcePaths,
  isExternalUrl,
  isMarkdownFilePath,
  isRelativeResourcePath,
  normalizeResourcePath,
} from '../src/markdown/resource-links';

/** 旧 shared/{utils,resource-links}.ts 资源引用面迁移：路径归一、锚点分类与安全属性。 */
describe('normalizeResourcePath', () => {
  it('归一反斜杠与相对前缀', () => {
    expect(normalizeResourcePath('assets\\images\\a.png')).toBe('assets/images/a.png');
    expect(normalizeResourcePath('./assets/a.png')).toBe('assets/a.png');
  });

  it('拒绝协议引用、协议相对、绝对路径、查询与锚点', () => {
    expect(normalizeResourcePath('https://example.com/a.png')).toBe('');
    expect(normalizeResourcePath('file:///etc/a')).toBe('');
    expect(normalizeResourcePath('//cdn.example.com/a.png')).toBe('');
    expect(normalizeResourcePath('/abs/a.png')).toBe('');
    expect(normalizeResourcePath('assets/a.png?v=2')).toBe('');
    expect(normalizeResourcePath('assets/a.png#frag')).toBe('');
  });

  it('拒绝越界段与非字符串输入', () => {
    expect(normalizeResourcePath('a/../b.png')).toBe('');
    expect(normalizeResourcePath('./../b.png')).toBe('');
    expect(normalizeResourcePath(42)).toBe('');
    expect(normalizeResourcePath(null)).toBe('');
  });
});

describe('判定辅助', () => {
  it('isRelativeResourcePath / isMarkdownFilePath / isExternalUrl', () => {
    expect(isRelativeResourcePath('assets/a.png')).toBe(true);
    expect(isRelativeResourcePath('  ')).toBe(false);
    expect(isMarkdownFilePath('richtext/note.MD')).toBe(true);
    expect(isMarkdownFilePath('richtext/note.markdown')).toBe(false);
    expect(isExternalUrl('https://example.com')).toBe(true);
    expect(isExternalUrl('//cdn.example.com')).toBe(true);
    expect(isExternalUrl('#section')).toBe(true);
    expect(isExternalUrl('assets/a.png')).toBe(false);
  });
});

describe('dedupeResourcePaths', () => {
  it('去重并稳定排序', () => {
    expect(dedupeResourcePaths(['b.md', 'a.md', 'b.md', undefined, './a.md'])).toEqual(['a.md', 'b.md']);
  });
});

describe('collectMarkdownResourcePaths', () => {
  it('扫描 Markdown 链接、图片与内联 img/a 引用', () => {
    const markdown = [
      '![封面](assets/cover.png)',
      '[笔记](richtext/a1B2c3D4e5.md)',
      '<img src="assets/inline.png" alt="">',
      '<a href="assets/link.md">内联</a>',
      '[外部](https://example.com/a.png)',
    ].join('\n');
    expect(collectMarkdownResourcePaths(markdown)).toEqual([
      'assets/cover.png',
      'assets/inline.png',
      'assets/link.md',
      'richtext/a1B2c3D4e5.md',
    ]);
  });
});

describe('classifyMarkdownAnchor 与安全属性', () => {
  it('空值、外部与资源三类锚点', () => {
    expect(classifyMarkdownAnchor(undefined)).toBe('empty');
    expect(classifyMarkdownAnchor('')).toBe('empty');
    expect(classifyMarkdownAnchor('   ')).toBe('empty');
    expect(classifyMarkdownAnchor('https://example.com')).toBe('external');
    expect(classifyMarkdownAnchor('#锚点')).toBe('external');
    expect(classifyMarkdownAnchor('assets/cover.png')).toBe('resource');
  });

  it('安全属性固定为新窗口并切断 opener', () => {
    expect(ANCHOR_SAFE_ATTRIBUTES).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
  });
});
