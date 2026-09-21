/**
 * 卡片窗口装载输入投递·渲染消费臂接线测试（刀7 后续接线波，任务 #120）。
 *
 * 权威：契约单一事实源 `src/shared/card-window-init-surface.ts`（#119 冻结，四臂封套与三竞态
 * 语义由其定义，本套件是渲染消费侧的运行链接线证明）；工单035 §10.3 待办 3（渲染入口臂：
 * requestId 自发自检、到达闸权威校验、pending/绑定未就绪的有上限诚实空闲重试、终态码落诊断、
 * payload 零适配直传）；《05-渲染引擎设计》05.02 §2.3 承载段（装载投递细节归宿主实现）。
 *
 * @remarks
 * - 分层覆盖：`readCardWindowInitSurface` 世界缺席守卫 → `createCardWindowInitProvider` 六路径
 *   （就绪直传 / pending 重试 / DOCUMENT_NOT_OPEN 继续等待 / 终态码收口 / 重试上限 / 闸违约与
 *   传输拒绝不重试）→ `bootCardWindow` 投递臂端到端（空闲根先行、就绪后卸载空闲根挂真实组合）。
 * - 零 skip、零弱化：错误码逐值断言取契约在册常量；重试节奏以注入排程驱动（生产缺省
 *   `setTimeout` 400ms×30 由常量锁钉）。
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChipsError } from '@chips/bridge';

import {
  CARD_WINDOW_INIT_CHANNEL_ERROR_CODES,
  CARD_WINDOW_INIT_MESSAGE_TYPES,
  CARD_WINDOW_INIT_PROTOCOL,
  CARD_WINDOW_INIT_SURFACE_KEY,
  createCardWindowInitFailure,
  createCardWindowInitPending,
  createCardWindowInitResult,
  validateCardWindowInitRequest,
} from '../src/shared/card-window-init-surface.js';
import { HOST_VIEW_CHANNEL_SURFACE_KEY } from '../src/shared/host-view-channel-surface.js';
import { createDocumentViewBuildFailure } from '../src/renderer/index.js';
import type { IChipsCardWindowFacade } from '../src/renderer/entries/card.js';
import {
  CARD_WINDOW_INIT_DEFAULTS,
  bootCardWindow,
  createCardWindowInitProvider,
  readCardWindowInitSurface,
} from '../src/renderer/entries/card.js';
import type { IDocumentReflowSubscription } from '../src/renderer/index.js';

const SOURCE = 'chips-resource://workspace-a/投递卡片.card';
const DOC_ID = 'Ab3dEf6Gh8';
const RESOURCE_BASE = 'chips-resource://workspace-a/';

/** 契约合法的装载输入 payload（就绪臂负载；渲染侧到达闸同口径形状）。 */
const PAYLOAD = Object.freeze({
  source: SOURCE,
  documentId: DOC_ID,
  resourceBase: RESOURCE_BASE,
  pluginEntries: {},
  tokens: {},
});

