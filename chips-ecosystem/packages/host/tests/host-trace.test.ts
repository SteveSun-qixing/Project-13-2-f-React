/**
 * 宿主调试追踪导出面单测（工单041 修复波 / 任务 #135）。
 *
 * 权威：《调试指南》§2.1–§2.3（通道落位、开关门控、公共字段）、§2.4（异步追加）、
 * §5.1–§5.2（主进程适配层 Bridge 追踪字段与 `durationMs` 口径）、§8.2（`startup`
 * 里程碑）；`@chips/perf` 在册标记点命名（`tests/perf/src/scenarios.ts` `MARKERS`）。
 *
 * @remarks
 * - 落盘用例走 `node:fs` 真实临时目录（`mkdtemp`），断言 JSONL 行内容逐字段核验；
 *   故障隔离用例以不可写路径（文件冒充目录）坐实「永不抛错 + droppedCount + onFault」。
 * - 单例面逐用例 `resetHostTrace()` 隔离；文档服务插桩用例复用
 *   `tests/helpers/document-fake-ports.ts` 内存夹具（打开链路真实建立记录）。
 */

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createHostTrace,
  HOST_TRACE_CATEGORIES,
  hostTraceFileName,
  initHostTrace,
  getHostTrace,
  resetHostTrace,
  resolveHostTraceCategories,
  shutdownHostTrace,
  type HostTraceCategory,
} from '../src/shared/host-trace.js';
import { DOCUMENT_OPEN_TRACE_PHASES, createDocumentService } from '../src/capabilities/document/service.js';
import { registerIpcChannels } from '../src/main/ipc-channels.js';
import { BRIDGE_REQUEST_CHANNEL } from '../src/protocol/channels.js';
import type { IBridgeRequest, IBridgeResponse } from '../src/protocol/wire.js';
import type { IPlatformRuntime } from '../src/runtime/contracts.js';
import type { ShellIpcInvokeEvent, ShellIpcMain } from '../src/main/shell-api.js';
import { createHarness, ctxFor, SESSION_A } from './helpers/document-fake-ports.js';

/** 建临时目录并登记清理。 */
const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'chips-host-trace-'));
  tempDirs.push(dir);
  return dir;
}

