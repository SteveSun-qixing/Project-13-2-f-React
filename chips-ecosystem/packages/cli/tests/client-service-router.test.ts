/**
 * `cli-command` / `cli-task` 对接层（[CLI 完整参考] §1.4、§5.6、§5.8、§2.5）：
 * 端口方法 → 服务路由 ID 与入参映射、返回结构校验的错误码、缺承载适配器时的
 * `CLI_TARGET_UNAVAILABLE`（不虚构协议、不静默降级）。
 */

import { describe, expect, it } from 'vitest';

import type {
  ICliClient,
  ICliCommandView,
  ICliInvoker,
  ICliPlatformOperations,
} from '../src/client/types.js';
import { createServiceRouterClient } from '../src/client/service-router.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

const COMMAND_VIEW: ICliCommandView = {
  entryId: 'chips.demo.app#open',
  commandPath: ['demo', 'open'],
  commandId: 'demo.open',
  pluginId: 'chips.demo.app',
  enabled: true,
  declaration: {
    commandPath: ['demo', 'open'],
    title: '打开示例',
    target: { type: 'app', pluginId: 'chips.demo.app' },
  },
  conflicts: [],
};

const TASK = { taskId: 'task-1', pluginId: 'chips.demo.app', commandId: 'demo.open', status: 'running', createdAt: 1, updatedAt: 2 };

/** 记录调用与预置返回的传输端口替身。 */
class RecordingInvoker implements ICliInvoker {
  public readonly records: { id: string; input: unknown }[] = [];

  private readonly responses = new Map<string, unknown>();

  public constructor(responses: Record<string, unknown> = {}) {
    for (const [id, value] of Object.entries(responses)) {
      this.responses.set(id, value);
    }
  }

  public request<TOutput = unknown>(id: string, input?: unknown): Promise<TOutput> {
    this.records.push({ id, input });
    if (!this.responses.has(id)) {
      return Promise.reject(new Error(`未预置的路由：${id}`));
    }
    return Promise.resolve(this.responses.get(id) as TOutput);
  }

  public last(id: string): { id: string; input: unknown } | undefined {
    return [...this.records].reverse().find((record) => record.id === id);
  }
}

function expectCode(promise: Promise<unknown>, code: string): Promise<unknown> {
  return expect(promise).rejects.toMatchObject({ code });
}

