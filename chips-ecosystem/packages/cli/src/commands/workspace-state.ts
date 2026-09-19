/**
 * 工作区运行标记命令：`chips start` / `chips stop` / `chips status`（[CLI 完整参考] §3.2）。
 */

import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions } from './helpers.js';

/** `chips start`：写入运行标记，幂等。 */
export const startCommand: ICliCommandDefinition = {
  path: ['start'],
  summary: '确保工作区已初始化并写入运行标记',
  usage: 'chips start',
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    parseCommandOptions(context, {});
    const state = await context.client.platform.workspaceStart();
    return { json: state };
  },
};

/** `chips stop`：删除运行标记，幂等。 */
export const stopCommand: ICliCommandDefinition = {
  path: ['stop'],
  summary: '删除工作区运行标记',
  usage: 'chips stop',
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    parseCommandOptions(context, {});
    const state = await context.client.platform.workspaceStop();
    return { json: state };
  },
};

/** `chips status`：输出工作区、运行标记与平台版本。 */
export const statusCommand: ICliCommandDefinition = {
  path: ['status'],
  summary: '查看工作区与运行标记状态',
  usage: 'chips status',
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    parseCommandOptions(context, {});
    const status = await context.client.platform.workspaceStatus();
    return { json: status };
  },
};
