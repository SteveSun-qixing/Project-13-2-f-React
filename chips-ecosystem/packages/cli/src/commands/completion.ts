/**
 * 补全命令：`chips completion <bash|zsh|fish>`（用户侧）与私有入口 `__complete`（[CLI 完整参考] §3.9）。
 */

import type { IParameterDeclaration } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import { COMPLETION_SHELLS, renderCompletionScript } from '../completion/scripts.js';
import { FIXED_COMMAND_PATHS } from './fixed-paths.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, readString } from './helpers.js';

const shellArgument: IParameterDeclaration = {
  name: 'shell',
  position: 0,
  type: 'enum',
  choices: [...COMPLETION_SHELLS],
  required: true,
  mapsTo: 'shell',
};

/** `chips completion <shell>`。 */
export const completionCommand: ICliCommandDefinition = {
  path: ['completion'],
  summary: '输出 shell 补全脚本',
  usage: 'chips completion <bash|zsh|fish>',
  outputMode: 'human',
  parameters: { arguments: [shellArgument] },
  run: (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { arguments: [shellArgument] });
    const shell = readString(values, 'shell') ?? '';
    const script = renderCompletionScript(shell, context.entry);
    return Promise.resolve({
      json: { shell, script },
      human: script.split('\n').filter((line) => line.length > 0),
    });
  },
};

/**
 * 固定命令树在当前入口下的候选路径。
 *
 * 开发侧可见命令 = `dev` 子树（§1.2）：`dev` 前缀在开发入口内被剥离并去重（§4.4、§4.5），
 * 未加前缀的顶层段只有在 `dev` 子树里同名存在时才属于开发命令面——用户侧专属入口
 * （`update` 平台自更新，§1.5）在开发侧不存在，不得作为候选出现。
 */
export function fixedPathsForEntry(entry: 'user' | 'dev'): readonly (readonly string[])[] {
  if (entry === 'user') {
    return FIXED_COMMAND_PATHS;
  }
  const devRoots = new Set<string>();
  for (const path of FIXED_COMMAND_PATHS) {
    if (path[0] === 'dev' && path.length > 1) {
      devRoots.add(path[1] ?? '');
    }
  }
  const seen = new Set<string>();
  const result: (readonly string[])[] = [];
  for (const path of FIXED_COMMAND_PATHS) {
    let candidate: readonly string[];
    if (path[0] === 'dev') {
      candidate = path.slice(1);
      if (candidate.length === 0) {
        continue;
      }
    } else {
      if (!devRoots.has(path[0] ?? '')) {
        continue;
      }
      candidate = path;
    }
    const key = candidate.join(' ');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

/**
 * 计算补全候选：固定命令树 + 当前工作区命令索引；索引读取失败时静默返回空集（§3.9）。
 *
 * 输入 token 的最后一个元素是当前待补全词；输出为当前段的候选（前缀匹配，大小写不敏感）。
 */
export async function completeCandidates(
  context: ICommandContext,
  tokens: readonly string[]
): Promise<readonly string[]> {
  const paths: (readonly string[])[] = [...fixedPathsForEntry(context.entry)];
  try {
    const result = await context.client.cliCommand.list();
    for (const command of result.commands) {
      paths.push(command.commandPath);
    }
  } catch {
    // 索引读取失败时静默返回固定命令树候选（§3.9）。
  }

  const current = tokens.length === 0 ? '' : (tokens[tokens.length - 1] ?? '');
  const preceding = tokens
    .slice(0, Math.max(0, tokens.length - 1))
    .map((token) => token.toLowerCase());
  const candidates = new Set<string>();
  for (const path of paths) {
    if (path.length <= preceding.length) {
      continue;
    }
    // 已输入的每个 token 必须与命令路径的对应段一致（大小写不敏感）；当前段由前缀过滤。
    const matches = preceding.every((token, index) => (path[index] ?? '').toLowerCase() === token);
    if (!matches) {
      continue;
    }
    const segment = path[preceding.length];
    if (segment === undefined) {
      continue;
    }
    if (current.length === 0 || segment.toLowerCase().startsWith(current.toLowerCase())) {
      candidates.add(segment);
    }
  }
  return [...candidates].sort((left, right) => left.localeCompare(right, 'en'));
}

/** 私有入口 `__complete`。 */
export const completeCommand: ICliCommandDefinition = {
  path: ['__complete'],
  summary: '补全候选私有入口（换行分隔）',
  usage: 'chips __complete <tokens...>',
  outputMode: 'human',
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const candidates = await completeCandidates(context, context.args);
    return { json: candidates, human: candidates, mode: 'human' };
  },
};
