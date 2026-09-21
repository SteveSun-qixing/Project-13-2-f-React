import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Page } from '@playwright/test';

import {
  closeHostApp,
  createTestWorkspace,
  expect,
  expectContentDigest,
  expectRevisionAdvanced,
  launchHostApp,
  openDocument,
  readDocumentPart,
  resolveHostApp,
  test,
  waitForEvent,
  writeDocumentPart,
} from '../src';
import type { DocumentOpenOutput, DocumentWriteOutput, RichTextContent } from '../src';

/**
 * W2 金链路（刀7 / 任务 #114 段B）：真进程端到端「打开 → 原生解析 → 取视图 → 读 → 编辑写 →
 * 回读 → 再取视图」链路，`CHIPS_E2E_REQUIRE_APP=1` 必跑且绿。
 *
 * 承载：宿主 E2E 入口 `dist/main/e2e-app.js`（与正式入口共用组合根与启动编排，唯一差异是
 * 经 `CHIPS_E2E_DOCUMENT_WIRING_MODULE` 装载 `host-wiring/e2e-document-wiring.cjs` 的
 * tests/ 面注入项——工单 036 §六在册通道）。解析域为真实 `chips-native.node`（34 项导出、
 * 17 必备名 fail-closed 闸），**全链路零原生替身**。
 *
 * 断言面纪律：
 * - 只使用文档库契约能力（`window.chips` 的 `document:open|read|write`）、#105 冻结的宿主
 *   内部取视图通道封套（`window.__chipsHostViewChannel.requestView`，`chips-document-view/1`）
 *   与 `05-事件契约规范` 在册事件——不读取实现私有状态、不注入调试脚本；
 * - 保存落盘与保存后事件（`document:changed` / `document:saved`）权威归 W3（金链路刀6），
 *   不在本单断言面内——本单**反向坐实**该在册语义：`document:write` 只改内存模型、不落盘、
 *   不发布事件（`11-文档服务设计` §4.2），故写后取视图字段内容仍为解析基线（§6.6 规则 5
 *   字段投影确定）、`document:changed` 观察不到；视图修订号是解析句柄会话内的构建单调源
 *   （《05-渲染引擎设计》§2.4 第 5 条严格递增、工单037 裁定），逐次构建严格前进、与落盘解耦；
 * - 卡片窗口 DOM 回流（executeAction → session.update 渲染臂）的主进程 → 渲染侧文档绑定
 *   投递为在册集成缝（#99，`card-window-orchestrator.ts` 头注），本单不触达渲染层私有面。
 */

/** 取视图通道协议版本与消息判别字面量（#105 冻结件 `document-view-channel.ts` 的测试侧镜像；
 * 测试钉死字面量以防实现常量漂移）。 */
const VIEW_PROTOCOL = 'chips-document-view/1';
const VIEW_MESSAGE_BUILD = 'document-view:build';
const VIEW_MESSAGE_RESULT = 'document-view:result';
const VIEW_MESSAGE_ERROR = 'document-view:error';

/** 视图通道回包的测试侧收窄形状（成功臂 view 为 §6.6 CardRenderView 投影；失败臂 error 带在册码）。 */
interface ViewChannelReply {
  readonly protocol: string;
  readonly type: string;
  readonly requestId: string;
  readonly view?: {
    readonly kind: string;
    readonly revision: number;
    readonly card_id: string;
    readonly name: string;
    readonly chip_standards_version: string;
    readonly cover_ratio: string;
    readonly content_nodes: readonly {
      readonly node_id: string;
      readonly card_type: string;
      readonly content: Record<string, unknown>;
    }[];
  };
  readonly error?: { readonly code: string; readonly message: string };
}

