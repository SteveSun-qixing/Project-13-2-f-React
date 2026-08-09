import { beforeEach, describe, expect, it, vi } from 'vitest';
import yaml from 'yaml';
import { BoxDocumentService, DEFAULT_BOX_LAYOUT_TYPE } from '../../src/services/box-document-service';

const { mockFileService, mockClient } = vi.hoisted(() => ({
  mockFileService: {
    exists: vi.fn<[string], Promise<boolean>>(),
    mkdir: vi.fn<[string], Promise<void>>(),
    readText: vi.fn<[string], Promise<string>>(),
    writeText: vi.fn<[string, string], Promise<void>>(),
    writeBinary: vi.fn<[string, Uint8Array], Promise<void>>(),
    delete: vi.fn<[string], Promise<void>>(),
    copy: vi.fn<[string, string], Promise<void>>(),
  },
  mockClient: {
    box: {
      pack: vi.fn<[string, { outputPath?: string }?], Promise<string>>(),
      inspect: vi.fn<[string], Promise<any>>(),
      unpack: vi.fn<[string, string], Promise<string>>(),
      readMetadata: vi.fn<[string], Promise<any>>(),
      readLayoutDescriptor: vi.fn<[string], Promise<any>>(),
      normalizeLayoutConfig: vi.fn<[string, Record<string, unknown>], Promise<Record<string, unknown>>>(),
    },
    card: {
      readInfo: vi.fn<[string, string[]?], Promise<any>>(),
    },
    plugin: {
      query: vi.fn(async () => []),
    },
  },
}));

vi.mock('../../src/services/file-service', () => ({
  fileService: mockFileService,
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => mockClient,
}));

