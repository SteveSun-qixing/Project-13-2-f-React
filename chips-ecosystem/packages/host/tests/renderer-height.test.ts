/**
 * 父帧侧高度自适应单测（Node 环境确定性驱动）。
 *
 * 权威：`05-渲染引擎设计` §9.4（高度自适应算法父帧侧职责：clamp、上限冻结、缓存键）、
 * §9.6（拒绝越限高度与非递增 epoch 并记录诊断）。
 *
 * @remarks 刀3 双轨：渲染会话高度事件桥同时保留原受控 stub viewBuilder 轨，
 * 并新增真实现 `createDocumentViewBuilder`（fake native 模块注入）轨孪生用例。
 */

import { describe, expect, it, vi } from 'vitest';

import { FrameHeightCache, FrameHeightController, frameHeightCacheKey } from '../src/renderer/frame-height.js';
import { createRenderEngine } from '../src/renderer/render-engine.js';
import type { IRenderEngineBindings } from '../src/renderer/render-engine.js';
import { createDocumentViewBuilder } from '../src/renderer/document-view-builder.js';
import type { IDocumentViewBuildInput, INativeDocumentViewHandle, INativeDocumentViewModule } from '../src/renderer/document-view-builder.js';
import type { ICardFrameHostOptions } from '../src/renderer/card-frame-host.js';
import { FRAME_HEIGHT_MIN_DELTA_PX } from '../src/renderer/frame-protocol.js';
import type { FrameLimits, ICardRenderView } from '../src/renderer/frame-protocol.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

const LIMITS: FrameLimits = { minHeight: 80, maxHeight: 600, maxNestedFrames: 0 };

/** 诊断记录器。 */
function createDiagnostics(): DiagnosticsSink & { readonly warns: string[] } {
  const warns: string[] = [];
  return {
    warns,
    warn(_scope: string, message: string) {
      warns.push(message);
    },
    error(_scope: string, message: string) {
      warns.push(message);
    },
  };
}

/** 控制器夹具面。 */
interface IHeightControllerFixture {
  readonly controller: FrameHeightController;
  readonly diagnostics: ReturnType<typeof createDiagnostics>;
  readonly applied: number[];
  readonly acks: number[];
}

/** 控制器夹具。 */
const createController = (limits: FrameLimits = LIMITS): IHeightControllerFixture => {
  const diagnostics = createDiagnostics();
  const applied: number[] = [];
  const acks: number[] = [];
  const controller = new FrameHeightController({
    limits,
    applyHeight(heightPx) {
      applied.push(heightPx);
    },
    sendAck(epoch) {
      acks.push(epoch);
    },
    diagnostics,
  });
  return { controller, diagnostics, applied, acks };
}

describe('父帧侧高度控制器（05.09 §9.4/§9.6）', () => {
  it('正常上报：clamp 后应用高度并回执 ack', () => {
    const context = createController();
    expect(context.controller.handleReport(300, 1)).toBe('applied');
    expect(context.applied).toEqual([300]);
    expect(context.acks).toEqual([1]);
    expect(context.controller.appliedHeight).toBe(300);
  });

  it('低于下限与高于上限均 clamp 到限制区间', () => {
    const context = createController();
    expect(context.controller.handleReport(10, 1)).toBe('applied');
    expect(context.applied[0]).toBe(80);
    expect(context.controller.handleReport(9999, 2)).toBe('applied');
    expect(context.applied[1]).toBe(600);
  });

  it('变化小于 1px 时仅回执 ack 不重复应用', () => {
    const context = createController();
    context.controller.handleReport(300, 1);
    expect(context.controller.handleReport(300 + FRAME_HEIGHT_MIN_DELTA_PX - 0.5, 2)).toBe('ack-only');
    expect(context.applied).toHaveLength(1);
    expect(context.acks).toEqual([1, 2]);
  });

  it('非递增 epoch 与非法高度按 rejected 拒绝并记录诊断', () => {
    const context = createController();
    context.controller.handleReport(300, 1);
    expect(context.controller.handleReport(320, 1)).toBe('rejected');
    expect(context.controller.handleReport(-5, 2)).toBe('rejected');
    expect(context.controller.handleReport(Number.NaN, 3)).toBe('rejected');
    expect(context.applied).toEqual([300]);
    expect(context.acks).toEqual([1]);
    expect(context.diagnostics.warns).toHaveLength(3);
  });

  it('达到 maxHeight 进入冻结：仍回执 ack 但高度不再放大；低于上限后解冻恢复跟随', () => {
    const context = createController();
    expect(context.controller.handleReport(600, 1)).toBe('applied');
    expect(context.controller.isFrozenAtMax).toBe(true);
    // 冻结期间的更大上报只回执。
    expect(context.controller.handleReport(1200, 2)).toBe('ack-only');
    expect(context.applied).toEqual([600]);
    // 回落到上限以下解除冻结，高度重新跟随。
    expect(context.controller.handleReport(400, 3)).toBe('applied');
    expect(context.controller.isFrozenAtMax).toBe(false);
    expect(context.applied).toEqual([600, 400]);
  });

  it('host:update 后 resetFreeze 解除上限冻结', () => {
    const context = createController();
    context.controller.handleReport(600, 1);
    expect(context.controller.isFrozenAtMax).toBe(true);
    context.controller.resetFreeze();
    expect(context.controller.isFrozenAtMax).toBe(false);
    expect(context.controller.handleReport(200, 2)).toBe('applied');
    expect(context.applied).toEqual([600, 200]);
  });
});

