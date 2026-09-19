/**
 * TUI 终端端口与运行器（[CLI 完整参考] §3.1.1「TUI 契约」）：
 * 按键序列解析、备用屏幕与 raw mode 生命周期、字符界面键盘循环，
 * 以及执行时把最终 token 交回**同一** CLI 执行器（不定义第二套执行语义）。
 */

import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { createNullOperationLogger } from '../src/logging/operations.js';
import type { ICliClient } from '../src/client/types.js';
import type { IOutputSink } from '../src/output/io.js';
import { MemoryFileSystem } from './support/memory-file-system.js';
import { FakeCliClient } from './support/fake-client.js';
import { createNodeTerminal, parseKeys, type ITerminal, type ITuiKey } from '../src/tui/terminal.js';
import { runTui, type ITuiRunOptions } from '../src/tui/run.js';
import type { ICommandContext } from '../src/commands/types.js';

/** 可写流替身。 */
class FakeStdout extends EventEmitter {
  public readonly chunks: string[] = [];

  public isTTY: boolean = true;

  public columns: number | undefined = 80;

  public rows: number | undefined = 24;

  public write(text: string): boolean {
    this.chunks.push(text);
    return true;
  }
}

/** 可读流替身。 */
class FakeStdin extends EventEmitter {
  public isTTY: boolean = true;

  public rawMode: boolean | undefined;

  public resumed = false;

  public paused = false;

  public encoding = '';

  public setRawMode(value: boolean): this {
    this.rawMode = value;
    return this;
  }

  public resume(): this {
    this.resumed = true;
    this.paused = false;
    return this;
  }

  public pause(): this {
    this.paused = true;
    return this;
  }

  public setEncoding(encoding: string): this {
    this.encoding = encoding;
    return this;
  }
}

/** 用假的 stdin/stdout 替换进程流，回调结束后恢复。 */
async function withFakeStreams<T>(stdin: FakeStdin, stdout: FakeStdout, body: () => Promise<T> | T): Promise<T> {
  const originalIn = process.stdin;
  const originalOut = process.stdout;
  Object.defineProperty(process, 'stdin', { value: stdin, configurable: true, writable: true });
  Object.defineProperty(process, 'stdout', { value: stdout, configurable: true, writable: true });
  try {
    return await body();
  } finally {
    Object.defineProperty(process, 'stdin', { value: originalIn, configurable: true, writable: true });
    Object.defineProperty(process, 'stdout', { value: originalOut, configurable: true, writable: true });
  }
}

describe('parseKeys（§3.1.1 键盘操作）', () => {
  it('方向键转义序列解析为独立按键，一次输入可含多键', () => {
    expect(parseKeys('\u001b[A\u001b[B\u001b[C\u001b[D')).toEqual([{ name: 'up' }, { name: 'down' }, { name: 'right' }, { name: 'left' }]);
  });

  it('回车、空格、退格、Ctrl+C、Ctrl+\\ 各自成键', () => {
    expect(parseKeys('\r\n')).toEqual([{ name: 'enter' }, { name: 'enter' }]);
    expect(parseKeys(' ')).toEqual([{ name: 'space' }]);
    expect(parseKeys('\u007f\b')).toEqual([{ name: 'backspace' }, { name: 'backspace' }]);
    expect(parseKeys('\u0003')).toEqual([{ name: 'ctrl-c' }]);
    expect(parseKeys('\u001c')).toEqual([{ name: 'ctrl-backslash' }]);
  });

  it('孤立转义符按 escape 处理，普通字符携带 char', () => {
    expect(parseKeys('\u001b')).toEqual([{ name: 'escape' }]);
    expect(parseKeys('\u001b[Z')).toEqual([{ name: 'escape' }, { name: 'char', char: '[' }, { name: 'char', char: 'Z' }]);
    expect(parseKeys('ab')).toEqual([{ name: 'char', char: 'a' }, { name: 'char', char: 'b' }]);
  });

  it('空输入与转义序列前缀混排按逐段解析', () => {
    expect(parseKeys('')).toEqual([]);
    expect(parseKeys('x\u001b[Ay')).toEqual([{ name: 'char', char: 'x' }, { name: 'up' }, { name: 'char', char: 'y' }]);
  });
});

