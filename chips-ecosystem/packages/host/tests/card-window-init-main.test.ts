/**
 * 卡片窗口装载输入投递·主进程投递臂接线测试（刀7 后续接线波，任务 #120）。
 *
 * 权威：契约单一事实源 `src/shared/card-window-init-surface.ts`（#119 冻结，四臂封套与三竞态
 * 语义由其定义，本套件是其运行链接线证明）；工单035 裁定一（宿主内部壳进程↔主进程 IPC，
 * 非插件能力）、§九「待裁随账」收口（登记表 `documentId` 承载位与 `document:open` 回包同源一致性
 * 由投递臂钉死）、§十 10.3 接线待办第 1/4 条；《05-渲染引擎设计》05.02 §2.3 承载段（`05.02:89`
 * 「窗口感知与装载投递细节归宿主实现」）；《04-能力契约规范》§7.4（windowId = webContents.id，
 * 身份由主进程 `event.sender.id` 取证）。
 *
 * @remarks
 * - 分层覆盖：{@link createCardWindowInitHandler} 四臂逐竞态（就绪 / pending / 销毁 / 绑定未就绪 /
 *   绑定未接线 / 绑定漂移 / 承载位冲突 / 请求闸）→ 身份取证锁 → 回包权威闸发送前自检锁 →
 *   `ICardWindowRecord` 承载位生命周期（真实编排器 + Electron 替身窗口链：绑定幂等、异值拒收、
 *   销毁作废）→ `IDocumentService.resolveWindowDocument` 与 `document:open` 回包同源（真实文档
 *   服务 + 解析域夹具）→ `registerCardWindowInitChannel` 注册与幂等注销 → 壳启动装载与投递端到端。
 * - 零 skip、零弱化：错误码逐值断言取契约在册错误面常量与文档域码表常量，不新造码。
 */

import { describe, expect, it, vi } from 'vitest';

import { ChipsError } from '@chips/bridge';

import {
  CARD_WINDOW_INIT_MESSAGE_TYPES,
  CARD_WINDOW_INIT_PROTOCOL,
  CARD_WINDOW_INIT_REQUEST_CHANNEL,
  isCardWindowInitFailure,
  isCardWindowInitPending,
  isCardWindowInitResult,
  validateCardWindowInitResponse,
} from '../src/shared/card-window-init-surface.js';
import {
  CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID,
  createCardWindowInitHandler,
  registerCardWindowInitChannel,
} from '../src/main/card-window-init-channel.js';
import type { CardWindowInitHandlerDeps } from '../src/main/card-window-init-channel.js';
import { CardWindowOrchestrator } from '../src/main/card-window-orchestrator.js';
import { CARD_WINDOW_ENTRY_URL } from '../src/main/window-entries.js';
import { ShellWindowManager } from '../src/main/window-manager.js';
import { WebContentsBinder } from '../src/main/web-contents-binder.js';
import { WindowBindings } from '../src/main/window-bindings.js';
import { WindowRegistry } from '../src/main/window-registry.js';
import { createElectronRuntime } from '../src/main/electron-adapter.js';
import { HostApplication } from '../src/main/application.js';
import { createDocumentService } from '../src/capabilities/document/service.js';
import { DOCUMENT_BUSINESS_ERROR_CODES } from '../src/capabilities/document/errors.js';
import type { ShellIpcInvokeEvent, ShellIpcMain } from '../src/main/shell-api.js';
import type { IResourceBackend } from '../src/runtime/contracts.js';
import { createFakeElectron } from './helpers/shell-electron.js';
import { createFakePalHost } from './helpers/fake-pal-host.js';
import { createFakeRuntime } from './helpers/fake-runtime.js';
import { createWireError } from './helpers/wire-error.js';
import { CARD_ID, SESSION_A, ctxFor, createHarness } from './helpers/document-fake-ports.js';

const SOURCE = 'chips-resource://workspace-a/我的卡片.card';
const SOURCE_B = 'chips-resource://workspace-a/另一张.card';
const OTHER_DOC_ID = 'SecondDoc1';
const RESOURCE_BASE = 'chips-resource://workspace-a/';
const WINDOW_ID = 42;

const backend: IResourceBackend = {
  async read() {
    return Promise.reject(createWireError('RESOURCE_NOT_FOUND', '资源不存在'));
  },
};

/* ------------------------------------------------------------------ *
 * 替身：登记表 / 窗口存活 / 文档绑定端口
 * ------------------------------------------------------------------ */

/** 登记表窗口位（三竞态与漂移臂需要「记录已失」「承载位持旧值」等内部状态；真实编排器另行逐项覆盖）。 */
interface FakeWindow {
  readonly id: number;
  readonly source: string;
  destroyed: boolean;
  documentId: string | null;
}

