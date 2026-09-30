/**
 * `cli.task.*` 轮询信封逐字段 E2E（工单039 波 3 交付 A 之「存储侧协议内可达路径」）。
 *
 * 口径：经 `@chips/cli` **包根公开出口**的 `createCarrierInvoker` +
 * `createServiceRouterClient`（`client/carrier/index.ts` 头注明示 e2e 可经此面接入），
 * 对端为契约独立实现桩进程（真 UDS/命名管道端点），逐字段锁定《07.12 §5.8》任务记录形状、
 * 封套 `routeId` 关联与《17》§5.3 定性收口。本套件不替代真宿主配对（R3/旗标臂另册），
 * 也不下探 CLI 内部实现。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  createCarrierInvoker,
  createServiceRouterClient,
  exitCodeForError,
  type ChipsError,
  type ICliClient,
  type ICliTaskRecord,
} from '@chips/cli';

import {
  cleanupCarrierDir,
  makeCarrierTempDir,
  readFrameLog,
  startStubHost,
  writeCommandsFile,
  type IStubHandle,
} from './support/carrier-harness';

const tempDirs: string[] = [];

function tempDir(kind: string): string {
  const dir = makeCarrierTempDir(kind);
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    cleanupCarrierDir(dir);
  }
});

/** 组一对公开面客户端 + 桩宿主。 */
async function paired(input: { readonly instanceId?: string } = {}): Promise<{
  readonly client: ICliClient;
  readonly stub: IStubHandle;
  readonly userdataRoot: string;
  readonly frameLog: string;
  readonly dispose: () => void;
}> {
  const dir = tempDir('pair');
  const frameLog = path.join(dir, 'frames.jsonl');
  const commandsFile = writeCommandsFile(dir, { index: {}, commands: [] });
  const userdataRoot = path.join(dir, 'Chips');
  const stub = await startStubHost({
    userdataRoot,
    commandsFile,
    frameLogFile: frameLog,
    ...(input.instanceId === undefined ? {} : { instanceId: input.instanceId }),
  });
  const invoker = createCarrierInvoker({ userdataRoot, env: {} });
  const client = createServiceRouterClient({ invoker });
  return { client, stub, userdataRoot, frameLog, dispose: () => invoker.dispose() };
}

