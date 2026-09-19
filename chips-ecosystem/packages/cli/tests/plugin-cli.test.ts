import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ICliCommandView, ICliTaskRecord } from '../src/client/types.js';
import { matchCommand } from '../src/plugin-cli/index.js';
import { FakeCliClient } from './support/fake-client.js';
import { runUser } from './support/harness.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

function view(overrides: Partial<ICliCommandView> & { readonly commandPath: readonly string[] }): ICliCommandView {
  const pluginId = overrides.pluginId ?? 'chips.official.office';
  return {
    entryId: `${pluginId}.cli.${overrides.commandPath.join('.')}`,
    pluginId,
    enabled: true,
    declaration: {
      commandPath: overrides.commandPath,
      title: '打开办公文档',
      description: '用薯片办公打开指定文档',
      examples: ['chips office open ~/文档/报告.docx'],
      target: { type: 'app', pluginId, surface: { open: true, focus: true, reuse: 'preferred' } },
      ...overrides.declaration,
    },
    conflicts: [],
    ...overrides,
  };
}

const officeOpen = view({
  commandPath: ['office', 'open'],
  declaration: {
    commandPath: ['office', 'open'],
    commandId: 'office:open',
    title: '打开办公文档',
    target: { type: 'app', pluginId: 'chips.official.office' },
    arguments: [
      {
        name: 'path',
        position: 0,
        type: 'path',
        required: true,
        mapsTo: 'path',
        path: { kind: 'file', role: 'input', exists: true },
      },
    ],
    output: { mode: 'human', artifacts: ['files'] },
    job: { wait: true, cancelOnInterrupt: true },
  },
});