describe('高度缓存（05.09 §9.4 第 8 条）', () => {
  it('缓存键按 role + source + revision 组合生成且互不冲突', () => {
    const keyA = frameHeightCacheKey({ role: 'card', source: 'chips-resource://a', revision: 1 });
    const keyB = frameHeightCacheKey({ role: 'card', source: 'chips-resource://a', revision: 2 });
    const keyC = frameHeightCacheKey({ role: 'box-layout', source: 'chips-resource://a', revision: 1 });
    expect(new Set([keyA, keyB, keyC]).size).toBe(3);
    // 相同输入得到相同键（首屏占位命中口径）。
    expect(frameHeightCacheKey({ role: 'card', source: 'chips-resource://a', revision: 1 })).toBe(keyA);
  });

  it('remember/estimate/invalidate 构成完整的估算生命周期', () => {
    const cache = new FrameHeightCache();
    const key = frameHeightCacheKey({ role: 'card', source: 'chips-resource://a', revision: 3 });
    expect(cache.estimate(key)).toBeUndefined();
    cache.remember(key, 240);
    expect(cache.estimate(key)).toBe(240);
    cache.invalidate(key);
    expect(cache.estimate(key)).toBeUndefined();
  });

  it('未命中缓存的帧宿主首屏占位取 minHeight（与 CardFrameHost 口径一致的组合断言）', () => {
    const cache = new FrameHeightCache();
    const key = frameHeightCacheKey({ role: 'card', source: 'chips-resource://a', revision: 1 });
    const initialHeight = cache.estimate(key) ?? LIMITS.minHeight;
    expect(initialHeight).toBe(80);
    cache.remember(key, 320);
    expect(cache.estimate(key) ?? LIMITS.minHeight).toBe(320);
  });
});

