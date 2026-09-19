/**
 * 全局选项解析与剥离（[CLI 完整参考] §2.1、§2.2）。
 *
 * - 全局选项可出现在命令路径前后任意位置，解析时被剥离，不进入插件 payload；
 * - `--` 终止选项解析，其后 token 一律按位置参数处理；
 * - 未知选项不在此层判定（归属命令或插件声明），由后续解析器给出 `CLI_ARGUMENT_INVALID`；
 * - 用户侧不接受 `--workspace`（仅 `chips dev`），违规返回 `CLI_ARGUMENT_INVALID` 并给出提示。
 */

import { cliError } from '../errors.js';

/** 全局选项。 */
export interface IGlobalOptions {
  readonly json: boolean;
  readonly pluginId?: string;
  readonly workspace?: string;
  readonly yes: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

/** 剥离结果。 */
export interface IGlobalParseResult {
  readonly options: IGlobalOptions;
  readonly rest: readonly string[];
}

/** 入口类型：用户侧 / 开发侧。 */
export type CliEntryKind = 'user' | 'dev';

interface IMutableGlobals {
  json: boolean;
  pluginId: string | undefined;
  workspace: string | undefined;
  yes: boolean;
  help: boolean;
  version: boolean;
}

const BOOLEAN_FLAGS = new Set(['json', 'yes', 'help', 'version']);
const VALUE_FLAGS = new Set(['plugin', 'workspace']);

/** 解析并剥离全局选项。 */
export function parseGlobalOptions(argv: readonly string[], entry: CliEntryKind): IGlobalParseResult {
  const options: IMutableGlobals = {
    json: false,
    pluginId: undefined,
    workspace: undefined,
    yes: false,
    help: false,
    version: false,
  };
  const rest: string[] = [];
  let terminated = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (terminated) {
      rest.push(token);
      continue;
    }
    if (token === '--') {
      terminated = true;
      continue;
    }
    if (!token.startsWith('--')) {
      rest.push(token);
      continue;
    }

    const body = token.slice(2);
    const equalsIndex = body.indexOf('=');
    const name = equalsIndex === -1 ? body : body.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : body.slice(equalsIndex + 1);

    if (BOOLEAN_FLAGS.has(name)) {
      const value = parseBooleanFlag(name, inlineValue);
      switch (name) {
        case 'json':
          options.json = value;
          break;
        case 'yes':
          options.yes = value;
          break;
        case 'help':
          options.help = value;
          break;
        case 'version':
          options.version = value;
          break;
        default:
          break;
      }
      continue;
    }

    if (VALUE_FLAGS.has(name)) {
      const value = inlineValue ?? argv[index + 1];
      if (value === undefined || value.length === 0) {
        throw cliError('CLI_ARGUMENT_INVALID', `选项 --${name} 缺少取值`, { option: name });
      }
      if (inlineValue === undefined) {
        index += 1;
      }
      if (name === 'plugin') {
        if (options.pluginId !== undefined) {
          throw cliError('CLI_ARGUMENT_INVALID', '选项 --plugin 重复传入', { option: 'plugin' });
        }
        options.pluginId = value;
        continue;
      }
      if (entry === 'user') {
        throw cliError(
          'CLI_ARGUMENT_INVALID',
          '用户侧命令不接受 --workspace：工作区由平台设置面板选择',
          { option: 'workspace', hint: '请在生态设置面板中切换用户工作区' },
        );
      }
      if (options.workspace !== undefined) {
        throw cliError('CLI_ARGUMENT_INVALID', '选项 --workspace 重复传入', { option: 'workspace' });
      }
      options.workspace = value;
      continue;
    }

    rest.push(token);
  }

  const result: {
    json: boolean;
    yes: boolean;
    help: boolean;
    version: boolean;
    pluginId?: string;
    workspace?: string;
  } = {
    json: options.json,
    yes: options.yes,
    help: options.help,
    version: options.version,
  };
  if (options.pluginId !== undefined) {
    result.pluginId = options.pluginId;
  }
  if (options.workspace !== undefined) {
    result.workspace = options.workspace;
  }
  return { options: result, rest };
}

function parseBooleanFlag(name: string, inlineValue: string | undefined): boolean {
  if (inlineValue === undefined) {
    return true;
  }
  if (inlineValue === 'true') {
    return true;
  }
  if (inlineValue === 'false') {
    return false;
  }
  throw cliError('CLI_ARGUMENT_INVALID', `布尔选项 --${name} 的取值必须为 true 或 false`, {
    option: name,
    value: inlineValue,
  });
}
