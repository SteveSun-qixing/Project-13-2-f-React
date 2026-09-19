import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  cardContentRelativePath,
  expect,
  expectContentDigest,
  expectFrameContainsText,
  expectRevisionAdvanced,
  openDocument,
  readDocumentPart,
  readDocumentSession,
  saveDocument,
  test,
  waitForEvent,
  writeDocumentPart,
} from '../src';
import type { RichTextContent } from '../src';

/**
 * W2 金链路：打开卡片 → 解析 → 渲染 → 编辑 → 保存。
 *
 * 启动参数：`--workspace=<工作区>` + 位置参数打开目录态卡片（资源打开路由的
 * `os-association` 来源）；断言面只使用文档库契约能力与渲染帧的可观察面，
 * 不读取实现私有状态、不注入调试脚本。
 *
 * 执行前置：`pnpm build` 产出 `packages/host` 构建产物；未构建时 Playwright
 * 默认不纳入本 project，`CHIPS_E2E_REQUIRE_APP=1` 强制纳入（CI 与 W2 准出）。
 */
test.describe('金链路：打开卡片 → 渲染 → 编辑 → 保存', () => {
  test('目录态富文本卡片完成查看、编辑回流与保存落盘', async ({ host, workspace, frame }) => {
    const manifest = workspace.manifest;
    const cardDirectoryPath = workspace.cardDirectoryPath;
    if (cardDirectoryPath === null) {
      throw new Error('工作区未装配目录态卡片夹具。');
    }
    const source = pathToFileURL(cardDirectoryPath).href;

    const opened = await openDocument(host.window, { source, kind: 'card' });
    expect(opened.documentId, 'documentId 取自 card_id').toBe(manifest.card.id);
    expect(opened.source, 'document:open 返回受管引用').toMatch(/^[a-z][a-z0-9+.-]*:\/\//);
    expect(opened.kind, '文档类型').toBe('card');
    expect(opened.title, '文档标题').toBe(manifest.card.name);
    expectContentDigest(opened.digest);

    expect(frame.frame.height, '渲染帧已按高度协议落位').toBeGreaterThan(0);
    await expectFrameContainsText(frame, manifest.card.name, { timeoutMs: 20_000 });

    const session = await readDocumentSession(host.window, {
      documentId: opened.documentId,
      nodeId: manifest.card.nodeId,
    });
    expect(session.metadata.name, 'metadata 名称').toBe(manifest.card.name);
    const content = session.content as RichTextContent | null;
    if (content === null) {
      throw new Error('未读取到内容节点。');
    }

    const editedMark = '（E2E 编辑回写）';
    const editedText = `${content.content_text ?? ''}\n\n${editedMark}`;
    const changedEvent = waitForEvent(host.window, 'document:changed', { timeoutMs: 15_000 });
    const writeOutput = await writeDocumentPart(host.window, {
      documentId: opened.documentId,
      part: 'content',
      nodeId: manifest.card.nodeId,
      value: { ...content, content_text: editedText },
    });
    expectRevisionAdvanced(0, writeOutput.revision);
    await changedEvent;
    await expectFrameContainsText(frame, editedMark, { timeoutMs: 20_000 });

    const savedEvent = waitForEvent(host.window, 'document:saved', { timeoutMs: 15_000 });
    const saved = await saveDocument(host.window, opened.documentId);
    await savedEvent;
    expect(saved.source, '保存后引用不变').toBe(opened.source);
    expectContentDigest(saved.digest);

    const diskContent = await readDocumentPart<Record<string, unknown>>(host.window, {
      documentId: opened.documentId,
      part: 'content',
      nodeId: manifest.card.nodeId,
    });
    expect(diskContent.value.content_text, '保存后会话内容').toBe(editedText);
    const persistedYaml = await workspace.readText(
      path.join(`${manifest.card.name}.card`, cardContentRelativePath(manifest))
    );
    expect(persistedYaml, '保存后内容已落盘').toContain(editedMark);
  });
});
