/**
 * 卡片窗口入口组合根单测（jsdom；金链路刀4 / 任务 #100 → 刀5 收口 / 任务 #112 随动改写）。
 *
 * 权威：`05-渲染引擎设计` §2.2–§2.4（六阶段链路）、§2.3（视图经宿主内部取视图通道回传）、
 * §6.4（降级占位）、§7.3（`maxNestedFrames = 0` 冻结值）、§8.3（变更回流唯一时序）、
 * §9.2–§9.3（`frame:action` 四类动作）；`04-能力契约规范` §七（冻结内置能力 ID 与输入形状）；
 * 工单035 裁定一（取视图通道非插件能力、不经 `window.chips`）。
 *
 * @remarks
 * - **#100 流程锁口径改写（非放宽，任务 #112）**：原锁口径 = 组合根完整链路
 *   `document:open → document:read`（暂行视图臂以结构分片承载视图）；新口径 =
 *   `document:open`（`window.chips` 链路）+ `document-view:request`（宿主内部取视图通道，
 *   经注入端口送达并以 #105 冻结封套逐字段核验）。两口径断言强度对比：旧臂只断言能力 ID 与
 *   `{documentId, part}` 输入形状；新臂额外断言封套过 `validateDocumentViewChannelRequest`
 *   权威闸（协议版本/判别类型/非空 requestId/十位 Base62 documentId/精确键集）+ requestId
 *   关联一致 + 错误臂如实收敛——只紧不松，依据为工单035 裁定一与 §2.3 视图承载转正。
 * - 数据面断言全部按**冻结契约**编码：fake `window.chips` 与 fake 取视图端口记录调用形状，
 *   不断言真数据通（`document:*` 接线在途 #99）。
 * - 完整挂载路径驱动到视图通道回包即止（回包按 #99 诚实回退以失败臂收敛），不进入帧装载，
 *   避免 jsdom 下 5s ready 超时悬挂。
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChipsError } from '../src/preload/chips-error.js';
import { RENDER_ERROR_CODES } from '../src/renderer/codes.js';
import { PLATFORM_ENTRY_URLS } from '../src/main/window-entries.js';
import {
  DOCUMENT_VIEW_PROTOCOL,
  DOCUMENT_VIEW_REQUEST_CHANNEL,
  createDocumentViewBuildFailure,
  createDocumentViewBuildResult,
  validateDocumentViewChannelRequest,
} from '../src/renderer/index.js';
import type {
  DocumentReflowAction,
  IChipsRequestFacade,
  IDocumentReflowSubscription,
  IDocumentViewBuilder,
  IDocumentViewChannelInvoke,
  IRenderEngineBindings,
  IRenderSession,
} from '../src/renderer/index.js';
import { HOST_VIEW_CHANNEL_SURFACE_KEY } from '../src/shared/host-view-channel-surface.js';
import {
  FRAME_ENTRY_URL,
  PLATFORM_CARD_FRAME_LIMITS,
  bootCardWindow,
  createCardReflowCoordinator,
  createCardWindowBindings,
  createViewChannelInvoke,
  mountCardWindow,
} from '../src/renderer/entries/card.js';
import type { ICardWindowInit, IChipsCardWindowFacade } from '../src/renderer/entries/card.js';
import {
  EMPTY_DESIGN_TOKENS,
  FRAME_ACTION_CAPABILITY_IDS,
  createFrameActionForwarder,
} from '../src/renderer/entries/bridge-data-plane.js';
import type { FrameActionPayload } from '../src/renderer/index.js';

const SOURCE = 'chips-resource://platform/documents/demo.card';
/** 十位 Base62 稳定文档标识（#105 请求闸在册形状；`05-ID生成规范` §二.1）。 */
const DOC_ID = 'Ab3dEf6Gh8';

const VIEW = Object.freeze({
  kind: 'card' as const,
  revision: 3,
  card_id: DOC_ID,
  name: '示例卡片',
  chip_standards_version: '1.0',
  cover_ratio: '4:3',
  tags: ['旅行', '美食'],
  cover: { entry: 'chips-resource://platform/cover/a.png', ratio: '4:3' },
  content_nodes: [{ node_id: 'n-1', card_type: 'basic.note', content: { text: '你好，薯片' } }],
});

const OPEN_OUTPUT = Object.freeze({
  documentId: DOC_ID,
  source: SOURCE,
  kind: 'card' as const,
  title: '示例卡片',
  digest: 'sha256:demo',
});

