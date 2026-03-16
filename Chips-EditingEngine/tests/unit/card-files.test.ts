import { beforeEach, describe, expect, it, vi } from 'vitest';
import yaml from 'yaml';
import { createCardInitializer } from '../../src/core/card-initializer';
import { createCardService } from '../../src/core/card-service';

type MockEntry = {
  path: string;
  isDirectory: boolean;
};

const { mockFileService } = vi.hoisted(() => ({
  mockFileService: {
    readText: vi.fn<[string], Promise<string>>(),
    writeText: vi.fn<[string, string], Promise<void>>(),
    writeBinary: vi.fn<[string, Uint8Array], Promise<void>>(),
    stat: vi.fn<[string], Promise<{ path: string; size: number; isFile: boolean; isDirectory: boolean; mtimeMs: number }>>(),
    exists: vi.fn<[string], Promise<boolean>>(),
    ensureDir: vi.fn<[string], Promise<void>>(),
    list: vi.fn<[string], Promise<MockEntry[]>>(),
    stat: vi.fn<[string], Promise<{ size: number; isDirectory: boolean; isFile: boolean; mtimeMs?: number }>>(),
    delete: vi.fn<[string], Promise<void>>(),
  },
}));

vi.mock('../../src/services/file-service', () => ({
  fileService: mockFileService,
}));

vi.mock('../../src/services/basecard-service', () => ({
  basecardService: {
    normalizeSnapshot: vi.fn(async (options: {
      cardType: string;
      baseCardId?: string;
      sourceConfig?: Record<string, unknown>;
    }) => {
      const baseCardId = options.baseCardId ?? 'generated-basecard';
      const sourceConfig = options.sourceConfig ?? {};
      const body = typeof sourceConfig.body === 'string'
        ? sourceConfig.body
        : typeof sourceConfig.content_text === 'string'
          ? sourceConfig.content_text
          : '<p></p>';

      return {
        pluginId: 'chips.basecard.richtext',
        cardType: 'base.richtext',
        baseCardId,
        displayName: '富文本基础卡片',
        normalizedConfig: {
          id: baseCardId,
          body,
          locale: typeof sourceConfig.locale === 'string' ? sourceConfig.locale : 'zh-CN',
        },
        validation: { valid: true, issues: [] },
        referencedResources: [],
        commitDebounceMs: 260,
        supportsEditor: true,
      };
    }),
  },
}));