describe('命令匹配与冲突消解（§2.3、§5.5）', () => {
  it('按最长命令路径前缀匹配，剩余 token 交参数解析', () => {
    const office = view({ commandPath: ['office'], declaration: { commandPath: ['office'], title: '打开办公', target: { type: 'app', pluginId: 'chips.official.office' } } });
    const match = matchCommand([office, officeOpen], ['office', 'open', 'x.docx']);
    expect(match.command.commandPath).toEqual(['office', 'open']);
    expect(match.remaining).toEqual(['x.docx']);
  });

  it('优先最高的命令自动胜出，同优先级返回 CLI_COMMAND_CONFLICT', () => {
    const left = view({
      commandPath: ['tool', 'run'],
      pluginId: 'chips.a',
      declaration: { commandPath: ['tool', 'run'], title: 'A', target: { type: 'app', pluginId: 'chips.a' }, conflict: { priority: 1 } },
    });
    const right = view({
      commandPath: ['tool', 'run'],
      pluginId: 'chips.b',
      declaration: { commandPath: ['tool', 'run'], title: 'B', target: { type: 'app', pluginId: 'chips.b' } },
    });
    expect(matchCommand([left, right], ['tool', 'run']).command.pluginId).toBe('chips.a');

    // 同优先级（显式 `priority: 0` 与未声明 `conflict` 的缺省 0 等价）无法自动消解，
    // 必须由 `--plugin` 显式指定 owner（[CLI 完整参考] §5.5）。
    const tie = { ...left, declaration: { ...left.declaration, conflict: { priority: 0 } } };
    try {
      matchCommand([tie, right], ['tool', 'run']);
      throw new Error('expected conflict');
    } catch (error) {
      const shaped = error as { code: string; details: { conflicts: unknown[] } };
      expect(shaped.code).toBe('CLI_COMMAND_CONFLICT');
      expect(shaped.details.conflicts).toHaveLength(2);
    }
  });

  it('--plugin 消解冲突、禁用命令不参与、无匹配返回 CLI_COMMAND_NOT_FOUND', () => {
    const left = view({
      commandPath: ['tool', 'run'],
      pluginId: 'chips.a',
      declaration: { commandPath: ['tool', 'run'], title: 'A', target: { type: 'app', pluginId: 'chips.a' } },
    });
    const right = view({
      commandPath: ['tool', 'run'],
      pluginId: 'chips.b',
      declaration: { commandPath: ['tool', 'run'], title: 'B', target: { type: 'app', pluginId: 'chips.b' } },
    });
    expect(matchCommand([left, right], ['tool', 'run'], { pluginId: 'chips.b' }).command.pluginId).toBe('chips.b');
    // 禁用命令只在治理视图（`includeDisabled: true`）里参与匹配（[CLI 完整参考] §5.5、§5.8）。
    expect(matchCommand([{ ...left, enabled: false }], ['tool', 'run'], { includeDisabled: true })).toBeDefined();
    try {
      matchCommand([{ ...left, enabled: false }], ['tool', 'run']);
      throw new Error('expected not found');
    } catch (error) {
      expect((error as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
    }
  });
});

describe('插件命令执行（§3.10、§5.3、§5.4、§5.7）', () => {
  it('service 目标同步调用能力并输出结果信封', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      view({
        commandPath: ['txt', 'translate'],
        pluginId: 'chips.service.translate',
        declaration: {
          commandPath: ['txt', 'translate'],
          title: '翻译一段文本',
          target: { type: 'service', pluginId: 'chips.service.translate', capability: 'translate:run' },
          arguments: [{ name: 'text', position: 0, type: 'string', required: true, mapsTo: 'text' }],
          options: [{ name: 'to', type: 'enum', choices: ['zh', 'en'], required: true, mapsTo: 'target' }],
          output: { mode: 'human' },
        },
      }),
    ];
    const outcome = await runUser(['txt', 'translate', 'Hello chips', '--to', 'zh'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('capabilities.invoke:translate:run');
    expect(outcome.stdout).toContain('完成\n命令: txt translate\n目标: service chips.service.translate');
    const envelope = outcome.json() as { ok: boolean; target: { type: string }; output: unknown };
    expect(envelope.ok).toBe(true);
    expect(envelope.target.type).toBe('service');
    expect(envelope.output).toEqual({ text: '你好' });
  });

  it('app 目标：创建任务、启动实例、调用命令、绑定调用并等待终态', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/报告.docx', 'doc');
    const client = new FakeCliClient();
    client.commandsIndex = [officeOpen];
    client.taskOutput = { files: ['/work/报告.docx'] };
    const outcome = await runUser(['office', 'open', '报告.docx'], { client, fileSystem });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls.filter((call) => call.startsWith('cliTask.create'))).toHaveLength(1);
    expect(client.calls).toContain('apps.ensureRunning:chips.official.office');
    expect(client.calls).toContain('commands.invoke:office:open');
    expect(client.calls).toContain('cliTask.bindInvocation:task-1');
    expect(outcome.stdout).toContain('任务: completed');
    expect(outcome.stdout).toContain('产物:\n- /work/报告.docx');
    const envelope = outcome.json() as { artifacts: string[]; commandId: string; task: { status: string } };
    expect(envelope.artifacts).toEqual(['/work/报告.docx']);
    expect(envelope.commandId).toBe('office:open');
    expect(envelope.task.status).toBe('completed');
  });

  it('--json 强制 JSON（human 声明不生效）', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [officeOpen];
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/报告.docx', 'doc');
    const outcome = await runUser(['office', 'open', '报告.docx', '--json'], { client, fileSystem });
    expect(outcome.stdout.trimStart().startsWith('{')).toBe(true);
    expect(outcome.json()).toBeDefined();
  });

  it('output.json: unsupported 时传 --json 返回 CLI_ARGUMENT_INVALID（退出码 2）', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      view({
        commandPath: ['plain'],
        pluginId: 'chips.service.plain',
        declaration: {
          commandPath: ['plain'],
          title: '纯文本命令',
          target: { type: 'service', pluginId: 'chips.service.plain', capability: 'plain:run' },
          output: { json: 'unsupported' },
        },
      }),
    ];
    const outcome = await runUser(['plain', '--json'], { client });
    expect(outcome.exitCode).toBe(2);
  });

  it('未声明入口级 commandId：只启动实例并立即返回', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      view({
        commandPath: ['launcher'],
        declaration: {
          commandPath: ['launcher'],
          title: '打开应用',
          target: { type: 'app', pluginId: 'chips.official.office', surface: { open: true } },
        },
      }),
    ];
    const outcome = await runUser(['launcher'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('apps.ensureRunning:chips.official.office');
    expect(client.calls.some((call) => call.startsWith('commands.invoke'))).toBe(false);
    expect((outcome.json() as { launched: boolean }).launched).toBe(true);
  });

  it('job.wait: false：不创建任务但仍调用命令', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      view({
        commandPath: ['fire'],
        declaration: {
          commandPath: ['fire'],
          commandId: 'tool:fire',
          title: '触发',
          target: { type: 'app', pluginId: 'chips.official.office' },
          job: { wait: false },
        },
      }),
    ];
    const outcome = await runUser(['fire'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls.some((call) => call.startsWith('cliTask.create'))).toBe(false);
    expect(client.calls).toContain('commands.invoke:tool:fire');
  });

  it('任务失败：以任务错误码收口并退出 7', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [officeOpen];
    client.taskStatus = 'failed';
    client.taskErrorMessage = { code: 'DOCUMENT_VERSION_UNSUPPORTED', message: '文档版本过高' };
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/报告.docx', 'doc');
    const outcome = await runUser(['office', 'open', '报告.docx'], { client, fileSystem });
    expect(outcome.exitCode).toBe(7);
    const error = outcome.json() as { code: string; details: { task: { taskId: string } } };
    expect(error.code).toBe('DOCUMENT_VERSION_UNSUPPORTED');
    expect(error.details.task.taskId).toBe('task-1');
  });

  it('任务未上报失败码时按 CLI_TASK_FAILED 收口', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [officeOpen];
    client.taskStatus = 'failed';
    client.taskErrorMessage = { code: '', message: '' };
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/报告.docx', 'doc');
    const outcome = await runUser(['office', 'open', '报告.docx'], { client, fileSystem });
    expect(outcome.exitCode).toBe(7);
    expect((outcome.json() as { code: string }).code).toBe('CLI_TASK_FAILED');
  });

  it('command:invoke 失败时任务标记失败并以原错误码收口', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [officeOpen];
    client.invokeError = Object.assign(new Error('命令执行失败'), { code: 'COMMAND_EXECUTION_FAILED' });
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/报告.docx', 'doc');
    const outcome = await runUser(['office', 'open', '报告.docx'], { client, fileSystem });
    expect(outcome.exitCode).toBe(1);
    expect((outcome.json() as { code: string }).code).toBe('COMMAND_EXECUTION_FAILED');
    expect(client.calls.some((call) => call.startsWith('cliTask.fail'))).toBe(true);
  });

  it('缺少权限时预检拒绝（退出码 4）', async () => {
    const client = new FakeCliClient();
    client.pluginDetail = { ...client.pluginDetail, grantedPermissions: [] };
    client.commandsIndex = [
      view({
        commandPath: ['secure'],
        declaration: {
          commandPath: ['secure'],
          commandId: 'secure:run',
          title: '安全命令',
          permissions: ['resources:read'],
          target: { type: 'app', pluginId: 'chips.official.office' },
        },
      }),
    ];
    const outcome = await runUser(['secure'], { client });
    expect(outcome.exitCode).toBe(4);
    expect((outcome.json() as { code: string }).code).toBe('CLI_PERMISSION_DENIED');
  });

  it('输出冲突 skip：不调用目标并返回 skipped 信封', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      view({
        commandPath: ['export'],
        pluginId: 'chips.official.office',
        declaration: {
          commandPath: ['export'],
          commandId: 'export:run',
          title: '导出',
          target: { type: 'app', pluginId: 'chips.official.office' },
          options: [
            {
              name: 'out',
              type: 'path',
              required: true,
              mapsTo: 'out',
              path: { kind: 'file', role: 'output', overwrite: 'skip' },
            },
          ],
        },
      }),
    ];
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/out.html', 'old');
    const outcome = await runUser(['export', '--out', '/work/out.html'], { client, fileSystem });
    expect(outcome.exitCode).toBe(0);
    expect((outcome.json() as { skipped: boolean }).skipped).toBe(true);
    expect(client.calls.some((call) => call.startsWith('commands.invoke'))).toBe(false);
  });

  it('CLI 级 --overwrite 覆盖默认 fail 策略', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      view({
        commandPath: ['export'],
        declaration: {
          commandPath: ['export'],
          commandId: 'export:run',
          title: '导出',
          target: { type: 'app', pluginId: 'chips.official.office' },
          options: [
            { name: 'out', type: 'path', required: true, mapsTo: 'out', path: { kind: 'file', role: 'output' } },
          ],
        },
      }),
    ];
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/out.html', 'old');
    const blocked = await runUser(['export', '--out', '/work/out.html'], { client, fileSystem });
    expect(blocked.exitCode).toBe(5);
    const overwritten = await runUser(['export', '--out', '/work/out.html', '--overwrite'], { client, fileSystem });
    expect(overwritten.exitCode).toBe(0);
  });

  it('等待命令注册超时返回 CLI_TIMEOUT（退出码 9）', async () => {
    vi.useFakeTimers();
    try {
      const client = new FakeCliClient();
      client.commandsIndex = [officeOpen];
      client.apps.ensureRunning = async (): Promise<void> => {
        await new Promise<void>(() => undefined);
      };
      const fileSystem = new MemoryFileSystem();
      fileSystem.writeText('/work/报告.docx', 'doc');
      const outcomePromise = runUser(['office', 'open', '报告.docx'], { client, fileSystem });
      await vi.advanceTimersByTimeAsync(30_001);
      const outcome = await outcomePromise;
      expect(outcome.exitCode).toBe(9);
      expect((outcome.json() as { code: string }).code).toBe('CLI_TIMEOUT');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Ctrl+C 且声明 cancelOnInterrupt：取消任务并以退出码 8 收口', async () => {
    const controller = new AbortController();
    const client = new FakeCliClient();
    client.commandsIndex = [officeOpen];
    client.taskStatus = 'running';
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/报告.docx', 'doc');
    client.cliTask.get = (): Promise<ICliTaskRecord> => {
      const status = controller.signal.aborted ? 'cancelled' : 'running';
      return Promise.resolve({
        taskId: 'task-1',
        pluginId: 'chips.official.office',
        commandId: 'office:open',
        status,
        createdAt: 1,
        updatedAt: 2,
      });
    };
    const outcomePromise = runUser(['office', 'open', '报告.docx'], {
      client,
      fileSystem,
      signal: controller.signal,
    });
    controller.abort();
    const outcome = await outcomePromise;
    expect(outcome.exitCode).toBe(8);
    expect((outcome.json() as { code: string }).code).toBe('CLI_TASK_CANCELLED');
  });

  it('Ctrl+C 且未声明 cancelOnInterrupt：直接中断（退出码 130，无错误对象）', async () => {
    const controller = new AbortController();
    const client = new FakeCliClient();
    client.commandsIndex = [
      view({
        commandPath: ['long'],
        declaration: {
          commandPath: ['long'],
          commandId: 'tool:long',
          title: '长命令',
          target: { type: 'app', pluginId: 'chips.official.office' },
          job: { wait: true },
        },
      }),
    ];
    client.taskStatus = 'running';
    client.cliTask.get = (): Promise<ICliTaskRecord> => {
      controller.abort();
      return Promise.resolve({
        taskId: 'task-1',
        pluginId: 'chips.official.office',
        commandId: 'tool:long',
        status: 'running',
        createdAt: 1,
        updatedAt: 2,
      });
    };
    const outcomePromise = runUser(['long'], { client, signal: controller.signal });
    const outcome = await outcomePromise;
    expect(outcome.exitCode).toBe(130);
    expect(outcome.stdout).toBe('');
  });
});

afterEach(() => {
  vi.useRealTimers();
});