interface HandlerProbe {
  readonly records: FakeWindow[];
  readonly bindCalls: number[];
  readonly bindingCalls: string[];
}

/**
 * 测试替位覆写面：`resolveDocument` 允许显式置 `undefined`，用于模拟「绑定端口未接线」的
 * 生产回退态（`exactOptionalPropertyTypes` 下契约deps位本身只省略不传，此替位不入契约面）。
 */
interface HandlerOverrides extends Partial<Omit<CardWindowInitHandlerDeps, 'resolveDocument'>> {
  resolveDocument?: CardWindowInitHandlerDeps['resolveDocument'] | undefined;
}

function makeHandler(
  windows: readonly { id: number; source: string; destroyed?: boolean; documentId?: string | null }[],
  overrides: HandlerOverrides = {},
): { handler: ReturnType<typeof createCardWindowInitHandler>; probe: HandlerProbe } {
  const records: FakeWindow[] = windows.map((window) => ({
    id: window.id,
    source: window.source,
    destroyed: window.destroyed ?? false,
    documentId: window.documentId ?? null,
  }));
  const bindCalls: number[] = [];
  const bindingCalls: string[] = [];
  const alive = (windowId: number): boolean => records.some((record) => record.id === windowId && !record.destroyed);
  const orchestrator = {
    recordOf(windowId: number): unknown {
      const found = records.find((record) => record.id === windowId && !record.destroyed);
      if (found === undefined) {
        return null;
      }
      return {
        windowId: found.id,
        source: found.source,
        entryUrl: CARD_WINDOW_ENTRY_URL,
        openedAt: 1_727_000_000_000,
        documentId: found.documentId,
      };
    },
    bindDocument(windowId: number, documentId: string): unknown {
      bindCalls.push(windowId);
      const found = records.find((record) => record.id === windowId && !record.destroyed);
      if (found === undefined) {
        return { status: 'unregistered' };
      }
      if (found.documentId !== null && found.documentId !== documentId) {
        return { status: 'conflict', record: {}, boundDocumentId: found.documentId };
      }
      found.documentId = documentId;
      return { status: 'ok', record: {} };
    },
  } as unknown as CardWindowOrchestrator;

  const bindingCallsOf = (): CardWindowInitHandlerDeps['resolveDocument'] => {
    return (source: string) => {
      bindingCalls.push(source);
      return { documentId: CARD_ID, resourceBase: RESOURCE_BASE };
    };
  };

  // `in` 判别两态：键缺省 = 接探针绑定腿；显式置 `undefined` = 模拟生产「绑定端口未接线」。
  const resolveDocument = 'resolveDocument' in overrides ? overrides.resolveDocument : bindingCallsOf();
  const deps: CardWindowInitHandlerDeps = {
    orchestrator: overrides.orchestrator ?? orchestrator,
    isWindowAlive: overrides.isWindowAlive ?? alive,
    ...(resolveDocument === undefined ? {} : { resolveDocument }),
  };
  const handler = createCardWindowInitHandler(deps);
  return { handler, probe: { records, bindCalls, bindingCalls } };
}

function eventFrom(windowId: number): ShellIpcInvokeEvent {
  return { sender: { id: windowId }, senderFrame: { routingId: windowId * 10 } };
}

function fetchPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protocol: CARD_WINDOW_INIT_PROTOCOL,
    type: CARD_WINDOW_INIT_MESSAGE_TYPES.fetch,
    requestId: 'init-1',
    ...overrides,
  };
}

/** 回包过契约响应权威闸（渲染侧到达闸同一函数）：投递漂移即闸红。 */
async function deliver(
  handler: ReturnType<typeof createCardWindowInitHandler>,
  windowId: number,
  data: unknown,
  expectedRequestId = 'init-1',
): Promise<ReturnType<typeof validateCardWindowInitResponse>> {
  return validateCardWindowInitResponse(await handler(eventFrom(windowId), data), expectedRequestId);
}

/* ------------------------------------------------------------------ *
 * 就绪臂
 * ------------------------------------------------------------------ */

