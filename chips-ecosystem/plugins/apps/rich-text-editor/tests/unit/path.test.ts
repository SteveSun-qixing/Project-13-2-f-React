import { describe, expect, it } from 'vitest';
import { normalizeRelativeResourcePath } from '../../src/domain/card/path';

describe('卡片根相对资源路径文法（01-卡片文件格式 §8.2、§9.4）', () => {
  it('归一路径分隔符并保留层级', () => {
    expect(normalizeRelativeResourcePath('richtext/a1B2c3D4e5.md')).toBe('richtext/a1B2c3D4e5.md');
    expect(normalizeRelativeResourcePath('richtext\\a1B2c3D4e5.md')).toBe('richtext/a1B2c3D4e5.md');
    expect(normalizeRelativeResourcePath('a//b\\\\c.md')).toBe('a/b/c.md');
    expect(normalizeRelativeResourcePath('  photo.jpg  ')).toBe('photo.jpg');
  });

  it('剥除前导 ./ 形态', () => {
    expect(normalizeRelativeResourcePath('./cover.png')).toBe('cover.png');
    expect(normalizeRelativeResourcePath('./richtext/body.md')).toBe('richtext/body.md');
  });

  it('拒绝空值与空串', () => {
    expect(normalizeRelativeResourcePath('')).toBeNull();
    expect(normalizeRelativeResourcePath('   ')).toBeNull();
    expect(normalizeRelativeResourcePath(null)).toBeNull();
    expect(normalizeRelativeResourcePath(undefined)).toBeNull();
    expect(normalizeRelativeResourcePath('./')).toBeNull();
  });

  it('拒绝协议化与绝对路径引用（§8.2 禁止持久化形态）', () => {
    expect(normalizeRelativeResourcePath('/Users/demo/body.md')).toBeNull();
    expect(normalizeRelativeResourcePath('C:\\Users\\demo\\body.md')).toBeNull();
    expect(normalizeRelativeResourcePath('file:///Users/demo/body.md')).toBeNull();
    expect(normalizeRelativeResourcePath('https://file.example/video.mp4')).toBeNull();
    expect(normalizeRelativeResourcePath('chips-resource://card/a.png')).toBeNull();
    expect(normalizeRelativeResourcePath('blob:https://example.invalid/x')).toBeNull();
    expect(normalizeRelativeResourcePath('data:image/png;base64,xxxx')).toBeNull();
    expect(normalizeRelativeResourcePath('//server/share/a.png')).toBeNull();
  });

  it('拒绝查询串、片段与路径逃逸', () => {
    expect(normalizeRelativeResourcePath('a.png?size=full')).toBeNull();
    expect(normalizeRelativeResourcePath('a.md#heading')).toBeNull();
    expect(normalizeRelativeResourcePath('.')).toBeNull();
    expect(normalizeRelativeResourcePath('..')).toBeNull();
    expect(normalizeRelativeResourcePath('a/../b.md')).toBeNull();
    expect(normalizeRelativeResourcePath('a/./b.md')).toBeNull();
    expect(normalizeRelativeResourcePath('../escape.md')).toBeNull();
  });
});
