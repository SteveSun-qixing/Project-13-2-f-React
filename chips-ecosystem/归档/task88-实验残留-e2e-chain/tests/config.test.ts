import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, readConfig, readDraft, readText, validateConfig } from '../src/config';

describe('readConfig', () => {
  it('配置缺失时回退默认值', () => {
    expect(readConfig({})).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ config: 'invalid' })).toEqual(DEFAULT_CONFIG);
  });

  it('读取合法配置并允许部分字段', () => {
    expect(readConfig({ config: { fontSize: 20 } })).toEqual({ fontSize: 20, lineHeight: 1.6 });
  });
});

describe('validateConfig', () => {
  it('接受空配置与缺省字段', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
    expect(validateConfig({ fontSize: 16, lineHeight: 1.6 })).toBe(true);
  });

  it('拒绝非对象与越界值', () => {
    expect(validateConfig('markdown')).toBe(false);
    expect(validateConfig({ fontSize: 8 })).toBe(false);
    expect(validateConfig({ fontSize: 16.5 })).toBe(false);
    expect(validateConfig({ lineHeight: 0.5 })).toBe(false);
  });
});

describe('readText 与 readDraft', () => {
  it('读取正文并容忍缺失字段', () => {
    expect(readText({ content_text: '你好' })).toBe('你好');
    expect(readText({})).toBe('');
  });

  it('生成完整草稿', () => {
    expect(readDraft({ content_text: '你好', config: { fontSize: 18, lineHeight: 1.5 } })).toEqual({
      text: '你好',
      fontSize: 18,
      lineHeight: 1.5,
    });
  });
});
