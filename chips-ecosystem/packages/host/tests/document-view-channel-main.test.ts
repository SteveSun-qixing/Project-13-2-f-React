/**
 * 金链路刀5 段A：宿主内部取视图通道·主进程侧接线测试。
 *
 * 权威：`05-渲染引擎设计` §2.3/§2.6（构建执行位主进程、跨进程只过通道封套）、
 * 工单035 裁定（C+B 双层：渲染侧经宿主内部取视图通道消费；string↔u64 归一单点）、
 * RFC O3（wire `string` 为对外唯一身份，backing 数值会话不出主进程）、
 * `11-文档服务设计` §3.1/§4.6（会话定位与释放联动）。封套与错误面权威在
 * `src/renderer/document-view-channel.ts`（任务 #105 冻结件）。
 *
 * @remarks
 * - 分层覆盖：会话存储 `nativeSession` 唯一生成点 → `IDocumentService.resolveViewSession`
 *   严格二元组定位 → {@link createDocumentViewSessionResolver} 归一单点三臂 →
 *   {@link createDocumentViewChannelHandler} 两臂全错误面 → `registerDocumentViewChannel`
 *   注册与幂等注销 → 生产装载段（真实 17 名装载闸 + 行为面夹具）端到端 →
 *   宿主运行时端点透传与刀4 缝②会话释放联动 → 组合根全链（打开 → 取视图 → 关窗 → 记录移除）。
 * - 泄露防线：每条成功回包做递归键集巡检（`handle` / `nativeSession` / 品牌字段与
 *   `chips-parser` 字样一律不得出现在跨进程封套）。
 * - G2 归属臂（工单043 §五 G2 / A4）：端点入参携带 `event.sender.id` 折叠的发起窗口
 *   身份，会话定位升级为「窗口 ↔ 会话归属」比对——他窗来源拒臂与本窗归属通过臂
 *   在处理器臂、注册臂、生产装载臂与组合根端到端四层各别锁死。
 * - 零 skip：全部用例真实断言；未接线臂按「真实拒绝、不静默」逐项呈现。
 */

import { describe, expect, it } from 'vitest';

import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import {
  createHarness,
  ctxFor,
  CARD_ID,
  BOX_ID,
  NODE_ID_ONE,
  NODE_ID_TWO,
  SESSION_A,
  SESSION_A_WINDOW,
  SESSION_B,
  SESSION_B_WINDOW,
} from './helpers/document-fake-ports.js';
import { createDocumentService } from '../src/capabilities/document/service.js';
import type { IDocumentService } from '../src/capabilities/document/service.js';
import {
  DOCUMENT_VIEW_UNCORRELATED_REQUEST_ID,
  createDocumentViewChannelHandler,
  createDocumentViewSessionResolver,
  createUnavailableDocumentViewChannelEndpoint,
  registerDocumentViewChannel,
} from '../src/capabilities/document/adapters/view-channel.js';
import {
  DOCUMENT_WIRING_DIAGNOSTIC_SCOPE,
  createDocumentCapabilityWiring,
  type IDocumentResourcePorts,
} from '../src/capabilities/document/adapters/production-wiring.js';
import type {
  DocumentGuardSessionSource,
  IDocumentGuardSessionView,
} from '../src/capabilities/document/adapters/bridge-session-guard.js';
import type {
  IDocumentCommitRequest,
  IDocumentScopePort,
  IDocumentScopeRegistration,
  IDocumentStoragePort,
  IResolvedDocumentSource,
} from '../src/capabilities/document/ports.js';
import {
  DOCUMENT_VIEW_PROTOCOL,
  DOCUMENT_VIEW_REQUEST_CHANNEL,
  createDocumentViewBuildRequest,
  isDocumentViewBuildFailure,
  isDocumentViewBuildResult,
  validateDocumentViewChannelResponse,
} from '../src/renderer/document-view-channel.js';
import type { DocumentViewBuildResponse } from '../src/renderer/document-view-channel.js';
import type { INativeDocumentViewModule } from '../src/renderer/document-view-builder.js';
import { createHostRuntime } from '../src/runtime/host-runtime.js';
import type { IDocumentViewChannelEndpoint } from '../src/runtime/contracts.js';
import { createProductionAssembly } from '../src/main/production-assembly.js';
import type { IHostCapabilityDescriptor, IHostCapabilityContext } from '../src/runtime/capability/contracts.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { HostRuntimeContext } from '../src/main/runtime-provider.js';
import type { ShellIpcInvokeEvent, ShellIpcMain } from '../src/main/shell-api.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

const PARSER_BEHAVIOR_FIXTURE = fileURLToPath(
  new URL('./fixtures/native-binding/parser-document-behavior.js', import.meta.url),
);
const BRIDGE_AVAILABLE_FIXTURE = fileURLToPath(new URL('./fixtures/native-binding/available.js', import.meta.url));

const ENCODER = new TextEncoder();
const ENVELOPE_KEYS = ['protocol', 'type', 'requestId', 'view'];

/* ------------------------------------------------------------------ *
 * 替身与夹具
 * ------------------------------------------------------------------ */

/** §6.6 CardRenderView 冻结形状基线（替身注入面交付；与文档服务夹具编号同源）。 */
function baseCardView(revision = 0): Record<string, unknown> {
  return {
    kind: 'card',
    revision,
    card_id: CARD_ID,
    name: '测试卡片',
    chip_standards_version: '1.0.0',
    cover_ratio: '1:1',
    tags: ['a', ['b', 'c']],
    cover: { entry: NODE_ID_ONE, ratio: '1:1' },
    content_nodes: [
      { node_id: NODE_ID_ONE, card_type: 'text', content: { text: '第一块内容' } },
      { node_id: NODE_ID_TWO, card_type: 'image', content: { text: '第二块内容' } },
    ],
  };
}

/** 视图构建域替身注入面（逐调用记录句柄身份与数值会话；资源臂不在段A消费面）。 */
function makeFakeNative(behavior?: (handle: unknown, session: number) => Promise<Record<string, unknown>>): {
  readonly native: INativeDocumentViewModule;
  readonly calls: { handle: unknown; session: number }[];
} {
  const calls: { handle: unknown; session: number }[] = [];
  return {
    calls,
    native: {
      buildDocumentView: (handle, session) => {
        calls.push({ handle, session });
        return behavior ? behavior(handle, session) : Promise.resolve(baseCardView());
      },
      documentReadResource: () => Promise.reject(new Error('本套件不触达资源臂')),
    },
  };
}

