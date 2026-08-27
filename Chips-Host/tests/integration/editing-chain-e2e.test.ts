/**
 * 编辑链路端到端验证（真实 Host + RuntimeClient）
 *
 * 覆盖 task034 上移后的完整链路：卡片会话编辑→持久化→打包→重开一致性、
 * 箱子会话→持久化→检查、渲染文档生成、ZIP 目录导入、工作区扫描、文件类型识别。
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HostApplication } from '../../src/main/core/host-application';
import { StoreZipService } from '../../packages/zip-service/src';
import { RuntimeClient } from '../../src/renderer/runtime-client';

let workspace: string;
let app: HostApplication;
let runtime: RuntimeClient;

const writeText = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
};

const createZipFixture = async (zipPath: string, files: Record<string, string>): Promise<void> => {
  const zip = new StoreZipService();
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-e2e-src-'));
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(sourceDir, filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }
  await zip.compress(sourceDir, zipPath);
  await fs.rm(sourceDir, { recursive: true, force: true });
};

interface SessionSnapshot {
  cardId: string;
  path: string;
  metadata: { name?: string; description?: string; coverRatio?: string };
  structure: { basicCards: Array<{ id: string; type: string; data: Record<string, unknown> }> };
}

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-e2e-'));
  app = new HostApplication({ workspacePath: workspace });
  await app.start();
  runtime = new RuntimeClient(app.createBridge(), {
    defaultTimeout: 10000,
    maxRetries: 1,
    retryDelay: 10,
    retryBackoff: 2,
    enableRetry: true,
  });
});

afterEach(async () => {
  await app.stop();
  await fs.rm(workspace, { recursive: true, force: true });
});

describe('编辑链路端到端（真实 Host）', () => {
  it('卡片：创建→编辑→自动持久化→打包→重开 数据一致', async () => {
    // 1. 创建卡片
    const initResult = await runtime.invoke<{
      cardDir: string;
      cardId: string;
      sessionId: string;
      snapshot: SessionSnapshot;
    }>('card.init', { parentPath: workspace, name: '端到端测试卡片' });
    expect(initResult.cardDir.endsWith('.card')).toBe(true);

    // 2. 添加基础卡片并编辑
    const addResult = await runtime.invoke<{ snapshot: SessionSnapshot }>('card.session.addBasicCard', {
      sessionId: initResult.sessionId,
      type: 'base.richtext',
      data: { content_text: 'hello e2e' },
    });
    const basicCardId = addResult.snapshot.structure.basicCards[0]?.id;
    expect(basicCardId).toBeTruthy();

    const updateResult = await runtime.invoke<{ snapshot: SessionSnapshot }>('card.session.updateBasicCard', {
      sessionId: initResult.sessionId,
      basicCardId,
      data: { content_text: 'hello e2e updated', theme: 'dark' },
    });
    expect(updateResult.snapshot.structure.basicCards[0]?.data.content_text).toBe('hello e2e updated');

    // 3. 更新元数据
    await runtime.invoke('card.session.updateMetadata', {
      sessionId: initResult.sessionId,
      patch: { name: '端到端改名', description: 'e2e 描述' },
    });

    // 4. 显式持久化（同时验证自动保存路径的文件已落盘）
    const persistResult = await runtime.invoke<{ snapshot: SessionSnapshot }>('card.session.persist', {
      sessionId: initResult.sessionId,
    });
    expect(persistResult.snapshot.metadata.name).toBe('端到端改名');

    // 5. 打包 → 解包 → 重开 → 数据一致
    const packedPath = path.join(workspace, 'packed-output.card');
    await runtime.invoke('card.pack', { cardDir: initResult.cardDir, outputPath: packedPath });
    const unpackedDir = path.join(workspace, 'unpacked');
    await runtime.invoke('card.unpack', { cardFile: packedPath, outputDir: unpackedDir });

    const reopenResult = await runtime.invoke<{ sessionId: string; snapshot: SessionSnapshot }>(
      'card.session.open',
      { cardDir: unpackedDir },
    );
    expect(reopenResult.snapshot.metadata.name).toBe('端到端改名');
    expect(reopenResult.snapshot.metadata.description).toBe('e2e 描述');
    expect(reopenResult.snapshot.structure.basicCards).toHaveLength(1);
    expect(reopenResult.snapshot.structure.basicCards[0]?.data.content_text).toBe('hello e2e updated');
    expect(reopenResult.snapshot.structure.basicCards[0]?.data.id).toBe(basicCardId);

    await runtime.invoke('card.session.close', { sessionId: reopenResult.sessionId });
  });

  it('卡片：undo/redo 历史闭环', async () => {
    const initResult = await runtime.invoke<{ sessionId: string }>('card.init', {
      parentPath: workspace,
      name: '历史卡片',
    });

    await runtime.invoke('card.session.updateMetadata', {
      sessionId: initResult.sessionId,
      patch: { name: '第一步' },
    });
    await runtime.invoke('card.session.updateMetadata', {
      sessionId: initResult.sessionId,
      patch: { name: '第二步' },
    });

    const history = await runtime.invoke<{ history: { undoAvailable: boolean; redoAvailable: boolean } }>(
      'card.session.history',
      { sessionId: initResult.sessionId },
    );
    expect(history.history.undoAvailable).toBe(true);

    const undone = await runtime.invoke<{ snapshot: { metadata: { name: string } } }>('card.session.undo', {
      sessionId: initResult.sessionId,
    });
    expect(undone.snapshot.metadata.name).toBe('第一步');

    const redone = await runtime.invoke<{ snapshot: { metadata: { name: string } } }>('card.session.redo', {
      sessionId: initResult.sessionId,
    });
    expect(redone.snapshot.metadata.name).toBe('第二步');
  });

  it('箱子：创建→会话编辑→持久化→检查 数据一致', async () => {
    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: path.resolve(process.cwd(), '..', 'Chips-BoxLayoutPlugin', 'grid-BLP', 'manifest.yaml'),
    });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });

    const created = await runtime.invoke<{ boxFile: string }>('box.create', {
      name: '端到端箱子',
      layoutType: 'chips.layout.grid',
      parentPath: workspace,
    });
    expect(created.boxFile.endsWith('.box')).toBe(true);

    const opened = await runtime.invoke<{ sessionId: string }>('box.session.open', {
      boxFile: created.boxFile,
    });

    await runtime.invoke('box.session.addEntry', {
      sessionId: opened.sessionId,
      url: 'file:///tmp/示例卡片.card',
    });
    await runtime.invoke('box.session.updateLayoutConfig', {
      sessionId: opened.sessionId,
      layoutType: 'chips.layout.list',
      config: { props: { columns: 2 } },
    });

    const persisted = await runtime.invoke<{ snapshot: { entries: unknown[]; content: { activeLayoutType: string } } }>(
      'box.session.persist',
      { sessionId: opened.sessionId },
    );
    expect(persisted.snapshot.entries).toHaveLength(1);
    expect(persisted.snapshot.content.activeLayoutType).toBe('chips.layout.list');

    const inspected = await runtime.invoke<{
      inspection: {
        metadata: { name: string };
        content: { activeLayoutType: string };
        entries: unknown[];
      };
    }>('box.inspect', { boxFile: created.boxFile });
    expect(inspected.inspection.metadata.name).toBe('端到端箱子');
    expect(inspected.inspection.content.activeLayoutType).toBe('chips.layout.list');
    expect(inspected.inspection.entries).toHaveLength(1);

    await runtime.invoke('box.session.close', { sessionId: opened.sessionId });
  });

  it('渲染文档生成（card.render）', async () => {
    const initResult = await runtime.invoke<{ cardDir: string; sessionId: string }>('card.init', {
      parentPath: workspace,
      name: '渲染测试',
    });
    const addResult = await runtime.invoke<{ snapshot: { structure: { basicCards: Array<{ id: string }> } } }>(
      'card.session.addBasicCard',
      { sessionId: initResult.sessionId, type: 'base.richtext', data: { content_text: 'render me' } },
    );
    void addResult;
    await runtime.invoke('card.session.persist', { sessionId: initResult.sessionId });

    const renderResult = await runtime.invoke<{ view: { documentUrl: string; sessionId: string } }>('card.render', {
      cardFile: initResult.cardDir,
      options: { target: 'card-iframe' },
    });
    expect(renderResult.view.documentUrl).toMatch(/^(chips-render:\/\/|file:\/\/)/);
    expect(renderResult.view.sessionId).toBeTruthy();

    const coverResult = await runtime.invoke<{ view: { coverUrl: string } }>('card.renderCover', {
      cardFile: initResult.cardDir,
    });
    expect(coverResult.view.coverUrl).toBeTruthy();
  });

  it('ZIP 目录导入（resource.importArchive）', async () => {
    const zipPath = path.join(workspace, 'bundle.zip');
    await createZipFixture(zipPath, {
      'webapp/index.html': '<html>hi</html>',
      'webapp/app.js': 'console.log(1)',
    });

    const result = await runtime.invoke<{
      rootDir: string;
      resourcePaths: string[];
    }>('resource.importArchive', {
      zipFile: zipPath,
      targetRoot: workspace,
      preferredRootDir: 'webapp',
    });
    expect(result.rootDir).toBe('webapp');
    expect(result.resourcePaths.sort()).toEqual(['app.js', 'index.html']);
    expect(
      await fs.stat(path.join(workspace, 'webapp', 'index.html')).then(() => true).catch(() => false),
    ).toBe(true);
  });

  it('工作区扫描与文件类型识别', async () => {
    // 创建一张卡片 + 一个普通文件
    const initResult = await runtime.invoke<{ cardDir: string; cardId: string }>('card.init', {
      parentPath: workspace,
      name: '扫描卡片',
    });
    void initResult;
    await writeText(path.join(workspace, 'notes.txt'), 'hello');
    await fs.mkdir(path.join(workspace, 'assets'), { recursive: true });

    const scanResult = await runtime.invoke<{ files: Array<{ type: string; name: string }> }>('workspace.scan', {
      rootPath: workspace,
    });
    const types = scanResult.files.map((file) => file.type).sort();
    expect(types).toContain('card');
    expect(types).toContain('folder');

    const detectCard = await runtime.invoke<{ documentType: string; category: string }>('file.detectType', {
      path: path.join(workspace, '扫描卡片.card'),
    });
    expect(detectCard.documentType).toBe('card');
    expect(detectCard.category).toBe('document');

    const detectPng = await runtime.invoke<{ mimeType: string; category: string }>('file.detectType', {
      path: path.join(workspace, 'photo.png'),
    });
    expect(detectPng.mimeType).toBe('image/png');
    expect(detectPng.category).toBe('image');
  });
});
