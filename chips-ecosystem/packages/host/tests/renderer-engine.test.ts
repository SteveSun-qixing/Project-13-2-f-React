/**
 * 渲染引擎与会话状态机单测（Node 环境确定性驱动）。
 *
 * 权威：`05-渲染引擎设计` §2.2（六阶段链路）、§2.4（渲染会话模型）、§9.3（revision 约束）、
 * §11（错误映射：解析/结构域 → RENDER_DOCUMENT_INVALID、权限拒绝 → RENDER_RESOURCE_DENIED、
 * 其余透传）。
 *
 * @remarks document 侧走 `tests/helpers/document-fake-ports.ts` 替身 + #28 已验收服务本体
 * （`createDocumentService`）+ 服务形态网关，构成真实 open 链路；受控时序与失败注入用
 * 网关替身驱动。
 *
 * 刀3 双轨：`createBindings` 的 viewBuilder 换为真实现 `createDocumentViewBuilder`
 * （注入 §6.4 两臂的 native 替身，`buildView` 逐调用触达 fake backing）；
 * `createControlledBindings` 保留原受控 stub 轨不删不减，两轨新增逐字段一致性断言。
 */

import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createRenderEngine } from '../src/renderer/render-engine.js';
import type { IRenderEngineBindings, RenderRequest } from '../src/renderer/render-engine.js';
import { createDocumentViewBuilder } from '../src/renderer/document-view-builder.js';
import type { IDocumentViewBuildInput, INativeDocumentViewHandle, INativeDocumentViewModule } from '../src/renderer/document-view-builder.js';
import { createServiceDocumentGateway, normalizeDocumentFailure } from '../src/renderer/document-gateway.js';
import type { IRenderDocumentGateway } from '../src/renderer/document-gateway.js';
import { createDocumentService } from '../src/capabilities/document/service.js';
import { ChipsError } from '../src/preload/chips-error.js';
import { CARD_ID, SESSION_A, createHarness, portFailure } from './helpers/document-fake-ports.js';
import type { ICardFrameHostOptions } from '../src/renderer/card-frame-host.js';
import type { FrameActionPayload, FrameLimits, ICardRenderView } from '../src/renderer/frame-protocol.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

const LIMITS: FrameLimits = { minHeight: 80, maxHeight: 600, maxNestedFrames: 0 };

type RecordingDiagnostics = DiagnosticsSink & { readonly lines: { level: string; message: string }[] };

/** 诊断记录器。 */
function createDiagnostics(): RecordingDiagnostics {
  const lines: { level: string; message: string }[] = [];
  return {
    lines,
    warn(_scope: string, message: string) {
      lines.push({ level: 'warn', message });
    },
    error(_scope: string, message: string) {
      lines.push({ level: 'error', message });
    },
  };
}

/** 卡片渲染视图基线。 */
function cardView(revision = 1): ICardRenderView {
  return {
    kind: 'card',
    revision,
    card_id: CARD_ID,
    name: '测试卡片',
    chip_standards_version: '1.0.0',
    cover_ratio: '3:2',
    tags: [],
    cover: { entry: 'cover', ratio: '3:2' },
    content_nodes: [{ node_id: 'node-1', card_type: 'text', content: { text: '正文' } }],
  };
}

/** 刀3 真实现轨：视图构建域 native 替身（§6.4 两臂）与调用记录面。 */
interface IViewBuilderTrack {
  readonly native: INativeDocumentViewModule;
  readonly handle: INativeDocumentViewHandle;
  /** `buildDocumentView` 实参逐次记录（句柄 + 数值会话按 §6.4 位次）。 */
  readonly backingCalls: readonly (readonly unknown[])[];
  /** 端口输入经会话解析入口逐次记录（documentId 断言承接自原 stub 轨）。 */
  readonly viewInputs: IDocumentViewBuildInput[];
}

/** 构造视图构建域替身注入面：`buildDocumentView` 返回 `cardView()` 冻结 DTO。 */
function createViewBuilderTrack(): IViewBuilderTrack {
  const handle = { nativeDocumentHandleBrand: 'chips-native.document' } as const satisfies INativeDocumentViewHandle;
  const backingCalls: (readonly unknown[])[] = [];
  const viewInputs: IDocumentViewBuildInput[] = [];
  const native: INativeDocumentViewModule = {
    buildDocumentView(handleArg, session) {
      backingCalls.push([handleArg, session]);
      return Promise.resolve(cardView() as unknown as Record<string, unknown>);
    },
    documentReadResource() {
      return Promise.resolve(new Uint8Array());
    },
  };
  return { native, handle, backingCalls, viewInputs };
}

