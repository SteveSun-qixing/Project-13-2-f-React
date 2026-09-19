/**
 * 打开文件命令：`chips open <路径>`（[CLI 完整参考] §3.6）。
 *
 * 文件关联路由（`.card` / `.box` 文档链路、`fileAssociations` 处理器、系统默认程序）
 * 由平台资源打开链路承担；CLI 负责路径解析与结果输出。
 */

import type { IParameterDeclaration } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, readString } from './helpers.js';

const pathArgument: IParameterDeclaration = {
  name: 'path',
  position: 0,
  type: 'path',
  required: true,
  mapsTo: 'path',
  path: { kind: 'any', role: 'input', exists: true },
};

/** `chips open`。 */
export const openCommand: ICliCommandDefinition = {
  path: ['open'],
  summary: '经文件关联链路打开文件',
  usage: 'chips open <路径>',
  parameters: { arguments: [pathArgument] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { arguments: [pathArgument] });
    const path = readString(values, 'path') ?? '';
    const result = await context.client.platform.open(path);
    const handlerLabel =
      result.handler.kind === 'shell'
        ? '系统默认程序'
        : `${result.handler.kind === 'app' ? '应用' : '服务'} ${result.handler.pluginId}`;
    return { json: result, human: [`已打开: ${result.path}`, `处理器: ${handlerLabel}`] };
  },
};
