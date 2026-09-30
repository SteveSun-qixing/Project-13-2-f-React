/**
 * 路径解析纯函数测试：旧 planner 路径算法语义逐字迁移的分支钉死
 * （分隔符探测 / 根形态 / 尾部分隔符 / 卷前缀 / 相对路径，含 Windows 形态）。
 */

import { describe, expect, it } from 'vitest';

import { basename, dirname, joinPath, splitSegments } from '../src/paths.js';

describe('splitSegments', () => {
  it('按正反分隔符切分并丢弃空段', () => {
    expect(splitSegments('/a/b//c/')).toEqual(['a', 'b', 'c']);
    expect(splitSegments('C:\\a\\b')).toEqual(['C:', 'a', 'b']);
    expect(splitSegments('')).toEqual([]);
  });
});

describe('dirname', () => {
  it('POSIX 绝对路径：根目录返回分隔符本身', () => {
    expect(dirname('/a/b')).toBe('/a');
    expect(dirname('/a')).toBe('/');
  });

  it('Windows 卷前缀：盘根返回带探测分隔符的卷前缀（旧算法：混合分隔符按反斜杠归一）', () => {
    expect(dirname('C:\\a\\b')).toBe('C:\\a');
    expect(dirname('C:\\a')).toBe('C:\\');
    expect(dirname('C:/a')).toBe('C:\\');
  });

  it('相对路径：无分隔符返回点', () => {
    expect(dirname('a')).toBe('.');
    expect(dirname('a/b')).toBe('a');
    expect(dirname('a\\b')).toBe('a');
  });

  it('尾部分隔符先归一再取目录', () => {
    expect(dirname('/a/b/')).toBe('/a');
    expect(dirname('C:\\a\\b\\')).toBe('C:\\a');
  });
});

describe('basename', () => {
  it('取末段；无段时回退原串', () => {
    expect(basename('/a/b/c.txt')).toBe('c.txt');
    expect(basename('C:\\a\\b\\c.txt')).toBe('c.txt');
    expect(basename('file.card')).toBe('file.card');
    expect(basename('/a//b//')).toBe('b');
  });
});

describe('joinPath', () => {
  it('以基路径分隔符拼接，POSIX 绝对基保留前导分隔符', () => {
    expect(joinPath('/a/b', 'c', 'd.txt')).toBe('/a/b/c/d.txt');
    expect(joinPath('/a/b/', '/c')).toBe('/a/b/c');
  });

  it('Windows 卷前缀基路径沿用反分隔符并归并重复分隔符', () => {
    expect(joinPath('C:\\a', 'b\\c')).toBe('C:\\a\\b\\c');
    expect(joinPath('C:\\a\\', 'b//c')).toBe('C:\\a\\b\\c');
  });

  it('相对基路径直接拼接', () => {
    expect(joinPath('a', 'b')).toBe('a/b');
    expect(joinPath('.', 'x', 'y')).toBe('./x/y');
  });

  it('多段中的空段被丢弃', () => {
    expect(joinPath('/a', '', 'b')).toBe('/a/b');
  });
});