describe('渲染会话高度事件桥（§9.4 父帧侧接线）', () => {
  it('会话把已应用高度写入缓存并发布 height-changed（经 frameHostFactory 替身验证）', async () => {
    const cache = new FrameHeightCache();
    const heightListeners: ((heightPx: number) => void)[] = [];
    const frameHost = {
      element: { tag: 'fake-iframe' } as unknown as HTMLElement,
      ready: Promise.resolve(),
      appliedHeight: null,
      attach: vi.fn(),
      detach: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(() => Promise.resolve()),
      onHeightChanged(listener: (heightPx: number) => void) {
        heightListeners.push(listener);
      },
      beginHandshake: vi.fn(() => Promise.resolve()),
    };
    const view: ICardRenderView = {
      kind: 'card',
      revision: 1,
      card_id: 'card-1',
      name: '测试卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:2',
      tags: [],
      cover: { entry: 'cover', ratio: '3:2' },
      content_nodes: [],
    };
    const bindings: IRenderEngineBindings = {
      document: {
        open: vi.fn(() => Promise.resolve({ documentId: 'doc-1', kind: 'card' as const })),
        read: vi.fn(),
      } as unknown as IRenderEngineBindings['document'],
      viewBuilder: { buildView: vi.fn(() => Promise.resolve(view)) },
      frames: {
        frameEntryUrl: 'chips-resource://platform/frame.html',
        tokens: {},
        executeAction: vi.fn(() => Promise.resolve()),
      },
      resourceBase: 'chips-resource://default',
      pluginEntries: {},
      limits: LIMITS,
      heightCache: cache,
      diagnostics: createDiagnostics(),
      frameHostFactory: () => frameHost,
    };
    const engine = createRenderEngine(bindings);
    const session = await engine.open({ kind: 'card', source: 'chips-resource://a', mode: 'view' });
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    expect(heightListeners).toHaveLength(1);
    const changed: number[] = [];
    session.subscribe('height-changed', (payload) => {
      changed.push(payload.height);
    });
    heightListeners[0]?.(360);
    expect(changed).toEqual([360]);
    expect(cache.estimate(frameHeightCacheKey({ role: 'card', source: 'chips-resource://a', revision: 1 }))).toBe(360);
    await session.dispose();
  });

  it('双轨孪生（刀3 真实现）：viewBuilder 换真 DocumentViewBuilder（fake native 注入）后同一高度桥逐环成立，视图与原受控轨全等', async () => {
    const cache = new FrameHeightCache();
    const heightListeners: ((heightPx: number) => void)[] = [];
    const frameHost = {
      element: { tag: 'fake-iframe' } as unknown as HTMLElement,
      ready: Promise.resolve(),
      appliedHeight: null,
      attach: vi.fn(),
      detach: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(() => Promise.resolve()),
      onHeightChanged(listener: (heightPx: number) => void) {
        heightListeners.push(listener);
      },
      beginHandshake: vi.fn(() => Promise.resolve()),
    };
    const view: ICardRenderView = {
      kind: 'card',
      revision: 1,
      card_id: 'card-1',
      name: '测试卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:2',
      tags: [],
      cover: { entry: 'cover', ratio: '3:2' },
      content_nodes: [],
    };
    const handle = { nativeDocumentHandleBrand: 'chips-native.document' } as const satisfies INativeDocumentViewHandle;
    const native: INativeDocumentViewModule = {
      buildDocumentView: () => Promise.resolve(view as unknown as Record<string, unknown>),
      documentReadResource: () => Promise.resolve(new Uint8Array()),
    };
    const viewInputs: IDocumentViewBuildInput[] = [];
    const factory = vi.fn((_options: ICardFrameHostOptions) => frameHost);
    const bindings: IRenderEngineBindings = {
      document: {
        open: vi.fn(() => Promise.resolve({ documentId: 'doc-1', kind: 'card' as const })),
        read: vi.fn(),
      } as unknown as IRenderEngineBindings['document'],
      viewBuilder: createDocumentViewBuilder({
        native,
        resolveSession: (input) => {
          viewInputs.push(input);
          return Promise.resolve({ handle, sessionId: 9, managedScope: 'card-doc-1' });
        },
      }),
      frames: {
        frameEntryUrl: 'chips-resource://platform/frame.html',
        tokens: {},
        executeAction: vi.fn(() => Promise.resolve()),
      },
      resourceBase: 'chips-resource://default',
      pluginEntries: {},
      limits: LIMITS,
      heightCache: cache,
      diagnostics: createDiagnostics(),
      frameHostFactory: factory,
    };
    const engine = createRenderEngine(bindings);
    const session = await engine.open({ kind: 'card', source: 'chips-resource://a', mode: 'view' });
    await vi.waitFor(() => {
      expect(session.state).toBe('ready');
    });
    // 守门重建后的真实现轨视图与原受控轨视图逐字段全等（孪生一致性核心断言）。
    expect(factory.mock.calls[0]?.[0].view).toStrictEqual(view);
    // 端口输入按 documentId 送达会话解析入口一次。
    expect(viewInputs).toHaveLength(1);
    expect(viewInputs[0]?.documentId).toBe('doc-1');
    expect(viewInputs[0]?.kind).toBe('card');
    // 高度桥后续环节与受控轨同构：订阅 → 上报 → 事件发布 + 缓存写入。
    expect(heightListeners).toHaveLength(1);
    const changed: number[] = [];
    session.subscribe('height-changed', (payload) => {
      changed.push(payload.height);
    });
    heightListeners[0]?.(360);
    expect(changed).toEqual([360]);
    expect(cache.estimate(frameHeightCacheKey({ role: 'card', source: 'chips-resource://a', revision: 1 }))).toBe(360);
    await session.dispose();
  });
});