describe('cli.task.* 全链信封逐字段（07.12 §5.8 记录形状）', () => {
  it('create → bindInvocation → progress → get → complete：running→completed 生命周期', async () => {
    const h = await paired();
    try {
      const created = await h.client.cliTask.create({
        pluginId: 'chips.demo.app',
        commandId: 'demo.job',
        commandPath: ['demo', 'job'],
      });
      expect(created).toMatchObject({
        pluginId: 'chips.demo.app',
        commandId: 'demo.job',
        commandPath: ['demo', 'job'],
        status: 'running',
      });
      expect(typeof created.taskId).toBe('string');
      expect(Number.isInteger(created.createdAt)).toBe(true);
      expect(Number.isInteger(created.updatedAt)).toBe(true);

      const bound = await h.client.cliTask.bindInvocation({
        taskId: created.taskId,
        invocationId: 'inv-fixed',
      });
      expect(bound.status).toBe('running');

      const progressed = await h.client.cliTask.progress(created.taskId, {
        phase: 'render',
        percent: 40,
      });
      expect(progressed).toMatchObject({
        status: 'running',
        progress: { phase: 'render', percent: 40 },
      });

      const fetched = await h.client.cliTask.get(created.taskId);
      expect(fetched.taskId).toBe(created.taskId);
      expect(fetched.progress).toMatchObject({ percent: 40 });

      const settled = await h.client.cliTask.complete(created.taskId, {
        message: 'ok',
        files: ['a.txt'],
      });
      expect(settled.status).toBe('completed');
      expect(settled.output).toEqual({ message: 'ok', files: ['a.txt'] });
      expect(settled.updatedAt).toBeGreaterThanOrEqual(settled.createdAt);

      // 帧面逐字段：每步都是独立封套（requestId 关联、capabilityId=routeId）。
      const capabilityIds = readFrameLog(h.frameLog)
        .filter((entry) => entry.direction === 'in' && 'capabilityId' in entry.frame)
        .map((entry) => entry.frame.capabilityId);
      expect(capabilityIds).toEqual([
        'cli.task.create',
        'cli.task.bindInvocation',
        'cli.task.progress',
        'cli.task.get',
        'cli.task.complete',
      ]);
      // 一个会话贯穿全链（§3.6 一次调用一连接：本进程只建连一次）。
      const handshakes = readFrameLog(h.frameLog).filter(
        (entry) => entry.direction === 'in' && 'clientId' in entry.frame
      );
      expect(handshakes).toHaveLength(1);
    } finally {
      h.dispose();
      await h.stub.stop();
    }
  });

  it('fail / cancel 终态臂：error 规范化与 cancelled 收口', async () => {
    const h = await paired();
    try {
      const task = await h.client.cliTask.create({
        pluginId: 'chips.demo.app',
        commandId: 'demo.failing',
      });
      const failed = await h.client.cliTask.fail(task.taskId, {
        code: 'PLUGIN_CRASH',
        message: '应用侧崩溃',
        retryable: true,
      });
      expect(failed.status).toBe('failed');
      expect(failed.error).toMatchObject({ code: 'PLUGIN_CRASH', message: '应用侧崩溃' });

      const cancellable = await h.client.cliTask.create({
        pluginId: 'chips.demo.app',
        commandId: 'demo.long',
      });
      const cancelled = await h.client.cliTask.cancel(cancellable.taskId);
      expect(cancelled.status).toBe('cancelled');

      const active = await h.client.cliTask.active('demo.job');
      expect(active).toBeUndefined();
    } finally {
      h.dispose();
      await h.stub.stop();
    }
  });

  it('未知任务 → CLI_TASK_NOT_FOUND；未在册 routeId → route_unregistered / 6（§5.3 防御面）', async () => {
    const h = await paired();
    try {
      const notFound = (await h.client.cliTask
        .get('task-does-not-exist')
        .catch((error: unknown) => error)) as ChipsError;
      expect(notFound.code).toBe('CLI_TASK_NOT_FOUND');

      // 未在册 routeId 的防御面只能经会话端口直打（`ICliClient` 端口本身零新增）。
      const invoker = createCarrierInvoker({ userdataRoot: h.userdataRoot, env: {} });
      const probe = (await invoker
        .request('cli.task.nonexistent', {})
        .catch((error: unknown) => error)) as ChipsError;
      invoker.dispose();
      expect(probe.code).toBe('CLI_TARGET_UNAVAILABLE');
      expect(probe.details).toMatchObject({ reason: 'route_unregistered' });
      expect(exitCodeForError(probe)).toBe(6);
    } finally {
      h.dispose();
      await h.stub.stop();
    }
  });

  it('发现记录六字段与握手 instanceId 一致性（§2.4/§3.2 真端点回写）', async () => {
    const h = await paired({ instanceId: 'inst-envelope-check' });
    try {
      const raw = JSON.parse(readFileSync(h.stub.discoveryFile, 'utf8')) as Record<string, unknown>;
      expect(Object.keys(raw).sort()).toEqual(
        ['bearerToken', 'instanceId', 'pid', 'protocol', 'socketPath', 'startedAt'].sort()
      );
      expect(raw.protocol).toBe('chips-cli-carrier/1');
      expect(raw.instanceId).toBe('inst-envelope-check');
      expect(raw.pid).toBe(h.stub.pid);
      expect(typeof raw.bearerToken).toBe('string');
      expect((raw.bearerToken as string).length ?? 0).toBe(64);
      expect(Number.isInteger(raw.startedAt)).toBe(true);

      const task: ICliTaskRecord = await h.client.cliTask.create({
        pluginId: 'chips.demo',
        commandId: 'demo.x',
      });
      expect(task.status).toBe('running');
    } finally {
      h.dispose();
      await h.stub.stop();
    }
  });
});
