import { describe, expect, it } from 'vitest';
import {
  createFileUrl,
  joinResourcePath,
  normalizeRelativeResourcePath,
} from '../../src/shared/resource-path';

describe('shared/resource-path 契约测试', () => {
  describe('normalizeRelativeResourcePath', () => {
    it('规范化正斜杠与反斜杠', () => {
      expect(normalizeRelativeResourcePath('a\\b\\c.png')).toBe('a/b/c.png');
    });

    it('去除前导 ./ 与空白', () => {
      expect(normalizeRelativeResourcePath('  ./a/b.png  ')).toBe('a/b.png');
    });

    it('去除 . 段', () => {
      expect(normalizeRelativeResourcePath('a/./b.png')).toBe('a/b.png');
    });

    it('拒绝 .. 逃逸', () => {
      expect(normalizeRelativeResourcePath('../a.png')).toBeNull();
      expect(normalizeRelativeResourcePath('a/../../b.png')).toBeNull();
    });

    it('拒绝空输入与非字符串', () => {
      expect(normalizeRelativeResourcePath('')).toBeNull();
      expect(normalizeRelativeResourcePath('   ')).toBeNull();
      expect(normalizeRelativeResourcePath(null)).toBeNull();
      expect(normalizeRelativeResourcePath(undefined)).toBeNull();
      expect(normalizeRelativeResourcePath(42)).toBeNull();
    });

    it('拒绝纯 . 段', () => {
      expect(normalizeRelativeResourcePath('./')).toBeNull();
    });

    it('保留嵌套相对路径', () => {
      expect(normalizeRelativeResourcePath('assets/covers/cover.png')).toBe('assets/covers/cover.png');
    });
  });

  describe('joinResourcePath', () => {
    it('拼接并统一分隔符', () => {
      expect(joinResourcePath('a', 'b', 'c.png')).toBe('a/b/c.png');
    });

    it('过滤空片段并压缩重复斜杠', () => {
      expect(joinResourcePath('a/', '', '/b//c')).toBe('a/b/c');
    });
  });

  describe('createFileUrl', () => {
    it('POSIX 路径编码', () => {
      expect(createFileUrl('/tmp/a b/c.png')).toBe('file:///tmp/a%20b/c.png');
    });

    it('Windows 盘符路径编码', () => {
      expect(createFileUrl('C:\\Users\\a\\b.png')).toBe('file:///C:/Users/a/b.png');
    });

    it('相对路径按绝对化处理', () => {
      expect(createFileUrl('a/b.png')).toBe('file:///a/b.png');
    });
  });
});
