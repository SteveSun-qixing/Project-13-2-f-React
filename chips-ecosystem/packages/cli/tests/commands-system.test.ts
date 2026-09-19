import { describe, expect, it } from 'vitest';

import { runUser } from './support/harness.js';
import { FakeCliClient } from './support/fake-client.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

describe('用户侧工作区命令（§3.2）', () => {
  it('start / stop / status 输出形状与幂等', async () => {
    const client = new FakeCliClient();
    const start = await runUser(['start'], { client });
    expect(start.exitCode).toBe(0);
    expect(start.json()).toEqual({ running: true, pid: 4242, startedAt: '2026-09-19T00:00:00.000Z' });

    const stop = await runUser(['stop'], { client });
    expect(stop.json()).toEqual({ running: false });

    const status = await runUser(['status'], { client });
    expect(status.json()).toEqual({
      workspace: { path: '/tmp/chips-user', kind: 'user' },
      state: { running: false },
      platformVersion: '0.1.0',
    });
  });
});

describe('配置命令（§3.3）', () => {
  it('list 透传层级；set 先按 JSON 解析，失败按字符串', async () => {
    const client = new FakeCliClient();
    const list = await runUser(['config', 'list', '--layer', 'user'], { client });
    expect(list.exitCode).toBe(0);
    expect(client.calls).toContain('platform.configList:user');

    await runUser(['config', 'set', 'plugins.chips.a.autoSaveDebounceMs', '800'], { client });
    expect(client.calls).toContain('platform.configSet:plugins.chips.a.autoSaveDebounceMs:800:default');

    await runUser(['config', 'set', 'platform.log.level', 'debug', '--layer', 'workspace'], { client });
    expect(client.calls).toContain('platform.configSet:platform.log.level:"debug":workspace');

    const reset = await runUser(['config', 'reset', 'platform.log.level'], { client });
    expect(reset.json()).toEqual({ ok: true });
    expect(client.calls).toContain('platform.configReset:platform.log.level:default');
  });

  it('缺少必填参数返回 CLI_ARGUMENT_INVALID（退出码 2）', async () => {
    const outcome = await runUser(['config', 'set', 'only-key'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(2);
    expect((outcome.json() as { code: string }).code).toBe('CLI_ARGUMENT_INVALID');
  });

  it('config 无子命令返回 CLI_COMMAND_NOT_FOUND（退出码 3）', async () => {
    const outcome = await runUser(['config'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { details: { subcommands: string[] } }).details.subcommands).toEqual([
      'list',
      'set',
      'reset',
    ]);
  });
});

describe('日志命令（§3.4）', () => {
  it('默认读取 100 行，可指定行数与级别', async () => {
    const client = new FakeCliClient();
    const outcome = await runUser(['logs', '-n', '200', '-l', 'warn'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('platform.logsRead:200:warn');
    expect(outcome.json()).toEqual([
      { timestamp: '2026-09-19T00:00:00.000Z', level: 'info', namespace: 'kernel', message: '就绪' },
    ]);
  });

  it('--follow 输出增量行且不污染最终结果（stdout 只承载结果）', async () => {
    const client = new FakeCliClient();
    const outcome = await runUser(['logs', '--follow'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('"message":"慢调用"');
    expect(outcome.stdout.endsWith('\n')).toBe(true);
  });
});

describe('打开与更新（§3.6、§3.7）', () => {
  it('open 输出处理器信息', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/旅行日记.card', 'x');
    const client = new FakeCliClient();
    const outcome = await runUser(['open', '旅行日记.card'], { client, fileSystem });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('platform.open:/work/旅行日记.card');
    expect(outcome.json()).toEqual({ path: '/work/旅行日记.card', handler: { kind: 'shell' } });
  });

  it('open 路径不存在返回 CLI_PATH_NOT_FOUND（退出码 5）', async () => {
    const outcome = await runUser(['open', '/work/missing.card'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(5);
    expect((outcome.json() as { code: string }).code).toBe('CLI_PATH_NOT_FOUND');
  });

  it('update check / install 渠道缺省 stable', async () => {
    const client = new FakeCliClient();
    const check = await runUser(['update', 'check'], { client });
    expect(check.json()).toEqual({
      currentVersion: '0.1.0',
      latestVersion: '0.1.0',
      channel: 'stable',
      updateAvailable: false,
    });
    const install = await runUser(['update', 'install', '--channel', 'beta'], { client });
    expect(install.json()).toEqual({ installed: false, reason: 'up-to-date' });
    expect(client.calls).toContain('platform.updateInstall:beta');
  });
});

describe('诊断命令（§3.8）', () => {
  it('存在 error 级检查项时退出码为 1 且仍输出报告', async () => {
    const client = new FakeCliClient();
    client.doctorResult = {
      workspace: { path: '/tmp/chips-user', kind: 'user' },
      checks: [{ id: 'registry', status: 'error', detail: '插件注册表不可写', fixable: false }],
    };
    const outcome = await runUser(['doctor'], { client });
    expect(outcome.exitCode).toBe(1);
    expect((outcome.json() as { checks: unknown[] }).checks).toHaveLength(1);
    expect(client.calls).toContain('platform.doctor:false:false');
  });

  it('正常时退出 0，--fix 与 --verbose 透传', async () => {
    const client = new FakeCliClient();
    const outcome = await runUser(['doctor', '--fix', '--verbose'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('platform.doctor:true:true');
  });
});

describe('帮助与补全（§3.1、§3.9）', () => {
  it('chips help 输出命令树与插件命令路径', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      {
        entryId: 'chips.official.office.cli.office.open',
        commandPath: ['office', 'open'],
        pluginId: 'chips.official.office',
        enabled: true,
        declaration: {
          commandPath: ['office', 'open'],
          commandId: 'office:open',
          title: '打开办公文档',
          target: { type: 'app', pluginId: 'chips.official.office' },
        },
        conflicts: [],
      },
    ];
    const outcome = await runUser(['help'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('plugin create');
    expect(outcome.stdout).toContain('office open');
  });

  it('chips help <内建命令> 输出用法与参数', async () => {
    const outcome = await runUser(['help', 'plugin', 'create'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('chips plugin create --role');
    expect(outcome.stdout).toContain('--role');
  });

  it('chips help <未知命令> 返回 CLI_COMMAND_NOT_FOUND（退出码 3）', async () => {
    const outcome = await runUser(['help', 'nope'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
  });

  it('completion 输出脚本并调用 __complete 私有入口', async () => {
    const outcome = await runUser(['completion', 'bash'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('_chips_complete');
    expect(outcome.stdout).toContain('chips __complete');
  });

  it('__complete 输出换行分隔候选且索引读取失败时静默', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      {
        entryId: 'chips.official.office.cli.office.open',
        commandPath: ['office', 'open'],
        pluginId: 'chips.official.office',
        enabled: true,
        declaration: {
          commandPath: ['office', 'open'],
          commandId: 'office:open',
          title: '打开办公文档',
          target: { type: 'app', pluginId: 'chips.official.office' },
        },
        conflicts: [],
      },
    ];
    const outcome = await runUser(['__complete', 'off'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout.trim()).toBe('office');
  });

  it('--version 输出 chips 版本与平台版本（退出码 0）', async () => {
    const outcome = await runUser(['--version'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(0);
    expect((outcome.json() as { chips: string; platform: string }).platform).toBe('0.1.0');
  });

  it('裸命令在非交互环境输出提示并返回 0；--interactive 返回 1（§3.1.2）', async () => {
    const bare = await runUser([], { client: new FakeCliClient() });
    expect(bare.exitCode).toBe(0);
    expect(bare.stdout).toBe('');
    expect(bare.stderr).toContain('不支持交互式界面');

    const interactive = await runUser(['--interactive'], { client: new FakeCliClient() });
    expect(interactive.exitCode).toBe(1);
  });

  it('未命中任何命令返回 CLI_COMMAND_NOT_FOUND（退出码 3）', async () => {
    const outcome = await runUser(['unknown-command'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
  });

  it('退出码来自命令结果（doctor 之外的错误路径）且操作日志写入', async () => {
    const client = new FakeCliClient();
    await runUser(['status'], { client });
    expect(client.operationsRecords).toHaveLength(1);
    const record = client.operationsRecords[0] as { namespace: string; action: string; metadata: { exitCode: number } };
    expect(record.namespace).toBe('cli');
    expect(record.action).toBe('operation.execute');
    expect(record.metadata.exitCode).toBe(0);
  });
});
