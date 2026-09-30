import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  CARD_TYPE_ALIASES,
  CARD_TYPE_ID,
  DEFAULT_CONTENT,
  analyzeWebpageUrl,
  buildContent,
  calculateFixedViewportHeight,
  calculateViewportLayout,
  createViewportPayload,
  dedupeResourcePaths,
  getBundleEntryPath,
  getBundleRootPath,
  normalizeRelativeResourcePath,
  normalizeViewportPayload,
  readContent,
  validateConfig,
} from '../src/config';
import { collectResourcePaths, createInitialContent } from '../src/main';

function createBasecard(content: Record<string, unknown>): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: CARD_TYPE_ID,
    content,
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:2',
      tags: [],
    },
  };
}

describe('类型常量与默认内容', () => {
  it('卡片类型正式 ID 与历史别名登记一致', () => {
    expect(CARD_TYPE_ID).toBe('base.webpage');
    expect(CARD_TYPE_ALIASES).toEqual(['WebPageCard']);
  });

  it('默认内容与卡片文件格式 §6.5 示例 1 同形', () => {
    expect(DEFAULT_CONTENT).toEqual({
      source_type: 'url',
      source_url: '',
      bundle_root: '',
      entry_file: 'index.html',
      resource_paths: [],
      display_mode: 'fixed',
      fixed_ratio: '7:16',
      max_height_ratio: 20,
    });
  });
});

describe('analyzeWebpageUrl', () => {
  it('空输入与非法输入', () => {
    expect(analyzeWebpageUrl('').reason).toBe('empty');
    expect(analyzeWebpageUrl(undefined).reason).toBe('empty');
    expect(analyzeWebpageUrl('不是地址').reason).toBe('invalid');
  });

  it('协议与主机判定', () => {
    expect(analyzeWebpageUrl('ftp://a.com').reason).toBe('unsupported-protocol');
    expect(analyzeWebpageUrl('javascript:alert(1)').reason).toBe('unsupported-protocol');
    expect(analyzeWebpageUrl('file:///Users/demo/index.html').reason).toBe('unsupported-protocol');
    expect(analyzeWebpageUrl('https://').reason).toBe('missing-host');
  });

  it('凭据阻断与 http(s) 判定', () => {
    expect(analyzeWebpageUrl('https://user:pass@a.com').reason).toBe('credentials-blocked');
    const https = analyzeWebpageUrl('https://chips.example.com/page');
    expect(https.openable).toBe(true);
    expect(https.reason).toBe('secure');
    expect(https.normalizedUrl).toBe('https://chips.example.com/page');
    const http = analyzeWebpageUrl('http://chips.example.com/');
    expect(http.openable).toBe(true);
    expect(http.reason).toBe('insecure-http');
  });

  it('非法地址归一原样返回输入，便于编辑器继续编辑', () => {
    expect(analyzeWebpageUrl('不是地址').normalizedUrl).toBe('');
    expect(analyzeWebpageUrl('https://a.com').openable).toBe(true);
  });
});

describe('包内相对资源路径', () => {
  it('归一反斜杠与前导符，拒绝协议、查询、穿段路径', () => {
    expect(normalizeRelativeResourcePath('./web-bundle/index.html')).toBe('web-bundle/index.html');
    expect(normalizeRelativeResourcePath('\\web-bundle\\a.js')).toBe('web-bundle/a.js');
    expect(normalizeRelativeResourcePath('https://a.com/x')).toBeUndefined();
    expect(normalizeRelativeResourcePath('a/b?c')).toBeUndefined();
    expect(normalizeRelativeResourcePath('a/b#d')).toBeUndefined();
    expect(normalizeRelativeResourcePath('a/../b')).toBeUndefined();
    expect(normalizeRelativeResourcePath('a/./b')).toBeUndefined();
    expect(normalizeRelativeResourcePath('')).toBeUndefined();
    expect(normalizeRelativeResourcePath(42)).toBeUndefined();
  });

  it('去重且保持首次出现顺序', () => {
    expect(
      dedupeResourcePaths([
        './web-bundle/index.html',
        'web-bundle/assets/app.js',
        'web-bundle/index.html',
        '不是路径?x',
      ]),
    ).toEqual(['web-bundle/index.html', 'web-bundle/assets/app.js']);
  });

  it('入口路径与包根路径派生', () => {
    const content = readContent({ source_type: 'bundle', bundle_root: './web-bundle/' });
    expect(getBundleRootPath(content)).toBe('web-bundle');
    expect(getBundleEntryPath(content)).toBe('web-bundle/index.html');
    expect(getBundleEntryPath(readContent({ source_type: 'url' }))).toBeUndefined();
  });
});

