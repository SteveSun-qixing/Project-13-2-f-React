import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceService } from '../../packages/workspace-service/src';

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-workspace-'));
  tempRoots.push(root);
  return root;
};

const writeText = async (targetPath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf-8');
};

describe('WorkspaceService 契约测试', () => {
  let root: string;
  let service: WorkspaceService;

  beforeEach(async () => {
    root = await createTempRoot();
    service = new WorkspaceService({
      readBoxMetadata: async (boxFile) => ({
        boxId: `box-${path.basename(boxFile)}`,
        name: path.basename(boxFile, '.box'),
        createdAt: '2026-01-01T00:00:00.000Z',
        modifiedAt: '2026-01-02T00:00:00.000Z',
      }),
    });
  });

  afterEach(async () => {
    for (const tempRoot of tempRoots) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
    tempRoots.length = 0;
  });

  it('识别卡片目录（.card/metadata.yaml）', async () => {
    await writeText(
      path.join(root, 'demo.card', '.card', 'metadata.yaml'),
      'chip_standards_version: "1.0.0"\ncard_id: demo-card\nname: 生态介绍\n',
    );
    await writeText(path.join(root, 'demo.card', '.card', 'structure.yaml'), 'structure: []\n');
    await writeText(path.join(root, 'demo.card', '.card', 'cover.html'), '<html></html>');

    const files = await service.scan({ rootPath: root });
    expect(files).toHaveLength(1);
    const card = files[0];
    expect(card?.type).toBe('card');
    expect(card?.id).toBe('demo-card');
    expect(card?.name).toBe('生态介绍.card');
  });

  it('识别 .card/.box 文件与文件夹', async () => {
    await fs.mkdir(path.join(root, 'assets'), { recursive: true });
    await fs.writeFile(path.join(root, 'plain.card'), 'x');
    await fs.writeFile(path.join(root, 'photo.box'), 'x');
    await fs.writeFile(path.join(root, 'notes.txt'), 'x');

    const files = await service.scan({ rootPath: root });
    const types = files.map((file) => file.type).sort();
    expect(types).toEqual(['box', 'card', 'file', 'folder']);
    const card = files.find((file) => file.type === 'card');
    expect(card).toMatchObject({
      name: 'plain.card',
      extension: 'card',
      mimeType: 'application/vnd.chips.card+zip',
      category: 'document',
      size: 1,
    });
    const folder = files.find((file) => file.type === 'folder');
    expect(folder?.name).toBe('assets');
    const generic = files.find((file) => file.type === 'file');
    expect(generic).toMatchObject({
      name: 'notes.txt',
      extension: 'txt',
      mimeType: 'text/plain',
      category: 'text',
      size: 1,
    });
  });

  it('排除 Host 运行时目录', async () => {
    await fs.mkdir(path.join(root, 'plugins'), { recursive: true });
    await fs.writeFile(path.join(root, 'plugins', 'x.txt'), 'x');
    await fs.writeFile(path.join(root, 'config.json'), '{}');

    const files = await service.scan({ rootPath: root });
    expect(files).toHaveLength(0);
  });

  it('隐藏文件不参与扫描', async () => {
    await fs.writeFile(path.join(root, '.hidden.txt'), 'x');
    await fs.mkdir(path.join(root, '.git'), { recursive: true });

    const files = await service.scan({ rootPath: root });
    expect(files).toHaveLength(0);
  });

  it('嵌套文件夹递归识别卡片', async () => {
    await writeText(
      path.join(root, 'folder', 'nested.card', '.card', 'metadata.yaml'),
      'card_id: nested\nname: 嵌套卡片\n',
    );
    const files = await service.scan({ rootPath: root });
    const folder = files[0];
    expect(folder?.type).toBe('folder');
    expect(folder?.children?.[0]?.type).toBe('card');
    expect(folder?.children?.[0]?.id).toBe('nested');
  });

  it('工作区路径不存在时抛错', async () => {
    await expect(service.scan({ rootPath: path.join(root, 'missing') })).rejects.toThrow();
  });
});