/** 跨进程封套泄露巡检：句柄、数值会话与品牌字样一律不得入包。 */
function assertNoInternalLeak(value: unknown, path = 'root'): void {
  if (typeof value === 'string') {
    expect(value, `${path} 泄露内部字样`).not.toContain('chips-parser');
    expect(value, `${path} 泄露内部字样`).not.toContain('chips-native');
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInternalLeak(item, `${path}[${String(index)}]`));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      expect(
        ['handle', 'nativeSession', 'sessionId', 'documentHandleBrand', 'managedUri'],
        `${path} 泄露内部键 ${key}`,
      ).not.toContain(key);
      assertNoInternalLeak(item, `${path}.${key}`);
    }
  }
}

/** 收集型诊断口。 */
function collectDiagnostics(): DiagnosticsSink & {
  entries: { level: 'warn' | 'error'; scope: string; message: string; details?: Readonly<Record<string, unknown>> }[];
} {
  const entries: {
    level: 'warn' | 'error';
    scope: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  }[] = [];
  return {
    entries,
    warn(scope, message, details) {
      entries.push({ level: 'warn', scope, message, ...(details === undefined ? {} : { details }) });
    },
    error(scope, message, details) {
      entries.push({ level: 'error', scope, message, ...(details === undefined ? {} : { details }) });
    },
  };
}

/** harness 打开卡片的公共前置。 */
async function openHarnessCard(): Promise<{
  harness: ReturnType<typeof createHarness>;
  service: IDocumentService;
}> {
  const harness = createHarness();
  const service = createDocumentService(harness.dependencies);
  await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
  return { harness, service };
}

/* ------------------------------------------------------------------ *
 * 会话存储生成点与 resolveViewSession 定位臂
 * ------------------------------------------------------------------ */

