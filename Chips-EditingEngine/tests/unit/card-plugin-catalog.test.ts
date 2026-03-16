import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listInstalledCardTypes } from '../../src/services/card-plugin-catalog';

const query = vi.fn();

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    plugin: {
      query,
    },
    events: {
      on: () => () => undefined,
    },
  }),
}));

describe('card-plugin-catalog', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('lists card types only from enabled plugins returned by Host', async () => {
    query.mockResolvedValue([
      {
        id: 'chips.basecard.image',
        enabled: true,
        name: '图片基础卡片插件',
        description: '图片基础卡片',
        capabilities: ['base.image'],
      },
      {
        id: 'chips.basecard.richtext',
        enabled: true,
        name: '富文本基础卡片插件',
        description: '富文本基础卡片',
        capabilities: ['base.richtext'],
      },
      {
        id: 'chips.basecard.disabled',
        enabled: false,
        name: '停用卡片',
        description: '不应展示',
        capabilities: ['base.disabled'],
      },
    ]);

    await expect(listInstalledCardTypes()).resolves.toMatchObject([
      {
        id: 'base.richtext',
        name: '富文本基础卡片插件',
      },
      {
        id: 'base.image',
        name: '图片基础卡片插件',
      },
    ]);

    expect(query).toHaveBeenCalledWith({ type: 'card' });
  });

  it('deduplicates repeated card types from multiple installed plugins', async () => {
    query.mockResolvedValue([
      {
        id: 'chips.basecard.image',
        enabled: true,
        name: '图片基础卡片插件',
        description: '图片基础卡片',
        capabilities: ['base.image'],
      },
      {
        id: 'chips.basecard.image.override',
        enabled: true,
        name: '图片基础卡片插件镜像',
        description: '重复能力',
        capabilities: ['base.image'],
      },
    ]);

    const result = await listInstalledCardTypes();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('base.image');
  });
});