/** 读取追踪文件全部 JSON 行。 */
async function readTraceLines(userDataPath: string, dateIso?: string): Promise<unknown[]> {
  const name = dateIso === undefined ? hostTraceFileName(new Date().toISOString()) : hostTraceFileName(dateIso);
  const text = await readFile(join(userDataPath, 'logs', 'trace', name), 'utf8');
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

afterEach(async () => {
  resetHostTrace();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe('resolveHostTraceCategories（§2.2 开关语义）', () => {
  it('CHIPS_TRACE 缺位：开发构建默认除 resource 外全部类别', () => {
    const categories = resolveHostTraceCategories({}, false);
    expect([...categories].sort()).toEqual(['bridge', 'event', 'plugin', 'render', 'startup']);
    expect(categories.has('resource')).toBe(false);
  });

  it('CHIPS_TRACE 缺位：发布构建默认全关', () => {
    expect(resolveHostTraceCategories({}, true).size).toBe(0);
  });

  it('显式逗号组合逐字生效（含 resource），空白与非法 token 忽略并回调留痕', () => {
    const ignored: string[] = [];
    const categories = resolveHostTraceCategories({ CHIPS_TRACE: ' render ,bridge,vpn,' }, false, (t) =>
      ignored.push(t),
    );
    expect([...categories].sort()).toEqual(['bridge', 'render']);
    expect(ignored).toEqual(['vpn']);
  });

  it('显式空串 = 全关（与缺位的开发默认区分）', () => {
    expect(resolveHostTraceCategories({ CHIPS_TRACE: '' }, false).size).toBe(0);
  });
});

describe('hostTraceFileName（§2.1 按日切分，UTC 日期）', () => {
  it('取 ISO 时间戳日期段命名 jsonl 文件', () => {
    expect(hostTraceFileName('2026-09-19T10:20:31.480Z')).toBe('trace-2026-09-19.jsonl');
  });
});

describe('createHostTrace（JSONL 落盘 / 门控 / 故障隔离 / 收口）', () => {
  function traceFor(
    userDataPath: string,
    categories: HostTraceCategory[],
  ): { faults: string[]; trace: ReturnType<typeof createHostTrace> } {
    const faults: string[] = [];
    return {
      faults,
      trace: createHostTrace({
        userDataPath,
        categories: new Set(categories),
        onFault: (message, reason) => faults.push(`${message}|${reason}`),
      }),
    };
  }

  it('启用类别记录逐行落盘：§2.3 公共字段全量成对呈现（缺位为 null），按调用序保序', async () => {
    const userDataPath = await makeTempDir();
    const { trace } = traceFor(userDataPath, ['bridge', 'render']);
    expect(trace.enabled('bridge')).toBe(true);
    expect(trace.enabled('startup')).toBe(false);
    trace.record({
      category: 'render',
      phase: 'document:parsed',
      traceId: 't-1',
      sessionId: SESSION_A,
      durationMs: 12.5,
    });
    trace.record({
      category: 'bridge',
      phase: 'execute',
      requestId: 'r-1',
      channel: BRIDGE_REQUEST_CHANNEL,
      direction: 'in',
      capabilityId: 'document:open',
      outcome: 'ok',
      durationMs: 20,
      windowId: 3,
    });
    // 未启用类别静默丢弃。
    trace.record({ category: 'startup', phase: 'startup:process-start' });
    await trace.flush();
    const lines = (await readTraceLines(userDataPath)) as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(2);
    const [first, second] = lines as [Record<string, unknown>, Record<string, unknown>];
    expect(first['category']).toBe('render');
    expect(first['phase']).toBe('document:parsed');
    expect(first['traceId']).toBe('t-1');
    expect(first['sessionId']).toBe(SESSION_A);
    expect(first['durationMs']).toBe(12.5);
    expect(first['errorCode']).toBeNull();
    expect(first['message']).toBeNull();
    expect(second['requestId']).toBe('r-1');
    expect(second['capabilityId']).toBe('document:open');
    expect(second['outcome']).toBe('ok');
    expect(second['windowId']).toBe(3);
    // 每行均含全部公共字段键（在册全量形状）。
    for (const key of [
      'timestamp',
      'category',
      'traceId',
      'pluginId',
      'pluginVersion',
      'sessionId',
      'windowId',
      'phase',
      'outcome',
      'errorCode',
      'durationMs',
      'details',
    ]) {
      expect(second).toHaveProperty(key);
    }
    expect(trace.writtenCount()).toBe(2);
    expect(trace.droppedCount()).toBe(0);
  });

  it('timestampOverride 按事实时刻回填启动里程碑（异步写出不错位日期文件）', async () => {
    const userDataPath = await makeTempDir();
    const { trace } = traceFor(userDataPath, ['startup']);
    trace.record({
      category: 'startup',
      phase: 'startup:process-start',
      timestampOverride: '2026-01-02T03:04:05.678Z',
    });
    await trace.flush();
    const lines = (await readTraceLines(userDataPath, '2026-01-02T00:00:00.000Z')) as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.['timestamp']).toBe('2026-01-02T03:04:05.678Z');
  });

  it('写盘故障永不抛错：droppedCount 计数、onFault 留痕、调用方链路不中断', async () => {
    const userDataPath = await makeTempDir();
    // 以普通文件冒充 logs 目录 → mkdir/append 必败。
    await writeFile(join(userDataPath, 'logs'), 'not-a-dir', 'utf8');
    const { trace, faults } = traceFor(userDataPath, ['render']);
    expect(() => trace.record({ category: 'render', phase: 'x' })).not.toThrow();
    await trace.flush();
    expect(trace.writtenCount()).toBe(0);
    expect(trace.droppedCount()).toBe(1);
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('调试追踪写入失败');
  });

  it('close 后 record 静默、flush 等待在途写入；重复 close 幂等', async () => {
    const userDataPath = await makeTempDir();
    const { trace } = traceFor(userDataPath, ['render']);
    await trace.close();
    trace.record({ category: 'render', phase: 'late' });
    await trace.flush();
    await trace.close();
    const fileName = join(userDataPath, 'logs', 'trace', hostTraceFileName(new Date().toISOString()));
    await expect(readFile(fileName, 'utf8')).rejects.toThrow();
  });

  it('newTraceId 逐次唯一（操作级 ID，§2.5）', async () => {
    const userDataPath = await makeTempDir();
    const { trace } = traceFor(userDataPath, []);
    const ids = new Set(Array.from({ length: 50 }, () => trace.newTraceId()));
    expect(ids.size).toBe(50);
  });
});

describe('进程级单例（initHostTrace / getHostTrace / shutdownHostTrace）', () => {
  it('未初始化恒关臂：record 零副作用；init 后共享同一实例；shutdown 复位', async () => {
    expect(getHostTrace().enabled('render')).toBe(false);
    expect(() => getHostTrace().record({ category: 'render', phase: 'x' })).not.toThrow();
    const userDataPath = await makeTempDir();
    const trace = initHostTrace({ userDataPath, categories: new Set<HostTraceCategory>(['render']) });
    expect(getHostTrace()).toBe(trace);
    trace.record({ category: 'render', phase: 'marker' });
    await shutdownHostTrace();
    expect(getHostTrace().enabled('render')).toBe(false);
    const lines = await readTraceLines(userDataPath);
    expect(lines).toHaveLength(1);
  });
});

describe('document:open 阶段导出（service.executeOpen 插桩）', () => {
  it('render 类别启用：request-accepted 与 document-parsed 同 traceId 落行，durationMs 承载前置分段', async () => {
    const userDataPath = await makeTempDir();
    initHostTrace({ userDataPath, categories: new Set<HostTraceCategory>(['render']) });
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const opened = await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    const trace = getHostTrace();
    await trace.flush();
    const lines = (await readTraceLines(userDataPath)) as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(2);
    const [accepted, parsed] = lines as [Record<string, unknown>, Record<string, unknown>];
    expect(accepted['phase']).toBe(DOCUMENT_OPEN_TRACE_PHASES.requestAccepted);
    expect(parsed['phase']).toBe(DOCUMENT_OPEN_TRACE_PHASES.documentParsed);
    expect(accepted['traceId']).toBe(parsed['traceId']);
    expect(typeof accepted['traceId']).toBe('string');
    expect(accepted['sessionId']).toBe(SESSION_A);
    expect(accepted['outcome']).toBe('ok');
    expect(typeof accepted['durationMs']).toBe('number');
    expect((accepted['durationMs'] as number) >= 0).toBe(true);
    expect(parsed['details']).toMatchObject({ documentId: opened.documentId });
    expect(accepted['details']).toMatchObject({ capabilityId: 'document:open' });
  });

  it('单例未初始化（恒关臂）：executeOpen 行为逐字不变、零落盘', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const opened = await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    expect(opened.kind).toBe('card');
    expect(getHostTrace().writtenCount()).toBe(0);
  });
});

describe('Bridge 执行记录（ipc-channels 主进程适配层，§5.1/§5.2）', () => {
  interface RegisteredHandler {
    (event: ShellIpcInvokeEvent, ...args: readonly unknown[]): Promise<IBridgeResponse>;
  }

  function wireIpc(handleRequest: () => Promise<IBridgeResponse>): {
    readonly handler: RegisteredHandler;
    readonly unregister: () => void;
  } {
    const handlers = new Map<string, RegisteredHandler>();
    const runtime = {
      ipc: { handleRequest },
    } as unknown as IPlatformRuntime;
    const ipcMain = {
      handle: (channel: string, listener: RegisteredHandler): void => {
        handlers.set(channel, listener);
      },
      removeHandler: (channel: string): void => {
        handlers.delete(channel);
      },
    } satisfies ShellIpcMain;
    const unregister = registerIpcChannels({
      ipcMain,
      runtime,
      isWindowAlive: () => true,
      diagnostics: { warn: () => undefined, error: () => undefined },
    });
    const handler = handlers.get(BRIDGE_REQUEST_CHANNEL);
    if (handler === undefined) {
      throw new Error('bridge:request 通道未注册');
    }
    return { handler, unregister };
  }

  const fakeEvent = { sender: { id: 7 }, senderFrame: { routingId: 11 } } as unknown as ShellIpcInvokeEvent;
  const request: IBridgeRequest = { requestId: 'r-trace-1', capabilityId: 'document:open', input: {} };

  it('成功调用：phase=execute、outcome=ok、durationMs 为收到请求到返回结果的包裹段', async () => {
    const userDataPath = await makeTempDir();
    initHostTrace({ userDataPath, categories: new Set<HostTraceCategory>(['bridge']) });
    const { handler, unregister } = wireIpc(() =>
      Promise.resolve({ requestId: 'r-trace-1', ok: true, result: { ping: 1 } }),
    );
    const response = await handler(fakeEvent, request);
    expect(response.ok).toBe(true);
    await getHostTrace().flush();
    unregister();
    const lines = (await readTraceLines(userDataPath)) as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(1);
    const record = lines[0] as Record<string, unknown>;
    expect(record['category']).toBe('bridge');
    expect(record['phase']).toBe('execute');
    expect(record['outcome']).toBe('ok');
    expect(record['requestId']).toBe('r-trace-1');
    expect(record['capabilityId']).toBe('document:open');
    expect(record['channel']).toBe(BRIDGE_REQUEST_CHANNEL);
    expect(record['direction']).toBe('in');
    expect(record['windowId']).toBe(7);
    expect(typeof record['durationMs']).toBe('number');
  });

  it('失败调用：errorCode/retryable 与错误同源落行', async () => {
    const userDataPath = await makeTempDir();
    initHostTrace({ userDataPath, categories: new Set<HostTraceCategory>(['bridge']) });
    const { handler } = wireIpc(() =>
      Promise.resolve({
        requestId: 'r-trace-1',
        ok: false,
        error: { code: 'BRIDGE_TIMEOUT', message: '调用超时', retryable: true },
      }),
    );
    await handler(fakeEvent, request);
    await getHostTrace().flush();
    const lines = (await readTraceLines(userDataPath)) as Array<Record<string, unknown>>;
    const record = lines[0] as Record<string, unknown>;
    expect(record['outcome']).toBe('error');
    expect(record['errorCode']).toBe('BRIDGE_TIMEOUT');
    expect(record['retryable']).toBe(true);
  });

  it('bridge 类别未启用：零落盘且响应链路不受影响', async () => {
    const userDataPath = await makeTempDir();
    initHostTrace({ userDataPath, categories: new Set<HostTraceCategory>(['render']) });
    const { handler } = wireIpc(() => Promise.resolve({ requestId: 'r-trace-1', ok: true, result: null }));
    const response = await handler(fakeEvent, request);
    expect(response.ok).toBe(true);
    await getHostTrace().flush();
    const fileName = join(userDataPath, 'logs', 'trace', hostTraceFileName(new Date().toISOString()));
    await expect(readFile(fileName, 'utf8')).rejects.toThrow();
  });

  it('全部在册类别常量与文件命名一致（§2.1 目录段 logs/trace）', async () => {
    const userDataPath = await makeTempDir();
    const traceDir = join(userDataPath, 'logs', 'trace');
    await mkdir(traceDir, { recursive: true });
    initHostTrace({ userDataPath, categories: new Set<HostTraceCategory>([...HOST_TRACE_CATEGORIES]) });
    for (const category of HOST_TRACE_CATEGORIES) {
      getHostTrace().record({ category, phase: `probe:${category}` });
    }
    await getHostTrace().flush();
    const lines = await readTraceLines(userDataPath);
    expect(lines).toHaveLength(HOST_TRACE_CATEGORIES.length);
  });
});
