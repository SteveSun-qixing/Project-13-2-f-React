import { describe, expect, it } from 'vitest';
import {
  createInitialBasecardConfig,
  getBasecardDescriptor,
  normalizeBasecardConfig,
} from '../../src/basecard-runtime/registry';

describe('basecard registry', () => {
  it('creates richtext starter content through the descriptor for new base cards', () => {
    expect(createInitialBasecardConfig('base.richtext', 'base-1')).toMatchObject({
      id: 'base-1',
      body: '<p></p>',
      locale: 'zh-CN',
    });
  });

  it('creates an empty image config through the descriptor for new image base cards', () => {
    expect(createInitialBasecardConfig('base.image', 'base-2')).toMatchObject({
      card_type: 'base.image',
      images: [],
      layout_type: 'single',
      layout_options: {
        grid_mode: '2x2',
        single_width_percent: 100,
        single_alignment: 'center',
        spacing_mode: 'comfortable',
      },
    });
  });

  it('normalizes image resource paths and collects only card-root file references', () => {
    const descriptor = getBasecardDescriptor('base.image');
    if (!descriptor?.collectResourcePaths) {
      throw new Error('图片基础卡片描述符未注册资源路径收集器');
    }

    const normalized = normalizeBasecardConfig('base.image', 'base-3', {
      card_type: 'base.image',
      images: [
        {
          id: 'image-1',
          source: 'file',
          file_path: './cover.png',
        },
        {
          id: 'image-2',
          source: 'url',
          url: 'https://example.com/photo.png',
        },
      ],
      layout_type: 'grid',
    });

    expect(normalized.card_type).toBe('base.image');
    expect((normalized.images as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'image-1',
      source: 'file',
      file_path: 'cover.png',
    });
    expect(descriptor.collectResourcePaths(normalized)).toEqual(['cover.png']);
  });
});