/** 诊断替身：属性式函数签名（方法式声明会被 `unbound-method` 拦在断言之外）。 */
interface IStubDiagnostics {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

function diagnosticsStub(): IStubDiagnostics {
  return { warn: vi.fn(), error: vi.fn() };
}

/** 投递世界替身：按序回包（回包工厂收到本轮请求封套，便于逐字回显关联标识）并登记请求。 */
function makeSurface(responses: readonly ((payload: unknown) => Promise<unknown>)[]): {
  requests: unknown[];
  surface: { requestInit(payload: unknown): Promise<unknown> };
} {
  const requests: unknown[] = [];
  let index = 0;
  return {
    requests,
    surface: {
      requestInit(payload: unknown): Promise<unknown> {
        requests.push(payload);
        const next = responses[Math.min(index, responses.length - 1)];
        index += 1;
        return next === undefined ? Promise.resolve(undefined) : next(payload);
      },
    },
  };
}

/** 即时排程注入（驱动重试环不等待真实定时器），并登记每轮节奏延迟。 */
function immediateSchedule(): { delays: number[]; schedule: (callback: () => void, delayMs: number) => void } {
  const delays: number[] = [];
  return {
    delays,
    schedule: (callback: () => void, delayMs: number): void => {
      delays.push(delayMs);
      callback();
    },
  };
}

/** 可铸造递增关联标识的注入位（自发自检的逐字关联锁）。 */
function mintSequence(): () => string {
  let n = 0;
  return (): string => `r-${(n += 1)}`;
}

function resultAt(requestId: string): Promise<unknown> {
  return Promise.resolve(createCardWindowInitResult(requestId, 42, PAYLOAD));
}

beforeEach(() => {
  document.body.innerHTML = '';
  delete (globalThis as { chips?: unknown }).chips;
  delete (globalThis as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY];
  delete (globalThis as Record<string, unknown>)[CARD_WINDOW_INIT_SURFACE_KEY];
});

describe('readCardWindowInitSurface：第三世界读取守卫', () => {
  it('世界缺席 / 形状非法（无 requestInit）→ null；在位且方法齐备 → 原面交付', () => {
    expect(readCardWindowInitSurface()).toBeNull();
    (globalThis as Record<string, unknown>)[CARD_WINDOW_INIT_SURFACE_KEY] = { requestInit: '不是函数' };
    expect(readCardWindowInitSurface()).toBeNull();
    const surface = { requestInit: (): Promise<unknown> => Promise.resolve(undefined) };
    (globalThis as Record<string, unknown>)[CARD_WINDOW_INIT_SURFACE_KEY] = surface;
    expect(readCardWindowInitSurface()).toBe(surface);
  });
});

describe('createCardWindowInitProvider：请求自发与到达闸', () => {
  it('就绪臂：请求封套过发送侧自检、requestId 自铸逐字关联、payload 零适配直达', async () => {
    const { surface, requests } = makeSurface([() => resultAt('r-1')]);
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, { mintRequestId: mintSequence() });
    const init = await provider();
    expect(init).toEqual(PAYLOAD);
    expect(requests).toHaveLength(1);
    const request = validateCardWindowInitRequest(requests[0]);
    expect(request).toEqual({
      protocol: CARD_WINDOW_INIT_PROTOCOL,
      type: CARD_WINDOW_INIT_MESSAGE_TYPES.fetch,
      requestId: 'r-1',
    });
    expect(diagnostics.error).not.toHaveBeenCalled();
    expect(diagnostics.warn).not.toHaveBeenCalled();
  });

  it('pending 竞态：空闲重试后就绪——每轮 requestId 新铸且回包逐字关联', async () => {
    const { surface, requests } = makeSurface([
      (payload) => Promise.resolve(createCardWindowInitPending((payload as { requestId: string }).requestId, 42)),
      () => resultAt('r-2'),
    ]);
    const schedule = immediateSchedule();
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, {
      mintRequestId: mintSequence(),
      schedule: schedule.schedule,
      retryDelayMs: 7,
    });
    await expect(provider()).resolves.toEqual(PAYLOAD);
    expect(requests.map((payload) => (payload as { requestId: string }).requestId)).toEqual(['r-1', 'r-2']);
    expect(schedule.delays).toEqual([7]);
    expect(diagnostics.warn).not.toHaveBeenCalled();
  });