describe('createNodeTerminal（§3.1.1 备用屏幕与 raw mode）', () => {
  it('两端均为 TTY 时才判定可交互，并暴露尺寸', async () => {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();
    await withFakeStreams(stdin, stdout, () => {
      const terminal = createNodeTerminal();
      expect(terminal.isTTY).toBe(true);
      expect(terminal.columns).toBe(80);
      expect(terminal.rows).toBe(24);
      stdout.columns = undefined;
      stdout.rows = undefined;
      expect(terminal.columns).toBe(80);
      expect(terminal.rows).toBe(24);
      stdin.isTTY = false;
      expect(terminal.isTTY).toBe(false);
      stdout.isTTY = false;
      stdin.isTTY = true;
      expect(terminal.isTTY).toBe(false);
    });
  });

  it('enter 进入备用屏幕、隐藏光标并开启 raw mode 输入', async () => {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();
    await withFakeStreams(stdin, stdout, () => {
      const terminal = createNodeTerminal();
      const keys: ITuiKey[] = [];
      terminal.onKey((key) => keys.push(key));
      terminal.enter();
      expect(stdout.chunks[0]).toBe('\u001b[?1049h\u001b[?25l');
      expect(stdin.rawMode).toBe(true);
      expect(stdin.resumed).toBe(true);
      expect(stdin.encoding).toBe('utf8');
      stdin.emit('data', 'pi');
      stdin.emit('data', Buffer.from('\u001b[A\r'));
      expect(keys).toEqual([
        { name: 'char', char: 'p' },
        { name: 'char', char: 'i' },
        { name: 'up' },
        { name: 'enter' },
      ]);
    });
  });

  it('exit 摘除监听、恢复光标与主屏幕并关闭 raw mode', async () => {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();
    await withFakeStreams(stdin, stdout, () => {
      const terminal = createNodeTerminal();
      const keys: ITuiKey[] = [];
      const off = terminal.onKey((key) => keys.push(key));
      terminal.enter();
      terminal.exit();
      expect(stdin.rawMode).toBe(false);
      expect(stdin.paused).toBe(true);
      expect(stdout.chunks.at(-1)).toBe('\u001b[?25h\u001b[?1049l');
      stdin.emit('data', 'x');
      expect(keys).toEqual([]);
      const late: ITuiKey[] = [];
      const offLate = terminal.onKey((key) => late.push(key));
      terminal.enter();
      off();
      stdin.emit('data', 'y');
      expect(late).toEqual([{ name: 'char', char: 'y' }]);
      offLate();
      stdin.emit('data', 'z');
      expect(late).toEqual([{ name: 'char', char: 'y' }]);
      terminal.exit();
    });
  });

  it('退订后不再收到按键，resize 通知可注册与退订', async () => {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();
    await withFakeStreams(stdin, stdout, () => {
      const terminal = createNodeTerminal();
      const keys: ITuiKey[] = [];
      const resizes: number[] = [];
      const offKey = terminal.onKey((key) => keys.push(key));
      const offResize = terminal.onResize(() => resizes.push(resizes.length + 1));
      terminal.enter();
      stdout.emit('resize');
      expect(resizes).toEqual([1]);
      offKey();
      offResize();
      stdin.emit('data', 'x');
      stdout.emit('resize');
      expect(keys).toEqual([]);
      expect(resizes).toEqual([1]);
      terminal.exit();
    });
  });

  it('非 TTY 环境 enter 不改动输入模式', async () => {
    const stdin = new FakeStdin();
    stdin.isTTY = false;
    const stdout = new FakeStdout();
    await withFakeStreams(stdin, stdout, () => {
      const terminal = createNodeTerminal();
      terminal.enter();
      expect(stdin.rawMode).toBeUndefined();
      terminal.exit();
      expect(stdin.paused).toBe(false);
    });
  });
});

/** 脚本化终端：按键由测试逐条推送，写出内容全部留存。 */
class FakeTerminal implements ITerminal {
  public readonly written: string[] = [];

  public readonly resizes: (() => void)[] = [];

  private handler: ((key: ITuiKey) => void) | undefined;

  public constructor(
    public isTTY: boolean = true,
    public columns: number = 100,
    public rows: number = 30,
  ) {}

  public write(text: string): void {
    this.written.push(text);
  }

  public enter(): void {
    this.written.push('[enter]');
  }

  public exit(): void {
    this.written.push('[exit]');
  }

  public onKey(handler: (key: ITuiKey) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = undefined;
    };
  }

  public onResize(handler: () => void): () => void {
    this.resizes.push(handler);
    return () => {
      const index = this.resizes.indexOf(handler);
      if (index >= 0) {
        this.resizes.splice(index, 1);
      }
    };
  }

  public key(name: ITuiKey['name'], char?: string): void {
    this.dispatch(char === undefined ? { name } : { name, char });
  }

  public dispatch(key: ITuiKey): void {
    this.handler?.(key);
  }

  public type(text: string): void {
    for (const char of text) {
      if (char === ' ') {
        this.key('space');
      } else {
        this.key('char', char);
      }
    }
  }

  public get frame(): string {
    return this.written.join('');
  }
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createContext(client: ICliClient, io: IOutputSink): ICommandContext {
  return {
    entry: 'user',
    globals: { json: false, yes: false, help: false, version: false },
    io,
    env: {},
    cwd: '/work',
    fileSystem: new MemoryFileSystem(),
    client,
    signal: new AbortController().signal,
    resolvePlatformVersion: () => Promise.resolve('0.1.0'),
    workspace: {
      kind: 'user',
      resolve: () => Promise.resolve({ path: '/ws', kind: 'user' as const }),
    },
    logger: createNullOperationLogger(),
    now: () => 1000,
    sleep: () => Promise.resolve(),
    commandPath: '',
    args: [],
    argv: [],
  };
}

