import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { cardContentRelativePath, resolveHarnessAppPath } from '../src';
import {
  expect,
  expectFrameContainsText,
  expectResource,
  expectRevisionAdvanced,
  expectWindowList,
  openDocument,
  readDocumentSession,
  saveDocument,
  test,
  waitForEvent,
  waitForWindow,
  writeDocumentPart,
} from '../src';
import type { RichTextContent } from '../src';

/**
 * 骨架自检：用受控夹具 Electron 应用（`fixtures/app/`）验证启动器与断言工具本身。
 *
 * 夹具应用只实现断言工具触达的契约子集，不解析 `.card`/`.box`、不承载产品渲染；
 * 产品金链路见 `golden-path.spec.ts`。
 */
test.use({ appPath: resolveHarnessAppPath() });

test.describe('E2E 骨架自检（受控夹具应用）', () => {
  test('启动器、窗口、帧、资源、文档会话与事件断言可用', async ({ host, workspace, frame }) => {
    const manifest = workspace.manifest;
    const cardDirectoryPath = workspace.cardDirectoryPath;
    if (cardDirectoryPath === null) {
      throw new Error('工作区未装配目录态卡片夹具。');
    }

    await expectWindowList(host.window, {
      minimum: 1,
      titleContains: manifest.card.name,
    });
    await waitForWindow(host.window, (windowInfo) => windowInfo.state === 'normal');

    expect(frame.frame.sandbox, '帧沙箱').toContain('allow-scripts');
    expect(frame.frame.height, '帧高度').toBeGreaterThan(0);
    await expectFrameContainsText(frame, manifest.card.name);

    const resource = await expectResource(host.window, 'chips-resource://fixture/manifest.json', {
      mimeType: 'application/json',
      scope: 'platform',
      minimumSize: 100,
      textContains: '"card"',
    });
    expect(resource.text ?? '', '夹具清单包含卡片名').toContain(manifest.card.name);

    const source = pathToFileURL(cardDirectoryPath).href;
    const opened = await openDocument(host.window, { source, kind: 'card' });
    expect(opened.documentId, '文档稳定标识').toBe(manifest.card.id);
    expect(opened.title, '文档标题').toBe(manifest.card.name);

    const session = await readDocumentSession(host.window, {
      documentId: opened.documentId,
      nodeId: manifest.card.nodeId,
    });
    expect(session.metadata.name, 'metadata 名称').toBe(manifest.card.name);
    expect(session.content, '内容节点已读取').not.toBeNull();

    const content = session.content as RichTextContent;
    const editedText = `${content.content_text ?? ''}\n\n（骨架自检编辑）`;
    const writeOutput = await writeDocumentPart(host.window, {
      documentId: opened.documentId,
      part: 'content',
      nodeId: manifest.card.nodeId,
      value: { ...content, content_text: editedText },
    });
    expectRevisionAdvanced(0, writeOutput.revision);
    await expectFrameContainsText(frame, '骨架自检编辑');

    const savedEvent = waitForEvent<{ kind: string }>(host.window, 'document:saved', {
      timeoutMs: 10_000,
    });
    const saved = await saveDocument(host.window, opened.documentId);
    expect((await savedEvent).kind, 'document:saved 事件').toBe('card');
    expect(saved.source, '保存返回来源').toBe(source);

    const persisted = JSON.parse(
      await workspace.readText(path.join(`${manifest.card.name}.card`, 'harness-save.json'))
    ) as { contentText?: unknown };
    expect(persisted.contentText, '夹具应用持久化内容').toBe(editedText);
  });

  test('工作区装配三份产品级夹具且互不共享', async ({ workspace }) => {
    expect(workspace.cardArchivePath, '归档态卡片').not.toBeNull();
    expect(workspace.boxArchivePath, '归档态箱子').not.toBeNull();
    const cardContent = await workspace.readText(
      path.join(`${workspace.manifest.card.name}.card`, cardContentRelativePath(workspace.manifest))
    );
    expect(cardContent).toContain(workspace.manifest.card.inlineText.split('\n')[0] ?? '');
  });
});