/** 帧宿主替身。 */
interface IFrameHostStub {
  readonly element: HTMLElement;
  readonly ready: Promise<void>;
  readonly appliedHeight: number | null;
  attach: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onHeightChanged: ReturnType<typeof vi.fn>;
  beginHandshake: ReturnType<typeof vi.fn>;
}

/** 帧宿主替身工厂夹具面。 */
interface IFrameHostFactoryFixture {
  readonly factory: Mock<(options: ICardFrameHostOptions) => IFrameHostStub>;
  readonly created: IFrameHostStub[];
}

/** 帧宿主替身工厂夹具：记录全部产物与构造选项。 */
const createFrameHostFactory = (): IFrameHostFactoryFixture => {
  const created: IFrameHostStub[] = [];
  const factory = vi.fn((_options: ICardFrameHostOptions): IFrameHostStub => {
    const stub: IFrameHostStub = {
      element: { tag: 'iframe-stub' } as unknown as HTMLElement,
      ready: Promise.resolve(),
      appliedHeight: null,
      attach: vi.fn(),
      detach: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(() => Promise.resolve()),
      onHeightChanged: vi.fn(),
      beginHandshake: vi.fn(() => Promise.resolve()),
    };
    created.push(stub);
    return stub;
  });
  return { factory, created };
};

/** 按序号取帧宿主替身（缺失即测试失败）。 */
function requireStub(stubs: ReturnType<typeof createFrameHostFactory>, index = 0): IFrameHostStub {
  const stub = stubs.created[index];
  if (stub === undefined) {
    throw new Error(`帧宿主替身 #${index} 未创建`);
  }
  return stub;
}

/** 绑定夹具（真实文档服务链路 + 刀3 真实现视图轨）。 */
function createBindings(overrides?: {
  readonly factory?: NonNullable<IRenderEngineBindings['frameHostFactory']>;
  readonly heightCache?: NonNullable<IRenderEngineBindings['heightCache']>;
}): IRenderEngineBindings & {
  readonly harness: ReturnType<typeof createHarness>;
  readonly diagnostics: RecordingDiagnostics;
  readonly viewTrack: IViewBuilderTrack;
} {
  const harness = createHarness();
  const service = createDocumentService(harness.dependencies);
  const viewTrack = createViewBuilderTrack();
  return {
    harness,
    diagnostics: createDiagnostics(),
    document: createServiceDocumentGateway(service, { sessionId: SESSION_A }),
    viewBuilder: createDocumentViewBuilder({
      native: viewTrack.native,
      resolveSession: (input) => {
        // 原 stub 轨的 documentId 断言承接位：真实现轨同样逐调用校验端口输入。
        viewTrack.viewInputs.push(input);
        expect(input.documentId).toBe(CARD_ID);
        return Promise.resolve({ handle: viewTrack.handle, sessionId: 42, managedScope: 'card-7f3a' });
      },
    }),
    viewTrack,
    frames: {
      frameEntryUrl: 'chips-resource://platform/frame.html',
      tokens: { '--chips-font-size': '14px' },
      executeAction: vi.fn((_action: FrameActionPayload) => Promise.resolve()),
    },
    resourceBase: 'chips-resource://default',
    pluginEntries: {},
    limits: LIMITS,
    ...(overrides?.heightCache === undefined ? {} : { heightCache: overrides.heightCache }),
    ...(overrides?.factory === undefined ? {} : { frameHostFactory: overrides.factory }),
  };
}

/** 受控网关替身（单会话：open 结果受测试逐步注入）。 */
function createControlledGateway(): IRenderDocumentGateway & {
  releaseOpen(result: { documentId: string; kind: 'card' }): void;
  failOpen(error: unknown): void;
} {
  let resolveOpen: ((result: { documentId: string; kind: 'card' }) => void) = () => undefined;
  let rejectOpen: ((error: unknown) => void) = () => undefined;
  const gate = new Promise<{ documentId: string; kind: 'card' }>((resolve, reject) => {
    resolveOpen = resolve;
    rejectOpen = reject;
  });
  return {
    open: vi.fn(() => gate) as unknown as IRenderDocumentGateway['open'],
    read: vi.fn(),
    releaseOpen(result) {
      resolveOpen(result);
    },
    failOpen(error) {
      rejectOpen(error);
    },
  };
}