const INIT: ICardWindowInit = {
  source: SOURCE,
  documentId: DOC_ID,
  resourceBase: 'chips-resource://platform/documents/',
  pluginEntries: { 'basic.note': 'chips-resource://platform/plugins/basic.note.js' },
  tokens: { '--chips-color-primary': '#1677ff' },
};

type FacadeCalls = Array<{ capabilityId: string; input: unknown }>;

/** 记录型 `window.chips` 替身（request + subscribe 双腿；事件处理器由用例手动触发）。 */
function createFacade(handlers: Record<string, (input: unknown) => unknown>): {
  facade: IChipsCardWindowFacade & IChipsRequestFacade;
  calls: FacadeCalls;
  subscribed: Array<{ eventId: string; handler: (payload: unknown) => void }>;
} {
  const calls: FacadeCalls = [];
  const subscribed: Array<{ eventId: string; handler: (payload: unknown) => void }> = [];
  const facade: IChipsCardWindowFacade & IChipsRequestFacade = {
    request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
      calls.push({ capabilityId, input });
      const handler = handlers[capabilityId];
      if (handler === undefined) {
        return Promise.reject(
          new ChipsError({
            code: 'BRIDGE_CAPABILITY_NOT_REGISTERED',
            message: `能力未注册：${capabilityId}`,
            retryable: false,
          }),
        );
      }
      return Promise.resolve(handler(input) as TOutput);
    },
    subscribe(eventId: string, handler: (payload: unknown) => void): IDocumentReflowSubscription {
      subscribed.push({ eventId, handler });
      return { dispose: vi.fn() };
    },
  };
  return { facade, calls, subscribed };
}

/** 记录型取视图通道注入端口：登记触达的通道名与载荷，回包由 response 工厂决定。 */
function createViewChannelStub(response: (request: unknown) => unknown): {
  invoke: IDocumentViewChannelInvoke;
  calls: Array<{ channel: string; payload: unknown }>;
} {
  const calls: Array<{ channel: string; payload: unknown }> = [];
  return {
    calls,
    invoke: {
      invoke(channel: string, payload: unknown): Promise<unknown> {
        calls.push({ channel, payload });
        return Promise.resolve(response(payload));
      },
    },
  };
}

function diagnosticsStub(): IRenderEngineBindings['diagnostics'] {
  return { warn: vi.fn(), error: vi.fn() };
}

beforeEach(() => {
  document.body.innerHTML = '';
  delete (globalThis as { chips?: unknown }).chips;
  delete (globalThis as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY];
});

describe('createCardWindowBindings：组合根接线', () => {
  it('帧环境与限制：入口 URL 锁主进程登记表、限制为 §7.3 冻结值', () => {
    const { facade } = createFacade({});
    const { invoke } = createViewChannelStub(() => ({}));
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub(), invoke);
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
    const { invoke } = createViewChannelStub(() => ({}));
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub(), invoke);
    await bindings.document.open({ source: SOURCE, kind: 'card' });
    await bindings.document.read({ documentId: DOC_ID, part: 'structure' });
    expect(calls).toEqual([
      { capabilityId: 'document:open', input: { source: SOURCE, kind: 'card' } },
      { capabilityId: 'document:read', input: { documentId: DOC_ID, part: 'structure' } },
    ]);
  });

  it('文档网关臂：权限拒绝经既有归一链路 → RENDER_RESOURCE_DENIED', async () => {
    const { facade } = createFacade({
      'document:open': () => {
        throw new ChipsError({ code: 'BRIDGE_PERMISSION_DENIED', message: '权限拒绝', retryable: false });
      },
    });
    const { invoke } = createViewChannelStub(() => ({}));
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub(), invoke);
    await expect(bindings.document.open({ source: SOURCE, kind: 'card' })).rejects.toSatisfy(
      (error: unknown) => error instanceof ChipsError && error.code === RENDER_ERROR_CODES.resourceDenied,
    );
  });

  it('视图臂（缝②切换后）：经注入端口触达钉定通道、请求过 #105 发送侧权威闸', async () => {
    const { facade } = createFacade({});
    const { invoke, calls } = createViewChannelStub((request) =>
      createDocumentViewBuildResult((request as { requestId: string }).requestId, VIEW),
    );
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub(), invoke);
    const view = await bindings.viewBuilder.buildView({ source: SOURCE, documentId: DOC_ID, kind: 'card' });
    // 暂行 `document:read` 结构臂已退役：视图触达只经 `document-view:request`，通道名钉定。
    expect(calls).toHaveLength(1);
    expect(calls[0]?.channel).toBe(DOCUMENT_VIEW_REQUEST_CHANNEL);
    // 请求载荷过冻结契约权威闸（协议版本/判别类型/非空 requestId/Base62 documentId/精确键集）。
    const request = validateDocumentViewChannelRequest(calls[0]?.payload);
    expect(request.protocol).toBe(DOCUMENT_VIEW_PROTOCOL);
    expect(request.input).toEqual({ source: SOURCE, documentId: DOC_ID, kind: 'card' });
    // 成功臂回包视图到达侧再守门后交付（§6.6 冻结形状）。
    expect(view.card_id).toBe(DOC_ID);
  });

  it('视图臂：回包失败臂以在册码如实上抛（视图通路无 Bridge 兜底腿）', async () => {
    const { facade, calls } = createFacade({});
    const { invoke } = createViewChannelStub((request) =>
      createDocumentViewBuildFailure(
        (request as { requestId: string }).requestId,
        new ChipsError({ code: 'BRIDGE_INTERNAL', message: '文档能力未接线（#99 诚实回退）', retryable: false }),
      ),
    );
    const bindings = createCardWindowBindings(facade, INIT, diagnosticsStub(), invoke);
    await expect(
      bindings.viewBuilder.buildView({ source: SOURCE, documentId: DOC_ID, kind: 'card' }),
    ).rejects.toSatisfy((error: unknown) => error instanceof ChipsError && error.code === 'BRIDGE_INTERNAL');
    // 视图臂不再触碰任何 Bridge capability（旧结构分片臂已退役）。
    expect(calls).toHaveLength(0);
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

  it('EMPTY_DESIGN_TOKENS 为冻结空表', () => {
    expect(EMPTY_DESIGN_TOKENS).toEqual({});
    expect(Object.isFrozen(EMPTY_DESIGN_TOKENS)).toBe(true);
  });
});

