/**
 * 金链路刀5 段B：编辑回流订阅编排单测（Node 环境，端口全替身确定性驱动）。
 *
 * 权威：`05-渲染引擎设计` §8.3（变更回流唯一时序：`document:write` 返回 `{revision}` →
 * `update(view, revision)`，revision 只能取自 write 返回值）、§2.6（写后重建经取视图通道
 * 端口）、§2.4 第 5 条（revision 递增守卫与会话层收敛）、§11；`11-文档服务设计` §4.2
 * （write 不落盘不发布事件——写后重建触发点是 write 成功返回）；`05-事件契约规范` §4.2
 * （`document:changed` 精确五键 payload）；`04-能力契约规范` §7.3（write 输入形状，
 * `additionalProperties:false` 下 `nodeId` 缺席即不携带该键）。
 *
 * @remarks 零 skip：两臂（executeAction 写后重建 / document:changed 事件回流）逐臂、
 * 时序逐环、错误逐码断言；队列串行性与失败不阻断逐项锁定。
 */

import { describe, expect, it, vi } from 'vitest';

import { ChipsError } from '@chips/bridge';

import { createBridgeDocumentWritePort, createDocumentReflowCoordinator } from '../src/renderer/document-reflow.js';
import type {
  DocumentReflowAction,
  DocumentReflowEventSubscribe,
  IDocumentReflowSubscription,
  IDocumentWritePort,
} from '../src/renderer/document-reflow.js';
import { createRenderError, RENDER_ERROR_CODES } from '../src/renderer/codes.js';
import type { IRenderDocumentGateway, IChipsRequestFacade } from '../src/renderer/document-gateway.js';
import type { IDocumentViewBuilder } from '../src/renderer/render-engine.js';
import type { IRenderSession, RenderEventMap, RenderEventName } from '../src/renderer/render-engine.js';
import type { ICardRenderView } from '../src/renderer/frame-protocol.js';
import type { DocumentKind, IDocumentWriteInput, IDocumentWriteOutput } from '../src/capabilities/document/contract.js';
import { DOCUMENT_BUSINESS_ERROR_CODES } from '../src/capabilities/document/errors.js';
import { CARD_ID } from './helpers/document-fake-ports.js';

const SOURCE = 'chips-resource://workspace-a/我的卡片.card';
const NODE_ID = 'n-1';

/* ------------------------------------------------------------------ *
 * 替身
 * ------------------------------------------------------------------ */

/** 渲染会话替身（完整 `IRenderSession` 面；仅 update 被编排器消费，其余为形状占位实装）。 */
class FakeRenderSession implements IRenderSession {
  readonly id = 'render-fake-1';
  readonly kind: DocumentKind = 'card';
  readonly mode = 'view' as const;
  readonly updateCalls: Array<{ view: ICardRenderView; revision: number }> = [];
  updateOutcome: () => Promise<void> = () => Promise.resolve();

  get state(): 'ready' {
    return 'ready';
  }

  readonly error: ChipsError | null = null;

  mount(): Promise<void> {
    return Promise.resolve();
  }

  unmount(): void {
    // 替身无挂载面。
  }

  update(view: ICardRenderView, revision: number): Promise<void> {
    this.updateCalls.push({ view, revision });
    return this.updateOutcome();
  }

