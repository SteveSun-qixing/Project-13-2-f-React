/**
 * 可执行入口（[CLI 完整参考] §1.1、§2.1、§2.5）：入口 token 识别、依赖注入
 * （客户端 / 输出出口 / 环境 / 工作目录）、`SIGINT` 监听的装与卸，以及退出码回传。
 */

import { describe, expect, it } from 'vitest';

import type { ICliClient, ICliCommandListResult } from '../src/client/types.js';
import { detectEntry, main } from '../src/main.js';
import type { IOutputSink } from '../src/output/io.js';
import { FakeCliClient } from './support/fake-client.js';

/** 输出出口替身：分别累积 stdout 与 stderr 文本。 */
interface ICapture {
  readonly sink: IOutputSink;
  stdout(): string;
  stderr(): string;
}

function captureSink(tty = false): ICapture {
  let stdout = '';
  let stderr = '';
  return {
    sink: {
      get isTTY(): boolean {
        return tty;
      },
      writeOut(text: string): void {
        stdout += text;
      },
      writeErr(text: string): void {
        stderr += text;
      },
    },
    stdout(): string {
      return stdout;
    },
    stderr(): string {
      return stderr;
    },
  };
}

function candidateLines(stdout: string): string[] {
  return stdout.split('\n').filter((line) => line.length > 0);
}

describe('detectEntry（§2.1 入口识别）', () => {
  it('空 argv 与首个非选项 token 决定入口', () => {
    expect(detectEntry([])).toEqual({ entry: 'user', argv: [] });
    expect(detectEntry(['status'])).toEqual({ entry: 'user', argv: ['status'] });
    expect(detectEntry(['--json', 'status'])).toEqual({
      entry: 'user',
      argv: ['--json', 'status'],
    });
  });

  it('dev token 命中时被剥离，其前后的全局选项保留', () => {
    expect(detectEntry(['dev', 'run'])).toEqual({ entry: 'dev', argv: ['run'] });
    expect(detectEntry(['--json', 'dev', 'run'])).toEqual({
      entry: 'dev',
      argv: ['--json', 'run'],
    });
    expect(detectEntry(['-y', 'dev'])).toEqual({ entry: 'dev', argv: ['-y'] });
  });

  it('--plugin 与 --workspace 的取值不被当作命令 token', () => {
    expect(detectEntry(['--plugin', 'chips.demo.app', 'dev', 'run'])).toEqual({
      entry: 'dev',
      argv: ['--plugin', 'chips.demo.app', 'run'],
    });
    expect(detectEntry(['--workspace', '/tmp/ws', 'status'])).toEqual({
      entry: 'user',
      argv: ['--workspace', '/tmp/ws', 'status'],
    });
    // 取值本身是 `dev` 时仍按选项值处理，不误判为开发入口。
    expect(detectEntry(['--workspace', 'dev', 'status'])).toEqual({
      entry: 'user',
      argv: ['--workspace', 'dev', 'status'],
    });
  });

  it('只有选项 token 时按用户入口处理', () => {
    expect(detectEntry(['--version'])).toEqual({ entry: 'user', argv: ['--version'] });
  });
});