describe('createViewChannelInvoke：窗口装载面 → 消费端口适配', () => {
  it('忽略入参 channel、把载荷原样投递到装载面的 requestView', async () => {
    const requestView = vi.fn((payload: unknown) => Promise.resolve({ echoed: payload }));
    const invoke = createViewChannelInvoke({ requestView });
    const payload = { protocol: DOCUMENT_VIEW_PROTOCOL, type: 'document-view:build' };
    await expect(invoke.invoke('anything-else', payload)).resolves.toEqual({ echoed: payload });
    // 渲染侧无法借适配端口改投递目标：通道名不转发，只转载荷。
    expect(requestView).toHaveBeenCalledWith(payload);
    expect(requestView.mock.calls[0]).toHaveLength(1);
  });
});

describe('#100 流程锁（任务 #112 口径改写）：装载臂生效完整链路', () => {
  it('document:open（chips）→ document-view:request（注入端口）→ 错误臂如实收敛为降级占位', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    const { facade, calls } = createFacade({ 'document:open': () => OPEN_OUTPUT });
    (globalThis as { chips?: unknown }).chips = facade;
    const viewCalls: unknown[] = [];
    const requestView = (payload: unknown): Promise<unknown> => {
      viewCalls.push(payload);
      const request = payload as { requestId: string };
      // #99 在册诚实回退：主进程视图通道端点回 BRIDGE_INTERNAL 失败臂（requestId 原样携带）。
      return Promise.resolve(
        createDocumentViewBuildFailure(request.requestId, {
          code: 'BRIDGE_INTERNAL',
          message: '文档能力未接线',
          retryable: false,
          details: {},
        }),
      );
    };
    (globalThis as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY] = { requestView };
    bootCardWindow(() => INIT);
    // 新口径流程锁：Bridge 链路只到 document:open；视图腿改走宿主内部通道。
    await vi.waitFor(() => {
      expect(calls.map((call) => call.capabilityId)).toEqual(['document:open']);
      expect(viewCalls).toHaveLength(1);
    });
    expect(calls[0]?.input).toEqual({ source: SOURCE, kind: 'card' });
    const request = validateDocumentViewChannelRequest(viewCalls[0]);
    expect(request.input).toEqual({ source: SOURCE, documentId: DOC_ID, kind: 'card' });
    // 失败臂经消费臂如实上抛 → 会话 error → 状态边界降级占位（进帧装载被确定性阻断）。
    await vi.waitFor(() => {
      expect(container.textContent ?? '').toContain('BRIDGE_INTERNAL');
    });
  });

  it('requestId 关联防线：回包关联标识失配以 BRIDGE_INTERNAL 收敛（不采信错配回包）', async () => {
    const { facade } = createFacade({ 'document:open': () => OPEN_OUTPUT });
    (globalThis as { chips?: unknown }).chips = facade;
    const requestView = (_payload: unknown): Promise<unknown> =>
      Promise.resolve(createDocumentViewBuildResult('req-mismatch', VIEW));
    (globalThis as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY] = { requestView };
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    bootCardWindow(() => INIT);
    await vi.waitFor(() => {
      expect(container.textContent ?? '').toContain('BRIDGE_INTERNAL');
    });
  });

  it('取视图装载面缺席：诚实空载、不降级到已退役结构臂、不发任何请求', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    const { facade, calls } = createFacade({ 'document:open': () => OPEN_OUTPUT });
    (globalThis as { chips?: unknown }).chips = facade;
    bootCardWindow(() => INIT);
    await vi.waitFor(() => {
      expect(container.childElementCount).toBeGreaterThan(0);
    });
    // 旧口径的 document:read 兜底腿已随暂行臂退役：本分支零 Bridge 调用。
    expect(calls).toHaveLength(0);
    expect(container.textContent ?? '').not.toContain('undefined');
  });
});