  subscribe<TEvent extends RenderEventName>(
    _event: TEvent,
    _handler: (payload: RenderEventMap[TEvent]) => void,
  ): { dispose(): void } {
    return { dispose: () => undefined };
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}

/** 视图构建端口替身（记录逐调用输入；可编程失败）。 */
interface ViewBuilderRecorder {
  readonly builder: IDocumentViewBuilder;
  readonly inputs: Array<{ source: string; documentId: string; kind: DocumentKind }>;
  outcome: (input: { source: string; documentId: string; kind: DocumentKind }) => Promise<ICardRenderView>;
}

function makeViewBuilder(revisionOf: (index: number) => number = () => 0): ViewBuilderRecorder {
  const inputs: ViewBuilderRecorder['inputs'] = [];
  const recorder: ViewBuilderRecorder = {
    inputs,
    builder: {
      buildView(input) {
        const index = inputs.length;
        inputs.push(input);
        return recorder.outcome(input).then((view) => ({ ...view, revision: revisionOf(index) }));
      },
    },
    outcome: () => Promise.resolve(cardView(0)),
  };
  return recorder;
}

/** §6.6 冻结形状卡片视图夹具（编排器只透传，不解释字段）。 */
function cardView(revision: number): ICardRenderView {
  return {
    kind: 'card',
    revision,
    card_id: CARD_ID,
    name: '示例卡片',
    chip_standards_version: '1.0',
    cover_ratio: '4:3',
    tags: ['旅行'],
    cover: { entry: 'cover/a.png', ratio: '4:3' },
    content_nodes: [{ node_id: NODE_ID, card_type: 'basic.note', content: { text: '内容' } }],
  };
}

/** 写臂替身（记录逐调用输入；可编程时序与失败）。 */
interface WriteRecorder {
  readonly port: IDocumentWritePort;
  readonly inputs: IDocumentWriteInput[];
  outcome: (input: IDocumentWriteInput) => Promise<IDocumentWriteOutput>;
}

function makeWrite(revision = 1): WriteRecorder {
  const inputs: IDocumentWriteInput[] = [];
  const recorder: WriteRecorder = {
    inputs,
    port: {
      write(input) {
        inputs.push(input);
        return recorder.outcome(input);
      },
    },
    outcome: () => Promise.resolve({ revision }),
  };
  return recorder;
}

/** 事件订阅替身（捕获唯一 handler 与 dispose 计数）。 */
interface SubscribeRecorder {
  readonly subscribe: DocumentReflowEventSubscribe;
  readonly eventIds: string[];
  handlers: Array<(payload: unknown) => void>;
  disposeCount: () => number;
}

function makeSubscribe(): SubscribeRecorder {
  const eventIds: string[] = [];
  const handlers: Array<(payload: unknown) => void> = [];
  let disposed = 0;
  return {
    eventIds,
    handlers,
    disposeCount: () => disposed,
    subscribe(eventId, handler): IDocumentReflowSubscription {
      eventIds.push(eventId);
      handlers.push(handler);
      return {
        dispose(): void {
          disposed += 1;
        },
      };
    },
  };
}

/** 诊断替身：函数属性位（非方法语法），spy 面可直接断言调用记录。 */
interface RecordingDiagnostics {
  readonly warn: ReturnType<typeof vi.fn>;
  readonly error: ReturnType<typeof vi.fn>;
}

function makeDiagnostics(): RecordingDiagnostics {
  return { warn: vi.fn(), error: vi.fn() };
}

interface CoordinatorHarness {
  // 网关替身与渲染面类型同构（仅测试消费面被触达）。
  coordinator: ReturnType<typeof createDocumentReflowCoordinator>;
  session: FakeRenderSession;
  write: WriteRecorder;
  views: ViewBuilderRecorder;
  events: SubscribeRecorder;
  diagnostics: ReturnType<typeof makeDiagnostics>;
  emitChanged(payload: unknown): void;
}

function makeCoordinator(
  overrides: {
    kind?: DocumentKind;
    revisionOf?: (index: number) => number;
  } = {},
): CoordinatorHarness {
  const session = new FakeRenderSession();
  const write = makeWrite(1);
  const views = makeViewBuilder(overrides.revisionOf);
  const events = makeSubscribe();
  const diagnostics = makeDiagnostics();
  const coordinator = createDocumentReflowCoordinator({
    source: SOURCE,
    documentId: CARD_ID,
    kind: overrides.kind ?? 'card',
    session,
    write: write.port,
    viewBuilder: views.builder,
    subscribe: events.subscribe,
    diagnostics,
  });
  return {
    coordinator,
    session,
    write,
    views,
    events,
    diagnostics,
    emitChanged(payload: unknown): void {
      const handler = events.handlers[0];
      if (handler === undefined) {
        throw new Error('测试夹具：document:changed 订阅未建立');
      }
      handler(payload);
    },
  };
}

/** 在册 `document:changed` payload 夹具（§4.2 精确五键）。 */
function changedPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uri: SOURCE,
    documentId: CARD_ID,
    kind: 'card',
    digest: 'sha256:demo',
    size: 1024,
    ...overrides,
  };
}

