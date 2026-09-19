/**
 * CLI 入口编排：全局选项 → 命令匹配（固定树 / 插件命令）→ 执行 → 输出与退出码
 * （[CLI 完整参考] §二、§三、§四）。
 *
 * 输出纪律：stdout 只承载最终结果或单个错误对象；进度、提示与跟踪只写 stderr；
 * 错误统一归一为 `ChipsError` 并按 §2.5 映射退出码。
 */

import { CliInterruptedError, exitCodeForError, normalizeError } from './errors.js';
import { createNodeFileSystem, type IFileSystemPort } from './args/filesystem.js';
import {
  parseGlobalOptions,
  type CliEntryKind,
  type IGlobalOptions,
} from './args/global-options.js';
import type { IOutputSink } from './output/io.js';
import type { ICommandResult } from './output/result.js';
import { renderError, renderResult } from './output/result.js';
import type { ICliClient } from './client/types.js';
import { createOperationLogger, type IOperationLogger } from './logging/operations.js';
import { CLI_VERSION } from './version.js';
import { listCommands, matchBuiltinCommand } from './commands/registry.js';
import type {
  ICliCommandDefinition,
  ICommandContext,
  IWorkspaceAccessor,
} from './commands/types.js';
import { createHelpCommand } from './commands/help.js';
import { executePluginCommand } from './plugin-cli/execute.js';
import { matchCommand } from './plugin-cli/index.js';
import { runTui } from './tui/run.js';

/** 运行依赖；命令级测试注入 `client` 与内存出口。 */
export interface ICliRunDependencies {
  readonly client: ICliClient;
  readonly io: IOutputSink;
  /** 文件系统端口；缺省绑定 `node:fs`（路径校验、脚手架落盘与打包引擎共用）。 */
  readonly fileSystem?: IFileSystemPort;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly logger?: IOperationLogger;
}

interface ICommandBase {
  readonly entry: CliEntryKind;
  readonly io: IOutputSink;
  readonly fileSystem: IFileSystemPort;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly signal: AbortSignal;
  readonly now: () => number;
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly argv: readonly string[];
  readonly client: ICliClient;
  readonly logger: IOperationLogger;
}

/** 运行用户侧入口。 */
export async function runCli(argv: readonly string[], deps: ICliRunDependencies): Promise<number> {
  return runEntry(argv, deps, 'user');
}

/** 运行开发侧入口。 */
export async function runDevCli(
  argv: readonly string[],
  deps: ICliRunDependencies
): Promise<number> {
  return runEntry(argv, deps, 'dev');
}

