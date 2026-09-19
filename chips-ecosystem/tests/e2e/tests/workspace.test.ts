import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cardContentRelativePath, createTestWorkspace, type TestWorkspace } from '../src';

const workspaces: TestWorkspace[] = [];

afterEach(async () => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();
    if (workspace !== undefined) {
      await workspace.dispose();
    }
  }
});

describe('用例工作区', () => {
  it('装配目录态卡片、归档态卡片与箱子三份产品级夹具', async () => {
    const workspace = await createTestWorkspace({ label: 'workspace-test' });
    workspaces.push(workspace);

    expect(existsSync(workspace.root)).toBe(true);
    expect(existsSync(workspace.path('.chips'))).toBe(false);

    const cardDirectoryPath = workspace.cardDirectoryPath;
    const cardArchivePath = workspace.cardArchivePath;
    const boxArchivePath = workspace.boxArchivePath;
    expect(cardDirectoryPath).not.toBeNull();
    expect(cardArchivePath).not.toBeNull();
    expect(boxArchivePath).not.toBeNull();
    if (cardDirectoryPath === null || cardArchivePath === null || boxArchivePath === null) {
      return;
    }

    expect(existsSync(path.join(cardDirectoryPath, '.card', 'metadata.yaml'))).toBe(true);
    expect(existsSync(cardArchivePath)).toBe(true);
    expect(existsSync(boxArchivePath)).toBe(true);

    const cardContentPath = path.join(
      `${workspace.manifest.card.name}.card`,
      cardContentRelativePath(workspace.manifest)
    );
    expect(await workspace.readText(cardContentPath)).toContain('base.richtext');
  });

  it('支持按需装配并隔离写入', async () => {
    const workspace = await createTestWorkspace({
      label: 'workspace-partial',
      fixtures: { boxArchive: true },
    });
    workspaces.push(workspace);

    expect(workspace.cardDirectoryPath).toBeNull();
    expect(workspace.cardArchivePath).toBeNull();
    expect(workspace.boxArchivePath).not.toBeNull();

    await workspace.writeText('最近打开.json', '{}\n');
    expect(JSON.parse(await workspace.readText('最近打开.json'))).toEqual({});
  });

  it('dispose 清理整个工作区', async () => {
    const workspace = await createTestWorkspace({ label: 'workspace-dispose' });
    const root = workspace.root;
    expect(existsSync(root)).toBe(true);
    await workspace.dispose();
    expect(existsSync(root)).toBe(false);
  });
});