describe('resolveViewSession：记录级数值会话生成与会话定位（段A 基座）', () => {
  it('found 臂：打开后按 {source, documentId} + 归属窗口取回句柄、数值会话与受管 URI；重复解析逐字段稳定', async () => {
    const { harness, service } = await openHarnessCard();
    const first = service.resolveViewSession({
      source: harness.cardUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    expect(first.status).toBe('found');
    if (first.status !== 'found') {
      return;
    }
    expect(first.managedUri).toBe(harness.cardUri);
    expect(Number.isSafeInteger(first.nativeSession)).toBe(true);
    expect(first.nativeSession).toBeGreaterThan(0);
    expect(typeof first.handle).toBe('object');
    const second = service.resolveViewSession({
      source: harness.cardUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    expect(second).toEqual(first);
  });

  it('唯一生成点：同记录幂等复用同一数值会话；跨记录互异且单调不复用（释放重开前进）', async () => {
    const { harness, service } = await openHarnessCard();
    const before = service.resolveViewSession({
      source: harness.cardUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    // 第二个会话打开同一来源：记录复用（openRecord 幂等），数值会话不变。
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_B));
    const reused = service.resolveViewSession({
      source: harness.cardUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    expect(reused).toEqual(before);
    // G2 归属面：第二会话的窗口（SESSION_B_WINDOW）同持该记录会话，归属比对同样通过。
    expect(
      service.resolveViewSession({ source: harness.cardUri, documentId: CARD_ID, windowId: SESSION_B_WINDOW }),
    ).toEqual(before);

    // 另一来源第二记录：数值会话互异。
    await service.executeOpen({ source: harness.boxUri }, ctxFor(SESSION_A));
    const box = service.resolveViewSession({ source: harness.boxUri, documentId: BOX_ID, windowId: SESSION_A_WINDOW });
    expect(box.status).toBe('found');
    if (box.status !== 'found' || before.status !== 'found') {
      return;
    }
    expect(box.nativeSession).not.toBe(before.nativeSession);

    // 释放全部会话 → 记录移除；重开为全新记录，数值会话不复用旧值。
    await service.releaseSessions(SESSION_A);
    await service.releaseSessions(SESSION_B);
    expect(
      service.resolveViewSession({ source: harness.cardUri, documentId: CARD_ID, windowId: SESSION_A_WINDOW }).status,
    ).toBe('not-found');
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    const reopened = service.resolveViewSession({
      source: harness.cardUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    expect(reopened.status).toBe('found');
    if (reopened.status === 'found' && before.status === 'found') {
      expect(reopened.nativeSession).toBeGreaterThan(before.nativeSession);
    }
  });

  it('not-found 臂：来源从未打开 / 记录已随会话释放移除', async () => {
    const { harness, service } = await openHarnessCard();
    expect(
      service.resolveViewSession({
        source: 'chips-resource://default/card/Gg7Hh8Ij9K.card',
        documentId: 'Gg7Hh8Ij9K',
        windowId: SESSION_A_WINDOW,
      }).status,
    ).toBe('not-found');
    await service.releaseSessions(SESSION_A);
    expect(
      service.resolveViewSession({ source: harness.cardUri, documentId: CARD_ID, windowId: SESSION_A_WINDOW }).status,
    ).toBe('not-found');
  });

  it('conflict 臂：来源记录在册但标识不符；candidateCount 如实枚举该标识存活记录数', async () => {
    const { harness, service } = await openHarnessCard();
    // BOX_ID 尚无存活记录：冲突 + 0。
    const drift = service.resolveViewSession({
      source: harness.cardUri,
      documentId: BOX_ID,
      windowId: SESSION_A_WINDOW,
    });
    expect(drift.status).toBe('conflict');
    if (drift.status === 'conflict') {
      expect(drift.candidateCount).toBe(0);
    }
    // 打开箱子后同一误配：该标识存活记录数如实为 1（来源仍以严格二元组为准）。
    await service.executeOpen({ source: harness.boxUri }, ctxFor(SESSION_A));
    const conflict = service.resolveViewSession({
      source: harness.cardUri,
      documentId: BOX_ID,
      windowId: SESSION_A_WINDOW,
    });
    expect(conflict.status).toBe('conflict');
    if (conflict.status === 'conflict') {
      expect(conflict.candidateCount).toBe(1);
    }
    // 同标识双记录（第二会话打开另一来源）：严格二元组仍各自命中正确记录，不做跨来源放宽。
    const twinUri = harness.addCard('chips-resource://default/backup/Ab3dEf6Gh8-copy.card');
    await service.executeOpen({ source: twinUri }, ctxFor(SESSION_B));
    const exact = service.resolveViewSession({ source: twinUri, documentId: CARD_ID, windowId: SESSION_B_WINDOW });
    expect(exact.status).toBe('found');
    if (exact.status === 'found') {
      expect(exact.managedUri).toBe(twinUri);
    }
    // 该标识此时有两条存活记录：误配来源的冲突臂如实枚举为 2。
    const multi = service.resolveViewSession({
      source: harness.boxUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    expect(multi.status).toBe('conflict');
    if (multi.status === 'conflict') {
      expect(multi.candidateCount).toBe(2);
    }
  });
});

/* ------------------------------------------------------------------ *
 * string↔u64 归一单点：生产会话解析器
 * ------------------------------------------------------------------ */

describe('createDocumentViewSessionResolver：string↔u64 归一单点', () => {
  it('found → 绑定三元组：handle 为服务侧句柄原样投影、sessionId 逐字取记录级数值会话、scope 归一小写', async () => {
    const { harness, service } = await openHarnessCard();
    const resolution = service.resolveViewSession({
      source: harness.cardUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    const resolver = createDocumentViewSessionResolver(service, SESSION_A_WINDOW);
    const binding = await resolver({ source: harness.cardUri, documentId: CARD_ID, kind: 'card' });
    expect(resolution.status).toBe('found');
    if (resolution.status !== 'found') {
      return;
    }
    expect(binding.handle).toBe(resolution.handle as unknown as typeof binding.handle);
    expect(binding.sessionId).toBe(resolution.nativeSession);
    expect(binding.managedScope).toBe('default');
    // 大写来源作用域经 URI 归一为小写（记录级受管引用为唯一权威输入）。
    expect(typeof binding.sessionId).toBe('number');
  });

  it('not-found / conflict 以在册会话域码拒绝（DOCUMENT_NOT_OPEN / DOCUMENT_ID_CONFLICT）', async () => {
    const { harness, service } = await openHarnessCard();
    const resolver = createDocumentViewSessionResolver(service, SESSION_A_WINDOW);
    await expect(
      resolver({ source: 'chips-resource://default/card/Gg7Hh8Ij9K.card', documentId: 'Gg7Hh8Ij9K', kind: 'card' }),
    ).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_OPEN',
    });
    await expect(resolver({ source: harness.cardUri, documentId: BOX_ID, kind: 'card' })).rejects.toMatchObject({
      code: 'DOCUMENT_ID_CONFLICT',
    });
  });

  it('受管引用语法违约（构造性漂移）以 BRIDGE_INTERNAL 拒绝，不猜测作用域', async () => {
    const service = {
      resolveViewSession: () => ({
        status: 'found',
        handle: { documentHandleBrand: 'chips-parser' },
        nativeSession: 3,
        managedUri: 'chips://not-resource',
      }),
    } as unknown as IDocumentService;
    const resolver = createDocumentViewSessionResolver(service, SESSION_A_WINDOW);
    await expect(resolver({ source: 'chips://not-resource', documentId: CARD_ID, kind: 'card' })).rejects.toMatchObject(
      {
        code: 'BRIDGE_INTERNAL',
      },
    );
  });
});

/* ------------------------------------------------------------------ *
 * 真实构建臂端点（替身注入面）
 * ------------------------------------------------------------------ */

describe('createDocumentViewChannelHandler：真实构建臂两臂与错误面', () => {
  it('成功臂：结果封套精确键集 + 视图逐字交付；native 收到服务侧句柄身份与数值会话', async () => {
    const { harness, service } = await openHarnessCard();
    const fake = makeFakeNative();
    const endpoint = createDocumentViewChannelHandler({ service, native: fake.native });
    const response = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-ok', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildResult(response)).toBe(true);
    if (!isDocumentViewBuildResult(response)) {
      return;
    }
    expect(Object.keys(response).sort()).toEqual([...ENVELOPE_KEYS].sort());
    expect(response.protocol).toBe(DOCUMENT_VIEW_PROTOCOL);
    expect(response.requestId).toBe('req-ok');
    expect(response.view).toEqual(baseCardView() as unknown as typeof response.view);
    expect(fake.calls).toHaveLength(1);
    const resolution = service.resolveViewSession({
      source: harness.cardUri,
      documentId: CARD_ID,
      windowId: SESSION_A_WINDOW,
    });
    if (resolution.status === 'found') {
      expect(fake.calls[0]?.handle).toBe(resolution.handle);
      expect(fake.calls[0]?.session).toBe(resolution.nativeSession);
    }
    assertNoInternalLeak(response);
  });

  it('破损封套臂：非对象 / 协议不符 / 多余键 / 非法 requestId / documentId 非十位 Base62 / kind 非判别 → 在册 BRIDGE_INVALID_INPUT 失败臂（不抛出、不静默）', async () => {
    const { service } = await openHarnessCard();
    const endpoint = createDocumentViewChannelHandler({ service, native: makeFakeNative().native });
    const malformed: unknown[] = [
      null,
      'not-an-envelope',
      { ...createDocumentViewBuildRequest('req-a', { source: 'x', documentId: CARD_ID, kind: 'card' }), extra: true },
      {
        ...createDocumentViewBuildRequest('req-b', { source: 'x', documentId: CARD_ID, kind: 'card' }),
        protocol: 'chips-document-view/2',
      },
      {
        ...createDocumentViewBuildRequest('req-c', { source: 'x', documentId: CARD_ID, kind: 'card' }),
        type: 'document-view:result',
      },
      { ...createDocumentViewBuildRequest('', { source: 'x', documentId: CARD_ID, kind: 'card' }) },
      { ...createDocumentViewBuildRequest('req-d', { source: '', documentId: CARD_ID, kind: 'card' }) },
      { ...createDocumentViewBuildRequest('req-e', { source: 'x', documentId: 'short', kind: 'card' }) },
      { ...createDocumentViewBuildRequest('req-f', { source: 'x', documentId: 'Ab3dEf6Gh8!', kind: 'card' }) },
      { ...createDocumentViewBuildRequest('req-g', { source: 'x', documentId: CARD_ID, kind: 'sheet' as 'card' }) },
      {
        ...createDocumentViewBuildRequest('req-h', {
          source: 'x',
          documentId: CARD_ID,
          kind: 'card',
          extra: 1,
        } as unknown as Parameters<typeof createDocumentViewBuildRequest>[1]),
      },
    ];
    for (const payload of malformed) {
      const raw = await endpoint.handleRequest(SESSION_A_WINDOW, payload);
      const response = validateDocumentViewChannelResponse(raw);
      expect(isDocumentViewBuildFailure(response), JSON.stringify(payload)).toBe(true);
      if (isDocumentViewBuildFailure(response)) {
        expect(response.error.code).toBe('BRIDGE_INVALID_INPUT');
        // 请求闸未过 → 关联不可信，统一以回退标识回包。
        expect(response.requestId).toBe(DOCUMENT_VIEW_UNCORRELATED_REQUEST_ID);
      }
    }
  });

  it('交付面闸：kind=box 合法请求以 BRIDGE_INVALID_INPUT 失败臂回包并回显 requestId', async () => {
    const { harness, service } = await openHarnessCard();
    const endpoint = createDocumentViewChannelHandler({ service, native: makeFakeNative().native });
    const response = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-box', { source: harness.cardUri, documentId: CARD_ID, kind: 'box' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response)).toBe(true);
    if (isDocumentViewBuildFailure(response)) {
      expect(response.requestId).toBe('req-box');
      expect(response.error.code).toBe('BRIDGE_INVALID_INPUT');
    }
  });

  it('会话定位失败臂：未打开文档 → DOCUMENT_NOT_OPEN；句柄漂移对 → DOCUMENT_ID_CONFLICT（在册面内透传）', async () => {
    const { harness, service } = await openHarnessCard();
    const endpoint = createDocumentViewChannelHandler({ service, native: makeFakeNative().native });
    const ghost = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-ghost', {
          source: 'chips-resource://default/card/Gg7Hh8Ij9K.card',
          documentId: 'Gg7Hh8Ij9K',
          kind: 'card',
        }),
      ),
    );
    expect(isDocumentViewBuildFailure(ghost)).toBe(true);
    if (isDocumentViewBuildFailure(ghost)) {
      expect(ghost.requestId).toBe('req-ghost');
      expect(ghost.error.code).toBe('DOCUMENT_NOT_OPEN');
    }
    const drift = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-drift', { source: harness.cardUri, documentId: BOX_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(drift)).toBe(true);
    if (isDocumentViewBuildFailure(drift)) {
      expect(drift.error.code).toBe('DOCUMENT_ID_CONFLICT');
    }
  });

  it('backing 失败臂：在册解析域码原样透传；面外码归一 BRIDGE_INTERNAL（details.cause 留原码）', async () => {
    const { harness, service } = await openHarnessCard();
    const notFound = createDocumentViewChannelHandler({
      service,
      native: makeFakeNative(() =>
        Promise.reject(Object.assign(new Error('句柄已释放'), { code: 'DOCUMENT_NOT_FOUND', retryable: false })),
      ).native,
    });
    const response1 = validateDocumentViewChannelResponse(
      await notFound.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-nf', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response1)).toBe(true);
    if (isDocumentViewBuildFailure(response1)) {
      expect(response1.error.code).toBe('DOCUMENT_NOT_FOUND');
    }
    const drift = createDocumentViewChannelHandler({
      service,
      native: makeFakeNative(() =>
        Promise.reject(
          Object.assign(new Error('渲染域码不应出现在本链路'), { code: 'RENDER_INTERNAL', retryable: false }),
        ),
      ).native,
    });
    const response2 = validateDocumentViewChannelResponse(
      await drift.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-drift2', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response2)).toBe(true);
    if (isDocumentViewBuildFailure(response2)) {
      expect(response2.error.code).toBe('BRIDGE_INTERNAL');
      expect(response2.error.details).toMatchObject({ cause: 'RENDER_INTERNAL' });
    }
  });

  it('发送侧守门：backing 返回违约形状（缺冻结字段 / 混入函数）以 BRIDGE_INTERNAL 失败臂拒绝，不入结果臂', async () => {
    const { harness, service } = await openHarnessCard();
    const missingKeys = createDocumentViewChannelHandler({
      service,
      native: makeFakeNative(() => Promise.resolve({ kind: 'card', revision: 0 })).native,
    });
    const response1 = validateDocumentViewChannelResponse(
      await missingKeys.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-shape', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response1)).toBe(true);
    if (isDocumentViewBuildFailure(response1)) {
      expect(response1.error.code).toBe('BRIDGE_INTERNAL');
    }
    const withFunction = createDocumentViewChannelHandler({
      service,
      native: makeFakeNative(() => Promise.resolve({ ...baseCardView(), extra: () => undefined })).native,
    });
    const response2 = validateDocumentViewChannelResponse(
      await withFunction.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-fn', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response2)).toBe(true);
  });

  it('句柄与数值会话不出回包：成功臂递归巡检泄露防线 + JSON 往返无内部字段', async () => {
    const { harness, service } = await openHarnessCard();
    const endpoint = createDocumentViewChannelHandler({ service, native: makeFakeNative().native });
    const raw = await endpoint.handleRequest(
      SESSION_A_WINDOW,
      createDocumentViewBuildRequest('req-leak', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
    );
    assertNoInternalLeak(raw);
    const roundTripped = JSON.parse(JSON.stringify(raw)) as DocumentViewBuildResponse;
    expect(isDocumentViewBuildResult(roundTripped)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * G2 窗口↔会话归属锁测（工单043-A4）
 * ------------------------------------------------------------------ */

describe('G2 归属臂锁测：他窗来源拒臂 + 本窗归属通过臂（工单043-A4）', () => {
  it('他窗拒绝臂：记录会话无一会归属发起窗口 → BRIDGE_SESSION_UNKNOWN 失败臂，不触达 native、不泄露视图', async () => {
    const { harness, service } = await openHarnessCard();
    const fake = makeFakeNative();
    const endpoint = createDocumentViewChannelHandler({ service, native: fake.native });
    const response = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        SESSION_B_WINDOW,
        createDocumentViewBuildRequest('req-cross', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response)).toBe(true);
    if (isDocumentViewBuildFailure(response)) {
      expect(response.requestId).toBe('req-cross');
      expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
    expect(fake.calls).toHaveLength(0);
    assertNoInternalLeak(response);
  });

  it('本窗通过臂：发起窗口即记录会话归属窗口 → 视图照常交付', async () => {
    const { harness, service } = await openHarnessCard();
    const endpoint = createDocumentViewChannelHandler({ service, native: makeFakeNative().native });
    const response = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        SESSION_A_WINDOW,
        createDocumentViewBuildRequest('req-own', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildResult(response)).toBe(true);
    if (isDocumentViewBuildResult(response)) {
      expect(response.view.card_id).toBe(CARD_ID);
    }
  });

  it('双窗共享：同一来源被两会话打开后各归属窗口均通过；第三窗仍如实拒绝', async () => {
    const { harness, service } = await openHarnessCard();
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_B));
    const endpoint = createDocumentViewChannelHandler({ service, native: makeFakeNative().native });
    for (const [requestId, windowId] of [
      ['req-w-a', SESSION_A_WINDOW],
      ['req-w-b', SESSION_B_WINDOW],
    ] as const) {
      const response = validateDocumentViewChannelResponse(
        await endpoint.handleRequest(
          windowId,
          createDocumentViewBuildRequest(requestId, { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
        ),
      );
      expect(isDocumentViewBuildResult(response), requestId).toBe(true);
    }
    const third = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        999,
        createDocumentViewBuildRequest('req-third', { source: harness.cardUri, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(third)).toBe(true);
    if (isDocumentViewBuildFailure(third)) {
      expect(third.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
  });

  it('不可取证来源（非整数窗口 ID）→ BRIDGE_SESSION_UNKNOWN 失败臂，不触达会话域与 native', async () => {
    const { harness, service } = await openHarnessCard();
    const fake = makeFakeNative();
    const endpoint = createDocumentViewChannelHandler({ service, native: fake.native });
    const response = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        1.5,
        createDocumentViewBuildRequest('req-bad-sender', {
          source: harness.cardUri,
          documentId: CARD_ID,
          kind: 'card',
        }),
      ),
    );
    expect(isDocumentViewBuildFailure(response)).toBe(true);
    if (isDocumentViewBuildFailure(response)) {
      expect(response.requestId).toBe('req-bad-sender');
      expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
      expect(response.error.details).toMatchObject({ reason: 'invalid_sender_window' });
    }
    expect(fake.calls).toHaveLength(0);
  });

  it('服务本体：归属不符即 unowned（不携任何句柄/数值会话字段）', async () => {
    const { harness, service } = await openHarnessCard();
    expect(service.resolveViewSession({ source: harness.cardUri, documentId: CARD_ID, windowId: 999 })).toEqual({
      status: 'unowned',
    });
  });

  it('无窗口可归属的会话（载体会话形态，解析为 null）：任何发起窗口都进不去', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const carrierSession = 'session:carrier:c-1';
    harness.openSession(carrierSession, undefined, null);
    await service.executeOpen({ source: harness.cardUri }, ctxFor(carrierSession));
    for (const windowId of [SESSION_A_WINDOW, SESSION_B_WINDOW, 1]) {
      expect(service.resolveViewSession({ source: harness.cardUri, documentId: CARD_ID, windowId })).toEqual({
        status: 'unowned',
      });
    }
  });
});

/* ------------------------------------------------------------------ *
 * IPC 注册与未接线诚实拒绝臂
 * ------------------------------------------------------------------ */

describe('registerDocumentViewChannel：ipcMain 切片注册与幂等注销', () => {
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

  const EVENT: ShellIpcInvokeEvent = { sender: { id: 1 }, senderFrame: { routingId: 2 } };

  it('按契约通道名注册；监听回包为契约响应封套；注销后通道移除且重复注销幂等', async () => {
    const ipcMain = makeFakeIpcMain();
    const endpoint = createUnavailableDocumentViewChannelEndpoint();
    const detach = registerDocumentViewChannel({ ipcMain, endpoint });
    expect(ipcMain.handlers.has(DOCUMENT_VIEW_REQUEST_CHANNEL)).toBe(true);
    const listener = ipcMain.handlers.get(DOCUMENT_VIEW_REQUEST_CHANNEL);
    if (listener === undefined) {
      return;
    }
    const returned = await listener(
      EVENT,
      createDocumentViewBuildRequest('req-ipc', { source: 'chips-resource://x', documentId: CARD_ID, kind: 'card' }),
      '多余实参被忽略',
    );
    const response = validateDocumentViewChannelResponse(returned);
    expect(isDocumentViewBuildFailure(response)).toBe(true);
    if (isDocumentViewBuildFailure(response)) {
      expect(response.requestId).toBe('req-ipc');
      expect(response.error.code).toBe('BRIDGE_INTERNAL');
    }
    detach();
    expect(ipcMain.handlers.size).toBe(0);
    expect(() => detach()).not.toThrow();
  });

  it('G2 注册臂（工单043-A4）：event.sender.id 即发起窗口身份——他窗拒臂 / 本窗过臂经真实注册面成立', async () => {
    const { harness, service } = await openHarnessCard();
    const fake = makeFakeNative();
    const ipcMain = makeFakeIpcMain();
    registerDocumentViewChannel({
      ipcMain,
      endpoint: createDocumentViewChannelHandler({ service, native: fake.native }),
    });
    const listener = ipcMain.handlers.get(DOCUMENT_VIEW_REQUEST_CHANNEL);
    if (listener === undefined) {
      return;
    }
    const payload = createDocumentViewBuildRequest('req-sender', {
      source: harness.cardUri,
      documentId: CARD_ID,
      kind: 'card',
    });
    const foreign = validateDocumentViewChannelResponse(
      await listener({ sender: { id: SESSION_B_WINDOW }, senderFrame: null }, payload),
    );
    expect(isDocumentViewBuildFailure(foreign)).toBe(true);
    if (isDocumentViewBuildFailure(foreign)) {
      expect(foreign.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
    expect(fake.calls).toHaveLength(0);
    const own = validateDocumentViewChannelResponse(
      await listener({ sender: { id: SESSION_A_WINDOW }, senderFrame: null }, payload),
    );
    expect(isDocumentViewBuildResult(own)).toBe(true);
    expect(fake.calls).toHaveLength(1);
  });

  it('通道名覆写注入位可用（缺省恒为契约唯一名字来源）', () => {
    const ipcMain = makeFakeIpcMain();
    registerDocumentViewChannel({
      ipcMain,
      endpoint: createUnavailableDocumentViewChannelEndpoint(),
      channel: 'document-view:test-only',
    });
    expect(ipcMain.handlers.has('document-view:test-only')).toBe(true);
    expect(ipcMain.handlers.has(DOCUMENT_VIEW_REQUEST_CHANNEL)).toBe(false);
  });
});

describe('未接线诚实拒绝臂（当前生产恒回退态，工单036）', () => {
  it('合法请求 → BRIDGE_INTERNAL 失败臂回显 requestId；破损请求 → 回退标识 + BRIDGE_INVALID_INPUT；全程不抛出', async () => {
    const endpoint = createUnavailableDocumentViewChannelEndpoint();
    const valid = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        1,
        createDocumentViewBuildRequest('req-unwired', {
          source: 'chips-resource://default/card/x.card',
          documentId: CARD_ID,
          kind: 'card',
        }),
      ),
    );
    expect(isDocumentViewBuildFailure(valid)).toBe(true);
    if (isDocumentViewBuildFailure(valid)) {
      expect(valid.requestId).toBe('req-unwired');
      expect(valid.error.code).toBe('BRIDGE_INTERNAL');
      expect(valid.error.details).toMatchObject({ gate: 'wiring' });
    }
    const invalid = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(1, { protocol: DOCUMENT_VIEW_PROTOCOL }),
    );
    expect(isDocumentViewBuildFailure(invalid)).toBe(true);
    if (isDocumentViewBuildFailure(invalid)) {
      expect(invalid.error.code).toBe('BRIDGE_INVALID_INPUT');
      expect(invalid.requestId).toBe(DOCUMENT_VIEW_UNCORRELATED_REQUEST_ID);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 生产装载段两臂（真实装载闸 + 行为面夹具）
 * ------------------------------------------------------------------ */

/** 与 `document-production-assembly.test.ts` 同口径的最小资源端口替身（仅证明注入通道形状）。 */
function makeResourcePorts(): IDocumentResourcePorts {
  const CARD_PATH = '/fake/prod-card.card';
  const CARD_URI = `chips-resource://default/card/${CARD_ID}.card`;
  let viewNativeSession = 0;
  const scope: IDocumentScopePort = {
    normalizeSource(source: string): Promise<IResolvedDocumentSource> {
      if (source !== CARD_URI) {
        return Promise.reject(Object.assign(new Error('夹具未登记该来源'), { code: 'RESOURCE_NOT_FOUND' }));
      }
      return Promise.resolve({ managedUri: CARD_URI, localPath: CARD_PATH, form: 'directory' });
    },
    registerScope(): Promise<IDocumentScopeRegistration> {
      // 替身自持登记凭号（模拟原生 `resourceOpenSession` 回执，INV-1 记录面唯一来源）。
      viewNativeSession += 1;
      return Promise.resolve({ nativeSession: viewNativeSession });
    },
    unregisterScope(): Promise<void> {
      // 注入通道形状替身（两拍接线行为面见 `document-scope-lifecycle.test.ts` 与
      // `document-session-store.test.ts` 的次序锁；本臂只保证端口形状与装载通道可用）。
      return Promise.resolve();
    },
    // 点位三消费臂替身（波 B2）：路径与作用域根一律经端口取回（形状与装载通道可用即本臂职责）。
    localPathOf(managedUri: string): Promise<string> {
      if (managedUri !== CARD_URI) {
        return Promise.reject(Object.assign(new Error('夹具未登记该受管引用'), { code: 'RESOURCE_NOT_FOUND' }));
      }
      return Promise.resolve(CARD_PATH);
    },
    scopeRootOf(managedUri: string): string | null {
      return managedUri === CARD_URI ? 'chips-resource://default/' : null;
    },
  };
  const storage: IDocumentStoragePort = {
    commit(request: IDocumentCommitRequest): Promise<void> {
      void request;
      return Promise.resolve();
    },
    listMembers(): Promise<readonly { packagePath: string; bytes: Uint8Array }[]> {
      return Promise.resolve([{ packagePath: 'meta.yaml', bytes: ENCODER.encode('{}') }]);
    },
    readFileBytes(): Promise<Uint8Array> {
      return Promise.reject(Object.assign(new Error('未用出'), { code: 'RESOURCE_PATH_INVALID' }));
    },
  };
  return { scope, storage };
}

/**
 * 装载段套件的真实词法会话身份（工单043-A4 G2）：生产装配的会话→窗口解析口为壳侧
 * 词法唯一权威（`host-runtime.ts` `windowIdOfSessionId`），故本组用例经 Bridge 路由
 * 同源词法 `session:<windowId>:main` 打开文档——归属窗口即 `WIRED_WINDOW`。
 */
const WIRED_WINDOW = 1;
const WIRED_FOREIGN_WINDOW = 2;
const WIRED_SESSION_ID = `session:${String(WIRED_WINDOW)}:main`;

function activeGuard(): DocumentGuardSessionSource {
  const view: IDocumentGuardSessionView = {
    sessionId: WIRED_SESSION_ID,
    state: 'active',
    grantedPermissions: new Set<string>(['resources:read', 'resources:write']),
  };
  return () => [view];
}

const WIRING_CONTEXT = { platformRoot: '/tmp/platform' };
const WIRING_CARD_URI = `chips-resource://default/card/${CARD_ID}.card`;

function hostCtxFor(sessionId: string): IHostCapabilityContext {
  return {
    signal: new AbortController().signal,
    deadline: Date.now() + 5000,
    sessionId,
    callerId: 'platform',
    emit: () => undefined,
  };
}

describe('生产装载段：viewChannel 两臂恒在（缝③收口）', () => {
  it('wired 臂：真实装载闸产物端到端——open 后取视图回 §6.6 卡片视图；native 收到夹具登记的本地路径与数值会话（token→原生句柄翻译单点生效）', async () => {
    const requireFixture = createRequire(import.meta.url);
    const fixtureModule = requireFixture(PARSER_BEHAVIOR_FIXTURE) as {
      __calls: { export: string; args: Record<string, unknown> }[];
    };
    const wiring = createDocumentCapabilityWiring(
      {
        parserModulePath: PARSER_BEHAVIOR_FIXTURE,
        guardSessionSource: activeGuard(),
        resourcePorts: makeResourcePorts(),
      },
      WIRING_CONTEXT,
      collectDiagnostics(),
    );
    expect(wiring.status).toBe('wired');
    expect(wiring.service).toBeDefined();
    const openDescriptor = wiring.descriptors.find(
      (descriptor: IHostCapabilityDescriptor) => descriptor.id === 'document:open',
    );
    expect(openDescriptor).toBeDefined();
    await openDescriptor?.handler({ source: WIRING_CARD_URI }, hostCtxFor(WIRED_SESSION_ID));
    if (!wiring.service) {
      return;
    }
    const resolution = wiring.service.resolveViewSession({
      source: WIRING_CARD_URI,
      documentId: CARD_ID,
      windowId: WIRED_WINDOW,
    });
    expect(resolution.status).toBe('found');

    const callsBefore = fixtureModule.__calls.length;
    const response = validateDocumentViewChannelResponse(
      await wiring.viewChannel.handleRequest(
        WIRED_WINDOW,
        createDocumentViewBuildRequest('req-wired', { source: WIRING_CARD_URI, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildResult(response)).toBe(true);
    if (isDocumentViewBuildResult(response) && resolution.status === 'found') {
      expect(response.view.card_id).toBe(CARD_ID);
      expect(response.view.name).toBe('生产接线卡片');
      expect(response.view.content_nodes.map((node) => node.node_id)).toEqual([NODE_ID_ONE, NODE_ID_TWO]);
      assertNoInternalLeak(response);
    }
    const viewCalls = fixtureModule.__calls.slice(callsBefore).filter((call) => call.export === 'buildDocumentView');
    expect(viewCalls).toHaveLength(1);
    // 句柄侧归一：夹具登记路径可查 → 传入的是 WeakMap 还原后的真实原生句柄，
    // 服务侧 token 直达夹具会在 `requireHandle` 处即 `DOCUMENT_NOT_FOUND`。
    expect(viewCalls[0]?.args).toMatchObject({
      path: '/fake/prod-card.card',
      session: resolution.status === 'found' ? resolution.nativeSession : undefined,
    });

    // G2 归属臂（工单043-A4）：生产装载段以壳侧词法权威解析归属窗口——他窗请求
    // 在真实端点上同样得到 `BRIDGE_SESSION_UNKNOWN`，native 不再触达。
    const foreign = validateDocumentViewChannelResponse(
      await wiring.viewChannel.handleRequest(
        WIRED_FOREIGN_WINDOW,
        createDocumentViewBuildRequest('req-wired-foreign', {
          source: WIRING_CARD_URI,
          documentId: CARD_ID,
          kind: 'card',
        }),
      ),
    );
    expect(isDocumentViewBuildFailure(foreign)).toBe(true);
    if (isDocumentViewBuildFailure(foreign)) {
      expect(foreign.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
    expect(fixtureModule.__calls.slice(callsBefore).filter((call) => call.export === 'buildDocumentView')).toHaveLength(
      1,
    );
  });

  it('wired 臂未打开即请求：DOCUMENT_NOT_OPEN 如实失败（不伪造成功）', async () => {
    const wiring = createDocumentCapabilityWiring(
      {
        parserModulePath: PARSER_BEHAVIOR_FIXTURE,
        guardSessionSource: activeGuard(),
        resourcePorts: makeResourcePorts(),
      },
      WIRING_CONTEXT,
      collectDiagnostics(),
    );
    const response = validateDocumentViewChannelResponse(
      await wiring.viewChannel.handleRequest(
        WIRED_WINDOW,
        createDocumentViewBuildRequest('req-cold', { source: WIRING_CARD_URI, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response)).toBe(true);
    if (isDocumentViewBuildFailure(response)) {
      expect(response.error.code).toBe('DOCUMENT_NOT_OPEN');
    }
  });

  it('unavailable 臂：viewChannel 为诚实拒绝臂、service 缺位（装载判据语义不动）', async () => {
    const diagnostics = collectDiagnostics();
    const wiring = createDocumentCapabilityWiring(undefined, WIRING_CONTEXT, diagnostics);
    expect(wiring.status).toBe('unavailable');
    expect(wiring.service).toBeUndefined();
    expect(wiring.descriptors).toEqual([]);
    expect(diagnostics.entries.some((entry) => entry.scope === DOCUMENT_WIRING_DIAGNOSTIC_SCOPE)).toBe(true);
    const response = validateDocumentViewChannelResponse(
      await wiring.viewChannel.handleRequest(
        WIRED_WINDOW,
        createDocumentViewBuildRequest('req-fallback', { source: WIRING_CARD_URI, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response)).toBe(true);
    if (isDocumentViewBuildFailure(response)) {
      expect(response.error.code).toBe('BRIDGE_INTERNAL');
    }
  });
});

/* ------------------------------------------------------------------ *
 * 宿主运行时透传与刀4 缝②：会话关闭联动
 * ------------------------------------------------------------------ */

describe('createHostRuntime：取视图通道端点透传与 onBridgeSessionClosed 联动（缝②）', () => {
  const endpoint: IDocumentViewChannelEndpoint = { handleRequest: () => Promise.resolve(null) };

  it('端点透传到 IPlatformRuntime.documentViewChannel；选项缺位时该面缺位', () => {
    const runtime = createHostRuntime({ documentViewChannel: endpoint });
    expect(runtime.documentViewChannel).toBe(endpoint);
    const bare = createHostRuntime({});
    expect(bare.documentViewChannel).toBeUndefined();
  });

  it('会话关闭 → 内部清理完成后回调组合根（会话 ID 逐字交付）；回调同步抛出入诊断不阻断', async () => {
    const closed: string[] = [];
    const diagnostics = collectDiagnostics();
    const runtime = createHostRuntime({
      documentViewChannel: endpoint,
      onBridgeSessionClosed: (sessionId) => {
        closed.push(sessionId);
        throw new Error('联动回调故障');
      },
      diagnostics,
    });
    await runtime.start({} as IPalHost, { pushSessionPermissions: () => undefined });
    await runtime.ipc.handleRequest(
      { windowId: 7, frameId: null },
      { requestId: 'seed-1', capabilityId: 'no:such', input: {} },
    );
    expect(() => runtime.ipc.handleWindowClosed(7)).not.toThrow();
    expect(closed).toEqual(['session:7:main']);
    expect(
      diagnostics.entries.some((entry) => entry.level === 'error' && entry.message.includes('会话关闭联动回调抛出')),
    ).toBe(true);
    await runtime.shutdown();
  });

  it('未注入联动：会话关闭路径保持原语义（不新增调用面）', async () => {
    const runtime = createHostRuntime({});
    await runtime.start({} as IPalHost, { pushSessionPermissions: () => undefined });
    await runtime.ipc.handleRequest(
      { windowId: 8, frameId: null },
      { requestId: 'seed-2', capabilityId: 'no:such', input: {} },
    );
    expect(() => runtime.ipc.handleWindowClosed(8)).not.toThrow();
    expect(runtime.report().activeSessions).toBe(0);
    await runtime.shutdown();
  });
});

/* ------------------------------------------------------------------ *
 * 组合根端到端：生产装配运行时（注册面 + 释放联动收口）
 * ------------------------------------------------------------------ */

const SYSTEM_SNAPSHOT: SystemInfo = {
  platform: 'darwin',
  osVersion: '15.0',
  arch: 'arm64',
  appVersion: '0.1.0',
  locale: 'zh-CN',
  paths: {
    userHome: '/Users/tester',
    userDocuments: '/Users/tester/Documents',
    userDownloads: '/Users/tester/Downloads',
    userDesktop: '/Users/tester/Desktop',
    userPictures: '/Users/tester/Pictures',
    userMusic: '/Users/tester/Music',
    userVideos: '/Users/tester/Videos',
    userData: '/Users/tester/Library/Application Support/Chips',
    temp: '/tmp',
  },
};

const host: IPalHost = {
  info: {
    shell: 'desktop',
    platform: 'macos',
    osVersion: '15.0',
    arch: 'arm64',
    appVersion: '0.1.0',
    locale: 'zh-CN',
    paths: {},
  },
  matrix: {
    window: false,
    dialog: false,
    notification: false,
    clipboard: false,
    menu: false,
    tray: false,
    shortcut: false,
    power: false,
    systemInfo: true,
    transfer: false,
    shellOpen: false,
    http: false,
  },
  ports: {
    storage: {},
    system: { getInfo: (): Promise<SystemInfo> => Promise.resolve(SYSTEM_SNAPSHOT) },
  } as IPalHost['ports'],
};

const assemblyContext: HostRuntimeContext = { palHost: host, platformRoot: '/tmp/platform', userDataPath: '/tmp/user' };
const SENDER = { windowId: 1, frameId: null };
const ROUTE_SESSION_ID = 'session:1:main';

async function startAssemblyRuntime(
  documentWiring?: Parameters<typeof createProductionAssembly>[0]['documentWiring'],
): Promise<IHostRuntimeLike> {
  const diagnostics = collectDiagnostics();
  const assembly = createProductionAssembly({
    createPalHost: () => host,
    nativeBridgeModulePath: BRIDGE_AVAILABLE_FIXTURE,
    ...(documentWiring === undefined ? {} : { documentWiring }),
    diagnostics,
  });
  const runtime = await assembly.createRuntime(assemblyContext);
  await runtime.start(host, { pushSessionPermissions: () => undefined });
  return runtime;
}

/** 组合根运行时在本套件的消费面（含段A端点）。 */
type IHostRuntimeLike = {
  start(palHost: IPalHost, channel: { pushSessionPermissions: () => void }): Promise<void>;
  shutdown(): Promise<void>;
  ipc: {
    handleRequest(source: { windowId: number; frameId: number | null }, request: unknown): Promise<unknown>;
    handleWindowClosed(windowId: number): void;
  };
  documentViewChannel?: IDocumentViewChannelEndpoint;
};

describe('组合根端到端：wired 运行时取视图 + 关窗释放联动收口（缝②③合龙）', () => {
  it('document:open 经 Bridge 路由成功后端点取回视图；窗口关闭会话释放后同一请求如实 DOCUMENT_NOT_OPEN', async () => {
    const wiringGuard: DocumentGuardSessionSource = () => [
      {
        sessionId: ROUTE_SESSION_ID,
        state: 'active',
        grantedPermissions: new Set<string>(['resources:read', 'resources:write']),
      },
    ];
    const runtime = await startAssemblyRuntime({
      parserModulePath: PARSER_BEHAVIOR_FIXTURE,
      guardSessionSource: wiringGuard,
      resourcePorts: makeResourcePorts(),
    });
    expect(runtime.documentViewChannel).toBeDefined();
    const opened = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'e2e-open',
      capabilityId: 'document:open',
      input: { source: WIRING_CARD_URI },
    });
    expect(opened).toMatchObject({ ok: true });

    const request = createDocumentViewBuildRequest('e2e-view', {
      source: WIRING_CARD_URI,
      documentId: CARD_ID,
      kind: 'card',
    });
    const endpoint = runtime.documentViewChannel;
    if (endpoint === undefined) {
      return;
    }
    const before = validateDocumentViewChannelResponse(await endpoint.handleRequest(SENDER.windowId, request));
    expect(isDocumentViewBuildResult(before)).toBe(true);

    runtime.ipc.handleWindowClosed(1);
    // 释放链为 fire-and-forget：轮询直至会话释放联动收口（超时即测试失败）。
    const startedAt = Date.now();
    for (;;) {
      const after = validateDocumentViewChannelResponse(
        await endpoint.handleRequest(SENDER.windowId, { ...request, requestId: `e2e-view-${String(startedAt)}` }),
      );
      if (isDocumentViewBuildFailure(after) && after.error.code === 'DOCUMENT_NOT_OPEN') {
        break;
      }
      if (Date.now() - startedAt > 2000) {
        throw new Error('会话释放联动未在预算时间内收口（缝②失效）');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await runtime.shutdown();
  });

  it('未注入装载（当前生产判据）：运行时端点为诚实拒绝臂，Bridge 路由与通道回包互不静默', async () => {
    const runtime = await startAssemblyRuntime(undefined);
    expect(runtime.documentViewChannel).toBeDefined();
    const endpoint = runtime.documentViewChannel;
    if (endpoint === undefined) {
      return;
    }
    const response = validateDocumentViewChannelResponse(
      await endpoint.handleRequest(
        SENDER.windowId,
        createDocumentViewBuildRequest('e2e-unwired', { source: WIRING_CARD_URI, documentId: CARD_ID, kind: 'card' }),
      ),
    );
    expect(isDocumentViewBuildFailure(response)).toBe(true);
    if (isDocumentViewBuildFailure(response)) {
      expect(response.error.code).toBe('BRIDGE_INTERNAL');
    }
    await runtime.shutdown();
  });
});