/** 运行入口（用户侧 / 开发侧共用）。 */
export async function runEntry(
  argv: readonly string[],
  deps: ICliRunDependencies,
  entry: CliEntryKind
): Promise<number> {
  const startedAt = (deps.now ?? Date.now)();
  const base: ICommandBase = {
    entry,
    io: deps.io,
    fileSystem: deps.fileSystem ?? createNodeFileSystem(),
    env: deps.env,
    cwd: deps.cwd,
    signal: deps.signal ?? new AbortController().signal,
    now: deps.now ?? ((): number => Date.now()),
    sleep: deps.sleep ?? defaultSleep,
    argv,
    client: deps.client,
    logger: deps.logger ?? createOperationLogger(deps.client),
  };

  let globals: IGlobalOptions;
  let rest: readonly string[];
  try {
    const parsed = parseGlobalOptions(argv, entry);
    globals = parsed.options;
    rest = parsed.rest;
  } catch (error) {
    return reportFailure(
      createContext(base, defaultGlobals(), argv.join(' '), []),
      error,
      startedAt
    );
  }

  if (globals.version) {
    return reportVersion(base, globals, startedAt);
  }

  const definitions = listCommands(entry);

  if (rest.length === 0) {
    if (isInteractive(deps)) {
      return runTui({
        context: createContext(base, globals, '', []),
        execute: createTuiExecutor(deps, entry, base),
      });
    }
    base.io.writeErr('当前环境不支持交互式界面，请使用 chips help 查看命令\n');
    return 0;
  }

  if (rest[0] === '--interactive') {
    if (!isInteractive(deps)) {
      base.io.writeErr('当前环境不支持交互式界面，请使用 chips help 查看命令\n');
      return 1;
    }
    return runTui({
      context: createContext(base, globals, '', rest.slice(1)),
      execute: createTuiExecutor(deps, entry, base),
    });
  }

  const builtin = matchBuiltinCommand(definitions, rest);
  if (builtin !== undefined) {
    return runFixedCommand(base, builtin.definition, builtin.remaining, globals, startedAt);
  }

  // 插件命令失败保留插件上下文（命令 ID、命令路径、目标类型），不追加无上下文的顶层失败记录（§2.8.2）。
  let pluginFields: IOperationFields | undefined;
  try {
    const index = await deps.client.cliCommand.list();
    const match = matchCommand(index.commands, rest, {
      ...(globals.pluginId === undefined ? {} : { pluginId: globals.pluginId }),
    });
    const commandPath = match.command.commandPath.join(' ');
    pluginFields = {
      exitCode: 0,
      startedAt,
      commandPath,
      targetType: match.command.declaration.target.type,
      ...(match.command.commandId === undefined ? {} : { commandId: match.command.commandId }),
    };
    if (globals.help) {
      return runFixedCommand(
        base,
        createHelpCommand(definitions),
        [...match.command.commandPath],
        globals,
        startedAt
      );
    }
    const context = createContext(base, globals, commandPath, match.remaining);
    const result = await executePluginCommand({ context, match });
    renderResult(deps.io, result, globals.json);
    const exitCode = result.exitCode ?? 0;
    await recordOperation(context, { ...pluginFields, exitCode });
    return exitCode;
  } catch (error) {
    return reportFailure(
      createContext(base, globals, pluginFields?.commandPath ?? rest.join(' '), []),
      error,
      startedAt,
      pluginFields
    );
  }
}

function createContext(
  base: ICommandBase,
  globals: IGlobalOptions,
  commandPath: string,
  args: readonly string[]
): ICommandContext {
  const workspace = resolveWorkspaceAccessor(base.client, base.entry, globals, base.env, base.cwd);
  let versionPromise: Promise<string | undefined> | undefined;
  return {
    ...base,
    globals,
    commandPath,
    args,
    workspace,
    resolvePlatformVersion: async (): Promise<string | undefined> => {
      versionPromise ??= base.client.platform.version().catch(() => undefined);
      return versionPromise;
    },
  };
}

function defaultGlobals(): IGlobalOptions {
  return { json: false, yes: false, help: false, version: false };
}

async function runFixedCommand(
  base: ICommandBase,
  definition: ICliCommandDefinition,
  args: readonly string[],
  globals: IGlobalOptions,
  startedAt: number
): Promise<number> {
  const commandPath = definition.path.join(' ');
  const context = createContext(base, globals, commandPath, args);
  try {
    const result = await definition.run(context);
    renderResult(base.io, withDeclaredOutputMode(result, definition), globals.json);
    const exitCode = result.exitCode ?? 0;
    await recordOperation(context, { exitCode, startedAt, commandPath, targetType: 'platform' });
    return exitCode;
  } catch (error) {
    return reportFailure(context, error, startedAt);
  }
}

/**
 * 内建命令的缺省输出形态由定义声明（`outputMode`，缺省 `json`，[CLI 完整参考] §2.4.2）；
 * 命令自身返回的 `mode` 优先（例如按参数分支决定形态的命令）。
 */
function withDeclaredOutputMode(
  result: ICommandResult,
  definition: ICliCommandDefinition
): ICommandResult {
  if (result.mode !== undefined) {
    return result;
  }
  return { ...result, mode: definition.outputMode ?? 'json' };
}

