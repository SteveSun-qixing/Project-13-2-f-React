/**
 * 路径工具与资源复制计划断言：包内相对路径安全、URL 编码、平台路径归一。
 */

import { describe, expect, it } from 'vitest';

import { planAssetCopy } from '../src/converter.js';
import {
  basenameNormalized,
  dirnameNormalized,
  encodeRelativeUrlPath,
  isSafePackageRelativePath,
  joinNormalized,
  normalizePath,
  toNativePath,
  toSafeFileStem,
} from '../src/paths.js';

describe('包内相对路径安全校验', () => {
  it('放行常规相对路径', () => {
    expect(isSafePackageRelativePath('resources/pictures/photo.png')).toBe(true);
    expect(isSafePackageRelativePath('a.png')).toBe(true);
    expect(isSafePackageRelativePath('resources/图片 一号.png')).toBe(true);
  });

  it('拒绝根前缀、上跳段、反斜杠与空段', () => {
    expect(isSafePackageRelativePath('')).toBe(false);
    expect(isSafePackageRelativePath('/etc/passwd')).toBe(false);
    expect(isSafePackageRelativePath('C:/windows/system32')).toBe(false);
    expect(isSafePackageRelativePath('../escape.png')).toBe(false);
    expect(isSafePackageRelativePath('resources/../../escape.png')).toBe(false);
    expect(isSafePackageRelativePath('resources\\windows.png')).toBe(false);
    expect(isSafePackageRelativePath('resources//photo.png')).toBe(false);
    expect(isSafePackageRelativePath('./photo.png')).toBe(false);
  });
});

describe('相对 URL 编码', () => {
  it('逐段编码并保留分层', () => {
    expect(encodeRelativeUrlPath('resources/pictures/photo.png')).toBe('resources/pictures/photo.png');
    expect(encodeRelativeUrlPath('resources/图片 一号.png')).toBe(
      'resources/%E5%9B%BE%E7%89%87%20%E4%B8%80%E5%8F%B7.png'
    );
    expect(encodeRelativeUrlPath('a b/c&d.png')).toBe('a%20b/c%26d.png');
  });
});

describe('平台路径归一', () => {
  it('归一、拼接、取父与取末段（POSIX 形态）', () => {
    expect(normalizePath('/a//b/')).toBe('/a/b');
    expect(joinNormalized('/docs/cards', 'resources', 'a.png')).toBe('/docs/cards/resources/a.png');
    expect(dirnameNormalized('/a/b/c.txt')).toBe('/a/b');
    expect(dirnameNormalized('/c.txt')).toBe('/');
    expect(basenameNormalized('/a/b/c.txt')).toBe('c.txt');
  });

  it('参照路径为 Win32 形态时输出反斜杠形态', () => {
    expect(toNativePath('/a/b', 'C:\\out')).toBe('\\a\\b');
    expect(toNativePath('/a/b', '/out')).toBe('/a/b');
    expect(joinNormalized('C:/out', 'assets/content', 'a.png')).toBe('C:/out/assets/content/a.png');
    expect(dirnameNormalized('C:/out/index.html')).toBe('C:/out');
  });
});

describe('资源复制计划', () => {
  it('按包内相对布局生成源/目标对，目标统一落在产物 assets/content 下', () => {
    const plans = planAssetCopy(
      ['resources/pictures/photo.png', 'resources/files/notes.txt'],
      '/docs/cards/demo.card',
      '/exports/demo-html'
    );
    expect(plans).toEqual([
      { sourcePath: '/docs/cards/demo.card/resources/pictures/photo.png', targetPath: '/exports/demo-html/assets/content/resources/pictures/photo.png' },
      { sourcePath: '/docs/cards/demo.card/resources/files/notes.txt', targetPath: '/exports/demo-html/assets/content/resources/files/notes.txt' },
    ]);
  });

  it('不安全引用被计划层剔除，不产生复制对', () => {
    const plans = planAssetCopy(['../escape.png', 'ok.png'], '/src', '/out');
    expect(plans).toEqual([{ sourcePath: '/src/ok.png', targetPath: '/out/assets/content/ok.png' }]);
  });

  it('引用为空时计划为空', () => {
    expect(planAssetCopy([], '/src', '/out')).toEqual([]);
  });
});

describe('文件名净化', () => {
  it('非法字符折叠为连字符并去首尾', () => {
    expect(toSafeFileStem('a b/c:d*.txt', 'fallback')).toBe('a-b-c-d-.txt');
    expect(toSafeFileStem('***', 'fallback')).toBe('fallback');
  });
});
