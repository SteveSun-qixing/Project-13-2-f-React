/**
 * 卡片窗口入口组合根单测（jsdom；金链路刀4 / 任务 #100）。
 *
 * 权威：`05-渲染引擎设计` §2.2–§2.4（六阶段链路）、§6.4（降级占位）、§7.3
 * （`maxNestedFrames = 0` 冻结值）、§9.2–§9.3（`frame:action` 四类动作）；
 * `04-能力契约规范` §七（冻结内置能力 ID 与输入形状）。
 *
 * @remarks
 * - 数据面断言全部按**冻结契约**编码：fake `window.chips` 记录 `capabilityId` 与输入形状，
 *   不断言真数据通（`document:*` 接线在途 #99）。
 * - 完整挂载路径只驱动到 `document:read` 出参即止（read 以契约失败收敛），不进入帧装载，
 *   避免 jsdom 下 5s ready 超时悬挂。
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChipsError } from '../src/preload/chips-error.js';
import { RENDER_ERROR_CODES } from '../src/renderer/codes.js';
import { PLATFORM_ENTRY_URLS } from '../src/main/window-entries.js';
import type { IChipsRequestFacade, IRenderEngineBindings } from '../src/renderer/index.js';
import {
  FRAME_ENTRY_URL,
  PLATFORM_CARD_FRAME_LIMITS,
  bootCardWindow,
  createCardWindowBindings,
} from '../src/renderer/entries/card.js';
import type { ICardWindowInit } from '../src/renderer/entries/card.js';
import {
  EMPTY_DESIGN_TOKENS,
  FRAME_ACTION_CAPABILITY_IDS,
  createBridgeCardViewBuilder,
  createFrameActionForwarder,
  guardCardRenderView,
} from '../src/renderer/entries/bridge-data-plane.js';
import type { FrameActionPayload } from '../src/renderer/index.js';

const SOURCE = 'chips-resource://platform/documents/demo.card';

const VIEW = Object.freeze({
  kind: 'card' as const,
  revision: 3,
  card_id: 'card-0001',
  name: '示例卡片',
  chip_standards_version: '1.0',
  cover_ratio: '4:3',
  tags: ['旅行', '美食'],
  cover: { entry: 'chips-resource://platform/cover/a.png', ratio: '4:3' },
  content_nodes: [{ node_id: 'n-1', card_type: 'basic.note', content: { text: '你好，薯片' } }],
});

const OPEN_OUTPUT = Object.freeze({
  documentId: 'doc-1',
  source: SOURCE,
  kind: 'card' as const,
  title: '示例卡片',
  digest: 'sha256:demo',
});

const INIT: ICardWindowInit = {
  source: SOURCE,
  resourceBase: 'chips-resource://platform/documents/',
  pluginEntries: { 'basic.note': 'chips-resource://platform/plugins/basic.note.js' },
  tokens: { '--chips-color-primary': '#1677ff' },
};

type FacadeCalls = Array<{ capabilityId: string; input: unknown }>;

function createFacade(handlers: Record<string, (input: unknown) => unknown>): {
  facade: IChipsRequestFacade;
  calls: FacadeCalls;
} {
  const calls: FacadeCalls = [];
  const facade: IChipsRequestFacade = {
    request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
      calls.push({ capabilityId, input });
      const handler = handlers[capabilityId];
      if (handler === undefined) {
        return Promise.reject(
          new ChipsError({ code: 'BRIDGE_CAPABILITY_NOT_REGISTERED', message: `能力未注册：${capabilityId}`, retryable: false })
        );
      }
      return Promise.resolve(handler(input) as TOutput);
    },
  };
  return { facade, calls };
}

function diagnosticsStub(): IRenderEngineBindings['diagnostics'] {
  return { warn: vi.fn(), error: vi.fn() };
}

beforeEach(() => {
  document.body.innerHTML = '';
  delete (globalThis as { chips?: unknown }).chips;
});

describe('createCardWindowBindings：组合根接线', () => {
  it('帧环境与限制：入口 URL 锁主进程登记表、限制为 §7.3 冻结值', () => {
    const { facade } = createFacade({});
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub());
    expect(FRAME_ENTRY_URL).toBe(PLATFORM_ENTRY_URLS.frame);
    expect(bindings.frames.frameEntryUrl).toBe(FRAME_ENTRY_URL);
    expect(bindings.frames.tokens).toBe(INIT.tokens);
    expect(bindings.limits).toEqual({ minHeight: 1, maxHeight: 100_000, maxNestedFrames: 0 });
    expect(PLATFORM_CARD_FRAME_LIMITS.maxNestedFrames).toBe(0);
    expect(Object.isFrozen(PLATFORM_CARD_FRAME_LIMITS)).toBe(true);
    expect(bindings.resourceBase).toBe(INIT.resourceBase);
    expect(bindings.pluginEntries).toBe(INIT.pluginEntries);
  });

  it('文档网关臂：open / read 原样透传冻结能力 ID 与输入', async () => {
    const { facade, calls } = createFacade({
      'document:open': () => OPEN_OUTPUT,
      'document:read': () => ({ part: 'structure', value: VIEW, diagnostics: [] }),
    });
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub());
    await bindings.document.open({ source: SOURCE, kind: 'card' });
    await bindings.document.read({ documentId: 'doc-1', part: 'structure' });
    expect(calls).toEqual([
      { capabilityId: 'document:open', input: { source: SOURCE, kind: 'card' } },
      { capabilityId: 'document:read', input: { documentId: 'doc-1', part: 'structure' } },
    ]);
  });

  it('文档网关臂：权限拒绝经既有归一链路 → RENDER_RESOURCE_DENIED', async () => {
    const { facade } = createFacade({
      'document:open': () => {
        throw new ChipsError({ code: 'BRIDGE_PERMISSION_DENIED', message: '权限拒绝', retryable: false });
      },
    });
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub());
    await expect(bindings.document.open({ source: SOURCE, kind: 'card' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ChipsError && error.code === RENDER_ERROR_CODES.resourceDenied,
    );
  });

  it('视图臂：document:read(structure) 响应守门重建为 §9.2 卡片视图', async () => {
    const { facade, calls } = createFacade({
      'document:read': () => ({ part: 'structure', value: VIEW, diagnostics: [] }),
    });
    const builder = createBridgeCardViewBuilder(facade);
    const view = await builder.buildView({ source: SOURCE, documentId: 'doc-1', kind: 'card' });
    expect(calls).toEqual([
      { capabilityId: 'document:read', input: { documentId: 'doc-1', part: 'structure' } },
    ]);
    expect(view).toEqual(VIEW);
  });

  it('视图臂：箱子视图当前波次不承载（契约口径拒绝，不伪造）', async () => {
    const { facade, calls } = createFacade({});
    const builder = createBridgeCardViewBuilder(facade);
    await expect(builder.buildView({ source: SOURCE, documentId: 'doc-1', kind: 'box' })).rejects.toSatisfy(
      (error: unknown) => error instanceof ChipsError && error.code === 'BRIDGE_INVALID_INPUT',
    );
    expect(calls).toHaveLength(0);
  });

  it('视图臂：能力失败经 normalizeDocumentFailure 归一上抛', async () => {
    const { facade } = createFacade({
      'document:read': () => {
        throw new ChipsError({ code: 'BRIDGE_PERMISSION_DENIED', message: '权限拒绝', retryable: false });
      },
    });
    const builder = createBridgeCardViewBuilder(facade);
    await expect(builder.buildView({ source: SOURCE, documentId: 'doc-1', kind: 'card' })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ChipsError && error.code === RENDER_ERROR_CODES.resourceDenied,
    );
  });
});

describe('guardCardRenderView：视图守门', () => {
  it('接受包装响应（IDocumentReadOutput）与直投响应', () => {
    expect(guardCardRenderView({ part: 'structure', value: VIEW, diagnostics: [] })).toEqual(VIEW);
    expect(guardCardRenderView(VIEW)).toEqual(VIEW);
  });

  const rejectCases: ReadonlyArray<[string, unknown]> = [
    ['非对象', 'text'],
    ['kind 非 card', { ...VIEW, kind: 'box' }],
    ['多余字段', { ...VIEW, extra: 1 }],
    ['缺失字段', { ...VIEW, name: undefined } satisfies Record<string, unknown>],
    ['revision 负数', { ...VIEW, revision: -1 }],
    ['revision 非整数', { ...VIEW, revision: 1.5 }],
    ['cover 形状违约', { ...VIEW, cover: { entry: 'a' } }],
    ['cover 字段非字符串', { ...VIEW, cover: { entry: 1, ratio: '4:3' } }],
    ['tags 非数组', { ...VIEW, tags: '旅行' }],
    ['tags 成员非法', { ...VIEW, tags: [123] }],
    ['content_nodes 非数组', { ...VIEW, content_nodes: {} }],
    ['节点缺 content', { ...VIEW, content_nodes: [{ node_id: 'n-1', card_type: 'basic.note' }] }],
    ['节点 content 非映射', { ...VIEW, content_nodes: [{ node_id: 'n-1', card_type: 'basic.note', content: '文本' }] }],
    ['节点 card_type 空串', { ...VIEW, content_nodes: [{ node_id: 'n-1', card_type: '', content: {} }] }],
  ];

  it.each(rejectCases)('%s → 契约违约拒绝', (_label, raw) => {
    expect(() => guardCardRenderView(raw)).toThrow('文档视图形状违约');
    try {
      guardCardRenderView(raw);
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      expect((error as ChipsError).code).toBe('BRIDGE_INTERNAL');
    }
  });

  it('复合 tags（字符串数组成员）原样保留', () => {
    const view = { ...VIEW, tags: [['组', '标签']] };
    expect(guardCardRenderView(view).tags).toEqual([['组', '标签']]);
  });

  it('EMPTY_DESIGN_TOKENS 为冻结空表', () => {
    expect(EMPTY_DESIGN_TOKENS).toEqual({});
    expect(Object.isFrozen(EMPTY_DESIGN_TOKENS)).toBe(true);
  });
});

describe('createFrameActionForwarder：四类动作逐 kind 映射冻结能力', () => {
  const actionCases: ReadonlyArray<[FrameActionPayload, string, unknown]> = [
    [{ kind: 'open-external', url: 'https://example.com' }, 'shell:openExternal', { url: 'https://example.com' }],
    [
      { kind: 'open-resource', request: { resource_id: 'res-1', mode: 'view' } },
      'resource:open',
      { resource_id: 'res-1', mode: 'view', origin: 'frame' },
    ],
    [{ kind: 'copy-text', text: '复制内容' }, 'clipboard:write', { text: '复制内容' }],
    [{ kind: 'notify', level: 'info', message: '提示' }, 'notification:send', { level: 'info', message: '提示' }],
  ];

  it.each(actionCases)('动作 %s → %s', async (action, capabilityId, expectedInput) => {
    const { facade, calls } = createFacade({ [capabilityId]: () => ({}) });
    await createFrameActionForwarder(facade)(action);
    expect(calls).toEqual([{ capabilityId, input: expectedInput }]);
  });

  it('能力 ID 映射常量锁', () => {
    expect(FRAME_ACTION_CAPABILITY_IDS).toEqual({
      'open-external': 'shell:openExternal',
      'open-resource': 'resource:open',
      'copy-text': 'clipboard:write',
      notify: 'notification:send',
    });
  });

  it('清单外动作类型：无效输入拒绝且不发请求', async () => {
    const { facade, calls } = createFacade({});
    const rogue = { kind: 'unknown-action' } as unknown as FrameActionPayload;
    await expect(createFrameActionForwarder(facade)(rogue)).rejects.toSatisfy(
      (error: unknown) => error instanceof ChipsError && error.code === 'BRIDGE_INVALID_INPUT',
    );
    expect(calls).toHaveLength(0);
  });
});

describe('bootCardWindow：空载与装载臂', () => {
  it('根容器缺席：静默返回（模块导入期安全）', () => {
    expect(() => bootCardWindow()).not.toThrow();
  });

  it('preload 桥缺席：诚实空载态，不发任何能力请求', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    bootCardWindow();
    await vi.waitFor(() => {
      expect(container.childElementCount).toBeGreaterThan(0);
    });
    expect(container.textContent ?? '').not.toContain('undefined');
  });

  it('桥在但无装载输入：空载且不伪造请求', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    const { facade, calls } = createFacade({});
    (globalThis as { chips?: unknown }).chips = facade;
    bootCardWindow();
    expect(calls).toHaveLength(0);
    await vi.waitFor(() => {
      expect(container.childElementCount).toBeGreaterThan(0);
    });
  });

  it('装载输入注入位生效：完整组合按冻结契约发起 document:open → document:read', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    const { facade, calls } = createFacade({
      'document:open': () => OPEN_OUTPUT,
      'document:read': () => {
        throw new ChipsError({ code: 'BRIDGE_TIMEOUT', message: '数据面未接通（测试收敛：不进帧装载）', retryable: true });
      },
    });
    (globalThis as { chips?: unknown }).chips = facade;
    bootCardWindow(() => INIT);
    await vi.waitFor(() => {
      expect(calls.map((call) => call.capabilityId)).toEqual(['document:open', 'document:read']);
    });
    expect(calls[0]?.input).toEqual({ source: SOURCE, kind: 'card' });
    expect(calls[1]?.input).toEqual({ documentId: 'doc-1', part: 'structure' });
  });
});
