import { describe, expect, it } from 'vitest';
import {
  collectReferences,
  createDefaultCoverHtml,
  createImageHtml,
  normalizeRatio,
  validateRatio,
} from '../../src/cover';

describe('cover 模块契约测试', () => {
  describe('createDefaultHtml', () => {
    it('生成包含卡片名称的默认封面', () => {
      const html = createDefaultCoverHtml({ name: '生态介绍' });
      expect(html).toContain('生态介绍');
      expect(html).toContain('<!doctype html>');
    });

    it('转义 HTML 特殊字符', () => {
      const html = createDefaultCoverHtml({ name: '<script>alert(1)</script>' });
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
    });
  });

  describe('createImageHtml', () => {
    it('生成图片封面并标记图片来源', () => {
      const html = createImageHtml({ imageSrc: 'cardcover/cover.png' });
      expect(html).toContain('data-chips-cover-image-source="cardcover/cover.png"');
      expect(html).toContain('object-fit: cover');
    });
  });

  describe('normalizeRatio', () => {
    it('默认 3:4', () => {
      expect(normalizeRatio({})).toBe('3:4');
      expect(normalizeRatio({ value: undefined })).toBe('3:4');
      expect(normalizeRatio({ value: 'invalid' })).toBe('3:4');
    });

    it('容忍 / 与 : 混写', () => {
      expect(normalizeRatio({ value: '16/9' })).toBe('16:9');
      expect(normalizeRatio({ value: '16:9' })).toBe('16:9');
      expect(normalizeRatio({ value: '1:1.414' })).toBe('1:1.414');
    });
  });

  describe('validateRatio', () => {
    it('合法比例通过', () => {
      expect(validateRatio({ value: '3:4' }).valid).toBe(true);
      expect(validateRatio({ value: '16:9' }).normalized).toBe('16:9');
    });

    it('非法输入拒绝', () => {
      expect(validateRatio({ value: 'abc' }).valid).toBe(false);
      expect(validateRatio({ value: '' }).valid).toBe(false);
      expect(validateRatio({ value: undefined }).valid).toBe(false);
    });
  });

  describe('collectReferences', () => {
    it('收集 src/href/poster/data-chips-cover-image-source/url() 引用', () => {
      const html = [
        '<img src="cardcover/a.png" />',
        '<link href="cardcover/b.css" />',
        '<video poster="cardcover/c.jpg" />',
        '<img data-chips-cover-image-source="cardcover/d.png" />',
        '<div style="background: url(cardcover/e.png)"></div>',
      ].join('');
      const references = collectReferences({ html });
      expect(references.sort()).toEqual([
        'cardcover/a.png',
        'cardcover/b.css',
        'cardcover/c.jpg',
        'cardcover/d.png',
        'cardcover/e.png',
      ]);
    });

    it('忽略外部 URL 与非 cardcover 引用', () => {
      const html = '<img src="https://example.com/a.png" /><img src="other/b.png" />';
      expect(collectReferences({ html })).toEqual([]);
    });

    it('拒绝 .. 逃逸路径', () => {
      expect(collectReferences({ html: '<img src="cardcover/../../etc/passwd" />' })).toEqual([]);
    });
  });
});