interface IOperationFields {
  readonly exitCode: number;
  readonly startedAt: number;
  readonly commandId?: string;
  readonly commandPath?: string;
  readonly targetType?: 'app' | 'service' | 'platform';
}

async function recordOperation(context: ICommandContext, fields: IOperationFields): Promise<void> {
  const workspace = await context.workspace.resolve().catch(() => undefined);
  await context.logger.record({
    source: 'cli',
    argv: context.argv,
    ...(workspace === undefined ? {} : { workspace }),
    exitCode: fields.exitCode,
    durationMs: context.now() - fields.startedAt,
    ...(fields.commandId === undefined ? {} : { commandId: fields.commandId }),
    ...(fields.commandPath === undefined ? {} : { commandPath: fields.commandPath }),
    ...(fields.targetType === undefined ? {} : { targetType: fields.targetType }),
  });
}

async function reportFailure(
  context: ICommandContext,
  cause: unknown,
  startedAt: number,
  pluginFields?: IOperationFields
): Promise<number> {
  const detail: IOperationFields = pluginFields ?? {
    exitCode: 0,
    startedAt,
    ...(context.commandPath.length === 0 ? {} : { commandPath: context.commandPath }),
  };
  // 用户中断没有错误码，也不产生错误对象：直接以 130 收口（[CLI 完整参考] §2.5）。
  if (cause instanceof CliInterruptedError) {
    await recordOperation(context, { ...detail, exitCode: 130 });
    return 130;
  }
  const error = normalizeError(cause);
  renderError(context.io, error);
  const exitCode = exitCodeForError(error);
  await recordOperation(context, { ...detail, exitCode });
  return exitCode;
}

async function reportVersion(
  base: ICommandBase,
  globals: IGlobalOptions,
  startedAt: number
): Promise<number> {
  const context = createContext(base, globals, '--version', []);
  const platformVersion = await context.resolvePlatformVersion();
  const json = { chips: CLI_VERSION, platform: platformVersion ?? null };
  renderResult(base.io, { json, mode: 'json' }, globals.json);
  await recordOperation(context, { exitCode: 0, startedAt, commandPath: '--version' });
  return 0;
}

/** 工作区访问器：`--workspace`（dev）→ `CHIPS_WORKSPACE`（dev）→ 平台缺省值（[CLI 完整参考] §2.2）。 */
export function resolveWorkspaceAccessor(
  client: ICliClient,
  entry: CliEntryKind,
  globals: IGlobalOptions,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string
): IWorkspaceAccessor {
  let cached: Promise<{ readonly path: string; readonly kind: CliEntryKind }> | undefined;
  return {
    kind: entry,
    resolve: async () => {
      cached ??= (async () => {
        if (entry === 'dev') {
          // 平台缺省值始终解析：显式覆盖时它仍参与工作区初始化兜底与操作日志摘要（§2.2）。
          const platformDefault = await client.platform.defaultWorkspacePath('dev');
          const explicit = globals.workspace ?? env.CHIPS_WORKSPACE;
          if (explicit !== undefined && explicit.length > 0) {
            return {
              path: isAbsolutePath(explicit) ? explicit : `${cwd}/${explicit}`,
              kind: 'dev' as const,
            };
          }
          return { path: platformDefault, kind: 'dev' as const };
        }
        return { path: await client.platform.defaultWorkspacePath('user'), kind: 'user' as const };
      })();
      return cached;
    },
  };
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
}

function isInteractive(deps: ICliRunDependencies): boolean {
  return deps.io.isTTY;
}

/** TUI 执行器：把最终 token 交回同一入口（含全局选项解析与插件命令匹配）。 */
function createTuiExecutor(
  deps: ICliRunDependencies,
  entry: CliEntryKind,
  base: ICommandBase
): (tokens: readonly string[], sink: IOutputSink, signal: AbortSignal) => Promise<number> {
  return (tokens, sink, signal) =>
    runEntry(tokens, { ...deps, io: sink, signal, logger: base.logger }, entry);
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