/** 壳窗口经宿主内部取视图通道发起一次构建请求（封套逐字按 #105 冻结形状铸造）。 */
async function requestView(
  page: Page,
  requestId: string,
  input: { readonly source: string; readonly documentId: string; readonly kind: 'card' | 'box' },
  protocol: string = VIEW_PROTOCOL,
  type: string = VIEW_MESSAGE_BUILD
): Promise<ViewChannelReply> {
  return page.evaluate(
    async ({
      requestId: id,
      input: body,
      protocol: wireProtocol,
      type: wireType,
    }: {
      requestId: string;
      input: { source: string; documentId: string; kind: string };
      protocol: string;
      type: string;
    }) => {
      const surface = (
        window as unknown as {
          __chipsHostViewChannel?: { requestView(payload: unknown): Promise<unknown> };
        }
      ).__chipsHostViewChannel;
      if (surface === undefined || typeof surface.requestView !== 'function') {
        throw new Error('宿主内部取视图通道未挂载（preload 双世界缺失）');
      }
      return surface.requestView({
        protocol: wireProtocol,
        type: wireType,
        requestId: id,
        input: body,
      });
    },
    { requestId, input, protocol, type }
  ) as Promise<ViewChannelReply>;
}

/** 取视图内容节点 content_text 字符串臂（unknown 值窄化，避免非基元类型入 String()）。 */
function contentTextOf(node: { readonly content: Record<string, unknown> } | undefined): string {
  const raw = node?.content['content_text'];
  return typeof raw === 'string' ? raw : '';
}

/**
 * `document:read` 的 content 切片回包形状 = ContentNode 投影（`04-能力契约规范` §7.3
 * 「`value` 为对应模型切片」，绑定层 `IDocumentContentResult` 按《06-文档解析器设计》
 * §11.3 冻结）：节点身份字段在外层，富文字段值在嵌套 `value` 内。
 */
interface ContentNodeProjection<TValue> {
  readonly node_id: string;
  readonly file: string;
  readonly card_type: string;
  readonly value: TValue;
  readonly diagnostics: readonly unknown[];
}

/** E2E 入口构建产物与接线模块定位（缺失即如实抛错——REQUIRED 必跑对构建产物的硬判据）。 */
function resolveE2EAppEntry(): { appEntry: string; wiringModulePath: string } {
  const { appPath } = resolveHostApp();
  const appEntry = path.join(appPath, 'dist', 'main', 'e2e-app.js');
  if (!existsSync(appEntry)) {
    throw new Error(
      `E2E 入口构建产物不存在：${appEntry}。请先执行 pnpm --filter @chips/host build（或 pnpm build）。`
    );
  }
  const wiringModulePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'host-wiring',
    'e2e-document-wiring.cjs'
  );
  if (!existsSync(wiringModulePath)) {
    throw new Error(`E2E 文档接线模块不存在：${wiringModulePath}。`);
  }
  return { appEntry, wiringModulePath };
}