/** 受控绑定（网关替身 + 帧宿主替身）。 */
function createControlledBindings(): {
  bindings: IRenderEngineBindings;
  gateway: ReturnType<typeof createControlledGateway>;
  stubs: ReturnType<typeof createFrameHostFactory>;
  diagnostics: RecordingDiagnostics;
} {
  const gateway = createControlledGateway();
  const stubs = createFrameHostFactory();
  const diagnostics = createDiagnostics();
  const bindings: IRenderEngineBindings = {
    diagnostics,
    document: gateway,
    viewBuilder: { buildView: vi.fn(() => Promise.resolve(cardView())) },
    frames: {
      frameEntryUrl: 'chips-resource://platform/frame.html',
      tokens: {},
      executeAction: vi.fn(() => Promise.resolve()),
    },
    resourceBase: 'chips-resource://default',
    pluginEntries: {},
    limits: LIMITS,
    frameHostFactory: stubs.factory,
  };
  return { bindings, gateway, stubs, diagnostics };
}

const REQUEST: RenderRequest = { kind: 'card', source: `chips-resource://default/card/${CARD_ID}.card`, mode: 'view' };

describe('渲染请求校验（§2.4 RenderRequest）', () => {
  it('非卡片、非查看态或空来源的请求同步拒绝', () => {
    const engine = createRenderEngine(createBindings());
    expect(() => engine.open({ kind: 'box', source: REQUEST.source, mode: 'view' })).toThrow();
    expect(() => engine.open({ kind: 'card', source: REQUEST.source, mode: 'edit' })).toThrow();
    expect(() => engine.open({ kind: 'card', source: '', mode: 'view' })).toThrow();
  });
});

