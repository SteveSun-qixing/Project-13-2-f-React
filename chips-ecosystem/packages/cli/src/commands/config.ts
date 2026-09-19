/**
 * 配置命令：`chips config list | set | reset`（[CLI 完整参考] §3.3）。
 *
 * 层级与键空间校验、schema 校验与错误码（`CONFIG_*`）由平台配置系统承担；
 * CLI 负责参数解析、JSON 优先的取值解析与输出。
 */

import type { CliConfigLayer } from '../client/types.js';
import type { IParameterDeclaration, IParameterSet } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, readString } from './helpers.js';

const layerOption: IParameterDeclaration = {
  name: 'layer',
  type: 'enum',
  choices: ['user', 'workspace'],
  mapsTo: 'layer',
};

const keyArgument: IParameterDeclaration = {
  name: 'key',
  position: 0,
  type: 'string',
  required: true,
  mapsTo: 'key',
};

const valueArgument: IParameterDeclaration = {
  name: 'value',
  position: 1,
  type: 'string',
  required: true,
  mapsTo: 'value',
};

function readLayer(layer: string | undefined): CliConfigLayer | undefined {
  return layer === 'user' || layer === 'workspace' ? layer : undefined;
}

/** 取值解析：先按 JSON，失败时按字符串（[CLI 完整参考] §3.3）。 */
export function parseConfigValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

const listCommand: ICliCommandDefinition = {
  path: ['config', 'list'],
  summary: '列出生效配置',
  usage: 'chips config list [--layer <user|workspace>]',
  parameters: { options: [layerOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { options: [layerOption] });
    const layer = readLayer(readString(values, 'layer'));
    const result = await context.client.platform.configList(layer);
    return { json: result };
  },
};

const setCommand: ICliCommandDefinition = {
  path: ['config', 'set'],
  summary: '写入配置项（JSON 优先，失败按字符串）',
  usage: 'chips config set <键> <值> [--layer <user|workspace>]',
  parameters: { arguments: [keyArgument, valueArgument], options: [layerOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, {
      arguments: [keyArgument, valueArgument],
      options: [layerOption],
    });
    const key = readString(values, 'key') ?? '';
    const rawValue = readString(values, 'value') ?? '';
    const layer = readLayer(readString(values, 'layer'));
    const result = await context.client.platform.configSet(key, parseConfigValue(rawValue), layer);
    return { json: result };
  },
};

const resetCommand: ICliCommandDefinition = {
  path: ['config', 'reset'],
  summary: '移除该层的配置覆盖',
  usage: 'chips config reset <键> [--layer <user|workspace>]',
  parameters: { arguments: [keyArgument], options: [layerOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, {
      arguments: [keyArgument],
      options: [layerOption],
    });
    const key = readString(values, 'key') ?? '';
    const layer = readLayer(readString(values, 'layer'));
    const result = await context.client.platform.configReset(key, layer);
    return { json: result };
  },
};

/** `config` 命令组。 */
export const configCommands: readonly ICliCommandDefinition[] = [listCommand, setCommand, resetCommand];

/** 供帮助展示的参数声明集合。 */
export const configParameterSets: Readonly<Record<string, IParameterSet>> = {
  'config list': { options: [layerOption] },
  'config set': { arguments: [keyArgument, valueArgument], options: [layerOption] },
  'config reset': { arguments: [keyArgument], options: [layerOption] },
};