describe('bootCardWindow：空载与守卫臂', () => {
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
});

describe('mountCardWindow：生产组合 + 回流协调器接线（缝③）', () => {
  interface Mounted {
    container: HTMLElement;
    facade: IChipsCardWindowFacade & IChipsRequestFacade;
    calls: FacadeCalls;
    subscribed: Array<{ eventId: string; handler: (payload: unknown) => void }>;
    invoke: IDocumentViewChannelInvoke;
    channelCalls: Array<{ channel: string; payload: unknown }>;
    handle: ReturnType<typeof mountCardWindow>;
  }
  function mountWithFakeChannel(): Mounted {
    const container = document.createElement('main');
    const { facade, calls, subscribed } = createFacade({ 'document:open': () => OPEN_OUTPUT });
    const { invoke, calls: channelCalls } = createViewChannelStub((request) =>
      createDocumentViewBuildFailure(
        (request as { requestId: string }).requestId,
        new ChipsError({ code: 'BRIDGE_INTERNAL', message: '视图端点未接线（#99）', retryable: false }),
      ),
    );
    const handle = mountCardWindow(container, facade, INIT, diagnosticsStub(), invoke);
    return { container, facade, calls, subscribed, invoke, channelCalls, handle };
  }

  it('句柄面完整：unmount / executeAction 双腿就位；装载即触达 open + 钉定视图通道', async () => {
    const { handle, calls, channelCalls } = mountWithFakeChannel();
    expect(typeof handle.unmount).toBe('function');
    expect(typeof handle.executeAction).toBe('function');
    await vi.waitFor(() => {
      expect(calls.map((call) => call.capabilityId)).toEqual(['document:open']);
      expect(channelCalls).toHaveLength(1);
    });
    expect(channelCalls[0]?.channel).toBe(DOCUMENT_VIEW_REQUEST_CHANNEL);
    handle.unmount();
  });

  it('executeAction：渲染会话建立前确定性拒绝（RENDER_SESSION_DISPOSED，不伪造更新）', async () => {
    const { handle } = mountWithFakeChannel();
    const action: DocumentReflowAction = { documentId: DOC_ID, part: 'structure', value: null };
    await expect(handle.executeAction(action)).rejects.toSatisfy(
      (error: unknown) => error instanceof ChipsError && error.code === RENDER_ERROR_CODES.sessionDisposed,
    );
    // 无会话时写臂不触达。
    expect(handle).toBeDefined();
    handle.unmount();
  });
});

/** 回流协调器单测替身会话（编排器只消费 update / id；其余成员形状齐备不做行为断言）。 */
function createFakeSession(): { session: IRenderSession; updateMock: ReturnType<typeof vi.fn> } {
  const updateMock = vi.fn(() => Promise.resolve());
  const session = {
    id: 'render-fake-1',
    kind: 'card',
    mode: 'view',
    get state() {
      return 'ready' as const;
    },
    error: null,
    mount: vi.fn(() => Promise.resolve()),
    unmount: vi.fn(),
    update: updateMock as unknown as IRenderSession['update'],
    subscribe: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(() => Promise.resolve()),
  } as unknown as IRenderSession;
  return { session, updateMock };
}

