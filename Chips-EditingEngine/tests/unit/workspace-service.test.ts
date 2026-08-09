import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceService } from '../../src/services/workspace-service';

type MockFileStat = {
  path: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtimeMs: number;
};

type MockFileEntry = {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
};

const { mockFileService, mockClient } = vi.hoisted(() => ({
  mockFileService: {
    readText: vi.fn<[string], Promise<string>>(),
    writeText: vi.fn<[string, string], Promise<void>>(),
    stat: vi.fn<[string], Promise<MockFileStat>>(),
    exists: vi.fn<[string], Promise<boolean>>(),
      ensureDir: vi.fn<[string], Promise<void>>(),
      mkdir: vi.fn<[string], Promise<void>>(),
      delete: vi.fn<[string], Promise<void>>(),
      list: vi.fn<[string], Promise<MockFileEntry[]>>(),
    },
    mockClient: {
    platform: {
      getLaunchContext: vi.fn(() => ({
        launchParams: {
          workspacePath: '/workspace',
        },
      })),
    },
    box: {
      readMetadata: vi.fn(),
      readLayoutDescriptor: vi.fn(),
      normalizeLayoutConfig: vi.fn(),
      pack: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/file-service', () => ({
  fileService: mockFileService,
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => mockClient,
}));

describe('WorkspaceService', () => {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  const hiddenListEntries = new Set<string>();

  const setFile = (filePath: string, content: string) => {
    files.set(filePath, content);
    const parts = filePath.split('/').filter(Boolean);
    let current = '';
    for (let index = 0; index < parts.length - 1; index += 1) {
      current = `${current}/${parts[index]}`;
      directories.add(current);
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
    for (const directory of Array.from(directories)) {
      if (directory.startsWith(`${targetPath}/`)) {
        directories.delete(directory);
      }
    }
  };

  const createDirectoryStateCard = (cardPath: string, cardId: string, name: string) => {
    setFile(`${cardPath}/.card/metadata.yaml`, [
      'chip_standards_version: "1.0.0"',
      `card_id: ${cardId}`,
      `name: ${name}`,
      'created_at: "2026-05-20T00:00:00.000Z"',
      'modified_at: "2026-05-21T00:00:00.000Z"',
      '',
    ].join('\n'));
    setFile(`${cardPath}/.card/structure.yaml`, 'structure: []\n');
    setFile(`${cardPath}/.card/cover.html`, '<!doctype html>');
    directories.add(`${cardPath}/content`);
  };

  beforeEach(() => {
    files.clear();
    directories.clear();
    hiddenListEntries.clear();
    directories.add('/workspace');
    vi.clearAllMocks();

    mockClient.platform.getLaunchContext.mockReturnValue({
      launchParams: {
        workspacePath: '/workspace',
      },
    });

    mockFileService.readText.mockImplementation(async (targetPath) => {
      const content = files.get(targetPath);
      if (content === undefined) {
        throw new Error(`Missing file: ${targetPath}`);
      }
      return content;
    });

    mockFileService.writeText.mockImplementation(async (targetPath, content) => {
      setFile(targetPath, content);
    });

    mockFileService.exists.mockImplementation(async (targetPath) => {
      return files.has(targetPath) || directories.has(targetPath);
    });

    mockFileService.ensureDir.mockImplementation(async (targetPath) => {
      directories.add(targetPath);
    });

    mockFileService.mkdir.mockImplementation(async (targetPath) => {
      directories.add(targetPath);
    });

    mockFileService.delete.mockImplementation(async (targetPath) => {
      deletePath(targetPath);
    });

    mockFileService.stat.mockImplementation(async (targetPath) => {
      if (files.has(targetPath)) {
        return {
          path: targetPath,
          size: Buffer.byteLength(files.get(targetPath) ?? '', 'utf-8'),
          isFile: true,
          isDirectory: false,
          mtimeMs: Date.parse('2026-05-26T00:00:00.000Z'),
        };
      }
      if (directories.has(targetPath)) {
        return {
          path: targetPath,
          size: 0,
          isFile: false,
          isDirectory: true,
          mtimeMs: Date.parse('2026-05-26T00:00:00.000Z'),
        };
      }
      throw new Error(`Missing path: ${targetPath}`);
    });

    mockFileService.list.mockImplementation(async (dirPath) => {
      const children = new Map<string, { isFile: boolean; isDirectory: boolean }>();
      const prefix = `${dirPath}/`;

      for (const directory of directories) {
        if (hiddenListEntries.has(directory)) {
          continue;
        }
        if (!directory.startsWith(prefix)) {
          continue;
        }
        const relative = directory.slice(prefix.length);
        if (!relative || relative.includes('/')) {
          continue;
        }
        children.set(relative, {
          isFile: false,
          isDirectory: true,
        });
      }

      for (const filePath of files.keys()) {
        if (hiddenListEntries.has(filePath)) {
          continue;
        }
        if (!filePath.startsWith(prefix)) {
          continue;
        }
        const relative = filePath.slice(prefix.length);
        if (!relative || relative.includes('/')) {
          continue;
        }
        children.set(relative, {
          isFile: true,
          isDirectory: false,
        });
      }

      return Array.from(children.entries()).map(([path, entry]) => ({
        path,
        ...entry,
      }));
    });

    mockClient.box.readMetadata.mockImplementation(async (boxPath: string) => {
      if (!files.has(boxPath)) {
        throw new Error(`Missing box file: ${boxPath}`);
      }

      const stem = boxPath.split('/').pop()?.replace(/\.box$/i, '') || '箱子';
      return {
        boxId: stem === '旅行箱' || stem === '列表滞后箱子' ? 'box1234567' : `${stem}BoxId`,
        name: stem,
        createdAt: '2026-05-22T00:00:00.000Z',
        modifiedAt: '2026-05-23T00:00:00.000Z',
      };
    });
    mockClient.box.readLayoutDescriptor.mockResolvedValue({
      layoutType: 'chips.layout.grid',
      displayName: '网格布局',
      pluginId: 'chips.layout.grid',
      defaultConfig: {},
    });
    mockClient.box.normalizeLayoutConfig.mockResolvedValue({});
    mockClient.box.pack.mockImplementation(async (_workDir: string, options?: { outputPath?: string }) => {
      if (options?.outputPath) {
        setFile(options.outputPath, 'box');
      }
      return options?.outputPath;
    });
  });

  it('loads existing cards and boxes from the bound workspace during initialization', async () => {
    createDirectoryStateCard('/workspace/First.card', 'FirstCard1', '第一张卡片');
    createDirectoryStateCard('/workspace/nested/Second.card', 'SecondCard', '第二张卡片');
    setFile('/workspace/旅行箱.box', 'box');
    setFile('/workspace/electron-user-data/Preferences', '{}');
    setFile('/workspace/route-descriptor-manifest.json', '{}');

    const service = new WorkspaceService();
    await service.initialize();

    expect(service.getFile('FirstCard1')).toMatchObject({
      name: '第一张卡片.card',
      path: '/workspace/First.card',
      type: 'card',
    });
    expect(service.getFile('SecondCard')).toMatchObject({
      name: '第二张卡片.card',
      path: '/workspace/nested/Second.card',
      type: 'card',
    });
    expect(service.getFile('box1234567')).toMatchObject({
      name: '旅行箱.box',
      path: '/workspace/旅行箱.box',
      type: 'box',
    });
    expect(service.getFileByPath('/workspace/electron-user-data')).toBeUndefined();
    expect(service.getFileByPath('/workspace/route-descriptor-manifest.json')).toBeUndefined();
  });

  it('indexes created directory-state cards when file.list returns relative entries', async () => {
    const service = new WorkspaceService();
    await service.initialize();

    const created = await service.createCard('新卡片', undefined, 'Abc123XyZ9');

    expect(created).toMatchObject({
      id: 'Abc123XyZ9',
      name: '新卡片.card',
      path: '/workspace/Abc123XyZ9.card',
      type: 'card',
    });
    expect(service.getFile('Abc123XyZ9')).toBe(created);
    expect(mockFileService.stat).toHaveBeenCalledWith('/workspace/Abc123XyZ9.card');
  });

  it('registers a created card from its written path when refresh does not list it yet', async () => {
    const service = new WorkspaceService();
    await service.initialize();
    hiddenListEntries.add('/workspace/LaggyCard1.card');

    const created = await service.createCard('列表滞后卡片', undefined, 'LaggyCard1');

    expect(created).toMatchObject({
      id: 'LaggyCard1',
      name: '列表滞后卡片.card',
      path: '/workspace/LaggyCard1.card',
      type: 'card',
    });
    expect(service.getFile('LaggyCard1')).toBe(created);
    expect(service.getFiles()).toContain(created);
  });

  it('registers a created box from its output path when refresh does not list it yet', async () => {
    const service = new WorkspaceService();
    await service.initialize();
    hiddenListEntries.add('/workspace/列表滞后箱子.box');

    const created = await service.createBox('列表滞后箱子', 'chips.layout.grid');

    expect(created).toMatchObject({
      id: 'box1234567',
      name: '列表滞后箱子.box',
      path: '/workspace/列表滞后箱子.box',
      type: 'box',
    });
    expect(service.getFile('box1234567')).toBe(created);
    expect(service.getFiles()).toContain(created);
  });

  it('fails before writing when no workspace is bound', async () => {
    mockClient.platform.getLaunchContext.mockReturnValue({
      launchParams: {
        workspacePath: '',
      },
    });

    const service = new WorkspaceService();
    await service.initialize();

    await expect(service.createCard('新卡片', undefined, 'Abc123XyZ9')).rejects.toThrow('当前工作区未绑定，无法创建卡片。');
    expect(mockFileService.writeText).not.toHaveBeenCalled();
  });
});