describe('cli.command.* 路由映射（§5.6、§5.8）', () => {
  it('list 缺省查询以空对象请求并原样返回索引与条目', async () => {
    const invoker = new RecordingInvoker({
      'cli.command.list': { index: { 'demo open': ['chips.demo.app#open'] }, commands: [COMMAND_VIEW] },
    });
    const client = createServiceRouterClient({ invoker });
    const result = await client.cliCommand.list();
    expect(invoker.records).toEqual([{ id: 'cli.command.list', input: {} }]);
    expect(result.commands).toEqual([COMMAND_VIEW]);
    expect(result.index).toEqual({ 'demo open': ['chips.demo.app#open'] });
  });

  it('list 透传查询对象并把非对象索引归一为空对象', async () => {
    const invoker = new RecordingInvoker({ 'cli.command.list': { index: null, commands: [] } });
    const client = createServiceRouterClient({ invoker });
    const query = { pluginId: 'chips.demo.app', includeDisabled: true };
    await expect(client.cliCommand.list(query)).resolves.toEqual({ index: {}, commands: [] });
    expect(invoker.last('cli.command.list')?.input).toEqual(query);
  });

  it('list 返回结构非法时给出 CLI_COMMAND_QUERY_INVALID', async () => {
    const nonCommands = createServiceRouterClient({ invoker: new RecordingInvoker({ 'cli.command.list': { index: {} } }) });
    await expectCode(nonCommands.cliCommand.list(), 'CLI_COMMAND_QUERY_INVALID');
    const nonObject = createServiceRouterClient({ invoker: new RecordingInvoker({ 'cli.command.list': '非法' }) });
    await expectCode(nonObject.cliCommand.list(), 'CLI_COMMAND_QUERY_INVALID');
  });

  it('get 以 entryId 或 commandPath 查询，未命中返回 undefined', async () => {
    const invoker = new RecordingInvoker({ 'cli.command.get': { command: COMMAND_VIEW } });
    const client = createServiceRouterClient({ invoker });
    await expect(client.cliCommand.get({ entryId: 'chips.demo.app#open' })).resolves.toEqual(COMMAND_VIEW);
    expect(invoker.last('cli.command.get')?.input).toEqual({ entryId: 'chips.demo.app#open' });
    const empty = createServiceRouterClient({ invoker: new RecordingInvoker({ 'cli.command.get': {} }) });
    await expect(empty.cliCommand.get({ commandPath: ['demo', 'open'] })).resolves.toBeUndefined();
  });

  it('get 与 resolve 拒绝缺少定位键与非法 targetType 的查询', async () => {
    const client = createServiceRouterClient({ invoker: new RecordingInvoker() });
    await expectCode(client.cliCommand.get({}), 'CLI_COMMAND_QUERY_INVALID');
    await expectCode(client.cliCommand.resolve({ pluginId: 'chips.demo.app' }), 'CLI_COMMAND_QUERY_INVALID');
    await expectCode(client.cliCommand.get({ commandPath: ['demo'], targetType: 'worker' as 'app' }), 'CLI_COMMAND_QUERY_INVALID');
  });

  it('get 与 resolve 返回标量时给出 CLI_COMMAND_QUERY_INVALID', async () => {
    const client = createServiceRouterClient({
      invoker: new RecordingInvoker({ 'cli.command.get': 'x', 'cli.command.resolve': 7 }),
    });
    await expectCode(client.cliCommand.get({ entryId: 'e' }), 'CLI_COMMAND_QUERY_INVALID');
    await expectCode(client.cliCommand.resolve({ entryId: 'e' }), 'CLI_COMMAND_QUERY_INVALID');
  });

  it('resolve 归一冲突列表：无命令时只返回冲突，缺字段时按空数组', async () => {
    const conflict = { entryId: 'other', commandPath: ['demo', 'open'], pluginId: 'chips.other', priority: 10 };
    const withCommand = createServiceRouterClient({
      invoker: new RecordingInvoker({ 'cli.command.resolve': { command: COMMAND_VIEW, conflicts: [conflict] } }),
    });
    await expect(withCommand.cliCommand.resolve({ commandPath: 'demo open' })).resolves.toEqual({
      command: COMMAND_VIEW,
      conflicts: [conflict],
    });
    const withoutConflicts = createServiceRouterClient({
      invoker: new RecordingInvoker({ 'cli.command.resolve': { command: COMMAND_VIEW } }),
    });
    await expect(withoutConflicts.cliCommand.resolve({ entryId: 'e' })).resolves.toEqual({ command: COMMAND_VIEW, conflicts: [] });
    const miss = createServiceRouterClient({ invoker: new RecordingInvoker({ 'cli.command.resolve': {} }) });
    await expect(miss.cliCommand.resolve({ entryId: 'e' })).resolves.toEqual({ conflicts: [] });
  });
});