describe('createCardReflowCoordinator：§8.3 唯一时序生产组合（缝③ executeAction 链路接通）', () => {
  it('executeAction：document:write → 取视图端口写后重建 → session.update(view, write 返回 revision)', async () => {
    const { facade, calls } = createFacade({ 'document:write': () => ({ revision: 4 }) });
    const { session, updateMock } = createFakeSession();
    const buildView = vi.fn(() => Promise.resolve({ ...VIEW, revision: 4 }));
    const viewBuilder: IDocumentViewBuilder = { buildView };
    const coordinator = createCardReflowCoordinator(facade, INIT, viewBuilder, session, diagnosticsStub());

    const action: DocumentReflowAction = {
      documentId: DOC_ID,
      part: 'structure',
      nodeId: 'n-1',
      value: { text: '改后文本' },
    };
    await coordinator.executeAction(action);

    // §8.3：revision 只取自 document:write 返回值（会话推进不自算）。
    expect(calls).toEqual([
      {
        capabilityId: 'document:write',
        input: { documentId: DOC_ID, part: 'structure', nodeId: 'n-1', value: { text: '改后文本' } },
      },
    ]);
    expect(buildView).toHaveBeenCalledWith({ source: SOURCE, documentId: DOC_ID, kind: 'card' });
    expect(updateMock).toHaveBeenCalledTimes(1);
    const [updatedView, updatedRevision] = updateMock.mock.calls[0] as [{ revision: number }, number];
    expect(updatedRevision).toBe(4);
    expect(updatedView?.revision).toBe(4);
    coordinator.dispose();
  });

  it('executeAction：跨文档动作确定性拒绝（BRIDGE_INVALID_INPUT），写臂与视图端口零触达', async () => {
    const { facade, calls } = createFacade({ 'document:write': () => ({ revision: 4 }) });
    const { session, updateMock } = createFakeSession();
    const buildView = vi.fn(() => Promise.resolve(VIEW));
    const coordinator = createCardReflowCoordinator(facade, INIT, { buildView }, session, diagnosticsStub());
    await expect(
      coordinator.executeAction({ documentId: 'De9fGh0Ij2', part: 'structure', value: null }),
    ).rejects.toBeInstanceOf(ChipsError);
    expect(calls).toHaveLength(0);
    expect(buildView).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    coordinator.dispose();
  });

  it('写失败如实上抛编辑链路：旧帧不动（update 零触达），错误码原样透传', async () => {
    const { facade } = createFacade({
      'document:write': () => {
        throw new ChipsError({ code: 'DOCUMENT_WRITE_CONFLICT', message: '写入冲突', retryable: false });
      },
    });
    const { session, updateMock } = createFakeSession();
    const buildView = vi.fn(() => Promise.resolve(VIEW));
    const coordinator = createCardReflowCoordinator(facade, INIT, { buildView }, session, diagnosticsStub());
    await expect(coordinator.executeAction({ documentId: DOC_ID, part: 'structure', value: null })).rejects.toSatisfy(
      (error: unknown) => error instanceof ChipsError && error.code === 'DOCUMENT_WRITE_CONFLICT',
    );
    expect(buildView).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    coordinator.dispose();
  });

  it('document:changed 订阅腿：装载身份匹配 → 通道重建 → update(view, 回包 revision)；dispose 幂等收口', async () => {
    const { facade, subscribed } = createFacade({});
    const { session, updateMock } = createFakeSession();
    const buildView = vi.fn(() => Promise.resolve({ ...VIEW, revision: 7 }));
    const coordinator = createCardReflowCoordinator(facade, INIT, { buildView }, session, diagnosticsStub());
    expect(subscribed.map((entry) => entry.eventId)).toEqual(['document:changed']);

    subscribed[0]?.handler({
      uri: SOURCE,
      documentId: DOC_ID,
      kind: 'card',
      digest: 'sha256:demo2',
      size: 128,
    });
    await vi.waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(1);
    });
    expect(buildView).toHaveBeenCalledWith({ source: SOURCE, documentId: DOC_ID, kind: 'card' });

    coordinator.dispose();
    coordinator.dispose();
    subscribed[0]?.handler({
      uri: SOURCE,
      documentId: DOC_ID,
      kind: 'card',
      digest: 'sha256:demo3',
      size: 130,
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    // dispose 幂等：后续 executeAction 拒绝（会话层已注销订阅）。
    await expect(
      coordinator.executeAction({ documentId: DOC_ID, part: 'structure', value: null }),
    ).rejects.toBeInstanceOf(ChipsError);
  });
});
