import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, PluginRecord } from 'chips-sdk';
import type { BasecardDescriptor } from '../../src/basecard-runtime/contracts';
import {
  createInitialBasecardConfig,
  getBasecardDescriptor,
  getInstalledBasecardDescriptors,
  getRegisteredBasecardDescriptors,
  normalizeBasecardConfig,
  syncInstalledBasecardDescriptors,
} from '../../src/basecard-runtime/registry';

function createPluginRecord(input: Partial<PluginRecord> & Pick<PluginRecord, 'id'>): PluginRecord {
  return {
    id: input.id,
    manifestPath: input.manifestPath ?? `/plugins/${input.id}/manifest.yaml`,
    enabled: input.enabled ?? true,
    version: input.version ?? '1.0.0',
    type: input.type ?? 'card',
    name: input.name ?? input.id,
    description: input.description,
    installPath: input.installPath ?? `/plugins/${input.id}`,
    capabilities: input.capabilities ?? [],
    entry: input.entry ?? 'dist/index.mjs',
    installedAt: input.installedAt ?? 0,
  };
}

function createClientStub(records: PluginRecord[]): Client {
  return {
    plugin: {
      query: vi.fn(async () => records),
    },
  } as unknown as Client;
}

const mockDescriptor: BasecardDescriptor = {
  pluginId: 'chips.basecard.mock',
  cardType: 'base.mock',
  displayName: 'Mock Basecard',
  description: 'Mock descriptor',
  icon: { name: 'extension' },
  aliases: ['MockCard'],
  createInitialConfig: (baseCardId) => ({ id: baseCardId, card_type: 'base.mock' }),
  normalizeConfig: (input, baseCardId) => ({ ...input, id: baseCardId, card_type: 'base.mock' }),
  validateConfig: () => ({ valid: true, errors: {} }),
  renderView: () => () => undefined,
};

afterEach(async () => {
  vi.restoreAllMocks();
  await syncInstalledBasecardDescriptors(createClientStub([]));
});

describe('basecard registry', () => {
  it('creates richtext starter content through the descriptor for new base cards', () => {
    expect(createInitialBasecardConfig('RichTextCard', 'base-1')).toMatchObject({
      card_type: 'base.richtext',
      content_format: 'markdown',
      content_source: 'inline',
      content_text: '# 富文本\n\n开始写点什么。',
      locale: 'zh-CN',
      markdown_capabilities: {
        commonmark: true,
        gfm: true,
        math: true,
        highlight: true,
        underline: true,
        superscript: true,
        subscript: true,
      },
    });
  });

  it('creates an empty image config through the descriptor for new image base cards', () => {
    expect(createInitialBasecardConfig('ImageCard', 'base-2')).toMatchObject({
      card_type: 'ImageCard',
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

  it('creates webpage starter config through the descriptor and resolves the alias', () => {
    expect(createInitialBasecardConfig('WebPageCard', 'base-3')).toMatchObject({
      card_type: 'WebPageCard',
      source_type: 'url',
      source_url: '',
      bundle_root: '',
      entry_file: 'index.html',
      resource_paths: [],
      display_mode: 'fixed',
      fixed_ratio: '7:16',
      max_height_ratio: 20,
    });
    expect(getBasecardDescriptor('base.webpage')?.pluginId).toBe('chips.basecard.webpage');
    expect(getBasecardDescriptor('base.webpage')?.previewPointerEvents).toBe('shielded');
  });

  it('normalizes image resource paths and collects only card-root file references', () => {
    const descriptor = getBasecardDescriptor('base.image');
    if (!descriptor?.collectResourcePaths) {
      throw new Error('图片基础卡片描述符未注册资源路径收集器');
    }

    const normalized = normalizeBasecardConfig('base.image', 'base-3', {
      card_type: 'ImageCard',
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

    expect(normalized.card_type).toBe('ImageCard');
    expect((normalized.images as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'image-1',
      source: 'file',
      file_path: 'cover.png',
    });
    expect(descriptor.collectResourcePaths(normalized)).toEqual(['cover.png']);
  });

  it('keeps builtin descriptors available while adding valid installed basecard plugins', async () => {
    await syncInstalledBasecardDescriptors(
      createClientStub([
        createPluginRecord({
          id: 'chips.basecard.mock',
          name: 'Mock Basecard',
          installPath: '/plugins/mock-card',
          entry: 'dist/index.mjs',
          capabilities: ['base.mock'],
        }),
      ]),
      async (moduleUrl) => {
        expect(moduleUrl).toBe('file:///plugins/mock-card/dist/index.mjs');
        return { basecardDefinition: mockDescriptor };
      },
    );

    const registeredCardTypes = getRegisteredBasecardDescriptors().map((descriptor) => descriptor.cardType);
    expect(registeredCardTypes).toContain('base.richtext');
    expect(registeredCardTypes).toContain('base.image');
    expect(registeredCardTypes).toContain('base.webpage');
    expect(registeredCardTypes).toContain('base.mock');
    expect(getInstalledBasecardDescriptors().map((descriptor) => descriptor.cardType)).toEqual(['base.mock']);
    expect(getBasecardDescriptor('MockCard')?.cardType).toBe('base.mock');
  });

  it('isolates invalid installed plugins instead of clearing the whole registry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await syncInstalledBasecardDescriptors(
      createClientStub([
        createPluginRecord({
          id: 'chips.basecard.good',
          name: 'Good Basecard',
          installPath: '/plugins/good-card',
          entry: 'dist/index.mjs',
          capabilities: ['base.mock'],
        }),
        createPluginRecord({
          id: 'chips.basecard.bad',
          name: 'Bad Basecard',
          installPath: '/plugins/bad-card',
          entry: 'dist/index.mjs',
          capabilities: ['base.bad'],
        }),
      ]),
      async (moduleUrl) => (
        moduleUrl.includes('/bad-card/')
          ? {}
          : { basecardDefinition: mockDescriptor }
      ),
    );

    const registeredCardTypes = getRegisteredBasecardDescriptors().map((descriptor) => descriptor.cardType);
    expect(registeredCardTypes).toContain('base.richtext');
    expect(registeredCardTypes).toContain('base.mock');
    expect(registeredCardTypes).not.toContain('base.bad');
    expect(consoleError).toHaveBeenCalledWith(
      '[BasecardRegistry] Failed to load installed basecard plugin.',
      expect.objectContaining({ pluginId: 'chips.basecard.bad' }),
    );
  });
});