describe('main（§2.5 进程入口）', () => {
  it('注入的客户端与输出出口生效：开发入口补全候选来自 dev 子树', async () => {
    const capture = captureSink();
    const exitCode = await main(['dev', '__complete'], {
      client: new FakeCliClient(),
      io: capture.sink,
      env: {},
      cwd: '/work',
    });
    expect(exitCode).toBe(0);
    const candidates = candidateLines(capture.stdout());
    expect(candidates).toContain('run');
    expect(candidates).not.toContain('update');
    expect(capture.stderr()).toBe('');
  });

  it('同一入口下的候选集与用户入口不同：update 属于用户侧', async () => {
    const capture = captureSink();
    const exitCode = await main(['__complete'], {
      client: new FakeCliClient(),
      io: capture.sink,
      env: {},
      cwd: '/work',
    });
    expect(exitCode).toBe(0);
    const candidates = candidateLines(capture.stdout());
    expect(candidates).toContain('update');
    expect(candidates).not.toContain('run');
  });

  it('注入的 env 与 cwd 参与工作区解析与缺省目录', async () => {
    const seen: unknown[] = [];
    const fake = new FakeCliClient();
    const client: ICliClient = {
      ...fake,
      capabilities: {
        invoke: (input): Promise<{ output: unknown }> => {
          seen.push(input);
          return Promise.resolve({ output: { text: 'pong' } });
        },
      },
    };
    const capture = captureSink();
    const exitCode = await main(['dev', 'service', 'invoke', '--capability', 'demo:ping'], {
      client,
      io: capture.sink,
      env: { CHIPS_WORKSPACE: 'relative/ws' },
      cwd: '/work',
    });
    expect(exitCode).toBe(0);
    expect(seen).toEqual([
      { capability: 'demo:ping', dir: '/work', input: {}, workspace: '/work/relative/ws' },
    ]);
    expect(JSON.parse(capture.stdout())).toMatchObject({
      ok: true,
      capability: 'demo:ping',
      output: { text: 'pong' },
    });
  });

  it('clientFactory 只在缺省客户端缺失时被 await；显式 client 优先', async () => {
    let factoryCalls = 0;
    const fake = new FakeCliClient();
    const capture = captureSink();
    await main(['__complete'], {
      client: fake,
      clientFactory: (): Promise<ICliClient> => {
        factoryCalls += 1;
        return Promise.resolve(fake);
      },
      io: capture.sink,
      env: {},
      cwd: '/work',
    });
    expect(factoryCalls).toBe(0);

    const other = captureSink();
    const exitCode = await main(['__complete'], {
      clientFactory: (): Promise<ICliClient> => {
        factoryCalls += 1;
        return Promise.resolve(fake);
      },
      io: other.sink,
      env: {},
      cwd: '/work',
    });
    expect(factoryCalls).toBe(1);
    expect(exitCode).toBe(0);
    expect(other.stdout()).toContain('plugin');
  });

  it('缺省组装的本地客户端在非交互环境只输出提示并返回 0', async () => {
    const capture = captureSink();
    const exitCode = await main([], { io: capture.sink, env: {}, cwd: '/work' });
    expect(exitCode).toBe(0);
    expect(capture.stderr()).toContain('当前环境不支持交互式界面');
    expect(capture.stdout()).toBe('');
  });

  it('命令未命中时按 §2.5 映射退出码 3，错误对象写 stdout', async () => {
    const capture = captureSink();
    const exitCode = await main(['没有这个命令'], {
      client: new FakeCliClient(),
      io: capture.sink,
      env: {},
      cwd: '/work',
    });
    expect(exitCode).toBe(3);
    const error = JSON.parse(capture.stdout()) as { code: string };
    expect(error.code).toBe('CLI_COMMAND_NOT_FOUND');
  });

  it('运行期间挂上 SIGINT 监听，返回后复原', async () => {
    const baseline = process.listenerCount('SIGINT');
    let during = -1;
    const fake = new FakeCliClient();
    const client: ICliClient = {
      ...fake,
      cliCommand: {
        ...fake.cliCommand,
        list: (): Promise<ICliCommandListResult> => {
          during = process.listenerCount('SIGINT');
          return Promise.resolve({ index: {}, commands: [] });
        },
      },
    };
    const capture = captureSink();
    await main(['help'], { client, io: capture.sink, env: {}, cwd: '/work' });
    expect(during).toBe(baseline + 1);
    expect(process.listenerCount('SIGINT')).toBe(baseline);
  });

  it('抛出异常同样在 finally 中卸下 SIGINT 监听', async () => {
    const baseline = process.listenerCount('SIGINT');
    const fake = new FakeCliClient();
    const client: ICliClient = {
      ...fake,
      cliCommand: {
        ...fake.cliCommand,
        list: (): Promise<never> => Promise.reject(new Error('承载链路断开')),
      },
    };
    const capture = captureSink();
    const exitCode = await main(['office', 'open'], {
      client,
      io: capture.sink,
      env: {},
      cwd: '/work',
    });
    expect(exitCode).toBe(1);
    expect(process.listenerCount('SIGINT')).toBe(baseline);
    const error = JSON.parse(capture.stdout()) as { code: string; message: string };
    expect(error.code).toBe('CLI_COMMAND_FAILED');
    expect(error.message).toBe('承载链路断开');
  });
});