describe('readContent 归一', () => {
  it('空内容回退默认内容', () => {
    expect(readContent(undefined)).toEqual(DEFAULT_CONTENT);
    expect(readContent('text')).toEqual(DEFAULT_CONTENT);
    expect(readContent({})).toEqual(DEFAULT_CONTENT);
  });

  it('历史别名 WebPageCard 读取归一，不回写判断', () => {
    expect(readContent({ card_type: 'WebPageCard' })).toEqual(DEFAULT_CONTENT);
    expect(readContent({ card_type: 'base.webpage' })).toEqual(DEFAULT_CONTENT);
  });

  it('保留合法字段并归一路径与清单', () => {
    expect(
      readContent({
        source_type: 'bundle',
        source_url: 'https://a.com',
        bundle_root: './web-bundle',
        entry_file: './index.html',
        resource_paths: ['./web-bundle/index.html', 'web-bundle/assets/app.js', 'web-bundle/index.html'],
        display_mode: 'free',
        max_height_ratio: 20,
      }),
    ).toEqual({
      source_type: 'bundle',
      source_url: '',
      bundle_root: 'web-bundle',
      entry_file: 'index.html',
      resource_paths: ['web-bundle/index.html', 'web-bundle/assets/app.js'],
      display_mode: 'free',
      fixed_ratio: '7:16',
      max_height_ratio: 20,
    });
  });

  it('非法枚举与数值回退默认值', () => {
    expect(readContent({ source_type: 'archive' }).source_type).toBe('url');
    expect(readContent({ display_mode: 'stretch' }).display_mode).toBe('fixed');
    expect(readContent({ max_height_ratio: 999 }).max_height_ratio).toBe(20);
    expect(readContent({ fixed_ratio: '4:3' })).toEqual(DEFAULT_CONTENT);
    expect(readContent({ resource_paths: 'web-bundle/index.html' }).resource_paths).toEqual([]);
  });
});

describe('validateConfig', () => {
  it('接受空配置与未提供配置（08 §2.4.3 规则 2）', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
  });

  it('拒绝非对象', () => {
    expect(validateConfig('webpage')).toBe(false);
    expect(validateConfig(['url'])).toBe(false);
  });

  it('字段出现即校验：类型错误与非法枚举拒绝', () => {
    expect(validateConfig({ card_type: 'base.image' })).toBe(false);
    expect(validateConfig({ card_type: 'WebPageCard' })).toBe(true);
    expect(validateConfig({ source_type: 'archive' })).toBe(false);
    expect(validateConfig({ display_mode: 'stretch' })).toBe(false);
    expect(validateConfig({ fixed_ratio: '4:3' })).toBe(false);
    expect(validateConfig({ max_height_ratio: 999 })).toBe(false);
    expect(validateConfig({ theme: 1 })).toBe(false);
    expect(validateConfig({ layout: 'x' })).toBe(false);
  });

  it('非空 source_url 必须是可打开的 http(s) 地址', () => {
    expect(validateConfig({ source_url: 'https://chips.example.com' })).toBe(true);
    expect(validateConfig({ source_url: 'http://chips.example.com' })).toBe(true);
    expect(validateConfig({ source_url: 'javascript:alert(1)' })).toBe(false);
    expect(validateConfig({ source_url: 'file:///Users/demo/index.html' })).toBe(false);
    expect(validateConfig({ source_url: 'https://user:pass@a.com' })).toBe(false);
    expect(validateConfig({ source_url: '不是地址' })).toBe(false);
  });

  it('bundle 模式入口文件必须为 index.html 且清单包含入口', () => {
    expect(
      validateConfig({
        source_type: 'bundle',
        bundle_root: 'site',
        entry_file: 'home.html',
      }),
    ).toBe(false);
    expect(
      validateConfig({
        source_type: 'bundle',
        bundle_root: 'site',
        entry_file: 'index.html',
        resource_paths: ['site/assets/app.js'],
      }),
    ).toBe(false);
    expect(
      validateConfig({
        source_type: 'bundle',
        bundle_root: 'site',
        entry_file: 'index.html',
        resource_paths: ['site/index.html', 'site/assets/app.js'],
      }),
    ).toBe(true);
  });

  it('resource_paths 必须是字符串数组', () => {
    expect(validateConfig({ resource_paths: ['a/b.html'] })).toBe(true);
    expect(validateConfig({ resource_paths: [1] })).toBe(false);
    expect(validateConfig({ resource_paths: 'a/b.html' })).toBe(false);
  });
});

