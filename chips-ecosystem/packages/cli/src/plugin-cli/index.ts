/**
 * 插件命令索引：命令路径归一、`entryId` 派生、最长前缀匹配与冲突消解
 * （[CLI 完整参考] §2.3、§5.1、§5.5）。
 */

import { cliError } from '../errors.js';
import type { ICliCommandConflict, ICliCommandView } from '../client/types.js';

/** 固定命令根：插件命令路径第一段不得命中（大小写不敏感，含历史保留名 `host`）。 */
export const FIXED_COMMAND_ROOTS: readonly string[] = [
  'help',
  'start',
  'stop',
  'status',
  'config',
  'logs',
  'plugin',
  'update',
  'doctor',
  'open',
  'completion',
  'dev',
  'host',
];

/** 路径段文法。 */
export const COMMAND_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

/** 命令路径归一为字符串数组。 */
export function normalizeCommandPath(path: string | readonly string[]): readonly string[] {
  if (typeof path === 'string') {
    const trimmed = path.trim();
    return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
  }
  return [...path];
}

/** 命令路径键：段小写、单空格连接（[CLI 完整参考] §5.5）。 */
export function commandPathKey(path: string | readonly string[]): string {
  return normalizeCommandPath(path)
    .map((segment) => segment.toLowerCase())
    .join(' ');
}

/** CLI 入口标识（`<pluginId>.cli.<commandPath 点分>`）。 */
export function deriveEntryId(pluginId: string, path: string | readonly string[]): string {
  return `${pluginId}.cli.${normalizeCommandPath(path).join('.')}`;
}

/** 匹配结果。 */
export interface ICommandMatch {
  readonly command: ICliCommandView;
  /** 匹配命令路径之后的 token。 */
  readonly remaining: readonly string[];
}

/** 匹配选项。 */
export interface IMatchCommandOptions {
  /** `--plugin` 限定的 owner，用于冲突消解。 */
  readonly pluginId?: string;
  /** 是否允许匹配禁用插件的命令（治理视图为 true，执行路径为 false）。 */
  readonly includeDisabled?: boolean;
}

/**
 * 按最长命令路径前缀匹配已启用插件命令。
 *
 * - 无匹配返回 `CLI_COMMAND_NOT_FOUND`（退出码 3）；
 * - 同一最长路径存在多个匹配且无法按 `conflict.priority` 唯一消解时返回
 *   `CLI_COMMAND_CONFLICT`（退出码 3），`details.conflicts` 给出冲突组。
 */
export function matchCommand(
  commands: readonly ICliCommandView[],
  argv: readonly string[],
  options: IMatchCommandOptions = {},
): ICommandMatch {
  const candidates = commands.filter(
    (command) => (options.includeDisabled === true || command.enabled) && matchesPlugin(command, options.pluginId),
  );
  const lowered = argv.map((token) => token.toLowerCase());

  let bestLength = 0;
  let best: ICliCommandView[] = [];
  for (const command of candidates) {
    const path = command.commandPath;
    if (path.length === 0 || path.length > argv.length || path.length < bestLength) {
      continue;
    }
    const prefixes = path.every((segment, index) => segment.toLowerCase() === lowered[index]);
    if (!prefixes) {
      continue;
    }
    if (path.length > bestLength) {
      bestLength = path.length;
      best = [command];
      continue;
    }
    best.push(command);
  }

  if (best.length === 0) {
    throw cliError('CLI_COMMAND_NOT_FOUND', `未找到匹配的命令路径：${argv.join(' ')}`, {
      argv: [...argv],
    });
  }
  const selected = resolveConflict(best);
  return { command: selected, remaining: argv.slice(bestLength) };
}

function matchesPlugin(command: ICliCommandView, pluginId: string | undefined): boolean {
  return pluginId === undefined || command.pluginId === pluginId;
}

/** 冲突消解：`conflict.priority` 唯一最高者自动胜出，否则要求 `--plugin` 显式消解。 */
function resolveConflict(commands: readonly ICliCommandView[]): ICliCommandView {
  if (commands.length === 1) {
    const only = commands[0];
    if (only === undefined) {
      throw cliError('CLI_COMMAND_NOT_FOUND', '未找到匹配的命令');
    }
    return only;
  }
  const priorityOf = (command: ICliCommandView): number => command.declaration.conflict?.priority ?? 0;
  const highest = Math.max(...commands.map(priorityOf));
  const top = commands.filter((command) => priorityOf(command) === highest);
  if (top.length === 1) {
    const winner = top[0];
    if (winner !== undefined) {
      return winner;
    }
  }
  const conflicts: ICliCommandConflict[] = commands.map((command) => {
    const conflict: {
      entryId: string;
      commandPath: readonly string[];
      pluginId: string;
      priority: number;
      namespace?: string;
    } = {
      entryId: command.entryId,
      commandPath: command.commandPath,
      pluginId: command.pluginId,
      priority: priorityOf(command),
    };
    const namespace = command.declaration.conflict?.namespace;
    if (namespace !== undefined) {
      conflict.namespace = namespace;
    }
    return conflict;
  });
  throw cliError(
    'CLI_COMMAND_CONFLICT',
    `命令路径存在冲突：${conflicts[0]?.commandPath.join(' ') ?? ''}`,
    { conflicts },
  );
}