describe('cli.task.* 路由映射（§5.7、§5.8）', () => {
  const client = (value: unknown): { client: ICliClient; invoker: RecordingInvoker } => {
    const invoker = new RecordingInvoker({
      'cli.task.create': value,
      'cli.task.bindInvocation': value,
      'cli.task.get': value,
      'cli.task.progress': value,
      'cli.task.complete': value,
      'cli.task.fail': value,
      'cli.task.cancel': value,
    });
    return { client: createServiceRouterClient({ invoker }), invoker };
  };

  it('任务生命周期方法各自映射到对应路由并透传入参', async () => {
    const { client: cli, invoker } = client({ task: TASK });
    await cli.cliTask.create({ pluginId: 'chips.demo.app', commandId: 'demo.open', commandPath: ['demo', 'open'] });
    expect(invoker.last('cli.task.create')?.input).toEqual({
      pluginId: 'chips.demo.app',
      commandId: 'demo.open',
      commandPath: ['demo', 'open'],
    });
    await cli.cliTask.bindInvocation({ taskId: 'task-1', invocationId: 'inv-1', sessionId: 's-1' });
    expect(invoker.last('cli.task.bindInvocation')?.input).toEqual({ taskId: 'task-1', invocationId: 'inv-1', sessionId: 's-1' });
    await cli.cliTask.get('task-1');
    expect(invoker.last('cli.task.get')?.input).toEqual({ taskId: 'task-1' });
    await cli.cliTask.progress('task-1', { percent: 40 });
    expect(invoker.last('cli.task.progress')?.input).toEqual({ taskId: 'task-1', progress: { percent: 40 } });
    await cli.cliTask.complete('task-1', { ok: true });
    expect(invoker.last('cli.task.complete')?.input).toEqual({ taskId: 'task-1', output: { ok: true } });
    await cli.cliTask.fail('task-1', { code: 'X', message: '失败' });
    expect(invoker.last('cli.task.fail')?.input).toEqual({ taskId: 'task-1', error: { code: 'X', message: '失败' } });
    await cli.cliTask.cancel('task-1');
    expect(invoker.last('cli.task.cancel')?.input).toEqual({ taskId: 'task-1' });
  });

  it('全部任务方法在缺少 task 字段时给出 CLI_TASK_INVALID', async () => {
    const { client: cli } = client({});
    await expectCode(cli.cliTask.create({ pluginId: 'p', commandId: 'c' }), 'CLI_TASK_INVALID');
    await expectCode(cli.cliTask.bindInvocation({ taskId: 't' }), 'CLI_TASK_INVALID');
    await expectCode(cli.cliTask.get('t'), 'CLI_TASK_INVALID');
    await expectCode(cli.cliTask.progress('t', {}), 'CLI_TASK_INVALID');
    await expectCode(cli.cliTask.complete('t'), 'CLI_TASK_INVALID');
    await expectCode(cli.cliTask.fail('t', null), 'CLI_TASK_INVALID');
    await expectCode(cli.cliTask.cancel('t'), 'CLI_TASK_INVALID');
  });

  it('active 以 activeOnly 查询当前运行任务，未命中返回 undefined', async () => {
    const found = client({ task: TASK });
    await expect(found.client.cliTask.active('demo.open')).resolves.toEqual(TASK);
    expect(found.invoker.last('cli.task.get')?.input).toEqual({ commandId: 'demo.open', activeOnly: true });
    const missing = client({});
    await expect(missing.client.cliTask.active('demo.open')).resolves.toBeUndefined();
    const scalar = client('x');
    await expect(scalar.client.cliTask.active('demo.open')).resolves.toBeUndefined();
  });
});

describe('命令与能力调用（§5.3、§5.8）', () => {
  it('commands.invoke 固定以 source: "cli" 请求 command:invoke', async () => {
    const result = { invocationId: 'inv-1', commandId: 'demo.open', target: 'main', status: 'dispatched' };
    const invoker = new RecordingInvoker({ 'command:invoke': result });
    const client = createServiceRouterClient({ invoker });
    await expect(client.commands.invoke({ commandId: 'demo.open', payload: { a: 1 } })).resolves.toEqual(result);
    expect(invoker.last('command:invoke')?.input).toEqual({ commandId: 'demo.open', payload: { a: 1 }, source: 'cli' });
  });

  it('capabilities.invoke 以能力 ID 为路由并包装为 output 信封', async () => {
    const invoker = new RecordingInvoker({ 'resources:read': { items: [] } });
    const client = createServiceRouterClient({ invoker });
    await expect(
      client.capabilities.invoke({ capability: 'resources:read', input: { path: '/x' }, workspace: '/ws' }),
    ).resolves.toEqual({ output: { items: [] } });
    expect(invoker.last('resources:read')?.input).toEqual({ path: '/x' });
  });
});