test.describe('W2 金链路：真进程 document:* 与宿主内部取视图通道', () => {
  test('归档态卡片完成打开、取视图、编辑回流与再取视图全链', async () => {
    const { appEntry, wiringModulePath } = resolveE2EAppEntry();
    const workspace = await createTestWorkspace({
      label: 'golden-chain-w2',
      fixtures: { cardArchive: true },
    });
    let host: Awaited<ReturnType<typeof launchHostApp>> | null = null;
    try {
      host = await launchHostApp({
        appEntry,
        workspacePath: workspace.root,
        env: {
          CHIPS_E2E_DOCUMENT_WIRING_MODULE: wiringModulePath,
          CHIPS_E2E_DOCUMENT_ROOT: workspace.root,
        },
      });
      const page = host.window;
      if (workspace.cardArchivePath === null) {
        throw new Error('工作区未装配归档态卡片夹具。');
      }
      const manifest = workspace.manifest;
      const source = pathToFileURL(workspace.cardArchivePath).href;
      const archiveBytesBefore = await readFile(workspace.cardArchivePath);

      // ── 环① 打开（document:open → scope 归一 → 真实原生解析 → 会话建立 + opened 事件）。
      const openedEvent = waitForEvent<Record<string, unknown>>(page, 'document:opened', {
        timeoutMs: 15_000,
      });
      const opened = await openDocument(page, { source, kind: 'card' });
      expect(opened.documentId, 'documentId 取自 card_id（05-ID生成规范 §二.1 十位 Base62）').toBe(
        manifest.card.id
      );
      expect(opened.documentId).toMatch(/^[0-9A-Za-z]{10}$/);
      expect(opened.kind, '文档类型').toBe('card');
      expect(opened.title, '文档标题').toBe(manifest.card.name);
      expect(
        opened.source,
        'document:open 返回受管引用（chips-resource:// 作用域段词法在册，工单036 tests/ 面映射）'
      ).toMatch(/^chips-resource:\/\/e2e-workspace\/[A-Za-z0-9%._~-]+\.card$/);
      expectContentDigest(opened.digest);
      const openedPayload = await openedEvent;
      expect(openedPayload.uri, 'document:opened 载荷 uri 为受管引用').toBe(opened.source);
      expect(openedPayload.kind).toBe('card');
      expect(openedPayload.title).toBe(manifest.card.name);

      // ── 环② 取视图（宿主内部通道 → 主进程真实构建链：请求闸 → 构建器 → 会话解析 → 原生 buildDocumentView）。
      const firstView = await requestView(page, 'e2e-chain-view-1', {
        source: opened.source,
        documentId: opened.documentId,
        kind: 'card',
      });
      expect(firstView.protocol, '回包协议版本').toBe(VIEW_PROTOCOL);
      expect(
        firstView.type,
        `回包判别为成功臂（失败臂回带在册错误：${JSON.stringify(firstView.error ?? null)}）`
      ).toBe(VIEW_MESSAGE_RESULT);
      expect(firstView.requestId, 'requestId 原样回带').toBe('e2e-chain-view-1');
      const view = firstView.view;
      if (view === undefined) {
        throw new Error('成功臂回包缺少 view。');
      }
      expect(view.kind).toBe('card');
      expect(view.card_id, '视图 card_id 与打开会话同源').toBe(manifest.card.id);
      expect(view.name).toBe(manifest.card.name);
      expect(view.chip_standards_version).toBe('1.0.0');
      expect(view.cover_ratio).toBe('3:4');
      expect(
        view.revision,
        '视图修订为非负安全整数（回包闸已判，此处钉基线在位）'
      ).toBeGreaterThanOrEqual(0);
      expect(
        view.content_nodes.map((node) => node.node_id),
        '内容节点集合来自真实结构'
      ).toEqual([manifest.card.nodeId]);
      const baselineText = contentTextOf(view.content_nodes[0]);
      expect(baselineText, '视图内容触达真实 L2 解析').toContain('document:open');

      // ── 环③ 读取基线（document:read content 切片 = ContentNode 投影，§11.3/工单034 冻结形状）。
      const baselineRead = await readDocumentPart<ContentNodeProjection<RichTextContent>>(page, {
        documentId: opened.documentId,
        part: 'content',
        nodeId: manifest.card.nodeId,
      });
      expect(baselineRead.part).toBe('content');
      expect(baselineRead.value.node_id, 'ContentNode 投影节点身份与结构同源').toBe(
        manifest.card.nodeId
      );
      expect(baselineRead.value.card_type, '内容节点类型').toBe(manifest.card.cardType);
      expect(baselineRead.value.value.content_text, '基线内容与视图同源解析').toBe(baselineText);

      // ── 环④ 编辑写入（document:write → 真实 parser.fingerprint 复查 + 内存覆盖层，修订 +1）。
      const editedMark = '（金链路刀7 编辑回写）';
      const editedText = `${baselineText}\n\n${editedMark}`;
      const writeOutput: DocumentWriteOutput = await writeDocumentPart(page, {
        documentId: opened.documentId,
        part: 'content',
        nodeId: manifest.card.nodeId,
        // 写回与读回同形状（模型切片对称，§7.3）：编辑富文字段值在嵌套 value 内。
        value: {
          ...baselineRead.value,
          value: { ...baselineRead.value.value, content_text: editedText },
        },
      });
      expectRevisionAdvanced(0, writeOutput.revision);
      expect(writeOutput.revision, '会话首次写入修订恰前进 1（§3.4）').toBe(1);

      // ── 环⑤ 回读覆盖层（写入只改内存模型：document:read 立即反映新值）。
      const editedRead = await readDocumentPart<ContentNodeProjection<RichTextContent>>(page, {
        documentId: opened.documentId,
        part: 'content',
        nodeId: manifest.card.nodeId,
      });
      expect(editedRead.value.value.content_text, '覆盖层回读反映编辑值').toBe(editedText);

      // ── 环⑥ 再取视图（同一通道、同一句柄：未落盘 → 基线内容不动，§6.6 规则 5；
      //    修订号按句柄会话构建序列严格前进——工单037 转正臂，FNV 直投 era 本环构建恒拒）。
      const secondView = await requestView(page, 'e2e-chain-view-2', {
        source: opened.source,
        documentId: opened.documentId,
        kind: 'card',
      });
      expect(secondView.type, '写后再取视图仍走真实构建链成功臂').toBe(VIEW_MESSAGE_RESULT);
      const view2 = secondView.view;
      if (view2 === undefined) {
        throw new Error('第二次成功臂回包缺少 view。');
      }
      expect(
        view2.revision,
        '视图修订句柄会话内严格递增（05.02 §2.4 第 5 条、工单037 裁定：首开 0 基线、逐构建 +1）'
      ).toBeGreaterThan(view.revision);
      expect(
        contentTextOf(view2.content_nodes[0]),
        '视图通道消费解析基线（覆盖层只经 document:read 观察，不落盘即不入视图）'
      ).toBe(baselineText);

      // ── 环⑦ 事件与持久面反向坐实（§4.2：write 不落盘、不发事件；changed/saved 归保存后，W3）。
      const changedArrived = await waitForEvent(page, 'document:changed', {
        timeoutMs: 2_000,
      }).then(
        () => true,
        () => false
      );
      expect(changedArrived, 'document:changed 只在保存持久化后发布（W3 面）').toBe(false);
      const archiveBytesAfter = await readFile(workspace.cardArchivePath);
      expect(archiveBytesAfter.equals(archiveBytesBefore), '编辑未落盘：归档字节保持夹具原样').toBe(
        true
      );

      // ── 通道失败臂（真实接线下的在册错误面，非 mock）：未打开的受管引用与标识 → DOCUMENT_NOT_OPEN。
      // 输入为**从未打开过**的受管引用（不复用已打开记录的来源——`{source, documentId}` 二元组
      // 与存活记录不一致时服务解析如实交付 `DOCUMENT_ID_CONFLICT`，§3.5 会话定位两臂语义不同）。
      const ghostView = await requestView(page, 'e2e-chain-view-ghost', {
        source: 'chips-resource://e2e-workspace/unopened-e2e-ghost.card',
        documentId: 'E2eGhostRt',
        kind: 'card',
      });
      expect(ghostView.type, '未打开的文档标识走失败臂').toBe(VIEW_MESSAGE_ERROR);
      expect(ghostView.error?.code, '会话定位失败交付在册码').toBe('DOCUMENT_NOT_OPEN');

      // ── 协议版本违约 → 请求闸 BRIDGE_INVALID_INPUT（先于任何构建触达）。
      const badProtocol = await requestView(
        page,
        'e2e-chain-view-badproto',
        { source: opened.source, documentId: opened.documentId, kind: 'card' },
        'chips-document-view/999'
      );
      expect(badProtocol.type, '协议版本违约如实拒绝').toBe(VIEW_MESSAGE_ERROR);
      expect(badProtocol.error?.code, '请求闸在册码').toBe('BRIDGE_INVALID_INPUT');

      // ── 会话复用语义：同源再打开 → 同记录（覆盖层共享，§3.5 单记录单句柄）。
      const reopened: DocumentOpenOutput = await openDocument(page, { source });
      expect(reopened.documentId, '同会话同源复用既有记录').toBe(opened.documentId);
      expect(reopened.source).toBe(opened.source);
      const afterReopen = await readDocumentPart<ContentNodeProjection<RichTextContent>>(page, {
        documentId: reopened.documentId,
        part: 'content',
        nodeId: manifest.card.nodeId,
      });
      expect(afterReopen.value.value.content_text, '复用记录后覆盖层仍在（记录级共享）').toBe(
        editedText
      );
    } finally {
      if (host !== null) {
        await closeHostApp(host);
      }
      await workspace.dispose();
    }
  });
});
