import { describe, expect, it } from 'vitest';
import {
  BASE_CARD_REGISTRY,
  getCardTypeDefinition,
  getCardTypeName,
  getCardTypeIcon,
} from '../../src/basecards/registry';

describe('BaseCardRegistry', () => {
  describe('BASE_CARD_REGISTRY', () => {
    it('应该包含所有 8 种基础卡片类型', () => {
      expect(BASE_CARD_REGISTRY.length).toBe(8);

      const types = BASE_CARD_REGISTRY.map(card => card.type);
      expect(types).toContain('chips.basecard.rich-text');
      expect(types).toContain('chips.basecard.image');
      expect(types).toContain('chips.basecard.video');
      expect(types).toContain('chips.basecard.audio');
      expect(types).toContain('chips.basecard.webpage');
      expect(types).toContain('chips.basecard.file');
      expect(types).toContain('chips.basecard.table');
      expect(types).toContain('chips.basecard.code');
    });

    it('每个基础卡片都应该有必要的字段', () => {
      BASE_CARD_REGISTRY.forEach(card => {
        expect(card.type).toBeTruthy();
        expect(card.name).toBeTruthy();
        expect(card.description).toBeTruthy();
        expect(card.icon).toBeTruthy();
        expect(card.defaultConfig).toBeDefined();
      });
    });
  });

  describe('getCardTypeDefinition', () => {
    it('应该返回对应类型的定义', () => {
      const def = getCardTypeDefinition('chips.basecard.rich-text');
      expect(def).toBeDefined();
      expect(def?.name).toBe('富文本');
    });

    it('对未知类型应该返回 undefined', () => {
      const def = getCardTypeDefinition('unknown.type');
      expect(def).toBeUndefined();
    });
  });

  describe('getCardTypeName', () => {
    it('应该返回类型的中文名称', () => {
      expect(getCardTypeName('chips.basecard.image')).toBe('图片');
      expect(getCardTypeName('chips.basecard.video')).toBe('视频');
    });

    it('对未知类型应该返回类型字符串', () => {
      expect(getCardTypeName('unknown.type')).toBe('unknown.type');
    });
  });

  describe('getCardTypeIcon', () => {
    it('应该返回对应的 React 图标组件', () => {
      const icon = getCardTypeIcon('chips.basecard.rich-text');
      expect(icon).toBeTruthy();
    });

    it('对未知类型应该返回 null', () => {
      const icon = getCardTypeIcon('unknown.type');
      expect(icon).toBeNull();
    });
  });

  describe('defaultConfig', () => {
    it('富文本应该有 content 默认配置', () => {
      const def = getCardTypeDefinition('chips.basecard.rich-text');
      expect(def?.defaultConfig).toHaveProperty('content');
    });

    it('图片应该有 src 和 alt 默认配置', () => {
      const def = getCardTypeDefinition('chips.basecard.image');
      expect(def?.defaultConfig).toHaveProperty('src');
      expect(def?.defaultConfig).toHaveProperty('alt');
    });

    it('表格应该有 rows、columns 和 data', () => {
      const def = getCardTypeDefinition('chips.basecard.table');
      expect(def?.defaultConfig).toHaveProperty('rows');
      expect(def?.defaultConfig).toHaveProperty('columns');
      expect(def?.defaultConfig).toHaveProperty('data');
      expect(Array.isArray((def?.defaultConfig as any).data)).toBe(true);
    });
  });
});