describe('卡片窗口装载投递 · 就绪臂（windowId ↔ init 一致性锁的响应侧承载）', () => {
  it('登记表命中且绑定可解析：回带主进程取证 windowId 与同源装载输入，未经正式源的腿为契约合法空集', async () => {
    const { handler, probe } = makeHandler([{ id: WINDOW_ID, source: SOURCE }]);
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    if (!isCardWindowInitResult(response)) {
      throw new Error('预期就绪臂');
    }
    expect(response.windowId).toBe(WINDOW_ID);
    expect(response.payload).toEqual({
      source: SOURCE,
      documentId: CARD_ID,
      resourceBase: RESOURCE_BASE,
      pluginEntries: {},
      tokens: {},
    });
    // 绑定腿写入登记表承载位（工单035 §九待裁随账收口的物理动作）并凭 source 单点解析。
    expect(probe.bindCalls).toEqual([WINDOW_ID]);
    expect(probe.bindingCalls).toEqual([SOURCE]);
    expect(probe.records[0]?.documentId).toBe(CARD_ID);
  });

  it('承载位已钉同值：幂等复用、不重复写绑定腿（不经第二来源拼合）', async () => {
    const { handler, probe } = makeHandler([{ id: 7, source: SOURCE, documentId: CARD_ID }]);
    const response = await deliver(handler, 7, fetchPayload());
    expect(isCardWindowInitResult(response)).toBe(true);
    expect(probe.bindCalls).toHaveLength(0);
    expect(probe.bindingCalls).toEqual([SOURCE]);
    expect(probe.records[0]?.documentId).toBe(CARD_ID);
  });

  it('渲染侧自报 windowId 无通路：请求闸即拒，回带 windowId 恒为主进程取证值', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }]);
    const forged = await handler(eventFrom(WINDOW_ID), fetchPayload({ windowId: 9999 }));
    const validated = validateCardWindowInitResponse(forged, CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID);
    expect(isCardWindowInitFailure(validated)).toBe(true);
    if (isCardWindowInitFailure(validated)) {
      expect(validated.error.code).toBe('BRIDGE_INVALID_INPUT');
    }
    expect(validated.windowId).toBe(WINDOW_ID);
  });

  it('requestId 由请求侧铸造、回包逐字携带（并发关联不串台）', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }]);
    const first = await deliver(handler, WINDOW_ID, fetchPayload({ requestId: 'init-a' }), 'init-a');
    const second = await deliver(handler, WINDOW_ID, fetchPayload({ requestId: 'init-b' }), 'init-b');
    expect(first.requestId).toBe('init-a');
    expect(second.requestId).toBe('init-b');
  });
});

/* ------------------------------------------------------------------ *
 * 三竞态失败臂
 * ------------------------------------------------------------------ */

