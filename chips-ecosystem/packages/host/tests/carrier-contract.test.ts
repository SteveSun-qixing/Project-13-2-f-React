/**
 * 承载链路宿主侧契约测试锁（《17-CLI承载链路契约》波 1 交付面 5）。
 *
 * 锁定：host↔bridge 双侧端点派生一致（同一 `deriveCarrierEndpoints` 实现 vs Node
 * `crypto`/`path` 独立计算的冻结向量）、`details.reason` 封闭词表使用面、封套序列化形状、
 * 发现文件原子写/权限位/双判据、任务存储唯一实现语义、发现索引四事件重建。
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  CARRIER_DISCOVERY_FILE_NAME,
  CARRIER_HANDSHAKE_REASON_VALUES,
  CARRIER_PROTOCOL,
  deriveCarrierEndpoints,
} from '@chips/bridge';
import { afterEach, describe, expect, it } from 'vitest';

import { createCliCommandIndex, type ICarrierPluginView } from '../src/carrier/command-index.js';
import type { ICarrierRouteTable } from '../src/carrier/routes.js';
import type { ICliTaskStore } from '../src/carrier/task-store.js';
import type { ICarrierCallContext } from '../src/carrier/types.js';
import {
  buildDiscoveryRecord,
  judgeDiscoveryStaleness,
  readDiscoveryRecord,
  writeDiscoveryRecordTo,
  generateBearerToken,
  type IPidProbe,
} from '../src/carrier/discovery.js';
import { createCarrierRouteTable } from '../src/carrier/routes.js';
import { createCliTaskStore } from '../src/carrier/task-store.js';
import {
  CARRIER_ROUTE_IDS,
  carrierReasonError,
  carrierServiceError,
  CLI_INDEX_REBUILD_EVENTS,
} from '../src/carrier/types.js';
import { createCarrierService } from '../src/carrier/index.js';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'chips-carrier-lock-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('host↔bridge 端点派生单一事实源锁（《17》§2.2–§2.3/§6.1-1）', () => {
  const nodeHash16 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);

  it('POSIX 常规根：与 Node `path.join` 独立计算逐字节一致', () => {
    const root = makeTempRoot();
    const endpoints = deriveCarrierEndpoints(root);
    expect(endpoints.discoveryFile).toBe(path.join(root, CARRIER_DISCOVERY_FILE_NAME));
    expect(endpoints.socketPath).toBe(path.join(root, 'chips-carrier.sock'));
    expect(endpoints.userdataRoot).toBe(root);
  });

  it('深根缩短形态：与 node:crypto 散列独立计算逐字节一致', () => {
    const deepRoot = path.join(makeTempRoot(), ...Array.from({ length: 12 }, (_v, i) => `nested-dir-${String(i)}`));
    const endpoints = deriveCarrierEndpoints(deepRoot);
    const standard = path.join(deepRoot, 'chips-carrier.sock');
    if (Buffer.byteLength(standard, 'utf8') > 104) {
      expect(endpoints.socketPath).toBe(path.join(deepRoot, `chips-c-${nodeHash16(deepRoot)}.sock`));
    }
    // 发现文件永不随 socket 缩短变化（§2.2 落点表）。
    expect(endpoints.discoveryFile).toBe(path.join(deepRoot, CARRIER_DISCOVERY_FILE_NAME));
  });

  it('确定性：同输入两次调用字节级同输出（JSON 序列化逐字）', () => {
    const root = makeTempRoot();
    expect(JSON.stringify(deriveCarrierEndpoints(root))).toBe(JSON.stringify(deriveCarrierEndpoints(root)));
  });
});

describe('reason 封闭词表与错误封套形状锁（《17》§5.3、§3.4）', () => {
  it('carrierReasonError：码恒为 CLI_TARGET_UNAVAILABLE、details.reason 落在词表内', () => {
    for (const reason of CARRIER_HANDSHAKE_REASON_VALUES) {
      const error = carrierReasonError(reason);
      expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
      expect((error.details as { reason: string }).reason).toBe(reason);
    }
    expect(CARRIER_HANDSHAKE_REASON_VALUES).toHaveLength(6);
  });

  it('§2.5 消费视图码值逐字（零新码族）', () => {
    const notFound = carrierServiceError('CLI_TASK_NOT_FOUND');
    expect(notFound.code).toBe('CLI_TASK_NOT_FOUND');
    expect(notFound.message).toBe('任务不存在');
    expect(notFound.retryable).toBe(false);
    const roundTrip = JSON.parse(JSON.stringify({ error: notFound })) as {
      error: { code: string; message: string; retryable: boolean };
    };
    expect(roundTrip.error).toEqual({
      code: 'CLI_TASK_NOT_FOUND',
      message: '任务不存在',
      retryable: false,
    });
    expect(carrierServiceError('CLI_COMMAND_QUERY_INVALID', { field: 'entryId' }).details as object).toEqual({
      field: 'entryId',
    });
  });

  it('在册路由集合逐字冻结（§5.1 全集 11 项，不扩充不别名）', () => {
    expect([...CARRIER_ROUTE_IDS].sort()).toEqual(
      [
        'cli.command.get',
        'cli.command.list',
        'cli.command.resolve',
        'cli.task.bindInvocation',
        'cli.task.cancel',
        'cli.task.complete',
        'cli.task.create',
        'cli.task.fail',
        'cli.task.get',
        'cli.task.progress',
        'command:invoke',
      ].sort(),
    );
  });
});

describe('发现文件：原子写、权限位、严格读回与双判据（《17》§2.4–§2.5）', () => {
  it('原子写落盘为 0600、目录 0700，tmp 文件不残留，读回逐字一致', () => {
    const root = makeTempRoot();
    const file = deriveCarrierEndpoints(root).discoveryFile;
    const record = buildDiscoveryRecord({
      instanceId: 'inst-1',
      socketPath: path.join(root, 'chips-carrier.sock'),
      pid: process.pid,
      startedAt: 1700000000000,
      bearerToken: generateBearerToken(),
    });
    writeDiscoveryRecordTo(file, record);
    expect(readDiscoveryRecord(file)).toEqual(record);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(root).mode & 0o777).toBe(0o700);
    expect(existsSync(`${file}.tmp-inst-1`)).toBe(false);
    expect(record.protocol).toBe(CARRIER_PROTOCOL);
  });

  it('未知字段拒绝、类型不符视同无效（§2.4 严格形状）', () => {
    const root = makeTempRoot();
    const file = path.join(root, CARRIER_DISCOVERY_FILE_NAME);
    writeFileSync(file, JSON.stringify({ protocol: 'p', extra: 1 }), { mode: 0o600 });
    expect(readDiscoveryRecord(file)).toBeNull();
  });

  it('token 形状：CSPRNG 64 位小写 hex、两次生成不同值', () => {
    const a = generateBearerToken();
    const b = generateBearerToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  const probe = (alive: boolean, createdAt: number | null): IPidProbe => ({
    pidAlive: () => alive,
    processCreatedAt: () => createdAt,
  });

  it('双判据①：PID 不存在 → pid_dead 陈旧', () => {
    const record = buildDiscoveryRecord({
      instanceId: 'i',
      socketPath: '/x',
      pid: 4242,
      startedAt: 100,
      bearerToken: 't',
    });
    expect(judgeDiscoveryStaleness(record, probe(false, null))).toEqual({
      stale: true,
      reason: 'pid_dead',
    });
  });

  it('双判据②：PID 假活但创建时间晚于 startedAt → pid_recycled 陈旧', () => {
    const record = buildDiscoveryRecord({
      instanceId: 'i',
      socketPath: '/x',
      pid: 4242,
      startedAt: 100,
      bearerToken: 't',
    });
    expect(judgeDiscoveryStaleness(record, probe(true, 200))).toEqual({
      stale: true,
      reason: 'pid_recycled',
    });
  });

  it('探测不可得（创建时间 null）→ 保守判不陈旧（§2.5-3 宁可不删）', () => {
    const record = buildDiscoveryRecord({
      instanceId: 'i',
      socketPath: '/x',
      pid: 4242,
      startedAt: 100,
      bearerToken: 't',
    });
    expect(judgeDiscoveryStaleness(record, probe(true, null))).toEqual({ stale: false });
  });
});

describe('cli-task 唯一存储语义（《07》§5.6，经路由表封套透出）', () => {
  interface ITaskTable {
    tasks: ICliTaskStore;
    routes: ICarrierRouteTable;
    context: ICarrierCallContext;
  }
  const table = (): ITaskTable => {
    const diagnostics = { debug(): void {}, info(): void {}, warn(): void {}, error(): void {} };
    const tasks = createCliTaskStore({ now: () => 1700000000000 });
    const index = createCliCommandIndex({ plugins: () => [], diagnostics });
    return {
      tasks,
      routes: createCarrierRouteTable({ index, tasks, diagnostics }),
      context: {
        sessionId: 'session:carrier:t#1',
        clientId: 'cli-1',
        signal: new AbortController().signal,
      },
    };
  };

  it('同一 (pluginId, commandId) 双 running → CLI_TASK_INVALID；终态后重开合法', async () => {
    const { routes, context } = table();
    const created = await routes.dispatch(
      {
        requestId: 'r1',
        capabilityId: 'cli.task.create',
        input: { pluginId: 'com.test.a', commandId: 'a.run' },
      },
      context,
    );
    expect(created.ok).toBe(true);
    const duplicated = await routes.dispatch(
      {
        requestId: 'r2',
        capabilityId: 'cli.task.create',
        input: { pluginId: 'com.test.a', commandId: 'a.run' },
      },
      context,
    );
    expect(duplicated.ok).toBe(false);
    if (!duplicated.ok) {
      expect(duplicated.error.code).toBe('CLI_TASK_INVALID');
    }
    if (created.ok) {
      const taskId = (created.result as { task: { taskId: string } }).task.taskId;
      const completed = await routes.dispatch(
        {
          requestId: 'r3',
          capabilityId: 'cli.task.complete',
          input: { taskId, output: { done: true } },
        },
        context,
      );
      expect(completed.ok).toBe(true);
      const reopened = await routes.dispatch(
        {
          requestId: 'r4',
          capabilityId: 'cli.task.create',
          input: { pluginId: 'com.test.a', commandId: 'a.run' },
        },
        context,
      );
      expect(reopened.ok).toBe(true);
    }
  });

  it('终态不可逆：completed 后 progress → CLI_TASK_INVALID', async () => {
    const { routes, tasks, context } = table();
    const task = tasks.create({ pluginId: 'com.test.b', commandId: 'b.run' });
    tasks.complete(task.taskId, null);
    const rejected = await routes.dispatch(
      {
        requestId: 'r9',
        capabilityId: 'cli.task.progress',
        input: { taskId: task.taskId, progress: { step: 1 } },
      },
      context,
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('CLI_TASK_INVALID');
    }
  });

  it('fail 缺省归一 CLI_TASK_FAILED；非在册 routeId → reason=route_unregistered', async () => {
    const { routes, tasks, context } = table();
    const task = tasks.create({ pluginId: 'com.test.c', commandId: 'c.run' });
    const failed = await routes.dispatch(
      {
        requestId: 'r10',
        capabilityId: 'cli.task.fail',
        input: { taskId: task.taskId, error: '出错了' },
      },
      context,
    );
    expect(failed.ok).toBe(true);
    if (failed.ok) {
      const record = (failed.result as { task: { error?: { code: string; message: string } } }).task;
      expect(record.error?.code).toBe('CLI_TASK_FAILED');
      expect(record.error?.message).toBe('出错了');
    }
    const unknown = await routes.dispatch(
      { requestId: 'r11', capabilityId: 'cli.command.unknown', input: {} },
      context,
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.code).toBe('CLI_TARGET_UNAVAILABLE');
      expect(unknown.error.details).toEqual({
        reason: 'route_unregistered',
        routeId: 'cli.command.unknown',
      });
    }
  });
});

describe('发现索引与四事件重建（《17》§5.8 + 波 1 派单）', () => {
  function writePluginManifest(root: string, pluginId: string, commandPath: string[]): void {
    const dir = path.join(root, pluginId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'manifest.yaml'),
      [
        'id: ' + pluginId,
        'version: 1.0.0',
        'cli:',
        '  commands:',
        `    - commandPath: [${commandPath.map((segment) => `'${segment}'`).join(', ')}]`,
        '      commandId: cmd-' + pluginId.replace(/[^a-z]/gi, ''),
        '      target: service',
        '',
      ].join('\n'),
    );
  }

  it('list/get/resolve：entryId 形状、冲突不自动选择、坏查询 CLI_COMMAND_QUERY_INVALID', async () => {
    const thrownCode = (run: () => unknown): string | undefined => {
      try {
        run();
        return undefined;
      } catch (error: unknown) {
        return (error as { code?: string }).code;
      }
    };
    const root = makeTempRoot();
    writePluginManifest(root, 'com.test.alpha', ['view', 'open']);
    writePluginManifest(root, 'com.test.beta', ['view', 'open']);
    const plugins = (): readonly ICarrierPluginView[] => [
      {
        pluginId: 'com.test.alpha',
        role: 'plugin',
        state: 'active',
        path: path.join(root, 'com.test.alpha'),
        enabled: true,
      },
      {
        pluginId: 'com.test.beta',
        role: 'plugin',
        state: 'active',
        path: path.join(root, 'com.test.beta'),
        enabled: true,
      },
    ];
    const diagnostics = { debug(): void {}, info(): void {}, warn(): void {}, error(): void {} };
    const index = createCliCommandIndex({ plugins, diagnostics });
    await index.rebuild();
    const listed = index.list({ commandPath: ['view', 'open'] });
    expect(listed.commands).toHaveLength(2);
    expect(listed.commands[0]?.entryId).toBe('com.test.alpha.cli.view.open');
    expect(listed.index['view open']).toEqual(['com.test.alpha.cli.view.open', 'com.test.beta.cli.view.open']);
    expect(thrownCode(() => index.get({ commandPath: ['view', 'open'] }))).toBe('CLI_COMMAND_CONFLICT');
    const resolved = index.resolve({ commandPath: ['view', 'open'] });
    expect(resolved.command).toBeUndefined();
    expect(resolved.conflicts).toHaveLength(2);
    const single = index.get({ entryId: 'com.test.beta.cli.view.open' });
    expect(single.owner).toBe('com.test.beta');
    expect(thrownCode(() => index.get({ commandPath: 42 as unknown as string }))).toBe('CLI_COMMAND_QUERY_INVALID');
  });

  it('carrier 服务 handlePluginEvent：四事件在册、其余事件不触发重建', async () => {
    expect([...CLI_INDEX_REBUILD_EVENTS].sort()).toEqual(
      ['plugin:disabled', 'plugin:enabled', 'plugin:installed', 'plugin:uninstalled'].sort(),
    );
    const root = makeTempRoot();
    const diagnostics = { debug(): void {}, info(): void {}, warn(): void {}, error(): void {} };
    let installed = 0;
    const service = createCarrierService({
      userDataPath: root,
      hostVersion: '9.9.9-test',
      diagnostics,
      sessions: {
        open: (input: { carrierId: string; clientId: string }): { sessionId: string; signal: AbortSignal } => ({
          sessionId: `session:carrier:${input.carrierId}`,
          signal: new AbortController().signal,
        }),
        close: (): void => {},
      },
      plugins: () => {
        if (installed === 0) {
          return [];
        }
        const pluginId = 'com.test.gamma';
        return [
          {
            pluginId,
            role: 'plugin',
            state: 'active',
            path: path.join(root, pluginId),
            enabled: true,
          },
        ];
      },
    });
    expect(service.report().indexEntries).toBe(0);
    // 非重建事件：即使插件已落盘也不重建。
    writePluginManifest(root, 'com.test.gamma', ['gamma', 'ping']);
    installed = 1;
    service.handlePluginEvent('plugin:activated');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(service.report().indexEntries).toBe(0);
    // 重建事件：尾部合并后条目出现。
    service.handlePluginEvent('plugin:enabled');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(service.report().indexEntries).toBe(1);
    expect(service.endpoints.discoveryFile).toBe(path.join(root, CARRIER_DISCOVERY_FILE_NAME));
    expect(service.instanceId).toMatch(/[0-9a-f-]{36}/);
  });
});
