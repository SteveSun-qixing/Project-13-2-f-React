import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  analyzeHyperlinkUrl,
  buildContent,
  DEFAULT_CONFIG,
  readConfig,
  validateConfig,
} from '../src/config';
import { createInitialContent, collectResourcePaths } from '../src/main';

function createBasecard(content: Record<string, unknown>): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.hyperlink',
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

describe('validateConfig', () => {
  it('接受空配置与未提供配置', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
  });

  it('接受类型合法的完整配置', () => {
    expect(
      validateConfig({
        anchor_text: '薯片生态官网',
        url: 'https://chips.example.com',
        description: '官网首页',
        icon_url: 'https://chips.example.com/icon.png',
        display_density: 'compact',
        show_security_hint: false,
      })
    ).toBe(true);
  });

  it('拒绝非对象与字段类型错误', () => {
    expect(validateConfig('hyperlink')).toBe(false);
    expect(validateConfig(['url'])).toBe(false);
    expect(validateConfig({ anchor_text: 1 })).toBe(false);
    expect(validateConfig({ url: true })).toBe(false);
    expect(validateConfig({ description: null })).toBe(false);
    expect(validateConfig({ display_density: 'dense' })).toBe(false);
    expect(validateConfig({ show_security_hint: 'yes' })).toBe(false);
  });

  it('非空 url 与 icon_url 必须是可打开的 http(s) 地址', () => {
    expect(validateConfig({ url: 'https://chips.example.com' })).toBe(true);
    expect(validateConfig({ url: 'http://chips.example.com' })).toBe(true);
    expect(validateConfig({ url: 'ftp://chips.example.com' })).toBe(false);
    expect(validateConfig({ url: 'https://user:pass@chips.example.com' })).toBe(false);
    expect(validateConfig({ url: '不是地址' })).toBe(false);
    expect(validateConfig({ icon_url: 'https://chips.example.com/i.png' })).toBe(true);
    expect(validateConfig({ icon_url: 'javascript:alert(1)' })).toBe(false);
  });
});

describe('readConfig 归一', () => {
  it('非法字段回退默认值', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('text')).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ display_density: 'dense' })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ show_security_hint: 'yes' }).show_security_hint).toBe(true);
  });

  it('保留合法字段并归一 URL', () => {
    expect(
      readConfig({ anchor_text: ' 标题 ', url: 'https://chips.example.com/a?b=1' })
    ).toEqual({
      ...DEFAULT_CONFIG,
      anchor_text: '标题',
      url: 'https://chips.example.com/a?b=1',
    });
    expect(readConfig({ url: 'https://chips.example.com' }).url).toBe(
      'https://chips.example.com/'
    );
    expect(readConfig({ url: '不是地址' }).url).toBe('不是地址');
  });
});

describe('analyzeHyperlinkUrl', () => {
  it('空输入与非法输入', () => {
    expect(analyzeHyperlinkUrl('').reason).toBe('empty');
    expect(analyzeHyperlinkUrl(undefined).reason).toBe('empty');
    expect(analyzeHyperlinkUrl('不是地址').reason).toBe('invalid');
  });

  it('协议与主机判定', () => {
    expect(analyzeHyperlinkUrl('ftp://a.com').reason).toBe('unsupported-protocol');
    expect(analyzeHyperlinkUrl('javascript:alert(1)').reason).toBe('unsupported-protocol');
    expect(analyzeHyperlinkUrl('https://').reason).toBe('missing-host');
  });

  it('凭据阻断与安全分级', () => {
    expect(analyzeHyperlinkUrl('https://user:pass@a.com').reason).toBe('credentials-blocked');
    const https = analyzeHyperlinkUrl('https://a.com/');
    expect(https.openable).toBe(true);
    expect(https.level).toBe('secure');
    const http = analyzeHyperlinkUrl('http://a.com/');
    expect(http.openable).toBe(true);
    expect(http.level).toBe('warning');
    expect(http.reason).toBe('insecure-http');
  });
});

describe('主进程纯函数', () => {
  it('createInitialContent 通过 validateConfig 并含 card_type 与 config', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe('base.hyperlink');
    expect(validateConfig(content['config'])).toBe(true);
    expect(readConfig(content['config'])).toEqual(DEFAULT_CONFIG);
  });

  it('collectResourcePaths 恒为空数组（http(s) 引用不进入资源清单）', () => {
    const basecard = createBasecard(
      buildContent({
        ...DEFAULT_CONFIG,
        url: 'https://chips.example.com',
        icon_url: 'https://chips.example.com/icon.png',
      })
    );
    expect(collectResourcePaths(basecard)).toEqual([]);
  });
});