describe('平台操作与适配器注入（§2.5）', () => {
  const platformCalls: readonly { method: keyof ICliPlatformOperations; args: unknown[] }[] = [
    { method: 'version', args: [] },
    { method: 'defaultWorkspacePath', args: ['dev'] },
    { method: 'workspaceStatus', args: [] },
    { method: 'workspaceStart', args: [] },
    { method: 'workspaceStop', args: [] },
    { method: 'configList', args: ['user'] },
    { method: 'configSet', args: ['platform.log.level', 'debug', 'user'] },
    { method: 'configReset', args: ['platform.log.level', 'workspace'] },
    { method: 'logsRead', args: [{ lines: 50, level: 'warn' }] },
    { method: 'logsFollow', args: [{ level: 'info' }, () => undefined, new AbortController().signal] },
    { method: 'pluginList', args: [{ role: 'app' }] },
    { method: 'pluginInfo', args: ['chips.demo.app'] },
    { method: 'pluginInstall', args: [{ path: '/tmp/a.cpk', source: 'user', yes: true }] },
    { method: 'pluginUninstall', args: ['chips.demo.app'] },
    { method: 'pluginEnable', args: ['chips.demo.app'] },
    { method: 'pluginDisable', args: ['chips.demo.app'] },
    { method: 'open', args: ['/tmp/卡片.chipscard'] },
    { method: 'updateCheck', args: ['beta'] },
    { method: 'updateInstall', args: ['stable'] },
    { method: 'doctor', args: [{ fix: true, verbose: false }] },
  ];

  it('未注入平台适配器时每个平台方法返回 CLI_TARGET_UNAVAILABLE', async () => {
    const client = createServiceRouterClient({ invoker: new RecordingInvoker() });
    expect(platformCalls.length).toBe(20);
    for (const { method, args } of platformCalls) {
      const call = (client.platform[method] as (...values: unknown[]) => Promise<unknown>)(...args);
      await expectCode(call, 'CLI_TARGET_UNAVAILABLE');
    }
  });

  it('注入平台适配器后按方法逐项委托给适配器', async () => {
    const seen: { method: string; args: unknown[] }[] = [];
    const platform: ICliPlatformOperations = {
      version: async () => {
        seen.push({ method: 'version', args: [] });
        return '0.1.0';
      },
      defaultWorkspacePath: async (kind) => {
        seen.push({ method: 'defaultWorkspacePath', args: [kind] });
        return `/ws/${kind}`;
      },
      workspaceStatus: async () => {
        seen.push({ method: 'workspaceStatus', args: [] });
        return { workspace: { path: '/ws', kind: 'user' }, state: { running: true }, platformVersion: '0.1.0' };
      },
      workspaceStart: async () => {
        seen.push({ method: 'workspaceStart', args: [] });
        return { running: true, pid: 7 };
      },
      workspaceStop: async () => {
        seen.push({ method: 'workspaceStop', args: [] });
        return { running: false };
      },
      configList: async (layer) => {
        seen.push({ method: 'configList', args: [layer] });
        return { layer };
      },
      configSet: async (key, value, layer) => {
        seen.push({ method: 'configSet', args: [key, value, layer] });
        return { key, value, layer };
      },
      configReset: async (key, layer) => {
        seen.push({ method: 'configReset', args: [key, layer] });
        return { key, layer };
      },
      logsRead: async (options) => {
        seen.push({ method: 'logsRead', args: [options] });
        return [];
      },
      logsFollow: async (options, onEntry, signal) => {
        seen.push({ method: 'logsFollow', args: [options, typeof onEntry, signal instanceof AbortSignal] });
      },
      pluginList: async (filter) => {
        seen.push({ method: 'pluginList', args: [filter] });
        return [];
      },
      pluginInfo: async (pluginId) => {
        seen.push({ method: 'pluginInfo', args: [pluginId] });
        throw new Error('未安装');
      },
      pluginInstall: async (input) => {
        seen.push({ method: 'pluginInstall', args: [input] });
        return { id: 'chips.demo.app', version: '0.1.0', role: 'app', name: '示例', source: 'user', state: 'installed', enabled: true };
      },
      pluginUninstall: async (pluginId) => {
        seen.push({ method: 'pluginUninstall', args: [pluginId] });
      },
      pluginEnable: async (pluginId) => {
        seen.push({ method: 'pluginEnable', args: [pluginId] });
        return { id: pluginId, version: '0.1.0', role: 'app', name: '示例', source: 'user', state: 'active', enabled: true };
      },
      pluginDisable: async (pluginId) => {
        seen.push({ method: 'pluginDisable', args: [pluginId] });
        return { id: pluginId, version: '0.1.0', role: 'app', name: '示例', source: 'user', state: 'disabled', enabled: false };
      },
      open: async (path) => {
        seen.push({ method: 'open', args: [path] });
        return { path, handler: { kind: 'shell' } };
      },
      updateCheck: async (channel) => {
        seen.push({ method: 'updateCheck', args: [channel] });
        return { currentVersion: '0.1.0', latestVersion: null, channel, updateAvailable: false };
      },
      updateInstall: async (channel) => {
        seen.push({ method: 'updateInstall', args: [channel] });
        return { installed: false, channel };
      },
      doctor: async (input) => {
        seen.push({ method: 'doctor', args: [input] });
        return { workspace: { path: '/ws', kind: 'user' }, checks: [] };
      },
    };
    const client = createServiceRouterClient({ invoker: new RecordingInvoker(), platform });
    for (const { method, args } of platformCalls) {
      const call = (client.platform[method] as (...values: unknown[]) => Promise<unknown>)(...args);
      if (method === 'pluginInfo') {
        await expect(call).rejects.toThrow('未安装');
      } else {
        await call;
      }
    }
    expect(seen.map((item) => item.method)).toEqual(platformCalls.map((item) => item.method));
    expect(seen.find((item) => item.method === 'configSet')?.args).toEqual(['platform.log.level', 'debug', 'user']);
    expect(seen.find((item) => item.method === 'logsFollow')?.args).toEqual([
      { level: 'info' },
      'function',
      true,
    ]);
  });

  it('apps.ensureRunning 缺适配器时 CLI_TARGET_UNAVAILABLE，注入后委托', async () => {
    const missing = createServiceRouterClient({ invoker: new RecordingInvoker() });
    await expectCode(missing.apps.ensureRunning({ pluginId: 'chips.demo.app' }), 'CLI_TARGET_UNAVAILABLE');
    const launched: unknown[] = [];
    const client = createServiceRouterClient({
      invoker: new RecordingInvoker(),
      apps: {
        ensureRunning: async (input) => {
          launched.push(input);
        },
      },
    });
    await client.apps.ensureRunning({ pluginId: 'chips.demo.app', surface: { open: true } });
    expect(launched).toEqual([{ pluginId: 'chips.demo.app', surface: { open: true } }]);
  });

  it('devHost.runPlugin 缺适配器时 CLI_TARGET_UNAVAILABLE，注入后委托', async () => {
    const missing = createServiceRouterClient({ invoker: new RecordingInvoker() });
    await expectCode(missing.devHost.runPlugin({ dir: '/p', workspace: '/ws' }), 'CLI_TARGET_UNAVAILABLE');
    const client = createServiceRouterClient({
      invoker: new RecordingInvoker(),
      devHost: {
        runPlugin: async (input) => ({ started: input.dir }),
      },
    });
    await expect(client.devHost.runPlugin({ dir: '/p', workspace: '/ws' })).resolves.toEqual({ started: '/p' });
  });

  it('operations.record 缺写入器时静默成功，注入后委托记录', async () => {
    const missing = createServiceRouterClient({ invoker: new RecordingInvoker() });
    await expect(missing.operations.record({ namespace: 'cli', action: 'operation.execute', metadata: {} })).resolves.toBeUndefined();
    const records: unknown[] = [];
    const client = createServiceRouterClient({
      invoker: new RecordingInvoker(),
      operations: {
        record: async (record) => {
          records.push(record);
        },
      },
    });
    const record = { namespace: 'cli', action: 'operation.execute', metadata: { exitCode: 0 } } as const;
    await client.operations.record(record);
    expect(records).toEqual([record]);
  });
});