function metadataAction(): DocumentReflowAction {
  return { documentId: CARD_ID, part: 'metadata', value: { name: '新名称' } };
}

/* ------------------------------------------------------------------ *
 * A 组：Bridge 写臂
 * ------------------------------------------------------------------ */

describe('createBridgeDocumentWritePort：document:write 正式能力通路', () => {
  function makeFacade(handlers: Record<string, (input: unknown) => unknown>): {
    facade: IChipsRequestFacade;
    calls: Array<{ capabilityId: string; input: unknown }>;
  } {
    const calls: Array<{ capabilityId: string; input: unknown }> = [];
    const facade: IChipsRequestFacade = {
      request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
        calls.push({ capabilityId, input });
        const handler = handlers[capabilityId];
        if (handler === undefined) {
          return Promise.reject(
            new ChipsError({ code: 'BRIDGE_CAPABILITY_NOT_REGISTERED', message: '能力未注册', retryable: false }),
          );
        }
        return Promise.resolve(handler(input) as TOutput);
      },
    };
    return { facade, calls };
  }

  it('能力 ID 与输入逐字段透传（冻结契约 ID）', async () => {
    const { facade, calls } = makeFacade({ 'document:write': () => ({ revision: 2 }) });
    const output = await createBridgeDocumentWritePort(facade).write({
      documentId: CARD_ID,
      part: 'content',
      nodeId: NODE_ID,
      value: { text: '编辑后' },
    });
    expect(output).toEqual({ revision: 2 });
    expect(calls).toEqual([
      {
        capabilityId: 'document:write',
        input: { documentId: CARD_ID, part: 'content', nodeId: NODE_ID, value: { text: '编辑后' } },
      },
    ]);
  });

  it('权限拒绝经既有归一链路 → RENDER_RESOURCE_DENIED', async () => {
    const { facade } = makeFacade({});
    await expect(createBridgeDocumentWritePort(facade).write(metadataAction())).rejects.toBeInstanceOf(ChipsError);
    // 未注册该能力：透传契约码（不发明映射）。
    const { facade: deniedFacade } = makeFacade({
      'document:write': () => {
        throw new ChipsError({ code: 'BRIDGE_PERMISSION_DENIED', message: '权限拒绝', retryable: false });
      },
    });
    const error = await createBridgeDocumentWritePort(deniedFacade)
      .write(metadataAction())
      .then(
        () => null,
        (rejection: unknown) => rejection as ChipsError,
      );
    expect(error?.code).toBe(RENDER_ERROR_CODES.resourceDenied);
  });

  it('文档域失败码经归一（notOpen → RENDER_DOCUMENT_INVALID），其余码原样透传', async () => {
    const { facade: notOpen } = makeFacade({
      'document:write': () => {
        throw new ChipsError({ code: DOCUMENT_BUSINESS_ERROR_CODES.notOpen, message: '会话不存在', retryable: false });
      },
    });
    await expect(createBridgeDocumentWritePort(notOpen).write(metadataAction())).rejects.toSatisfy(
      (error: unknown) => (error as ChipsError).code === RENDER_ERROR_CODES.documentInvalid,
    );
    const { facade: timeout } = makeFacade({
      'document:write': () => {
        throw new ChipsError({ code: 'BRIDGE_TIMEOUT', message: '调用超时', retryable: true });
      },
    });
    await expect(createBridgeDocumentWritePort(timeout).write(metadataAction())).rejects.toSatisfy(
      (error: unknown) => (error as ChipsError).code === 'BRIDGE_TIMEOUT',
    );
  });

  it('网关面隔离：本端口与渲染查看态网关互不混用（write 不在 IRenderDocumentGateway 面内）', () => {
    // 类型级防线：`IRenderDocumentGateway` 无 write 成员（查看态两动作），编辑写臂独立端口。
    const gatewayMembers: IRenderDocumentGateway = {
      open: () => Promise.resolve({ documentId: CARD_ID, source: SOURCE, kind: 'card', title: '', digest: '' }),
      read: () => Promise.resolve({ part: 'metadata', value: {}, diagnostics: [] }),
    };
    expect(Object.keys(gatewayMembers).sort()).toEqual(['open', 'read']);
    expect('write' in gatewayMembers).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * B 组：executeAction 写后重建臂（§8.3 唯一时序）
 * ------------------------------------------------------------------ */

describe('编辑回流·executeAction 写后重建臂', () => {
  it('构造即建立 document:changed 唯一订阅', () => {
    const harness = makeCoordinator();
    expect(harness.events.eventIds).toEqual(['document:changed']);
    harness.coordinator.dispose();
  });

  it('唯一时序闭环：write → buildView（取视图通道端口）→ update(view, write 返回的 revision)', async () => {
    const harness = makeCoordinator({ revisionOf: () => 5 });
    harness.write.outcome = () => Promise.resolve({ revision: 7 });
    const action: DocumentReflowAction = {
      documentId: CARD_ID,
      part: 'content',
      nodeId: NODE_ID,
      value: { text: '编辑后' },
    };
    await harness.coordinator.executeAction(action);
    expect(harness.write.inputs).toEqual([
      { documentId: CARD_ID, part: 'content', nodeId: NODE_ID, value: { text: '编辑后' } },
    ]);
    expect(harness.views.inputs).toEqual([{ source: SOURCE, documentId: CARD_ID, kind: 'card' }]);
    expect(harness.session.updateCalls).toHaveLength(1);
    const [call] = harness.session.updateCalls;
    // §8.3 锁定：revision 取自 write 返回值（7），不是视图字段（5）、不是自算。
    expect(call?.revision).toBe(7);
    expect(call?.view.revision).toBe(5);
    harness.coordinator.dispose();
  });

  it('nodeId 缺席即不物化该键（§7.3 additionalProperties:false 同纪律）', async () => {
    const harness = makeCoordinator();
    await harness.coordinator.executeAction({ documentId: CARD_ID, part: 'metadata', value: { name: '新名称' } });
    const [input] = harness.write.inputs;
    expect(Object.keys(input ?? {}).sort()).toEqual(['documentId', 'part', 'value']);
    harness.coordinator.dispose();
  });

  it('跨文档动作确定性拒绝：BRIDGE_INVALID_INPUT，写臂/构建/更新零触达', async () => {
    const harness = makeCoordinator();
    const error = await harness.coordinator
      .executeAction({ documentId: 'Zz9yXw8Vu7', part: 'metadata', value: {} })
      .then(
        () => null,
        (rejection: unknown) => rejection as ChipsError,
      );
    expect(error).toBeInstanceOf(ChipsError);
    expect(error?.code).toBe('BRIDGE_INVALID_INPUT');
    expect(harness.write.inputs).toHaveLength(0);
    expect(harness.views.inputs).toHaveLength(0);
    expect(harness.session.updateCalls).toHaveLength(0);
    harness.coordinator.dispose();
  });

  it('write 失败：不重建、不更新，契约错误如实上抛', async () => {
    const harness = makeCoordinator();
    harness.write.outcome = () => Promise.reject(createRenderError({ code: RENDER_ERROR_CODES.documentInvalid }));
    await expect(harness.coordinator.executeAction(metadataAction())).rejects.toBeInstanceOf(ChipsError);
    expect(harness.views.inputs).toHaveLength(0);
    expect(harness.session.updateCalls).toHaveLength(0);
    harness.coordinator.dispose();
  });

  it('buildView 失败（通道失败臂）：不更新，错误原码上抛（旧帧由会话层保留）', async () => {
    const harness = makeCoordinator();
    harness.views.outcome = () =>
      Promise.reject(new ChipsError({ code: 'DOCUMENT_NOT_OPEN', message: '会话不存在', retryable: false }));
    await expect(harness.coordinator.executeAction(metadataAction())).rejects.toSatisfy(
      (error: unknown) => (error as ChipsError).code === 'DOCUMENT_NOT_OPEN',
    );
    expect(harness.session.updateCalls).toHaveLength(0);
    harness.coordinator.dispose();
  });

  it('update 失败：RENDER_UPDATE_FAILED 如实上抛（编辑链路保持脏态自行重试口径）', async () => {
    const harness = makeCoordinator();
    harness.session.updateOutcome = () => Promise.reject(createRenderError({ code: RENDER_ERROR_CODES.updateFailed }));
    await expect(harness.coordinator.executeAction(metadataAction())).rejects.toSatisfy(
      (error: unknown) => (error as ChipsError).code === RENDER_ERROR_CODES.updateFailed,
    );
    harness.coordinator.dispose();
  });

  it('两臂共享串行队列：动作按调用序完整闭环，不与在途重建交错', async () => {
    const harness = makeCoordinator();
    const firstWriteGate: { release: (() => void) | null } = { release: null };
    harness.write.outcome = (input) => {
      const value = input.value as { seq: number };
      if (value.seq === 1) {
        return new Promise<IDocumentWriteOutput>((resolve) => {
          firstWriteGate.release = () => resolve({ revision: 11 });
        });
      }
      return Promise.resolve({ revision: 12 });
    };
    const first = harness.coordinator.executeAction({ documentId: CARD_ID, part: 'metadata', value: { seq: 1 } });
    const second = harness.coordinator.executeAction({ documentId: CARD_ID, part: 'metadata', value: { seq: 2 } });
    await Promise.resolve();
    // 第二动作写臂未启动（串行队列：第一动作全链路未落定）。
    expect(harness.write.inputs).toHaveLength(1);
    firstWriteGate.release?.();
    await Promise.all([first, second]);
    expect(harness.session.updateCalls.map((call) => call.revision)).toEqual([11, 12]);
    harness.coordinator.dispose();
  });

  it('队列失败不阻断：前序动作失败后，后续动作照常闭环', async () => {
    const harness = makeCoordinator();
    harness.write.outcome = (input) =>
      (input.value as { fail?: boolean }).fail === true
        ? Promise.reject(new ChipsError({ code: 'DOCUMENT_SOURCE_CHANGED', message: '来源已变', retryable: false }))
        : Promise.resolve({ revision: 2 });
    await expect(
      harness.coordinator.executeAction({ documentId: CARD_ID, part: 'metadata', value: { fail: true } }),
    ).rejects.toBeInstanceOf(ChipsError);
    await harness.coordinator.executeAction({ documentId: CARD_ID, part: 'metadata', value: { fail: false } });
    expect(harness.session.updateCalls).toHaveLength(1);
    harness.coordinator.dispose();
  });

  it('dispose 后动作拒绝 RENDER_SESSION_DISPOSED 且写臂零触达', async () => {
    const harness = makeCoordinator();
    harness.coordinator.dispose();
    await expect(harness.coordinator.executeAction(metadataAction())).rejects.toSatisfy(
      (error: unknown) => (error as ChipsError).code === RENDER_ERROR_CODES.sessionDisposed,
    );
    expect(harness.write.inputs).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * C 组：document:changed 事件回流臂
 * ------------------------------------------------------------------ */

describe('编辑回流·document:changed 事件臂', () => {
  it('身份匹配事件：重建取回视图并按视图 revision 更新（事件不携 revision，不发明字段）', async () => {
    const harness = makeCoordinator({ revisionOf: () => 9 });
    harness.emitChanged(changedPayload());
    await vi.waitFor(() => {
      expect(harness.session.updateCalls).toHaveLength(1);
    });
    expect(harness.views.inputs).toEqual([{ source: SOURCE, documentId: CARD_ID, kind: 'card' }]);
    expect(harness.session.updateCalls[0]?.revision).toBe(9);
    harness.coordinator.dispose();
  });

  it('他文档事件（uri 或 documentId 不符）：忽略，零触达构建与更新', async () => {
    const harness = makeCoordinator();
    harness.emitChanged(changedPayload({ uri: 'chips-resource://workspace-a/别的卡片.card' }));
    harness.emitChanged(changedPayload({ documentId: 'Zz9yXw8Vu7' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.views.inputs).toHaveLength(0);
    expect(harness.session.updateCalls).toHaveLength(0);
    expect(harness.diagnostics.warn).not.toHaveBeenCalled();
    harness.coordinator.dispose();
  });

  const malformedCases: ReadonlyArray<[string, unknown]> = [
    ['载荷非对象', 'text'],
    ['载荷为数组', []],
    ['载荷为 null', null],
    ['缺字段', { uri: SOURCE, documentId: CARD_ID, kind: 'card', digest: 'sha256:demo' }],
    ['多余键', changedPayload({ extra: 1 })],
    ['digest 非字符串', changedPayload({ digest: 42 })],
    ['size 负数', changedPayload({ size: -1 })],
    ['size 非整数', changedPayload({ size: 1.5 })],
    ['kind 不在判别联合', changedPayload({ kind: 'note' })],
    ['身份匹配但 kind 与会话矛盾', changedPayload({ kind: 'box' })],
  ];

  it.each(malformedCases)('违约事件·%s：诊断留痕并忽略，零触达构建', async (_label, payload) => {
    const harness = makeCoordinator();
    harness.emitChanged(payload);
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.views.inputs).toHaveLength(0);
    expect(harness.session.updateCalls).toHaveLength(0);
    expect(harness.diagnostics.warn).toHaveBeenCalledTimes(1);
    harness.coordinator.dispose();
  });

  it('事件臂重建失败：落诊断保留旧帧，不向事件总线抛出（事件是通知不是状态）', async () => {
    const harness = makeCoordinator();
    harness.views.outcome = () =>
      Promise.reject(new ChipsError({ code: 'BRIDGE_INTERNAL', message: '回包违约', retryable: false }));
    expect(() => harness.emitChanged(changedPayload())).not.toThrow();
    await vi.waitFor(() => {
      expect(harness.diagnostics.warn).toHaveBeenCalledTimes(1);
    });
    expect(String(harness.diagnostics.warn.mock.calls[0]?.[1])).toContain('回流重建失败');
    expect(harness.session.updateCalls).toHaveLength(0);
    harness.coordinator.dispose();
  });

  it('事件臂 update 失败同样收敛为诊断（RENDER_UPDATE_FAILED 上抛路径不升级）', async () => {
    const harness = makeCoordinator();
    harness.session.updateOutcome = () => Promise.reject(createRenderError({ code: RENDER_ERROR_CODES.updateFailed }));
    harness.emitChanged(changedPayload());
    await vi.waitFor(() => {
      expect(harness.diagnostics.warn).toHaveBeenCalledTimes(1);
    });
    harness.coordinator.dispose();
  });

  it('事件臂与动作臂共队列：在途动作未落定时事件重建不插队', async () => {
    const harness = makeCoordinator();
    const eventWriteGate: { release: (() => void) | null } = { release: null };
    harness.write.outcome = () =>
      new Promise<IDocumentWriteOutput>((resolve) => {
        eventWriteGate.release = () => resolve({ revision: 21 });
      });
    const action = harness.coordinator.executeAction(metadataAction());
    harness.emitChanged(changedPayload());
    await Promise.resolve();
    expect(harness.views.inputs).toHaveLength(0);
    eventWriteGate.release?.();
    await action;
    await vi.waitFor(() => {
      expect(harness.session.updateCalls).toHaveLength(2);
    });
    expect(harness.session.updateCalls.map((call) => call.revision)).toEqual([21, 0]);
    harness.coordinator.dispose();
  });
});

/* ------------------------------------------------------------------ *
 * D 组：dispose 收口
 * ------------------------------------------------------------------ */

describe('编辑回流·dispose 收口', () => {
  it('注销订阅一次且幂等；dispose 后竞态事件静默忽略', async () => {
    const harness = makeCoordinator();
    harness.coordinator.dispose();
    harness.coordinator.dispose();
    expect(harness.events.disposeCount()).toBe(1);
    harness.emitChanged(changedPayload());
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.views.inputs).toHaveLength(0);
    expect(harness.diagnostics.warn).not.toHaveBeenCalled();
  });
});