describe('buildContent 与主进程纯函数', () => {
  it('buildContent 产出 §6.5 平铺内容（card_type + 通用 theme 空串）', () => {
    expect(buildContent({ ...DEFAULT_CONTENT, source_url: 'https://a.com' })).toEqual({
      card_type: 'base.webpage',
      theme: '',
      source_type: 'url',
      source_url: 'https://a.com',
      bundle_root: '',
      entry_file: 'index.html',
      resource_paths: [],
      display_mode: 'fixed',
      fixed_ratio: '7:16',
      max_height_ratio: 20,
    });
  });

  it('createInitialContent 通过 validateConfig 与 schema 口径', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe('base.webpage');
    expect(content['theme']).toBe('');
    expect(content['source_type']).toBe('url');
    expect(content['source_url']).toBe('');
    expect(content['entry_file']).toBe('index.html');
    expect(content['resource_paths']).toEqual([]);
    expect(content['display_mode']).toBe('fixed');
    expect(content['fixed_ratio']).toBe('7:16');
    expect(content['max_height_ratio']).toBe(20);
    expect(validateConfig(content)).toBe(true);
  });

  it('collectResourcePaths 去重、过滤非法项并稳定排序', () => {
    const basecard = createBasecard(
      buildContent({
        ...DEFAULT_CONTENT,
        source_type: 'bundle',
        bundle_root: 'web-bundle',
        resource_paths: ['web-bundle/assets/b.css', 'web-bundle/index.html', 'web-bundle/assets/a.js'],
      }),
    );
    expect(collectResourcePaths(basecard)).toEqual([
      'web-bundle/assets/a.js',
      'web-bundle/assets/b.css',
      'web-bundle/index.html',
    ]);
  });

  it('collectResourcePaths 对 url 来源返回空数组', () => {
    const basecard = createBasecard(
      buildContent({ ...DEFAULT_CONTENT, source_url: 'https://chips.example.com' }),
    );
    expect(collectResourcePaths(basecard)).toEqual([]);
  });
});

describe('视口布局数学', () => {
  it('归一视口载荷：非法数值钳位、枚举回退', () => {
    expect(
      normalizeViewportPayload({
        version: 1,
        displayMode: 'free',
        fixedRatio: '7:16',
        width: -10.6,
        height: Number.NaN,
        baseHeight: 160.4,
        maxHeight: 'x',
        scrollMode: 1,
      }),
    ).toEqual({
      version: 1,
      displayMode: 'free',
      fixedRatio: '7:16',
      width: 0,
      height: 0,
      baseHeight: 160,
      maxHeight: 0,
      scrollMode: true,
    });
    expect(normalizeViewportPayload(undefined).displayMode).toBe('fixed');
  });

  it('fixed 模式视口高为宽:高 7:16 且进入滚动', () => {
    expect(calculateFixedViewportHeight(640)).toBe(1463);
    expect(calculateFixedViewportHeight(70)).toBe(160);
    const layout = calculateViewportLayout(0, 640, { ...DEFAULT_CONTENT }, 1463);
    expect(layout).toEqual({ height: 1463, scrollMode: true });
  });

  it('free 模式按内容高度展开，上限为宽度 20 倍，超高转滚动', () => {
    const content = { ...DEFAULT_CONTENT, display_mode: 'free' as const };
    const baseHeight = 160;
    const within = calculateViewportLayout(5000, 640, content, baseHeight);
    expect(within).toEqual({ height: 5000, scrollMode: false });
    const beyond = calculateViewportLayout(20000, 640, content, baseHeight);
    expect(beyond).toEqual({ height: 12800, scrollMode: true });
    const empty = calculateViewportLayout(0, 640, content, baseHeight);
    expect(empty).toEqual({ height: 160, scrollMode: true });
  });

  it('视口载荷携带协议版本与显示模式', () => {
    const payload = createViewportPayload(640, 1463, 1463, DEFAULT_CONTENT, true);
    expect(payload).toEqual({
      version: 1,
      displayMode: 'fixed',
      fixedRatio: '7:16',
      width: 640,
      height: 1463,
      baseHeight: 1463,
      maxHeight: 1463,
      scrollMode: true,
    });
    const free = createViewportPayload(640, 5000, 160, { ...DEFAULT_CONTENT, display_mode: 'free' }, false);
    expect(free.maxHeight).toBe(12800);
  });
});
