/**
 * 平台更新命令：`chips update check | install [--channel <stable|beta>]`（[CLI 完整参考] §3.7）。
 *
 * 渠道、版本判定、防降级、下载 → 摘要 → contentHash → 签名 → 原子替换与回滚由
 * 《更新与分发规范》与平台更新器承担；CLI 只调度并输出结果。
 */

import type { CliUpdateChannel } from '../client/types.js';
import type { IParameterDeclaration } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, readString } from './helpers.js';

const channelOption: IParameterDeclaration = {
  name: 'channel',
  type: 'enum',
  choices: ['stable', 'beta'],
  default: 'stable',
  mapsTo: 'channel',
};

function readChannel(value: string | undefined): CliUpdateChannel {
  return value === 'beta' ? 'beta' : 'stable';
}

const checkCommand: ICliCommandDefinition = {
  path: ['update', 'check'],
  summary: '检查更新可用性',
  usage: 'chips update check [--channel <stable|beta>]',
  parameters: { options: [channelOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { options: [channelOption] });
    const channel = readChannel(readString(values, 'channel'));
    const result = await context.client.platform.updateCheck(channel);
    const human = result.updateAvailable
      ? [
          `当前版本: ${result.currentVersion}`,
          `最新版本: ${result.latestVersion ?? '未知'}`,
          `渠道: ${result.channel}`,
          '存在可用更新，执行 chips update install 安装',
        ]
      : [`当前版本: ${result.currentVersion}`, `渠道: ${result.channel}`, '已是最新版本'];
    return { json: result, human };
  },
};

const installCommand: ICliCommandDefinition = {
  path: ['update', 'install'],
  summary: '下载并安装平台更新',
  usage: 'chips update install [--channel <stable|beta>]',
  parameters: { options: [channelOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { options: [channelOption] });
    const channel = readChannel(readString(values, 'channel'));
    const result = await context.client.platform.updateInstall(channel);
    const human = result.installed
      ? [`已安装版本: ${result.version ?? '未知'}`, '更新以重启为边界，请重启平台完成切换']
      : [`未安装更新：${result.reason ?? '无可用更新'}`];
    return { json: result, human };
  },
};

/** `update` 命令组。 */
export const updateCommands: readonly ICliCommandDefinition[] = [checkCommand, installCommand];