describe('渲染会话状态机（§2.4）', () => {
  it('真实文档服务链路：open → documentId → 视图 → 帧创建 → ready → dispose', async () => {
    const stubs = createFrameHostFactory();
    const bindings = createBindings({ factory: stubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open({ kind: 'card', source: bindings.harness.cardUri, mode: 'view' });
    expect(session.state).toBe('opening');
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    expect(stubs.factory).toHaveBeenCalledTimes(1);
    const options = stubs.factory.mock.calls[0]?.[0];
    expect(options?.sessionId).toBe(session.id);
    expect(options?.view.revision).toBe(1);
    expect(options?.frameEntryUrl).toBe('chips-resource://platform/frame.html');
    await session.dispose();
    expect(requireStub(stubs).dispose).toHaveBeenCalledTimes(1);
  });

  it('双轨一致（刀3）：真实现轨与受控 stub 轨下发帧宿主视图逐字段相等，backing 按 §6.4 位次单调用', async () => {
    const realStubs = createFrameHostFactory();
    const bindings = createBindings({ factory: realStubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open(REQUEST);
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    const controlled = createControlledBindings();
    const controlledEngine = createRenderEngine(controlled.bindings);
    const controlledSession = await controlledEngine.open(REQUEST);
    controlled.gateway.releaseOpen({ documentId: CARD_ID, kind: 'card' });
    await vi.waitFor(() => {
      expect(controlledSession.state).toBe('ready');
    });
    // 真实现轨视图 = 冻结 DTO 本体 = 受控轨视图（覆盖面不缩水：原 stub 产出继续被断言）。
    const realView = realStubs.factory.mock.calls[0]?.[0]?.view;
    const controlledView = controlled.stubs.factory.mock.calls[0]?.[0]?.view;
    expect(realView).toStrictEqual(cardView());
    expect(realView).toStrictEqual(controlledView);
    // 逐调用触达 backing 一次、无自有缓存，句柄与数值会话按 §6.4 位次交付。
    expect(bindings.viewTrack.backingCalls).toStrictEqual([[bindings.viewTrack.handle, 42]]);
    expect(bindings.viewTrack.viewInputs).toHaveLength(1);
    expect(bindings.viewTrack.viewInputs[0]?.kind).toBe('card');
    await session.dispose();
    await controlledSession.dispose();
  });

  it('解析管线在途时 mount 挂起，管线完成后自动挂载；unmount 后可重新挂载', async () => {
    const context = createControlledBindings();
    const engine = createRenderEngine(context.bindings);
    const session = await engine.open(REQUEST);
    const container = { tag: 'div-stub' } as unknown as HTMLElement;
    const mountPromise = session.mount(container);
    expect(context.stubs.created).toHaveLength(0);
    context.gateway.releaseOpen({ documentId: CARD_ID, kind: 'card' });
    await mountPromise;
    expect(context.stubs.created).toHaveLength(1);
    const host = requireStub(context.stubs);
    expect(host.attach).toHaveBeenCalledWith(container);
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    session.unmount();
    expect(host.detach).toHaveBeenCalledTimes(1);
    // 重新挂载直接复用既有帧宿主。
    const second = { tag: 'div-stub-2' } as unknown as HTMLElement;
    await session.mount(second);
    expect(host.attach).toHaveBeenLastCalledWith(second);
    await session.dispose();
  });

  it('请求 maxHeight 收敛到平台限制后再下发帧', async () => {
    const stubs = createFrameHostFactory();
    const bindings = createBindings({ factory: stubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open({
      kind: 'card',
      source: bindings.harness.cardUri,
      mode: 'view',
      options: { maxHeight: 5000 },
    });
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    expect(stubs.factory.mock.calls[0]?.[0].limits.maxHeight).toBe(LIMITS.maxHeight);
    await session.dispose();
  });

  it('取消信号触发后会话静默停止：不进入 error、不创建帧', async () => {
    const context = createControlledBindings();
    const engine = createRenderEngine(context.bindings);
    const controller = new AbortController();
    const session = await engine.open({ ...REQUEST, options: { signal: controller.signal } });
    const onError = vi.fn();
    session.subscribe('error', onError);
    controller.abort();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });
    expect(session.state).toBe('opening');
    expect(onError).not.toHaveBeenCalled();
    expect(context.stubs.created).toHaveLength(0);
    await session.dispose();
  });
});

describe('失败映射（§11）', () => {
  it('解析/结构域登记码 → RENDER_DOCUMENT_INVALID（不可重试，挂载即返回）', async () => {
    const context = createControlledBindings();
    const engine = createRenderEngine(context.bindings);
    const session = await engine.open(REQUEST);
    const errors: ChipsError[] = [];
    session.subscribe('error', (error) => {
      errors.push(error);
    });
    context.gateway.failOpen(portFailure('DOCUMENT_STRUCTURE_INVALID', '结构成员损坏'));
    await vi.waitFor(() => {
      expect(session.state).toBe('error');
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('RENDER_DOCUMENT_INVALID');
    expect(errors[0]?.retryable).toBe(false);
    // 失败会话挂载即返回（降级占位由界面层呈现）。
    const container = { tag: 'div-stub' } as unknown as HTMLElement;
    await expect(session.mount(container)).resolves.toBeUndefined();
    expect(context.stubs.created).toHaveLength(0);
    await session.dispose();
  });

  it('权限拒绝 → RENDER_RESOURCE_DENIED', async () => {
    const context = createControlledBindings();
    const engine = createRenderEngine(context.bindings);
    const session = await engine.open(REQUEST);
    context.gateway.failOpen(portFailure('BRIDGE_PERMISSION_DENIED', '缺少 resources:read 权限'));
    await vi.waitFor(() => {
      expect(session.state).toBe('error');
    });
    expect(session.error?.code).toBe('RENDER_RESOURCE_DENIED');
    await session.dispose();
  });

  it('其余登记码原样透传，不发明映射', async () => {
    const context = createControlledBindings();
    const engine = createRenderEngine(context.bindings);
    const session = await engine.open(REQUEST);
    context.gateway.failOpen(portFailure('DOCUMENT_PART_UNSUPPORTED', '分片不支持'));
    await vi.waitFor(() => {
      expect(session.state).toBe('error');
    });
    expect(session.error?.code).toBe('DOCUMENT_PART_UNSUPPORTED');
    await session.dispose();
  });

  it('normalizeDocumentFailure 对 open/read 路径的结构域码逐项归一', () => {
    expect(normalizeDocumentFailure(portFailure('DOCUMENT_METADATA_INVALID', '元数据损坏')).code).toBe(
      'RENDER_DOCUMENT_INVALID'
    );
    expect(normalizeDocumentFailure(portFailure('DOCUMENT_NOT_OPEN', '文档未打开')).code).toBe(
      'RENDER_DOCUMENT_INVALID'
    );
    expect(normalizeDocumentFailure(portFailure('DOCUMENT_FORMAT_UNKNOWN', '格式未知')).code).toBe(
      'RENDER_DOCUMENT_INVALID'
    );
    expect(normalizeDocumentFailure(portFailure('DOCUMENT_PART_UNSUPPORTED', '分片不支持')).code).toBe(
      'DOCUMENT_PART_UNSUPPORTED'
    );
  });

  it('帧加载失败（beginHandshake 拒绝）收敛为 RENDER_FRAME_TIMEOUT，不悬挂在 opening', async () => {
    const context = createControlledBindings();
    const bindings: IRenderEngineBindings = {
      ...context.bindings,
      frameHostFactory: (options) => {
        const base = context.stubs.factory(options);
        base.beginHandshake.mockRejectedValue(new Error('帧入口不可达'));
        return base;
      },
    };
    const engine = createRenderEngine(bindings);
    const session = await engine.open(REQUEST);
    context.gateway.releaseOpen({ documentId: CARD_ID, kind: 'card' });
    await vi.waitFor(() => {
      expect(session.state).toBe('error');
    });
    expect(session.error?.code).toBe('RENDER_FRAME_TIMEOUT');
    await session.dispose();
  });
});

describe('会话更新（§9.3 revision 约束）', () => {
  it('revision 严格递增生效；回退与重复忽略并记录诊断', async () => {
    const stubs = createFrameHostFactory();
    const bindings = createBindings({ factory: stubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open(REQUEST);
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    const host = requireStub(stubs);
    await session.update(cardView(2), 2);
    expect(host.update).toHaveBeenCalledTimes(1);
    expect(host.update).toHaveBeenCalledWith(cardView(2), 2);

    await session.update(cardView(2), 2);
    await session.update(cardView(1), 1);
    expect(host.update).toHaveBeenCalledTimes(1);
    expect(bindings.diagnostics.lines.some((line) => line.message.includes('revision'))).toBe(true);
    await session.dispose();
  });

  it('host.update 失败抛 RENDER_UPDATE_FAILED 并保留旧 revision（重试同一 revision 可成功）', async () => {
    const stubs = createFrameHostFactory();
    const bindings = createBindings({ factory: stubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open(REQUEST);
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    const host = requireStub(stubs);
    host.update.mockImplementationOnce(() => {
      throw new Error('帧通道已关闭');
    });
    await expect(session.update(cardView(2), 2)).rejects.toMatchObject({ code: 'RENDER_UPDATE_FAILED' });
    expect(host.update).toHaveBeenCalledTimes(1);
    // 旧 revision 保留：失败后同一 revision 重试重新送达帧。
    await session.update(cardView(2), 2);
    expect(host.update).toHaveBeenCalledTimes(2);
    await session.dispose();
  });

  it('未就绪会话的更新被忽略并记录诊断', async () => {
    const context = createControlledBindings();
    const engine = createRenderEngine(context.bindings);
    const session = await engine.open(REQUEST);
    await session.update(cardView(2), 2);
    expect(context.diagnostics.lines.some((line) => line.message.includes('未就绪'))).toBe(true);
    await session.dispose();
  });

  it('dispose 后一切操作拒绝 RENDER_SESSION_DISPOSED，dispose 幂等', async () => {
    const stubs = createFrameHostFactory();
    const bindings = createBindings({ factory: stubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open(REQUEST);
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    const host = requireStub(stubs);
    const disposedEvents: string[] = [];
    session.subscribe('disposed', (payload) => {
      disposedEvents.push(payload.sessionId);
    });
    await session.dispose();
    expect(host.dispose).toHaveBeenCalledTimes(1);
    expect(disposedEvents).toEqual([session.id]);
    expect(session.state).toBe('disposed');

    await session.dispose();
    expect(host.dispose).toHaveBeenCalledTimes(1);

    await expect(session.update(cardView(2), 2)).rejects.toMatchObject({ code: 'RENDER_SESSION_DISPOSED' });
    expect(() => session.mount(document.createElement('div'))).toThrow();
    expect(() => session.unmount()).toThrow();
  });

  it('dispose 在解析管线在途时同样收敛（管线结果被丢弃、帧不创建）', async () => {
    const context = createControlledBindings();
    const engine = createRenderEngine(context.bindings);
    const session = await engine.open(REQUEST);
    const disposePromise = session.dispose();
    context.gateway.releaseOpen({ documentId: CARD_ID, kind: 'card' });
    await disposePromise;
    expect(session.state).toBe('disposed');
    expect(context.stubs.created).toHaveLength(0);
  });

  it('事件订阅句柄 dispose 后不再收到事件', async () => {
    const stubs = createFrameHostFactory();
    const bindings = createBindings({ factory: stubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open(REQUEST);
    const readyEvents: string[] = [];
    const subscription = session.subscribe('ready', (payload) => {
      readyEvents.push(payload.sessionId);
    });
    subscription.dispose();
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    expect(readyEvents).toEqual([]);
    await session.dispose();
  });

  it('事件监听器抛错不阻断会话状态收敛', async () => {
    const stubs = createFrameHostFactory();
    const bindings = createBindings({ factory: stubs.factory });
    const engine = createRenderEngine(bindings);
    const session = await engine.open(REQUEST);
    session.subscribe('ready', () => {
      throw new Error('监听器故障');
    });
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    expect(bindings.diagnostics.lines.some((line) => line.message.includes('监听器'))).toBe(true);
    await session.dispose();
  });
});