describe('卡片窗口装载投递 · 竞态与绑定臂（pending / 销毁后投递 / 绑定未就绪 / 漂移）', () => {
  it('pending：窗口存活而登记表未命中（open 返回与 map 写入之间的结构性时窗，合法瞬态）', async () => {
    const { handler } = makeHandler([], { isWindowAlive: () => true });
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    expect(isCardWindowInitPending(response)).toBe(true);
    expect(response.windowId).toBe(WINDOW_ID);
    expect(Object.keys(response).sort()).toEqual(['protocol', 'requestId', 'type', 'windowId']);
  });

  it('error：窗口已销毁 / 记录已解绑 → BRIDGE_SESSION_UNKNOWN（不新造「窗口不存在」码）', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE, destroyed: true }]);
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    if (!isCardWindowInitFailure(response)) {
      throw new Error('预期失败臂');
    }
    expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    expect(response.error.retryable).toBe(false);
    expect(response.windowId).toBe(WINDOW_ID);
  });

  it('error：登记表命中而会话记录缺席 → DOCUMENT_NOT_OPEN（在册会话域码如实拒收，不伪造装载）', async () => {
    const { handler, probe } = makeHandler([{ id: WINDOW_ID, source: SOURCE }], { resolveDocument: () => null });
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    if (!isCardWindowInitFailure(response)) {
      throw new Error('预期失败臂');
    }
    expect(response.error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.notOpen);
    expect(response.error.retryable).toBe(false);
    expect(response.error.details).toMatchObject({ source: SOURCE });
    expect(probe.bindCalls).toHaveLength(0);
    expect(probe.records[0]?.documentId).toBeNull();
  });

  it('error：绑定端口未接线（document:* 生产回退态）→ 同码 DOCUMENT_NOT_OPEN（渲染侧继续空载等待）', async () => {
    const { handler, probe } = makeHandler([{ id: WINDOW_ID, source: SOURCE }], { resolveDocument: undefined });
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    expect(isCardWindowInitFailure(response)).toBe(true);
    if (isCardWindowInitFailure(response)) {
      expect(response.error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.notOpen);
    }
    expect(probe.bindingCalls).toHaveLength(0);
  });

  it('error：绑定腿抛出 → 面外码经契约归一落 BRIDGE_INTERNAL（details.cause 留原码，不采信面外语义）', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }], {
      resolveDocument: () => {
        throw new ChipsError({ code: 'DOCUMENT_PERMISSION_DENIED', message: '会话权限不足', retryable: false });
      },
    });
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    if (!isCardWindowInitFailure(response)) {
      throw new Error('预期失败臂');
    }
    expect(response.error.code).toBe('BRIDGE_INTERNAL');
    expect(response.error.details).toEqual({ cause: 'DOCUMENT_PERMISSION_DENIED' });
  });

  it('error：承载位已钉异值（登记表与 document:open 同源记录冲突）→ DOCUMENT_ID_CONFLICT 经归一呈现', async () => {
    const { handler, probe } = makeHandler([{ id: WINDOW_ID, source: SOURCE, documentId: OTHER_DOC_ID }]);
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    if (!isCardWindowInitFailure(response)) {
      throw new Error('预期失败臂');
    }
    expect(response.error.code).toBe('BRIDGE_INTERNAL');
    expect(response.error.details).toEqual({ cause: DOCUMENT_BUSINESS_ERROR_CODES.idConflict });
    // 身份锚点单向钉死：不改绑、不覆盖。
    expect(probe.records[0]?.documentId).toBe(OTHER_DOC_ID);
    expect(probe.bindCalls).toHaveLength(0);
  });

  it('error：绑定腿交付的标识不合 ID 词法 → 回包契约闸拦下（承载位保持未绑定，脏绑定不落表）', async () => {
    const { handler, probe } = makeHandler([{ id: WINDOW_ID, source: SOURCE }], {
      resolveDocument: () => ({ documentId: 'bad-id', resourceBase: RESOURCE_BASE }),
    });
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    if (!isCardWindowInitFailure(response)) {
      throw new Error('预期失败臂');
    }
    expect(response.error.code).toBe('BRIDGE_INTERNAL');
    expect(response.error.details).toMatchObject({ gate: 'response', field: 'documentId' });
    expect(probe.records[0]?.documentId).toBeNull();
    expect(probe.bindCalls).toHaveLength(0);
  });

  it('error：绑定命中后窗口在竞态中解绑 → 投递臂以 BRIDGE_SESSION_UNKNOWN 收尾（不投递给死窗口）', async () => {
    const { handler, probe } = makeHandler([{ id: WINDOW_ID, source: SOURCE }], {
      orchestrator: {
        recordOf: () => ({
          windowId: WINDOW_ID,
          source: SOURCE,
          entryUrl: CARD_WINDOW_ENTRY_URL,
          openedAt: 0,
          documentId: null,
        }),
        bindDocument: () => ({ status: 'unregistered' }),
      } as unknown as CardWindowOrchestrator,
    });
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    expect(isCardWindowInitFailure(response)).toBe(true);
    if (isCardWindowInitFailure(response)) {
      expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
    expect(probe.records).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * 请求闸与发送前自检
 * ------------------------------------------------------------------ */

describe('卡片窗口装载投递 · 请求闸与回包发送前自检', () => {
  it('非法请求封套 → BRIDGE_INVALID_INPUT；关联可取时逐字回带', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }]);
    for (const [label, data] of [
      ['非对象封套', null],
      ['协议版本不符', fetchPayload({ protocol: 'chips-card-window-init/2' })],
      ['消息类型不符', fetchPayload({ type: CARD_WINDOW_INIT_MESSAGE_TYPES.result })],
      ['缺 requestId', { protocol: CARD_WINDOW_INIT_PROTOCOL, type: CARD_WINDOW_INIT_MESSAGE_TYPES.fetch }],
    ] as const) {
      const raw = await handler(eventFrom(WINDOW_ID), data);
      // 尽力恢复口径：封套键集完好（恰三在册键）时逐字回带；非对象封套与缺 requestId 同样
      // 破损到取不出——以固定未关联标识回包（用例标题「关联可取时逐字回带」的如实镜像）。
      const expected =
        label === '缺 requestId' || label === '非对象封套' ? CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID : 'init-1';
      const validated = validateCardWindowInitResponse(raw, expected);
      if (!isCardWindowInitFailure(validated)) {
        throw new Error(`预期失败臂：${label}`);
      }
      expect(validated.error.code, label).toBe('BRIDGE_INVALID_INPUT');
      expect((validated.error.details as { gate?: string }).gate, label).toBe('request');
    }
  });

  it('破损到取不出关联标识：以固定未关联标识回包并回带取证 windowId', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }]);
    const raw = (await handler(eventFrom(WINDOW_ID), 'not-a-envelope')) as Record<string, unknown>;
    expect(raw['requestId']).toBe(CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID);
    expect(raw['type']).toBe(CARD_WINDOW_INIT_MESSAGE_TYPES.error);
    expect(raw['windowId']).toBe(WINDOW_ID);
    expect(() => validateCardWindowInitResponse(raw, CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID)).not.toThrow();
  });

  it('投递腿异常不产生悬空 promise：如实失败臂且不外泄内部原文', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }], {
      orchestrator: {
        recordOf: () => {
          throw new Error('登记表内部堆栈不得外泄');
        },
        bindDocument: () => ({ status: 'unregistered' }),
      } as unknown as CardWindowOrchestrator,
    });
    const response = await deliver(handler, WINDOW_ID, fetchPayload());
    if (!isCardWindowInitFailure(response)) {
      throw new Error('预期失败臂');
    }
    expect(response.error.code).toBe('BRIDGE_INTERNAL');
    expect(response.error.message).not.toContain('内部堆栈');
  });

  it('三臂回包全部经响应权威闸自检后出桥（就绪/空载/失败臂零破损投递）', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }]);
    const ready = await handler(eventFrom(WINDOW_ID), fetchPayload());
    expect(() => validateCardWindowInitResponse(ready, 'init-1')).not.toThrow();
    const aliveHandler = makeHandler([], { isWindowAlive: () => true }).handler;
    const pending = await aliveHandler(eventFrom(WINDOW_ID), fetchPayload());
    expect(() => validateCardWindowInitResponse(pending, 'init-1')).not.toThrow();
    const deadHandler = makeHandler([{ id: WINDOW_ID, source: SOURCE, destroyed: true }]).handler;
    const failure = await deadHandler(eventFrom(WINDOW_ID), fetchPayload());
    expect(() => validateCardWindowInitResponse(failure, 'init-1')).not.toThrow();
  });

  it('跨进程封套键集锁：就绪臂不携带任何主进程内部字段（绑定腿视图不外泄）', async () => {
    const { handler } = makeHandler([{ id: WINDOW_ID, source: SOURCE }]);
    const raw = JSON.stringify(await handler(eventFrom(WINDOW_ID), fetchPayload()));
    for (const internal of [
      'managedUri',
      'resourceBaseRaw',
      'nativeSession',
      'handle',
      'webContents',
      'entryUrl',
      'openedAt',
    ]) {
      expect(raw, internal).not.toContain(internal);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 登记表承载位生命周期（真实编排器 + Electron 替身窗口链）
 * ------------------------------------------------------------------ */

function realOrchestratorHarness(): {
  orchestrator: CardWindowOrchestrator;
  manager: ShellWindowManager;
  registry: WindowRegistry;
  fake: ReturnType<typeof createFakeElectron>;
} {
  const fake = createFakeElectron();
  const runtime = createElectronRuntime(fake.module);
  const registry = new WindowRegistry();
  const diagnostics = { warn: vi.fn(), error: vi.fn() };
  const binder = new WebContentsBinder({
    registry,
    bindings: new WindowBindings(),
    backend,
    diagnostics,
    onClosed: () => undefined,
  });
  const manager = new ShellWindowManager({
    factory: runtime.windowFactory,
    preloadPath: '/app/dist/preload/index.js',
    binder,
    registry,
    diagnostics,
  });
  const orchestrator = new CardWindowOrchestrator({
    windowManager: manager,
    registry,
    diagnostics,
    now: () => 1_727_000_000_000,
  });
  return { orchestrator, manager, registry, fake };
}

function handlerWith(
  orchestrator: CardWindowOrchestrator,
  isWindowAlive: (windowId: number) => boolean,
): ReturnType<typeof createCardWindowInitHandler> {
  return createCardWindowInitHandler({
    orchestrator,
    isWindowAlive,
    resolveDocument: (source) => (source === SOURCE ? { documentId: CARD_ID, resourceBase: RESOURCE_BASE } : null),
  });
}

describe('ICardWindowRecord 文档绑定承载位 · 生命周期（工单035 §九待裁随账收口的登记表侧）', () => {
  it('打开时承载位为空：卡片窗口装载 URI 不携带文档参数，绑定只能经投递腿钉死', async () => {
    const { orchestrator } = realOrchestratorHarness();
    const record = await orchestrator.open({ source: SOURCE });
    expect(record.documentId).toBeNull();
    expect(orchestrator.recordOf(record.windowId)).toBe(record);
    expect(orchestrator.recordOf(record.windowId + 1)).toBeNull();
  });

  it('绑定幂等：首次写入、同值复用不重复写、异值拒收不改绑', async () => {
    const { orchestrator } = realOrchestratorHarness();
    const record = await orchestrator.open({ source: SOURCE });
    expect(orchestrator.bindDocument(record.windowId, CARD_ID)).toEqual({ status: 'ok', record });
    expect(record.documentId).toBe(CARD_ID);
    expect(orchestrator.bindDocument(record.windowId, CARD_ID).status).toBe('ok');
    expect(record.documentId).toBe(CARD_ID);
    const conflict = orchestrator.bindDocument(record.windowId, OTHER_DOC_ID);
    expect(conflict.status).toBe('conflict');
    expect(conflict.status === 'conflict' ? conflict.boundDocumentId : '').toBe(CARD_ID);
    expect(record.documentId).toBe(CARD_ID);
  });

  it('未登记窗口绑定为 unregistered；窗口销毁后承载位随记录一并作废', async () => {
    const { orchestrator, fake } = realOrchestratorHarness();
    expect(orchestrator.bindDocument(9999, CARD_ID).status).toBe('unregistered');
    const record = await orchestrator.open({ source: SOURCE });
    orchestrator.bindDocument(record.windowId, CARD_ID);
    fake.windows[0]!.webContents.destroy();
    expect(orchestrator.recordOf(record.windowId)).toBeNull();
    expect(orchestrator.bindDocument(record.windowId, CARD_ID).status).toBe('unregistered');
    const reopened = await orchestrator.open({ source: SOURCE });
    expect(reopened.documentId).toBeNull();
  });

  it('不同文档各自钉绑定，互不串台', async () => {
    const { orchestrator } = realOrchestratorHarness();
    const first = await orchestrator.open({ source: SOURCE });
    const second = await orchestrator.open({ source: SOURCE_B });
    orchestrator.bindDocument(first.windowId, CARD_ID);
    orchestrator.bindDocument(second.windowId, OTHER_DOC_ID);
    expect(first.documentId).toBe(CARD_ID);
    expect(second.documentId).toBe(OTHER_DOC_ID);
    expect(orchestrator.bindDocument(second.windowId, CARD_ID).status).toBe('conflict');
  });

  it('就绪臂经真实编排器：承载位由投递腿写入并回带取证 windowId', async () => {
    const { orchestrator, registry } = realOrchestratorHarness();
    const record = await orchestrator.open({ source: SOURCE });
    const response = await deliver(
      handlerWith(orchestrator, (windowId) => registry.isAlive(windowId)),
      record.windowId,
      fetchPayload(),
    );
    if (!isCardWindowInitResult(response)) {
      throw new Error('预期就绪臂');
    }
    expect(response.windowId).toBe(record.windowId);
    expect(response.payload.source).toBe(SOURCE);
    expect(response.payload.documentId).toBe(CARD_ID);
    expect(record.documentId).toBe(CARD_ID);
  });

  it('open 未完成的结构性时窗：窗口已创建而登记表未命中 → pending（渲染侧继续空载）', async () => {
    const { orchestrator, manager, registry } = realOrchestratorHarness();
    // 真实「窗口已创建」的取证窗口：经窗口管理器创建（注册表在册且存活），而编排器登记表
    // 尚未命中（`createWindow` 返回与 map 写入之间的结构性时窗的同构复现）。
    const created = await manager.createWindow({
      title: '薯片 · 卡片（登记前）',
      width: 480,
      height: 720,
      url: CARD_WINDOW_ENTRY_URL,
    });
    expect(orchestrator.recordOf(created.windowId)).toBeNull();
    const response = await deliver(
      handlerWith(orchestrator, (windowId) => registry.isAlive(windowId)),
      created.windowId,
      fetchPayload(),
    );
    expect(isCardWindowInitPending(response)).toBe(true);
  });

  it('销毁后投递：记录已解绑且窗口不可达 → BRIDGE_SESSION_UNKNOWN（渲染侧据此停止重试）', async () => {
    const { orchestrator, registry, fake } = realOrchestratorHarness();
    const record = await orchestrator.open({ source: SOURCE });
    fake.windows[0]!.webContents.destroy();
    const response = await deliver(
      handlerWith(orchestrator, (windowId) => registry.isAlive(windowId)),
      record.windowId,
      fetchPayload(),
    );
    expect(isCardWindowInitFailure(response)).toBe(true);
    if (isCardWindowInitFailure(response)) {
      expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
  });
});

/* ------------------------------------------------------------------ *
 * 绑定腿与 document:open 回包同源（真实文档服务）
 * ------------------------------------------------------------------ */

describe('resolveWindowDocument · 与 document:open 回包同源（真实文档服务 + 解析域夹具）', () => {
  it('打开后解析：documentId 与 open 回包逐字同值、resourceBase 为受管引用作用域根', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const opened = await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    const binding = service.resolveWindowDocument(harness.cardUri);
    expect(binding).not.toBeNull();
    expect(binding?.documentId).toBe(opened.documentId);
    expect(binding?.documentId).toBe(CARD_ID);
    expect(binding?.resourceBase).toBe('chips-resource://default/');
    expect(harness.cardUri.startsWith(binding?.resourceBase ?? '')).toBe(true);
  });

  it('未打开来源：返回 null（投递臂据此落 DOCUMENT_NOT_OPEN）', () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    expect(service.resolveWindowDocument('chips-resource://default/card/ghost.card')).toBeNull();
  });

  it('会话释放后记录移除：解析转 null（投递臂随绑定腿失效如实拒收，不投递已关文档）', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    expect(service.resolveWindowDocument(harness.cardUri)).not.toBeNull();
    await service.releaseSessions(SESSION_A);
    expect(service.resolveWindowDocument(harness.cardUri)).toBeNull();
  });

  it('受管引用词法不可投影为作用域根：落诊断并返回 null（不猜测资源基址）', async () => {
    const harness = createHarness();
    const malformedUri = 'plain-relative-path.card';
    harness.addCard(malformedUri);
    const service = createDocumentService(harness.dependencies);
    await service.executeOpen({ source: malformedUri }, ctxFor(SESSION_A));
    expect(service.resolveWindowDocument(malformedUri)).toBeNull();
    expect(harness.logs.some((entry) => entry.message.includes('作用域根'))).toBe(true);
  });

  it('端到端（真实文档服务 + 真实编排器）：打开文档 → 投递就绪臂字段逐项同源', async () => {
    // 编排器登记表的来源闸是资源 URI 语法闸（夹具缺省的 `default` 段非受管作用域合法形态），
    // 端到端腿以真实受管作用域（`workspace-a`）登记并打开卡片——「同一来源引用」的同源论断
    // 在合法来源引用上同样成立且更强（两侧经逐字同一字符串命中）。
    const harness = createHarness();
    const windowCardUri = harness.addCard('chips-resource://workspace-a/投递端到端.card');
    const service = createDocumentService(harness.dependencies);
    const opened = await service.executeOpen({ source: windowCardUri }, ctxFor(SESSION_A));
    const { orchestrator, registry } = realOrchestratorHarness();
    const record = await orchestrator.open({ source: windowCardUri });
    const handler = createCardWindowInitHandler({
      orchestrator,
      isWindowAlive: (windowId) => registry.isAlive(windowId),
      resolveDocument: (source) => service.resolveWindowDocument(source),
    });
    const response = await deliver(handler, record.windowId, fetchPayload());
    if (!isCardWindowInitResult(response)) {
      throw new Error('预期就绪臂');
    }
    expect(response.payload).toEqual({
      source: windowCardUri,
      documentId: opened.documentId,
      resourceBase: 'chips-resource://workspace-a/',
      pluginEntries: {},
      tokens: {},
    });
    expect(record.documentId).toBe(opened.documentId);
    // 同一窗口二次投递（承载位已钉）幂等复用同一标识，不重复绑定。
    const again = await deliver(handler, record.windowId, fetchPayload({ requestId: 'init-2' }), 'init-2');
    if (!isCardWindowInitResult(again)) {
      throw new Error('预期就绪臂');
    }
    expect(again.payload.documentId).toBe(opened.documentId);
  });

  it('文档未打开即投递：绑定腿未命中 → DOCUMENT_NOT_OPEN（不伪造装载）', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const { orchestrator, registry } = realOrchestratorHarness();
    // 受管作用域合法而会话记录缺席（从未打开）——同上注的来源闸口径。
    const record = await orchestrator.open({ source: 'chips-resource://workspace-a/未打开.card' });
    const handler = createCardWindowInitHandler({
      orchestrator,
      isWindowAlive: (windowId) => registry.isAlive(windowId),
      resolveDocument: (source) => service.resolveWindowDocument(source),
    });
    const response = await deliver(handler, record.windowId, fetchPayload());
    if (!isCardWindowInitFailure(response)) {
      throw new Error('预期失败臂');
    }
    expect(response.error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.notOpen);
    expect(record.documentId).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * 通道注册与壳启动装载
 * ------------------------------------------------------------------ */

function makeFakeIpcMain(): ShellIpcMain & {
  handlers: Map<string, (event: ShellIpcInvokeEvent, ...args: readonly unknown[]) => unknown>;
} {
  const handlers = new Map<string, (event: ShellIpcInvokeEvent, ...args: readonly unknown[]) => unknown>();
  return {
    handlers,
    handle(channel, listener) {
      handlers.set(channel, listener);
    },
    removeHandler(channel) {
      handlers.delete(channel);
    },
  };
}

describe('registerCardWindowInitChannel：ipcMain 切片注册与幂等注销', () => {
  it('按契约通道名注册；监听器把 sender 与首个入参原样交投递臂', async () => {
    const ipcMain = makeFakeIpcMain();
    const calls: { windowId: number; data: unknown }[] = [];
    const detach = registerCardWindowInitChannel({
      ipcMain,
      handler: (event, data) => {
        calls.push({ windowId: event.sender.id, data });
        return Promise.resolve({ ack: true });
      },
    });
    expect(ipcMain.handlers.has(CARD_WINDOW_INIT_REQUEST_CHANNEL)).toBe(true);
    const listener = ipcMain.handlers.get(CARD_WINDOW_INIT_REQUEST_CHANNEL);
    if (listener === undefined) {
      throw new Error('通道未注册');
    }
    await expect(listener(eventFrom(WINDOW_ID), fetchPayload(), 'extra')).resolves.toEqual({ ack: true });
    expect(calls).toEqual([{ windowId: WINDOW_ID, data: fetchPayload() }]);
    detach();
    detach();
    expect(ipcMain.handlers.size).toBe(0);
  });

  it('通道名覆写仅供测试注入，缺省恒取契约唯一名字来源', () => {
    const ipcMain = makeFakeIpcMain();
    registerCardWindowInitChannel({
      ipcMain,
      handler: () => Promise.resolve(undefined),
      channel: 'card-window-init:test-only',
    });
    expect(ipcMain.handlers.has('card-window-init:test-only')).toBe(true);
    expect(ipcMain.handlers.has(CARD_WINDOW_INIT_REQUEST_CHANNEL)).toBe(false);
  });
});

describe('HostApplication：装载投递通道随壳启动注册、随停机与启动失败逆序注销', () => {
  function createApplication(cardWindowDocumentBinding?: CardWindowInitHandlerDeps['resolveDocument']): {
    application: HostApplication;
    fake: ReturnType<typeof createFakeElectron>;
  } {
    const fake = createFakeElectron();
    const base = createFakeRuntime();
    const runtime = {
      ...base.runtime,
      ...(cardWindowDocumentBinding === undefined ? {} : { cardWindowDocumentBinding }),
    };
    const application = new HostApplication({
      electron: createElectronRuntime(fake.module),
      palHost: createFakePalHost(),
      runtime,
      preloadPath: '/app/dist/preload/index.js',
      bootstrapWindow: { title: '薯片' },
      diagnostics: { warn: vi.fn(), error: vi.fn() },
    });
    return { application, fake };
  }

  it('启动后通道在册（绑定腿缺位也注册，投递臂如实拒收）', async () => {
    const { application, fake } = createApplication();
    await application.start();
    expect([...fake.ipcMain.handlers.keys()].sort()).toEqual([
      'bridge:request',
      'bridge:resource',
      'card-window-init:request',
      'event:control',
    ]);
    await application.shutdown();
    expect(fake.ipcMain.handlers.size).toBe(0);
  });

  it('端到端：真实壳 + 启动参数开卡 + 替身 webContents 投递 → 空载 pending（登记表时窗口径）', async () => {
    const { application, fake } = createApplication((source) =>
      source.length > 0 ? { documentId: CARD_ID, resourceBase: RESOURCE_BASE } : null,
    );
    await application.start();
    const record = await application.cardWindowOrchestrator.open({ source: SOURCE });
    const listener = fake.ipcMain.handlers.get(CARD_WINDOW_INIT_REQUEST_CHANNEL);
    if (listener === undefined) {
      throw new Error('通道未注册');
    }
    const response = await listener({ sender: { id: record.windowId }, senderFrame: { routingId: 1 } }, fetchPayload());
    const validated = validateCardWindowInitResponse(response, 'init-1');
    expect(isCardWindowInitResult(validated)).toBe(true);
    expect(validated.windowId).toBe(record.windowId);
    expect(record.documentId).toBe(CARD_ID);
    // 以替身 webContents 的真实 ID 自报身份投递：非卡片窗口即未命中登记表（窗口存活则 pending）。
    const stranger = await listener(
      { sender: { id: fake.windows[0]!.webContents.id + 5_000 }, senderFrame: null },
      fetchPayload(),
    );
    const strangerValidated = validateCardWindowInitResponse(stranger, 'init-1');
    expect(isCardWindowInitPending(strangerValidated) || isCardWindowInitFailure(strangerValidated)).toBe(true);
    await application.shutdown();
  });
});