describe('unpacked .card files', () => {
  const files = new Map<string, string>();
  const directories = new Set<string>();

  const setFile = (filePath: string, content: string) => {
    files.set(filePath, content);
    const parent = filePath.split('/').slice(0, -1).join('/');
    if (parent) {
      directories.add(parent);
    }
  };

  const seedCardDirectory = () => {
    directories.add('/workspace/demo.card');
    directories.add('/workspace/demo.card/.card');
    directories.add('/workspace/demo.card/content');

    setFile('/workspace/demo.card/.card/metadata.yaml', yaml.stringify({
      chip_standards_version: '1.0.0',
      card_id: 'demo-card',
      name: '生态介绍',
      created_at: '2026-03-13T00:00:00.000Z',
      modified_at: '2026-03-13T00:00:00.000Z',
      theme: 'chips-official.default-theme',
      cover_ratio: '3:4',
      description: '测试卡片',
      tags: ['chips'],
    }));

    setFile('/workspace/demo.card/.card/structure.yaml', yaml.stringify({
      structure: [
        {
          id: 'intro',
          type: 'base.richtext',
          created_at: '2026-03-13T00:00:00.000Z',
          modified_at: '2026-03-13T00:00:00.000Z',
        },
        {
          id: 'details',
          type: 'base.richtext',
          created_at: '2026-03-13T00:00:00.000Z',
          modified_at: '2026-03-13T00:00:00.000Z',
        },
      ],
      manifest: {
        card_count: 2,
        resource_count: 0,
        resources: [],
      },
    }));

    setFile('/workspace/demo.card/content/intro.yaml', yaml.stringify({
      card_type: 'base.richtext',
      content_text: '<h1>Intro</h1><p>Hello Chips.</p>',
    }));

    setFile('/workspace/demo.card/content/details.yaml', yaml.stringify({
      id: 'details',
      body: '<p>Second node body.</p>',
      locale: 'zh-CN',
    }));

    setFile('/workspace/demo.card/content/legacy-unused.yaml', yaml.stringify({
      id: 'legacy-unused',
      body: '<p>Unused</p>',
    }));
  };

  beforeEach(() => {
    files.clear();
    directories.clear();
    vi.clearAllMocks();

    mockFileService.readText.mockImplementation(async (filePath) => {
      const content = files.get(filePath);
      if (content === undefined) {
        throw new Error(`Missing file: ${filePath}`);
      }
      return content;
    });

    mockFileService.writeText.mockImplementation(async (filePath, content) => {
      setFile(filePath, content);
    });

    mockFileService.writeBinary.mockImplementation(async (filePath, content) => {
      setFile(filePath, Buffer.from(content).toString('base64'));
    });

    mockFileService.stat.mockImplementation(async (targetPath) => {
      const fileContent = files.get(targetPath);
      if (fileContent !== undefined) {
        const isTextFile = /\.(ya?ml|html|md|json|txt)$/i.test(targetPath);
        return {
          path: targetPath,
          size: isTextFile
            ? Buffer.byteLength(fileContent, 'utf-8')
            : Buffer.from(fileContent, 'base64').byteLength,
          isFile: true,
          isDirectory: false,
          mtimeMs: Date.now(),
        };
      }

      if (directories.has(targetPath)) {
        return {
          path: targetPath,
          size: 0,
          isFile: false,
          isDirectory: true,
          mtimeMs: Date.now(),
        };
      }

      throw new Error(`Missing path: ${targetPath}`);
    });

    mockFileService.exists.mockImplementation(async (targetPath) => {
      return files.has(targetPath) || directories.has(targetPath);
    });

    mockFileService.ensureDir.mockImplementation(async (targetPath) => {
      directories.add(targetPath);
    });

    mockFileService.list.mockImplementation(async (dirPath) => {
      const prefix = `${dirPath}/`;
      return Array.from(files.keys())
        .filter((filePath) => filePath.startsWith(prefix) && !filePath.slice(prefix.length).includes('/'))
        .map((filePath) => ({
          path: filePath,
          isDirectory: false,
        }));
    });

    mockFileService.stat.mockImplementation(async (targetPath) => {
      if (files.has(targetPath)) {
        const content = files.get(targetPath) ?? '';
        return {
          size: Buffer.byteLength(content),
          isDirectory: false,
          isFile: true,
        };
      }

      if (directories.has(targetPath)) {
        return {
          size: 0,
          isDirectory: true,
          isFile: false,
        };
      }

      throw new Error(`Missing path: ${targetPath}`);
    });

    mockFileService.delete.mockImplementation(async (targetPath) => {
      files.delete(targetPath);
    });
  });

  it('creates complete unpacked .card folders for new cards', async () => {
    const initializer = createCardInitializer({
      workspaceRoot: '/workspace',
    });

    const result = await initializer.createCard('new-card', '新卡片', {
      id: 'intro',
      type: 'base.richtext',
      config: {
        id: 'intro',
        body: '<p>你好</p>',
        locale: 'zh-CN',
      },
    });

    expect(result.success).toBe(true);
    expect(result.cardPath).toBe('/workspace/new-card.card');
    expect(directories.has('/workspace/new-card.card/.card')).toBe(true);
    expect(directories.has('/workspace/new-card.card/content')).toBe(true);

    const metadata = yaml.parse(files.get('/workspace/new-card.card/.card/metadata.yaml') ?? '');
    const structure = yaml.parse(files.get('/workspace/new-card.card/.card/structure.yaml') ?? '');
    const content = yaml.parse(files.get('/workspace/new-card.card/content/intro.yaml') ?? '');

    expect(metadata.name).toBe('新卡片');
    expect(metadata.cover_ratio).toBe('3:4');
    expect(structure.structure).toHaveLength(1);
    expect(content.body).toBe('<p>你好</p>');
    expect(files.get('/workspace/new-card.card/.card/cover.html')).toContain('新卡片');
    expect(files.get('/workspace/new-card.card/.card/cover.html')).toContain('<base href="../"');
  });

  it('opens unpacked .card directories and persists normalized base card updates', async () => {
    seedCardDirectory();
    const service = createCardService();

    const card = await service.openCard('demo-card', '/workspace/demo.card');

    expect(card.metadata.name).toBe('生态介绍');
    expect(card.metadata.coverRatio).toBe('3:4');
    expect(card.structure.basicCards).toHaveLength(2);
    expect(card.structure.basicCards[0]).toMatchObject({
      id: 'intro',
      type: 'base.richtext',
      data: {
        id: 'intro',
        body: '<h1>Intro</h1><p>Hello Chips.</p>',
        locale: 'zh-CN',
      },
    });

    service.removeBasicCard('demo-card', 'details');
    service.updateBasicCard('demo-card', 'intro', {
      id: 'intro',
      body: '<p>已更新</p>',
      locale: 'zh-CN',
    });
    await service.saveCard('demo-card');

    const persistedStructure = yaml.parse(files.get('/workspace/demo.card/.card/structure.yaml') ?? '');
    const persistedIntro = yaml.parse(files.get('/workspace/demo.card/content/intro.yaml') ?? '');

    expect(persistedStructure.structure).toHaveLength(1);
    expect(persistedStructure.structure[0]?.type).toBe('base.richtext');
    expect(persistedIntro).toMatchObject({
      id: 'intro',
      body: '<p>已更新</p>',
      locale: 'zh-CN',
    });
    expect(files.has('/workspace/demo.card/content/details.yaml')).toBe(false);
    expect(files.has('/workspace/demo.card/content/legacy-unused.yaml')).toBe(false);
    expect(files.get('/workspace/demo.card/.card/cover.html')).toContain('生态介绍');
    expect(files.get('/workspace/demo.card/.card/cover.html')).toContain('<base href="../"');
  });

  it('persists cover html, cover ratio and uploaded cover resources into the unpacked .card structure', async () => {
    seedCardDirectory();
    const service = createCardService();
    await service.openCard('demo-card', '/workspace/demo.card');

    service.updateCardCover('demo-card', {
      html: '<!doctype html><html><body><img src="./cardcover/cover-image.png" alt="" /></body></html>',
      ratio: '16:9',
      resources: [
        {
          path: 'cardcover/cover-image.png',
          data: new Uint8Array([137, 80, 78, 71]),
        },
      ],
    });
    await service.saveCard('demo-card');

    const metadata = yaml.parse(files.get('/workspace/demo.card/.card/metadata.yaml') ?? '');
    const structure = yaml.parse(files.get('/workspace/demo.card/.card/structure.yaml') ?? '');
    expect(metadata.cover_ratio).toBe('16:9');
    expect(files.get('/workspace/demo.card/.card/cover.html')).toContain('<base href="../"');
    expect(files.get('/workspace/demo.card/.card/cover.html')).toContain('./cardcover/cover-image.png');
    expect(files.get('/workspace/demo.card/cardcover/cover-image.png')).toBe(Buffer.from([137, 80, 78, 71]).toString('base64'));
    expect(structure.manifest).toMatchObject({
      resource_count: 1,
      resources: [
        {
          path: 'cardcover/cover-image.png',
          size: 4,
          type: 'image/png',
        },
      ],
    });
  });

  it('writes imported base card resources into the card root and finalizes deletions on save', async () => {
    seedCardDirectory();
    setFile('/workspace/demo.card/legacy-photo.png', Buffer.from([1, 2, 3]).toString('base64'));

    const service = createCardService();
    await service.openCard('demo-card', '/workspace/demo.card');

    service.updateBasicCard(
      'demo-card',
      'intro',
      {
        id: 'intro',
        locale: 'zh-CN',
        images: [
          {
            id: 'img-1',
            source: 'file',
            file_path: 'hero-photo.png',
          },
        ],
      },
      {
        imports: [
          {
            path: 'hero-photo.png',
            data: new Uint8Array([137, 80, 78, 71]),
            mimeType: 'image/png',
          },
        ],
        deletions: ['legacy-photo.png'],
      },
    );

    await service.saveCard('demo-card');

    const structure = yaml.parse(files.get('/workspace/demo.card/.card/structure.yaml') ?? '');

    expect(files.get('/workspace/demo.card/hero-photo.png')).toBe(Buffer.from([137, 80, 78, 71]).toString('base64'));
    expect(files.has('/workspace/demo.card/legacy-photo.png')).toBe(false);
    expect(structure.manifest.resource_count).toBe(1);
    expect(structure.manifest.resources).toEqual([
      {
        path: 'hero-photo.png',
        size: 4,
        type: 'image/png',
      },
    ]);
  });

  it('serializes rapid base card updates and persists the latest snapshot before preview refresh signals advance', async () => {
    seedCardDirectory();

    let releaseFirstIntroWrite: (() => void) | null = null;
    let firstIntroWriteBlocked = false;

    mockFileService.writeText.mockImplementation(async (filePath, content) => {
      if (filePath === '/workspace/demo.card/content/intro.yaml' && !firstIntroWriteBlocked) {
        firstIntroWriteBlocked = true;
        await new Promise<void>((resolve) => {
          releaseFirstIntroWrite = resolve;
        });
      }
      setFile(filePath, content);
    });

    const service = createCardService();
    await service.openCard('demo-card', '/workspace/demo.card');

    service.updateBasicCard('demo-card', 'intro', {
      id: 'intro',
      body: '<p>first</p>',
      locale: 'zh-CN',
    });
    service.updateBasicCard('demo-card', 'intro', {
      id: 'intro',
      body: '<p>second</p>',
      locale: 'zh-CN',
    });

    const pendingCard = service.getCard('demo-card');
    expect(pendingCard?.isPersisting).toBe(true);
    expect(pendingCard?.persistedRevision ?? 0).toBe(0);
    expect(pendingCard?.pendingPersistRevision).toBe(2);

	    for (let attempt = 0; attempt < 20 && !releaseFirstIntroWrite; attempt += 1) {
	      await Promise.resolve();
	    }
	    expect(releaseFirstIntroWrite).toBeTypeOf('function');
	    if (!releaseFirstIntroWrite) {
	      throw new Error('Expected pending intro write gate to be installed.');
	    }
	    (releaseFirstIntroWrite as () => void)();
	    await service.saveCard('demo-card');

    const latestCard = service.getCard('demo-card');
    const persistedIntro = yaml.parse(files.get('/workspace/demo.card/content/intro.yaml') ?? '');

    expect(latestCard?.persistedRevision).toBe(2);
    expect(latestCard?.isPersisting).toBe(false);
    expect(persistedIntro).toMatchObject({
      id: 'intro',
      body: '<p>second</p>',
      locale: 'zh-CN',
    });
  });

  it('replaces base card data with the authoritative normalized payload instead of merging legacy fields', async () => {
    seedCardDirectory();
    const service = createCardService();
    await service.openCard('demo-card', '/workspace/demo.card');

    const card = service.getCard('demo-card');
    const intro = card?.structure.basicCards.find((item) => item.id === 'intro');
    if (!intro) {
      throw new Error('Expected intro base card to exist.');
    }

    intro.data = {
      id: 'intro',
      body: '<p>legacy</p>',
      locale: 'zh-CN',
      content_text: '<p>legacy-content-text</p>',
      legacyFlag: true,
    };

    service.updateBasicCard('demo-card', 'intro', {
      id: 'intro',
      body: '<p>normalized</p>',
      locale: 'zh-CN',
    });
    await service.saveCard('demo-card');

    const persistedIntro = yaml.parse(files.get('/workspace/demo.card/content/intro.yaml') ?? '');
    expect(persistedIntro).toEqual({
      id: 'intro',
      body: '<p>normalized</p>',
      locale: 'zh-CN',
    });
  });
});
