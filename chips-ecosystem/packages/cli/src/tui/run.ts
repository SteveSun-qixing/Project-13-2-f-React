/**
 * TUI 运行器：字符界面三段式、键盘循环，并把最终 token 交回**同一** CLI 执行器
 * （[CLI 完整参考] §3.1.2）。TUI 不定义第二套执行语义。
 */

import type { IOutputSink } from '../output/io.js';
import type { ICliCommandView } from '../client/types.js';
import { listCommands, matchBuiltinCommand } from '../commands/registry.js';
import type { ICommandContext } from '../commands/types.js';
import { fixedPathsForEntry } from '../commands/completion.js';
import { matchCommand } from '../plugin-cli/index.js';
import { createNodeTerminal, type ITerminal, type ITuiKey } from './terminal.js';
import { renderFrame } from './render.js';
import {
  buildTokens,
  computeCandidates,
  initialState,
  reduceKey,
  splitTokens,
  type ITuiState,
  type ITuiTarget,
} from './state.js';

/** TUI 运行选项。 */
export interface ITuiRunOptions {
  readonly context: ICommandContext;
  /** 同一 CLI 执行器：固定命令树 + 插件命令解析、任务等待与结果输出完全一致。 */
  readonly execute: (
    tokens: readonly string[],
    sink: IOutputSink,
    signal: AbortSignal,
  ) => Promise<number>;
  readonly terminal?: ITerminal;
}

/** 内存出口：捕获一次执行的 stdout/stderr，供结果面板展示。 */
function createCaptureSink(): { sink: IOutputSink; out(): string; err(): string } {
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
    out: () => out,
    err: () => err,
  };
}

/** 运行 TUI；返回进程退出码。 */
export async function runTui(options: ITuiRunOptions): Promise<number> {
  const terminal = options.terminal ?? createNodeTerminal();
  if (!terminal.isTTY) {
    options.context.io.writeErr('当前环境不支持交互式界面，请使用 chips help 查看命令\n');
    return 1;
  }
  const index = await options.context.client.cliCommand.list().catch(() => undefined);
  const pluginCommands: readonly ICliCommandView[] = index?.commands ?? [];
  const commandPaths = [
    ...fixedPathsForEntry(options.context.entry).map((path) => path.join(' ')),
    ...pluginCommands.map((command) => command.commandPath.join(' ')),
  ];
  const definitions = listCommands(options.context.entry);

  let state: ITuiState = { ...initialState(), candidates: computeCandidates('', commandPaths) };
  let lastTokens: readonly string[] = [];
  const controller = new AbortController();

  const keyQueue: ITuiKey[] = [];
  const waiters: ((key: ITuiKey) => void)[] = [];
  const unsubscribeKey = terminal.onKey((key) => {
    const waiter = waiters.shift();
    if (waiter !== undefined) {
      waiter(key);
      return;
    }
    keyQueue.push(key);
  });
  const unsubscribeResize = terminal.onResize(() => {
    render();
  });

  const nextKey = (): Promise<ITuiKey> =>
    new Promise((resolve) => {
      const queued = keyQueue.shift();
      if (queued !== undefined) {
        resolve(queued);
        return;
      }
      waiters.push(resolve);
    });

  const render = (): void => {
    terminal.write(`\u001b[2J\u001b[H\u001b[3J${renderFrame(state, terminal.columns)}\n`);
  };

  const resolveTarget = (tokens: readonly string[]): ITuiTarget | undefined => {
    const builtin = matchBuiltinCommand(definitions, tokens);
    if (
      builtin !== undefined &&
      builtin.definition.path.length === tokens.length &&
      builtin.definition.parameters !== undefined
    ) {
      return {
        commandPath: builtin.definition.path,
        argumentsList: builtin.definition.parameters.arguments ?? [],
        optionsList: builtin.definition.parameters.options ?? [],
      };
    }
    try {
      const match = matchCommand(pluginCommands, tokens);
      if (match.command.commandPath.length !== tokens.length) {
        return undefined;
      }
      return {
        commandPath: match.command.commandPath,
        argumentsList: match.command.declaration.arguments ?? [],
        optionsList: match.command.declaration.options ?? [],
      };
    } catch {
      return undefined;
    }
  };

  const environment = { commandPaths, resolveTarget };

  const executeTokens = async (tokens: readonly string[]): Promise<void> => {
    lastTokens = tokens;
    state = { ...state, panel: 'running', commandPath: tokens.join(' ') };
    render();
    const capture = createCaptureSink();
    const startedAt = options.context.now();
    let exitCode = 0;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    try {
      exitCode = await options.execute(tokens, capture.sink, controller.signal);
    } catch (error) {
      exitCode = 1;
      const normalized = error as { code?: unknown; message?: unknown };
      errorCode = typeof normalized.code === 'string' ? normalized.code : 'CLI_COMMAND_FAILED';
      errorMessage = typeof normalized.message === 'string' ? normalized.message : String(error);
    }
    const stdout = capture.out();
    const stderr = capture.err();
    if (stdout.trim().length > 0 && stdout.trimStart().startsWith('{')) {
      try {
        const parsed = JSON.parse(stdout) as { code?: unknown; error?: unknown };
        if (typeof parsed.code === 'string') {
          errorCode = parsed.code;
          errorMessage = typeof parsed.error === 'string' ? parsed.error : errorMessage;
        }
      } catch {
        // 非错误 JSON，保持原样。
      }
    }
    state = {
      ...state,
      panel: 'result',
      result: {
        ok: exitCode === 0,
        exitCode,
        durationMs: options.context.now() - startedAt,
        output: `${stdout}${stderr}`,
        ...(errorCode === undefined ? {} : { errorCode }),
        ...(errorMessage === undefined ? {} : { errorMessage }),
      },
    };
    render();
  };

  terminal.enter();
  render();
  try {
    for (;;) {
      const key = await nextKey();
      if (key.name === 'ctrl-backslash') {
        return 0;
      }
      if (state.panel === 'running') {
        if (key.name === 'ctrl-c') {
          controller.abort();
        }
        continue;
      }
      if (state.panel === 'result') {
        if (key.name === 'char' && (key.char ?? '').toLowerCase() === 'r' && lastTokens.length > 0) {
          await executeTokens(lastTokens);
          continue;
        }
        if (key.name === 'enter') {
          state = initialState();
          state = { ...state, candidates: computeCandidates('', commandPaths) };
          render();
          continue;
        }
      }
      const previousPanel = state.panel;
      state = reduceKey(state, key, environment);
      if (previousPanel === 'form' && key.name === 'enter') {
        const tokens = buildTokens(state);
        if (tokens.length > 0) {
          await executeTokens(tokens);
          continue;
        }
      }
      render();
    }
  } finally {
    unsubscribeKey();
    unsubscribeResize();
    terminal.exit();
  }
}

/** 供状态机外部使用：切分缓冲（保持单一实现）。 */
export { splitTokens };