describe('BoxDocumentService', () => {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  let lastPackedSnapshot: {
    metadata?: Record<string, unknown>;
    content?: Record<string, unknown>;
    structure?: Record<string, unknown>;
  } = {};

  const createEmptyInspection = () => ({
    metadata: {
      chipStandardsVersion: '1.0.0',
      boxId: 'box1234567',
      name: 'Demo Box',
      createdAt: '2026-03-23T00:00:00.000Z',
      modifiedAt: '2026-03-23T00:00:00.000Z',
      activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
    },
    content: {
      activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
      layoutConfigs: {
        [DEFAULT_BOX_LAYOUT_TYPE]: {
          schemaVersion: '1.0.0',
          props: {},
          assetRefs: [],
        },
      },
    },
    entries: [],
    assets: [],
  });

  const toInspection = (packed: typeof lastPackedSnapshot) => ({
    metadata: {
      chipStandardsVersion: packed.metadata?.chip_standards_version,
      boxId: packed.metadata?.box_id,
      name: packed.metadata?.name,
      createdAt: packed.metadata?.created_at,
      modifiedAt: packed.metadata?.modified_at,
      activeLayoutType: packed.metadata?.active_layout_type,
      coverRatio: packed.metadata?.cover_ratio,
      description: packed.metadata?.description,
      tags: packed.metadata?.tags,
      coverAsset: packed.metadata?.cover_asset,
    },
    content: {
      activeLayoutType: packed.content?.active_layout_type,
      layoutConfigs: Object.fromEntries(
        Object.entries((packed.content?.layout_configs as Record<string, Record<string, unknown>> | undefined) ?? {}).map(([layoutType, config]) => [
          layoutType,
          {
            schemaVersion: config.schema_version,
            props: config.props,
            assetRefs: config.asset_refs,
          },
        ])
      ),
    },
    entries: ((packed.structure?.entries as Array<Record<string, any>> | undefined) ?? []).map((entry) => ({
      entryId: entry.entry_id,
      url: entry.url,
      enabled: entry.enabled,
      snapshot: {
        documentId: entry.snapshot?.document_id,
        title: entry.snapshot?.title,
        summary: entry.snapshot?.summary,
        tags: entry.snapshot?.tags,
        cover: entry.snapshot?.cover
          ? {
              mode: entry.snapshot.cover.mode,
              assetPath: entry.snapshot.cover.asset_path,
              mimeType: entry.snapshot.cover.mime_type,
              width: entry.snapshot.cover.width,
              height: entry.snapshot.cover.height,
            }
          : undefined,
        lastKnownModifiedAt: entry.snapshot?.last_known_modified_at,
        contentType: entry.snapshot?.content_type,
      },
      layoutHints: entry.layout_hints
        ? {
            sortKey: entry.layout_hints.sort_key,
            aspectRatio: entry.layout_hints.aspect_ratio,
            group: entry.layout_hints.group,
            priority: entry.layout_hints.priority,
          }
        : {},
    })),
    assets: [],
  });

  const setupOpenedBox = async (service: BoxDocumentService, initialInspection?: any) => {
    mockClient.box.inspect.mockResolvedValue(initialInspection ?? createEmptyInspection());
    mockClient.box.unpack.mockImplementation(async (_boxFile, outputDir) => {
      directories.add(outputDir);
      directories.add(`${outputDir}/.box`);
      return outputDir;
    });
    return service.openBox('/workspace/demo.box', '/workspace', 'box1234567');
  };

  const setFile = (filePath: string, content: string) => {
    files.set(filePath, content);
    const parent = filePath.split('/').slice(0, -1).join('/');
    if (parent) {
      directories.add(parent);
    }
  };

  const deletePath = (targetPath: string) => {
    files.delete(targetPath);
    directories.delete(targetPath);
    for (const filePath of Array.from(files.keys())) {
      if (filePath.startsWith(`${targetPath}/`)) {
        files.delete(filePath);
      }
    }
    for (const dirPath of Array.from(directories)) {
      if (dirPath.startsWith(`${targetPath}/`)) {
        directories.delete(dirPath);
      }
    }
  };

  beforeEach(() => {
    files.clear();
    directories.clear();
    directories.add('/');
    directories.add('/workspace');
    vi.clearAllMocks();
    lastPackedSnapshot = {};

    mockFileService.exists.mockImplementation(async (targetPath) => files.has(targetPath) || directories.has(targetPath));
    mockFileService.mkdir.mockImplementation(async (targetPath) => {
      directories.add(targetPath);
    });
    mockFileService.writeText.mockImplementation(async (targetPath, content) => {
      setFile(targetPath, content);
    });
    mockFileService.readText.mockImplementation(async (targetPath) => {
      return files.get(targetPath) ?? '';
    });
    mockFileService.writeBinary.mockImplementation(async (targetPath, content) => {
      setFile(targetPath, Buffer.from(content).toString('base64'));
    });
    mockFileService.delete.mockImplementation(async (targetPath) => {
      deletePath(targetPath);
    });
    mockFileService.copy.mockImplementation(async (sourcePath, destPath) => {
      const content = files.get(sourcePath);
      if (typeof content === 'undefined') {
        throw new Error(`Missing source file: ${sourcePath}`);
      }
      setFile(destPath, content);
    });

    mockClient.box.pack.mockImplementation(async (boxDir, options) => {
      lastPackedSnapshot = {
        metadata: yaml.parse(files.get(`${boxDir}/.box/metadata.yaml`) ?? ''),
        content: yaml.parse(files.get(`${boxDir}/.box/content.yaml`) ?? ''),
        structure: yaml.parse(files.get(`${boxDir}/.box/structure.yaml`) ?? ''),
      };
      return options?.outputPath ?? `${boxDir}.box`;
    });
    mockClient.box.readLayoutDescriptor.mockResolvedValue({
      layoutType: DEFAULT_BOX_LAYOUT_TYPE,
      displayName: '网格布局',
      pluginId: 'chips.layout.grid',
      defaultConfig: {
        schemaVersion: '1.0.0',
        props: {
          columnCount: 4,
          gap: 16,
        },
        assetRefs: [],
      },
    });
    mockClient.box.normalizeLayoutConfig.mockImplementation(async (_layoutType, input) => ({
      schemaVersion: typeof input.schemaVersion === 'string' ? input.schemaVersion : '1.0.0',
      props: {
        columnCount: Number((input.props as Record<string, unknown> | undefined)?.columnCount ?? 4),
        gap: Number((input.props as Record<string, unknown> | undefined)?.gap ?? 16),
      },
      assetRefs: Array.isArray(input.assetRefs) ? input.assetRefs : [],
    }));
  });

  it('creates a single-file .box working package from the new document model', async () => {
    const service = new BoxDocumentService();

    const created = await service.createBoxFile('旅行箱', DEFAULT_BOX_LAYOUT_TYPE, '/workspace', '/workspace');

    expect(created.boxFile).toBe('/workspace/旅行箱.box');
    expect(mockClient.box.pack).toHaveBeenCalledTimes(1);
    expect(lastPackedSnapshot.metadata).toMatchObject({
      name: '旅行箱',
      active_layout_type: DEFAULT_BOX_LAYOUT_TYPE,
    });
    expect(lastPackedSnapshot.content).toMatchObject({
      active_layout_type: DEFAULT_BOX_LAYOUT_TYPE,
    });
    expect(lastPackedSnapshot.structure).toEqual({
      entries: [],
    });
  });

  it('opens, edits and saves a box session back through box.pack', async () => {
    const initialInspection = {
      metadata: {
        chipStandardsVersion: '1.0.0',
        boxId: 'box1234567',
        name: 'Demo Box',
        createdAt: '2026-03-23T00:00:00.000Z',
        modifiedAt: '2026-03-23T00:00:00.000Z',
        activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
      },
      content: {
        activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
        layoutConfigs: {
          [DEFAULT_BOX_LAYOUT_TYPE]: {
            schemaVersion: '1.0.0',
            props: {
              columnCount: 4,
              gap: 16,
            },
            assetRefs: [],
          },
        },
      },
      entries: [
        {
          entryId: 'entry000001',
          url: 'file:///workspace/cards/demo.card',
          enabled: true,
          snapshot: {
            title: 'Demo Card',
            summary: 'Demo summary',
            cover: {
              mode: 'none',
            },
          },
          layoutHints: {},
        },
      ],
      assets: [],
    };

    mockClient.box.inspect.mockResolvedValue(initialInspection);
    mockClient.box.unpack.mockImplementation(async (_boxFile, outputDir) => {
      directories.add(outputDir);
      directories.add(`${outputDir}/.box`);
      setFile(`${outputDir}/.box/metadata.yaml`, yaml.stringify({
        chip_standards_version: '1.0.0',
        box_id: 'box1234567',
        name: 'Demo Box',
        created_at: '2026-03-23T00:00:00.000Z',
        modified_at: '2026-03-23T00:00:00.000Z',
        active_layout_type: DEFAULT_BOX_LAYOUT_TYPE,
      }));
      setFile(`${outputDir}/.box/content.yaml`, yaml.stringify({
        active_layout_type: DEFAULT_BOX_LAYOUT_TYPE,
        layout_configs: {
          [DEFAULT_BOX_LAYOUT_TYPE]: {
            schema_version: '1.0.0',
            props: {
              columnCount: 4,
              gap: 16,
            },
            asset_refs: [],
          },
        },
      }));
      setFile(`${outputDir}/.box/structure.yaml`, yaml.stringify({
        entries: [
          {
            entry_id: 'entry000001',
            url: 'file:///workspace/cards/demo.card',
            enabled: true,
            snapshot: {
              title: 'Demo Card',
              summary: 'Demo summary',
              cover: {
                mode: 'none',
              },
            },
          },
        ],
      }));
      return outputDir;
    });

    const service = new BoxDocumentService();
    const opened = await service.openBox('/workspace/demo.box', '/workspace', 'box1234567');
    expect(opened.entries).toHaveLength(1);

    service.addEntry('box1234567', 'https://example.com/demo');
    service.updateLayoutConfig('box1234567', DEFAULT_BOX_LAYOUT_TYPE, {
      schemaVersion: '1.0.0',
      props: {
        columnCount: 6,
        gap: 20,
      },
      assetRefs: [],
    });

    const saved = await service.saveBox('box1234567');

    expect(mockClient.box.pack).toHaveBeenCalledTimes(1);
    expect(lastPackedSnapshot.content).toMatchObject({
      layout_configs: {
        [DEFAULT_BOX_LAYOUT_TYPE]: {
          props: {
            columnCount: 6,
            gap: 20,
          },
        },
      },
    });
    expect((lastPackedSnapshot.structure?.entries as Array<unknown>) ?? []).toHaveLength(2);
    expect(saved.isDirty).toBe(false);
  });

  it('keeps persisted manual sort keys aligned with the content list order', async () => {
    const initialInspection = {
      metadata: {
        chipStandardsVersion: '1.0.0',
        boxId: 'box1234567',
        name: 'Demo Box',
        createdAt: '2026-03-23T00:00:00.000Z',
        modifiedAt: '2026-03-23T00:00:00.000Z',
        activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
      },
      content: {
        activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
        layoutConfigs: {
          [DEFAULT_BOX_LAYOUT_TYPE]: {
            schemaVersion: '1.0.0',
            props: {},
            assetRefs: [],
          },
        },
      },
      entries: [
        {
          entryId: 'entry000001',
          url: 'file:///workspace/cards/first.card',
          enabled: true,
          snapshot: { title: 'First', cover: { mode: 'none' } },
          layoutHints: { sortKey: 42 },
        },
        {
          entryId: 'entry000002',
          url: 'file:///workspace/cards/second.card',
          enabled: true,
          snapshot: { title: 'Second', cover: { mode: 'none' } },
          layoutHints: { sortKey: 88 },
        },
        {
          entryId: 'entry000003',
          url: 'file:///workspace/cards/third.card',
          enabled: true,
          snapshot: { title: 'Third', cover: { mode: 'none' } },
          layoutHints: { sortKey: 99 },
        },
      ],
      assets: [],
    };

    mockClient.box.inspect.mockResolvedValue(initialInspection);
    mockClient.box.unpack.mockImplementation(async (_boxFile, outputDir) => {
      directories.add(outputDir);
      directories.add(`${outputDir}/.box`);
      return outputDir;
    });

    const service = new BoxDocumentService();
    await service.openBox('/workspace/demo.box', '/workspace', 'box1234567');

    service.moveEntryToIndex('box1234567', 'entry000003', 0);
    service.removeEntry('box1234567', 'entry000002');
    await service.saveBox('box1234567');

    const entries = lastPackedSnapshot.structure?.entries as Array<{
      entry_id: string;
      layout_hints?: { sort_key?: number };
    }>;

    expect(entries.map((entry) => entry.entry_id)).toEqual(['entry000003', 'entry000001']);
    expect(entries.map((entry) => entry.layout_hints?.sort_key)).toEqual([0, 1]);
  });

  it('deduplicates concurrent box open requests for the same file and box id', async () => {
    const initialInspection = {
      metadata: {
        chipStandardsVersion: '1.0.0',
        boxId: 'box1234567',
        name: 'Demo Box',
        createdAt: '2026-03-23T00:00:00.000Z',
        modifiedAt: '2026-03-23T00:00:00.000Z',
        activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
      },
      content: {
        activeLayoutType: DEFAULT_BOX_LAYOUT_TYPE,
        layoutConfigs: {
          [DEFAULT_BOX_LAYOUT_TYPE]: {
            schemaVersion: '1.0.0',
            props: {
              columnCount: 4,
              gap: 16,
            },
            assetRefs: [],
          },
        },
      },
      entries: [],
      assets: [],
    };

    mockClient.box.inspect.mockResolvedValue(initialInspection);

    let releaseUnpack: (() => void) | null = null;
    const unpackStarted = new Promise<void>((resolve) => {
      mockClient.box.unpack.mockImplementationOnce(async (_boxFile, outputDir) => {
        directories.add(outputDir);
        directories.add(`${outputDir}/.box`);
        setFile(`${outputDir}/.box/metadata.yaml`, yaml.stringify({
          chip_standards_version: '1.0.0',
          box_id: 'box1234567',
          name: 'Demo Box',
          created_at: '2026-03-23T00:00:00.000Z',
          modified_at: '2026-03-23T00:00:00.000Z',
          active_layout_type: DEFAULT_BOX_LAYOUT_TYPE,
        }));
        setFile(`${outputDir}/.box/content.yaml`, yaml.stringify({
          active_layout_type: DEFAULT_BOX_LAYOUT_TYPE,
          layout_configs: {
            [DEFAULT_BOX_LAYOUT_TYPE]: {
              schema_version: '1.0.0',
              props: {
                columnCount: 4,
                gap: 16,
              },
              asset_refs: [],
            },
          },
        }));
        setFile(`${outputDir}/.box/structure.yaml`, yaml.stringify({
          entries: [],
        }));
        resolve();
        await new Promise<void>((next) => {
          releaseUnpack = next;
        });
        return outputDir;
      });
    });

    const service = new BoxDocumentService();
    const firstOpen = service.openBox('/workspace/demo.box', '/workspace', 'box1234567');
    await unpackStarted;
    const secondOpen = service.openBox('/workspace/demo.box', '/workspace', 'box1234567');
    releaseUnpack!();

    const [firstSession, secondSession] = await Promise.all([firstOpen, secondOpen]);

    expect(mockClient.box.inspect).toHaveBeenCalledTimes(1);
    expect(mockClient.box.unpack).toHaveBeenCalledTimes(1);
    expect(firstSession.workspaceDir).toBe(secondSession.workspaceDir);
    expect(firstSession.boxId).toBe('box1234567');
    expect(secondSession.boxId).toBe('box1234567');
  });

  it('adds an embedded card entry and copies the card file into the session workspace root', async () => {
    mockClient.card.readInfo.mockResolvedValue({
      cardFile: '/workspace/day-01.card',
      info: {
        status: { state: 'ready', exists: true, valid: true },
        metadata: {
          raw: {},
          cardId: 'card000001',
          name: '第一天',
          tags: ['旅行'],
        },
      },
    });
    setFile('/workspace/day-01.card', 'card content');

    const service = new BoxDocumentService();
    const opened = await setupOpenedBox(service);
    const snapshot = await service.addEmbeddedCard('box1234567', '/workspace/day-01.card', 'day-01');

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      entryId: expect.stringMatching(/^[0-9a-zA-Z]{10}$/),
      url: 'day-01.card',
      enabled: true,
      snapshot: {
        documentId: 'card000001',
        title: '第一天',
        summary: '第一天',
        tags: ['旅行'],
        cover: { mode: 'runtime' },
        contentType: 'chips/card',
      },
    });
    expect(snapshot.isDirty).toBe(true);
    expect(mockFileService.copy).toHaveBeenCalledWith(
      '/workspace/day-01.card',
      `${opened.workspaceDir}/day-01.card`,
    );
    expect(mockClient.card.readInfo).toHaveBeenCalledWith('/workspace/day-01.card', ['status', 'metadata']);
  });

  it('persists embedded entries through saveBox so box.inspect reads them back with the relative url untouched', async () => {
    const initialInspection = createEmptyInspection();
    let lastInspection: any = initialInspection;
    mockClient.box.inspect.mockImplementation(async () => lastInspection);
    mockClient.box.unpack.mockImplementation(async (_boxFile, outputDir) => {
      directories.add(outputDir);
      directories.add(`${outputDir}/.box`);
      return outputDir;
    });
    mockClient.box.pack.mockImplementation(async (boxDir, options) => {
      lastPackedSnapshot = {
        metadata: yaml.parse(files.get(`${boxDir}/.box/metadata.yaml`) ?? ''),
        content: yaml.parse(files.get(`${boxDir}/.box/content.yaml`) ?? ''),
        structure: yaml.parse(files.get(`${boxDir}/.box/structure.yaml`) ?? ''),
      };
      lastInspection = toInspection(lastPackedSnapshot);
      return options?.outputPath ?? `${boxDir}.box`;
    });
    mockClient.card.readInfo.mockResolvedValue({
      cardFile: '/workspace/day-01.card',
      info: {
        status: { state: 'ready', exists: true, valid: true },
        metadata: {
          raw: {},
          cardId: 'card000001',
          name: '第一天',
        },
      },
    });
    setFile('/workspace/day-01.card', 'card content');

    const service = new BoxDocumentService();
    await service.openBox('/workspace/demo.box', '/workspace', 'box1234567');
    await service.addEmbeddedCard('box1234567', '/workspace/day-01.card', 'day-01');
    const saved = await service.saveBox('box1234567');

    const packedEntries = (lastPackedSnapshot.structure?.entries as Array<Record<string, unknown>> | undefined) ?? [];
    expect(packedEntries).toHaveLength(1);
    expect(packedEntries[0]?.url).toBe('day-01.card');
    expect((packedEntries[0]?.snapshot as Record<string, unknown> | undefined)?.content_type).toBe('chips/card');
    expect(saved.entries).toHaveLength(1);
    expect(saved.entries[0]?.url).toBe('day-01.card');
    expect(saved.entries[0]?.snapshot?.documentId).toBe('card000001');
    expect(saved.isDirty).toBe(false);
  });

  it('auto renames the embedded card file when the preferred name is already taken', async () => {
    mockClient.card.readInfo.mockResolvedValue({
      cardFile: '/workspace/day-01.card',
      info: {
        status: { state: 'ready', exists: true, valid: true },
        metadata: {
          raw: {},
          cardId: 'card000001',
          name: '第一天',
        },
      },
    });
    setFile('/workspace/day-01.card', 'card content');

    const service = new BoxDocumentService();
    const opened = await setupOpenedBox(service);
    setFile(`${opened.workspaceDir}/day-01.card`, 'existing content');

    const snapshot = await service.addEmbeddedCard('box1234567', '/workspace/day-01.card', 'day-01');

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]?.url).toBe('day-01-2.card');
    expect(mockFileService.copy).toHaveBeenCalledWith(
      '/workspace/day-01.card',
      `${opened.workspaceDir}/day-01-2.card`,
    );
  });

  it('uses the card metadata name when no preferred name is given', async () => {
    mockClient.card.readInfo.mockResolvedValue({
      cardFile: '/workspace/day-01.card',
      info: {
        status: { state: 'ready', exists: true, valid: true },
        metadata: {
          raw: {},
          cardId: 'card000001',
          name: '第一天',
        },
      },
    });
    setFile('/workspace/day-01.card', 'card content');

    const service = new BoxDocumentService();
    const opened = await setupOpenedBox(service);
    const snapshot = await service.addEmbeddedCard('box1234567', '/workspace/day-01.card');

    expect(snapshot.entries[0]?.url).toBe('第一天.card');
    expect(snapshot.entries[0]?.snapshot?.title).toBe('第一天');
    expect(mockFileService.copy).toHaveBeenCalledWith(
      '/workspace/day-01.card',
      `${opened.workspaceDir}/第一天.card`,
    );
  });

  it('rejects missing files, non-card files and invalid cards without copying anything', async () => {
    setFile('/workspace/valid-content-holder', 'unused');
    mockClient.card.readInfo.mockResolvedValue({
      cardFile: '/workspace/broken.card',
      info: {
        status: { state: 'invalid', exists: true, valid: false, errors: ['structure missing'] },
      },
    });

    const service = new BoxDocumentService();
    await setupOpenedBox(service);

    await expect(service.addEmbeddedCard('box1234567', '/workspace/missing.card', 'x')).rejects.toThrow('卡片文件不存在');
    await expect(service.addEmbeddedCard('box1234567', '/workspace/other.box', 'x')).rejects.toThrow('仅支持内嵌 .card 卡片文件');
    await expect(service.addEmbeddedCard('box1234567', '/workspace/notes.txt', 'x')).rejects.toThrow('仅支持内嵌 .card 卡片文件');
    setFile('/workspace/broken.card', 'card content');
    await expect(service.addEmbeddedCard('box1234567', '/workspace/broken.card', 'x')).rejects.toThrow('卡片文件无效');

    expect(mockFileService.copy).not.toHaveBeenCalled();
    expect(service.getSession('box1234567')?.entries).toHaveLength(0);
  });
});