function captureSink(): { sink: IOutputSink; stdout: () => string; stderr: () => string } {
  let out = '';
  let err = '';
  return {
    sink: {
      isTTY: false,
      writeOut(text: string): void {
        out += text;
      },
      writeErr(text: string): void {
        err += text;
      },
    },
    stdout: () => out,
    stderr: () => err,
  };
}

describe('runTui（§3.1.1 键盘循环交回同一执行器）', () => {
  it('非交互终端输出提示并返回 1，不进入循环', async () => {
    const terminal = new FakeTerminal(false);
    const { sink, stderr } = captureSink();
    const exitCode = await runTui({
      context: createContext(new FakeCliClient(), sink),
      execute: () => Promise.resolve(0),
      terminal,
    });
    expect(exitCode).toBe(1);
    expect(stderr()).toContain('当前环境不支持交互式界面');
    expect(terminal.written).toEqual([]);
  });

  it('固定命令表单确认后以最终 token 调用执行器并渲染结果面板', async () => {
    const terminal = new FakeTerminal();
    const executed: { tokens: readonly string[]; signal: AbortSignal }[] = [];
    const options: ITuiRunOptions = {
      context: createContext(new FakeCliClient(), captureSink().sink),
      execute: (tokens, sink, signal) => {
        executed.push({ tokens, signal });
        sink.writeOut('已列出插件');
        return Promise.resolve(0);
      },
      terminal,
    };
    const running = runTui(options);
    await settle();
    terminal.type('completion ');
    terminal.key('enter');
    await settle();
    expect(terminal.frame).toContain('参数：completion');
    terminal.key('enter');
    await settle();
    expect(executed.map((item) => item.tokens)).toEqual([['completion', 'bash']]);
    expect(terminal.frame).toContain('执行中：completion bash');
    expect(terminal.frame).toContain('成功');
    expect(terminal.frame).toContain('退出码: 0');
    expect(terminal.frame).toContain('已列出插件');
    terminal.key('ctrl-backslash');
    await expect(running).resolves.toBe(0);
    expect(terminal.written.at(-1)).toBe('[exit]');
  });

  it('结果面板 R 键重跑上一条命令，Enter 返回命令输入', async () => {
    const terminal = new FakeTerminal();
    const tokens: string[][] = [];
    const running = runTui({
      context: createContext(new FakeCliClient(), captureSink().sink),
      execute: (t) => {
        tokens.push([...t]);
        return Promise.resolve(0);
      },
      terminal,
    });
    await settle();
    terminal.type('completion ');
    terminal.key('enter');
    await settle();
    terminal.key('enter');
    await settle();
    terminal.key('char', 'r');
    await settle();
    expect(tokens).toEqual([
      ['completion', 'bash'],
      ['completion', 'bash'],
    ]);
    terminal.key('enter');
    await settle();
    terminal.key('char', 'z');
    await settle();
    expect(terminal.written.at(-1)).toContain('chips > z');
    terminal.key('ctrl-backslash');
    await running;
  });

  it('执行器抛错与错误信封都落到结果面板的错误摘要', async () => {
    const terminal = new FakeTerminal();
    const { sink } = captureSink();
    let mode = 'throw';
    const running = runTui({
      context: createContext(new FakeCliClient(), sink),
      execute: (_tokens, out) => {
        if (mode === 'throw') {
          // 带 `code` 的普通 `Error`：走 `normalizeError` 的「非 ChipsError 但带错误码」归一分支。
          throw Object.assign(new Error('任务执行失败'), { code: 'CLI_TASK_FAILED' });
        }
        out.writeOut('{"code":"CLI_PLUGIN_FAILED","error":"插件返回失败"}');
        return Promise.resolve(5);
      },
      terminal,
    });
    await settle();
    terminal.type('completion ');
    terminal.key('enter');
    await settle();
    terminal.key('enter');
    await settle();
    expect(terminal.frame).toContain('错误码: CLI_TASK_FAILED');
    expect(terminal.frame).toContain('错误信息: 任务执行失败');
    mode = 'envelope';
    terminal.key('char', 'r');
    await settle();
    expect(terminal.frame).toContain('错误码: CLI_PLUGIN_FAILED');
    expect(terminal.frame).toContain('错误信息: 插件返回失败');
    expect(terminal.frame).toContain('退出码: 5');
    terminal.key('ctrl-backslash');
    await running;
  });

  it('执行器输出非 JSON 文本时不解析错误摘要', async () => {
    const terminal = new FakeTerminal();
    const running = runTui({
      context: createContext(new FakeCliClient(), captureSink().sink),
      execute: (_tokens, out) => {
        out.writeOut('{ 这不是一个 JSON 文档');
        out.writeErr('\n进度提示');
        return Promise.resolve(2);
      },
      terminal,
    });
    await settle();
    terminal.type('completion ');
    terminal.key('enter');
    await settle();
    terminal.key('enter');
    await settle();
    expect(terminal.frame).toContain('退出码: 2');
    expect(terminal.frame).toContain('进度提示');
    expect(terminal.frame).not.toContain('错误码:');
    terminal.key('ctrl-backslash');
    await running;
  });

  it('compose 面板的候选补全与 Ctrl+C 清屏在运行器等价生效', async () => {
    const terminal = new FakeTerminal();
    const running = runTui({
      context: createContext(new FakeCliClient(), captureSink().sink),
      execute: () => Promise.resolve(0),
      terminal,
    });
    await settle();
    const initial = terminal.written.at(-1) ?? '';
    expect(initial).toContain('  > __complete');
    expect(initial).toContain('    config');
    expect(initial).toContain('    plugin');
    terminal.type('plugi');
    await settle();
    expect(terminal.written.at(-1)).toContain('  > plugin');
    terminal.key('down');
    terminal.key('down');
    terminal.key('enter');
    await settle();
    expect(terminal.written.at(-1)).toContain('chips > plugin');
    terminal.key('ctrl-c');
    await settle();
    expect(terminal.written.at(-1)).toContain('chips > \n');
    expect(terminal.written.at(-1)).toContain('  （无候选）');
    terminal.key('ctrl-backslash');
    await running;
  });

  it('resize 事件触发重绘，退订后不再响应', async () => {
    const terminal = new FakeTerminal();
    const running = runTui({
      context: createContext(new FakeCliClient(), captureSink().sink),
      execute: () => Promise.resolve(0),
      terminal,
    });
    await settle();
    const before = terminal.written.length;
    terminal.resizes.forEach((notify) => notify());
    expect(terminal.written.length).toBe(before + 1);
    terminal.key('ctrl-backslash');
    await running;
    const afterExit = terminal.written.length;
    terminal.resizes.forEach((notify) => notify());
    expect(terminal.written.length).toBe(afterExit);
  });

  it('插件命令进入候选与表单，索引不可用时仅用固定命令树', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [
      {
        entryId: 'chips.demo.app#open',
        commandPath: ['demo', 'open'],
        pluginId: 'chips.demo.app',
        enabled: true,
        declaration: {
          commandPath: ['demo', 'open'],
          title: '打开示例',
          target: { type: 'app', pluginId: 'chips.demo.app' },
          arguments: [{ name: 'path', type: 'string', position: 0, required: true }],
        },
        conflicts: [],
      },
    ];
    const executed: (readonly string[])[] = [];
    const terminal = new FakeTerminal();
    const running = runTui({
      context: createContext(client, captureSink().sink),
      execute: (tokens) => {
        executed.push(tokens);
        return Promise.resolve(0);
      },
      terminal,
    });
    await settle();
    terminal.type('demo ');
    await settle();
    expect(terminal.written.at(-1)).toContain('  > open');
    terminal.key('enter');
    await settle();
    expect(terminal.written.at(-1)).toContain('chips > demo open');
    terminal.key('enter');
    await settle();
    expect(terminal.written.at(-1)).toContain('参数：demo open');
    expect(terminal.written.at(-1)).toContain('path [string/必填]');
    terminal.key('char', '/');
    terminal.key('char', 'x');
    await settle();
    terminal.key('enter');
    await settle();
    expect(executed).toEqual([['demo', 'open', '/x']]);
    terminal.key('ctrl-backslash');
    await running;

    const broken: ICliClient = {
      ...client,
      cliCommand: {
        ...client.cliCommand,
        list: () => Promise.reject(new Error('索引不可用')),
      },
    };
    const terminalTwo = new FakeTerminal();
    const runningTwo = runTui({
      context: createContext(broken, captureSink().sink),
      execute: () => Promise.resolve(0),
      terminal: terminalTwo,
    });
    await settle();
    terminalTwo.type('s');
    await settle();
    expect(terminalTwo.written.at(-1)).toContain('  > start');
    terminalTwo.key('ctrl-backslash');
    await expect(runningTwo).resolves.toBe(0);
  });
});