  it('DOCUMENT_NOT_OPEN（绑定腿未就绪）：继续等待而非收口，文档打开后即就绪', async () => {
    const notOpen = createCardWindowInitFailure(
      'r-1',
      42,
      new ChipsError({
        code: CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.documentNotOpen,
        message: '文档绑定未就绪',
        retryable: false,
      }),
    );
    const { surface, requests } = makeSurface([() => Promise.resolve(notOpen), () => resultAt('r-2')]);
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, {
      mintRequestId: mintSequence(),
      schedule: immediateSchedule().schedule,
    });
    await expect(provider()).resolves.toEqual(PAYLOAD);
    expect(requests).toHaveLength(2);
    expect(diagnostics.error).not.toHaveBeenCalled();
  });

  it('终态码收口：BRIDGE_SESSION_UNKNOWN（销毁竞态）单次即停、落诊断、不无限轮询死窗口', async () => {
    const gone = createCardWindowInitFailure(
      'r-1',
      42,
      new ChipsError({ code: 'BRIDGE_SESSION_UNKNOWN', message: '窗口已销毁', retryable: false }),
    );
    const { surface, requests } = makeSurface([() => Promise.resolve(gone)]);
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, { mintRequestId: mintSequence() });
    await expect(provider()).resolves.toBeNull();
    expect(requests).toHaveLength(1);
    expect(diagnostics.error).toHaveBeenCalledTimes(1);
    expect((diagnostics.error.mock.calls[0]?.[2] as { code: string }).code).toBe('BRIDGE_SESSION_UNKNOWN');
  });

  it('重试有上限收口：全程 pending 耗尽 maxAttempts，落一次 warn 并收口空闲', async () => {
    const { surface, requests } = makeSurface([
      (payload) => Promise.resolve(createCardWindowInitPending((payload as { requestId: string }).requestId, 42)),
    ]);
    const schedule = immediateSchedule();
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, {
      schedule: schedule.schedule,
      maxAttempts: 3,
    });
    await expect(provider()).resolves.toBeNull();
    expect(requests).toHaveLength(3);
    // 末轮不空转等待：排程次数 = 上限 - 1。
    expect(schedule.delays).toHaveLength(2);
    expect(diagnostics.warn).toHaveBeenCalledTimes(1);
    expect(diagnostics.error).not.toHaveBeenCalled();
  });

  it('生产缺省节奏锁：setTimeout 400ms × 30 上限（接线波钉死口径）', () => {
    expect(CARD_WINDOW_INIT_DEFAULTS).toEqual({ retryDelayMs: 400, maxAttempts: 30 });
  });

  it('到达闸违约不采信：回包关联错配 → 收口落诊断、零重试', async () => {
    const { surface, requests } = makeSurface([() => resultAt('别的-关联-标识')]);
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, { mintRequestId: mintSequence() });
    await expect(provider()).resolves.toBeNull();
    expect(requests).toHaveLength(1);
    expect(diagnostics.error).toHaveBeenCalledTimes(1);
    expect((diagnostics.error.mock.calls[0]?.[2] as { code: string }).code).toBe('BRIDGE_INTERNAL');
  });

  it('回包形状漂移不采信：payload 词法违例（脏 documentId）→ 收口落诊断、零重试', async () => {
    const dirty = createCardWindowInitResult('r-1', 42, { ...PAYLOAD, documentId: '坏标识' });
    const { surface, requests } = makeSurface([() => Promise.resolve(dirty)]);
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, { mintRequestId: mintSequence() });
    await expect(provider()).resolves.toBeNull();
    expect(requests).toHaveLength(1);
    expect(diagnostics.error).toHaveBeenCalledTimes(1);
  });

  it('传输拒绝臂：桥层失败经 #117 归一纯数据送达 → 收口落诊断（不伪装成载荷）', async () => {
    const surface = {
      requestInit: (): Promise<unknown> =>
        // 真实跨界拒绝值就是 `toPlain()` 同构纯数据（工单038 机理），刻意不复造 Error 实例。
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        Promise.reject(
          new ChipsError({ code: 'BRIDGE_INTERNAL', message: '装载投递处理器未注册', retryable: false }).toPlain(),
        ),
    };
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, { mintRequestId: mintSequence() });
    await expect(provider()).resolves.toBeNull();
    expect(diagnostics.error).toHaveBeenCalledTimes(1);
    expect((diagnostics.error.mock.calls[0]?.[2] as { code: string }).code).toBe('BRIDGE_INTERNAL');
  });

  it('传输拒绝携 DOCUMENT_NOT_OPEN：与封套失败臂同口径继续等待', async () => {
    let calls = 0;
    const surface = {
      requestInit(payload: unknown): Promise<unknown> {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(
            new ChipsError({
              code: CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.documentNotOpen,
              message: '绑定未就绪',
              retryable: false,
            }),
          );
        }
        return resultAt((payload as { requestId: string }).requestId);
      },
    };
    const diagnostics = diagnosticsStub();
    const provider = createCardWindowInitProvider(surface, diagnostics, {
      mintRequestId: mintSequence(),
      schedule: immediateSchedule().schedule,
    });
    await expect(provider()).resolves.toEqual(PAYLOAD);
    expect(diagnostics.error).not.toHaveBeenCalled();
  });
});