describe('本地产物引擎接缝（§3.5）', () => {
  it('缺省 artifacts 时 create/pack/validate 全部 CLI_TARGET_UNAVAILABLE', async () => {
    const client = createServiceRouterClient({ invoker: new RecordingInvoker() });
    const fileSystem = new MemoryFileSystem();
    await expectCode(
      client.artifacts.create({ role: 'app', pluginId: 'chips.demo.app', name: '示例', dir: '/out', fileSystem }),
      'CLI_TARGET_UNAVAILABLE',
    );
    await expectCode(client.artifacts.pack({ dir: '/src', sign: false, fileSystem }), 'CLI_TARGET_UNAVAILABLE');
    await expectCode(
      client.artifacts.validate({ path: '/out/a.cpk', source: 'user', fileSystem }),
      'CLI_TARGET_UNAVAILABLE',
    );
  });

  it('注入的 artifacts 实现被原样挂到客户端', async () => {
    const artifacts = {
      create: async () => ({ pluginId: 'chips.demo.app', role: 'app', targetDir: '/out', files: ['manifest.yaml'] }),
      pack: async () => ({
        archivePath: '/out/a.cpk',
        name: '示例',
        version: '1.0.0',
        role: 'app',
        memberCount: 1,
        archiveSize: 10,
        digest: 'sha256:x',
        signed: false,
      }),
      validate: async () => ({ valid: true, stages: [] }),
    } as unknown as ICliClient['artifacts'];
    const client = createServiceRouterClient({ invoker: new RecordingInvoker(), artifacts });
    expect(client.artifacts).toBe(artifacts);
    await expect(client.artifacts.validate({ path: '/out/a.cpk', source: 'user', fileSystem: new MemoryFileSystem() })).resolves.toEqual({
      valid: true,
      stages: [],
    });
  });
});
