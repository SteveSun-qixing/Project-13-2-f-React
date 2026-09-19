/**
 * 固定命令树注册表（[CLI 完整参考] §1.2、§三、§四）。
 *
 * 用户侧与开发侧共享同一组命令定义；差异由执行上下文的 `entry` 与客户端的开发工作区决定。
 * 插件命令路径不进入本注册表，由调度层经 `cli-command` 索引匹配。
 */

import { cliError } from '../errors.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { configCommands } from './config.js';
import { completeCommand, completionCommand } from './completion.js';
import { doctorCommand } from './doctor.js';
import { devCommands, DEV_SERVICE_SUBCOMMANDS } from './dev.js';
import { createHelpCommand } from './help.js';
import { logsCommand } from './logs.js';
import { openCommand } from './open.js';
import { pluginCommands, PLUGIN_SUBCOMMANDS } from './plugin.js';
import { updateCommands } from './update.js';
import { startCommand, statusCommand, stopCommand } from './workspace-state.js';

/** 组命令提示：缺少子命令时返回 `CLI_COMMAND_NOT_FOUND`（退出码 3）与可用子命令。 */
function groupCommand(
  path: readonly string[],
  summary: string,
  usage: string,
  subcommands: readonly string[],
): ICliCommandDefinition {
  return {
    path,
    summary,
    usage,
    subcommands,
    run: async (context: ICommandContext): Promise<never> => {
      throw cliError('CLI_COMMAND_NOT_FOUND', `命令 ${context.commandPath} 缺少子命令`, {
        commandPath: context.commandPath,
        subcommands: [...subcommands],
      });
    },
  };
}

const sharedCommands: readonly ICliCommandDefinition[] = [
  startCommand,
  stopCommand,
  statusCommand,
  groupCommand(['config'], '管理用户层与工作区层配置', 'chips config <list|set|reset>', [
    'list',
    'set',
    'reset',
  ]),
  ...configCommands,
  logsCommand,
  groupCommand(
    ['plugin'],
    '插件安装、启停与打包校验',
    'chips plugin <create|pack|validate|install|uninstall|list|info|enable|disable>',
    PLUGIN_SUBCOMMANDS,
  ),
  ...pluginCommands,
  openCommand,
  doctorCommand,
  completionCommand,
  completeCommand,
];

/** 用户侧固定命令（含平台更新）。 */
const userDefinitions: ICliCommandDefinition[] = [
  groupCommand(['update'], '平台更新', 'chips update <check|install>', ['check', 'install']),
  ...updateCommands,
  ...sharedCommands,
];
userDefinitions.unshift(createHelpCommand(userDefinitions));

/** 开发侧固定命令（含开发宿主与服务联调，不含平台更新）。 */
const devDefinitions: ICliCommandDefinition[] = [
  groupCommand(['service'], '开发宿主服务能力联调', 'chips dev service <invoke>', DEV_SERVICE_SUBCOMMANDS),
  ...devCommands,
  ...sharedCommands,
];
devDefinitions.unshift(createHelpCommand(devDefinitions));

/** 用户侧命令表。 */
export function listUserCommands(): readonly ICliCommandDefinition[] {
  return userDefinitions;
}

/** 开发侧命令表。 */
export function listDevCommands(): readonly ICliCommandDefinition[] {
  return devDefinitions;
}

/** 按入口取命令表。 */
export function listCommands(entry: 'user' | 'dev'): readonly ICliCommandDefinition[] {
  return entry === 'dev' ? devDefinitions : userDefinitions;
}

/** 最长命令路径前缀匹配（固定命令树）。 */
export function matchBuiltinCommand(
  definitions: readonly ICliCommandDefinition[],
  tokens: readonly string[],
): { readonly definition: ICliCommandDefinition; readonly remaining: readonly string[] } | undefined {
  let best: ICliCommandDefinition | undefined;
  for (const definition of definitions) {
    if (definition.path.length > tokens.length) {
      continue;
    }
    if (best !== undefined && definition.path.length <= best.path.length) {
      continue;
    }
    const matches = definition.path.every(
      (segment, index) => segment.toLowerCase() === (tokens[index] ?? '').toLowerCase(),
    );
    if (matches) {
      best = definition;
    }
  }
  if (best === undefined) {
    return undefined;
  }
  return { definition: best, remaining: tokens.slice(best.path.length) };
}