describe('bootCardWindow：投递臂端到端（空闲根先行 → 就绪后卸载并挂真实组合）', () => {
  const OPEN_OUTPUT = Object.freeze({
    documentId: DOC_ID,
    source: SOURCE,
    kind: 'card' as const,
    title: '投递卡片',
    digest: 'sha256:demo',
  });

  /** 记录型 `window.chips` 替身（request 记录能力调用；subscribe 供回流腿）。 */
  function makeFacade(handlers: Record<string, (input: unknown) => unknown>): {
    facade: IChipsCardWindowFacade;
    calls: Array<{ capabilityId: string; input: unknown }>;
  } {
    const calls: Array<{ capabilityId: string; input: unknown }> = [];
    return {
      calls,
      facade: {
        request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
          calls.push({ capabilityId, input });
          const handler = handlers[capabilityId];
          if (handler === undefined) {
            return Promise.reject(
              new ChipsError({ code: 'BRIDGE_CAPABILITY_NOT_REGISTERED', message: '未注册', retryable: false }),
            );
          }
          return Promise.resolve(handler(input) as TOutput);
        },
        subscribe(_eventId: string, _handler: (payload: unknown) => void): IDocumentReflowSubscription {
          return { dispose: vi.fn() };
        },
      },
    };
  }

  /** 视图腿诚实回退臂：主进程视图通道端点未接线时的在册失败回包（不进入帧装载）。 */
  function makeViewSurface(): { requestView: (payload: unknown) => Promise<unknown>; calls: unknown[] } {
    const calls: unknown[] = [];
    return {
      calls,
      requestView: (payload: unknown): Promise<unknown> => {
        calls.push(payload);
        const request = payload as { requestId: string };
        return Promise.resolve(
          createDocumentViewBuildFailure(request.requestId, {
            code: 'BRIDGE_INTERNAL',
            message: '文档能力未接线',
            retryable: false,
            details: {},
          }),
        );
      },
    };
  }

  it('三世界齐备：自动接入投递臂——就绪后空闲根让位真实组合（document:open 触达为证）', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    const { facade, calls } = makeFacade({ 'document:open': () => OPEN_OUTPUT });
    (globalThis as { chips?: unknown }).chips = facade;
    const view = makeViewSurface();
    (globalThis as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY] = { requestView: view.requestView };
    const initRequests: unknown[] = [];
    (globalThis as Record<string, unknown>)[CARD_WINDOW_INIT_SURFACE_KEY] = {
      requestInit: (payload: unknown): Promise<unknown> => {
        initRequests.push(payload);
        const request = validateCardWindowInitRequest(payload);
        return Promise.resolve(createCardWindowInitResult(request.requestId, 42, PAYLOAD));
      },
    };
    bootCardWindow();
    // 投递腿先过封套契约（发送侧自检形态），就绪后完整组合挂载：Bridge 链路触达 document:open。
    await vi.waitFor(() => {
      expect(calls.map((call) => call.capabilityId)).toEqual(['document:open']);
    });
    expect(initRequests).toHaveLength(1);
    expect(calls[0]?.input).toEqual({ source: SOURCE, kind: 'card' });
    // 视图腿经同一注入端口触达（真实组合而非空闲占位的证据）。
    await vi.waitFor(() => {
      expect(view.calls).toHaveLength(1);
    });
    const request = (view.calls[0] as { input: Record<string, unknown> }).input;
    expect(request).toEqual({ source: SOURCE, documentId: DOC_ID, kind: 'card' });
  });

  it('第三世界缺席（未注入 provider）：诚实空载、零 Bridge 请求、零投递触达', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    const { facade, calls } = makeFacade({ 'document:open': () => OPEN_OUTPUT });
    (globalThis as { chips?: unknown }).chips = facade;
    const view = makeViewSurface();
    (globalThis as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY] = { requestView: view.requestView };
    bootCardWindow();
    await vi.waitFor(() => {
      expect(container.childElementCount).toBeGreaterThan(0);
    });
    expect(calls).toHaveLength(0);
    expect(view.calls).toHaveLength(0);
  });

  it('异步提供臂收口为 null：维持空闲占位、不挂载不触达', async () => {
    const container = document.createElement('main');
    container.id = 'chips-card-root';
    document.body.append(container);
    const { facade, calls } = makeFacade({ 'document:open': () => OPEN_OUTPUT });
    (globalThis as { chips?: unknown }).chips = facade;
    const view = makeViewSurface();
    (globalThis as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY] = { requestView: view.requestView };
    bootCardWindow(() => Promise.resolve(null));
    await vi.waitFor(() => {
      expect(container.childElementCount).toBeGreaterThan(0);
    });
    expect(calls).toHaveLength(0);
    expect(view.calls).toHaveLength(0);
    expect(container.textContent ?? '').not.toContain('undefined');
  });
});
