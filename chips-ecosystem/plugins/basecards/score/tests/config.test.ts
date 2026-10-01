import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  CARD_TYPE_ID,
  collectConfigErrors,
  DEFAULT_CONFIG,
  formatScoreNumber,
  getScoreRatio,
  MAX_TOTAL_SCORE,
  MIN_TOTAL_SCORE,
  readConfig,
  SYMBOL_SCORE_TOTAL,
  validateConfig,
} from '../src/config';
import { createInitialContent, collectResourcePaths } from '../src/main';

function createBasecard(content: Record<string, unknown>): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.score',
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
    expect(validateConfig({ style: 'stars', score: 4, total_score: 5 })).toBe(true);
    expect(validateConfig({ style: 'hearts', score: 5, total_score: 5 })).toBe(true);
    expect(validateConfig({ style: 'score', score: 88.5, total_score: 100 })).toBe(true);
    expect(validateConfig({ style: 'progress', score: 0, total_score: 1 })).toBe(true);
  });

  it('拒绝非对象与字段类型错误', () => {
    expect(validateConfig('score')).toBe(false);
    expect(validateConfig(['stars'])).toBe(false);
    expect(validateConfig({ style: 42 })).toBe(false);
    expect(validateConfig({ score: '4' })).toBe(false);
    expect(validateConfig({ total_score: '5' })).toBe(false);
    expect(validateConfig({ style: 'rating' })).toBe(false);
  });

  it('总分必须落在 1–100000（数值样式口径）', () => {
    expect(validateConfig({ style: 'score', total_score: MIN_TOTAL_SCORE })).toBe(true);
    expect(validateConfig({ style: 'score', total_score: MAX_TOTAL_SCORE })).toBe(true);
    expect(validateConfig({ style: 'score', total_score: 0 })).toBe(false);
    expect(validateConfig({ style: 'score', total_score: -5 })).toBe(false);
    expect(validateConfig({ style: 'score', total_score: MAX_TOTAL_SCORE + 1 })).toBe(false);
    expect(validateConfig({ style: 'stars', total_score: 10 })).toBe(false);
  });

  it('获得分数必须非负且不超过总分', () => {
    expect(validateConfig({ style: 'score', score: 100, total_score: 100 })).toBe(true);
    expect(validateConfig({ style: 'score', score: -0.1, total_score: 100 })).toBe(false);
    expect(validateConfig({ style: 'score', score: 100.5, total_score: 100 })).toBe(false);
  });

  it('星星与爱心固定五分制且分数为整数', () => {
    expect(validateConfig({ style: 'stars', score: 4, total_score: 5 })).toBe(true);
    expect(validateConfig({ style: 'stars', total_score: 10 })).toBe(false);
    expect(validateConfig({ style: 'hearts', score: 4.5 })).toBe(false);
    expect(validateConfig({ style: 'hearts', score: 6 })).toBe(false);
  });

  it('样式缺省按星星口径校验', () => {
    expect(validateConfig({ score: 4 })).toBe(true);
    expect(validateConfig({ score: 4.5 })).toBe(false);
    expect(validateConfig({ total_score: 10 })).toBe(false);
  });
});

describe('readConfig 归一', () => {
  it('非法或缺失字段回退默认值', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('text')).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ style: 'rating' })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ score: Number.NaN })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ total_score: 'abc' })).toEqual(DEFAULT_CONFIG);
  });

  it('保留合法字段', () => {
    expect(readConfig({ style: 'progress', score: 12.5, total_score: 40 })).toEqual({
      style: 'progress',
      score: 12.5,
      total_score: 40,
    });
  });

  it('数字字符串按旧族语义解析为数值', () => {
    expect(readConfig({ style: 'score', score: '18.4', total_score: '25' })).toEqual({
      style: 'score',
      score: 18.4,
      total_score: 25,
    });
  });

  it('符号样式总分强制为五分制且分数取整', () => {
    expect(readConfig({ style: 'stars', score: 3.6, total_score: 10 })).toEqual({
      style: 'stars',
      score: 4,
      total_score: SYMBOL_SCORE_TOTAL,
    });
    expect(readConfig({ style: 'hearts', score: 2.2, total_score: 100 })).toEqual({
      style: 'hearts',
      score: 2,
      total_score: SYMBOL_SCORE_TOTAL,
    });
  });

  it('数值样式分数钳制在 [0, 总分]，总分钳制在 [1, 100000]', () => {
    expect(readConfig({ style: 'score', score: 120, total_score: 100 })).toEqual({
      style: 'score',
      score: 100,
      total_score: 100,
    });
    expect(readConfig({ style: 'progress', score: -3, total_score: 0 })).toEqual({
      style: 'progress',
      score: 0,
      total_score: MIN_TOTAL_SCORE,
    });
    expect(readConfig({ style: 'score', total_score: MAX_TOTAL_SCORE * 2 }).total_score).toBe(
      MAX_TOTAL_SCORE
    );
  });

  it('符号样式切换钳制分数后再取整', () => {
    expect(readConfig({ style: 'stars', score: 4.4, total_score: SYMBOL_SCORE_TOTAL }).score).toBe(
      4
    );
  });
});

describe('getScoreRatio 计分比率', () => {
  it('常规比率并钳制到 [0, 1]', () => {
    expect(getScoreRatio({ score: 3, total_score: 5 })).toBe(0.6);
    expect(getScoreRatio({ score: 50, total_score: 100 })).toBe(0.5);
    expect(getScoreRatio({ score: 200, total_score: 100 })).toBe(1);
    expect(getScoreRatio({ score: -10, total_score: 100 })).toBe(0);
  });

  it('非法总分返回 0', () => {
    expect(getScoreRatio({ score: 3, total_score: 0 })).toBe(0);
    expect(getScoreRatio({ score: 3, total_score: Number.NaN })).toBe(0);
  });
});

describe('collectConfigErrors 字段级中文错误', () => {
  it('合法配置无错误', () => {
    expect(collectConfigErrors(readConfig({ style: 'stars', score: 4 }))).toEqual({});
    expect(collectConfigErrors(DEFAULT_CONFIG)).toEqual({});
  });

  it('字段错误带简体中文文案', () => {
    const errors = collectConfigErrors({
      style: 'stars',
      score: 4.5,
      total_score: 10,
    });
    expect(errors['total_score']).toContain('五分制');
    expect(errors['score']).toContain('整数');
  });
});

describe('formatScoreNumber 中文数字格式化', () => {
  it('最多保留两位小数', () => {
    expect(formatScoreNumber(4)).toBe('4');
    expect(formatScoreNumber(4.5)).toBe('4.5');
    expect(formatScoreNumber(88.265)).toBe('88.27');
  });
});

describe('主进程纯函数', () => {
  it('createInitialContent 通过 validateConfig 并含 card_type 与 config', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe(CARD_TYPE_ID);
    expect(validateConfig(content['config'])).toBe(true);
    expect(readConfig(content['config'])).toEqual(DEFAULT_CONFIG);
  });

  it('collectResourcePaths 恒为空数组（评分卡不引用包内资源）', () => {
    const basecard = createBasecard({
      card_type: CARD_TYPE_ID,
      config: { style: 'progress', score: 3, total_score: 8 },
    });
    expect(collectResourcePaths(basecard)).toEqual([]);
  });
});
