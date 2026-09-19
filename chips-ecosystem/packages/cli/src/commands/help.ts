/**
 * 帮助命令：`chips help [命令]`（[CLI 完整参考] §3.1.1）。
 *
 * - 无参数：输出内置命令树与当前工作区已启用插件命令路径；
 * - 带参数：输出指定命令的用法、参数与示例；
 * - 未知命令返回 `CLI_COMMAND_NOT_FOUND`（退出码 3）。
 */

import type { ICliCommandView } from '../client/types.js';
import type { IParameterDeclaration, IParameterSet } from '../args/types.js';
import { cliError } from '../errors.js';
import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';

const TYPE_LABEL: Readonly<Record<string, string>> = {
  string: '字符串',
  stringList: '字符串列表',
  number: '数值',
  integer: '整数',
  boolean: '布尔',
  enum: '枚举',
  path: '路径',
  json: 'JSON',
  jsonFile: 'JSON 文件',
  text: '文本',
  textFile: '文本文件',
};

function renderDeclaration(declaration: IParameterDeclaration, kind: 'argument' | 'option'): string {
  const short = declaration.short === undefined ? '' : `-${declaration.short}, `;
  const name = kind === 'argument' ? `<${declaration.name}>` : `${short}--${declaration.name}`;
  const parts: string[] = [`${name}`, `（${TYPE_LABEL[declaration.type] ?? declaration.type}`];
  if (declaration.choices !== undefined && declaration.choices.length > 0) {
    parts.push(`：${declaration.choices.join(' | ')}`);
  }
  parts.push('）');
  if (declaration.required === true) {
    parts.push('必填');
  }
  if (declaration.default !== undefined) {
    parts.push(`默认 ${JSON.stringify(declaration.default)}`);
  }
  if (declaration.multiple === true) {
    parts.push('可重复');
  }
  if (declaration.path?.role === 'output' && declaration.path.overwrite !== undefined) {
    parts.push(`输出冲突：${declaration.path.overwrite}`);
  }
  return parts.join(' ');
}

/** 渲染参数集合为帮助行。 */
export function renderParameterHelp(parameters: IParameterSet | undefined): readonly string[] {
  if (parameters === undefined) {
    return [];
  }
  const lines: string[] = [];
  const argumentsList = parameters.arguments ?? [];
  const optionsList = parameters.options ?? [];
  if (argumentsList.length > 0) {
    lines.push('参数:');
    for (const declaration of argumentsList) {
      lines.push(`  ${renderDeclaration(declaration, 'argument')}`);
    }
  }
  if (optionsList.length > 0) {
    lines.push('选项:');
    for (const declaration of optionsList) {
      lines.push(`  ${renderDeclaration(declaration, 'option')}`);
    }
  }
  return lines;
}

/** 渲染插件命令声明帮助。 */
export function renderPluginHelp(view: ICliCommandView): readonly string[] {
  const declaration = view.declaration;
  const lines: string[] = [`命令: ${view.commandPath.join(' ')}`, `说明: ${declaration.title}`];
  if (declaration.description !== undefined) {
    lines.push(declaration.description);
  }
  lines.push(`插件: ${view.pluginId}`);
  const parameters: IParameterSet = {
    arguments: declaration.arguments ?? [],
    options: declaration.options ?? [],
  };
  lines.push(...renderParameterHelp(parameters));
  if (declaration.examples !== undefined && declaration.examples.length > 0) {
    lines.push('示例:');
    for (const example of declaration.examples) {
      lines.push(`  ${example}`);
    }
  }
  return lines;
}

function renderCommandHelp(definition: ICliCommandDefinition): readonly string[] {
  const lines: string[] = [`用法: ${definition.usage}`, `说明: ${definition.summary}`];
  if (definition.subcommands !== undefined && definition.subcommands.length > 0) {
    lines.push(`子命令: ${definition.subcommands.join(' | ')}`);
  }
  lines.push(...renderParameterHelp(definition.parameters));
  return lines;
}

/** 创建帮助命令（注入固定命令定义，避免模块环）。 */
export function createHelpCommand(
  definitions: readonly ICliCommandDefinition[],
): ICliCommandDefinition {
  return {
    path: ['help'],
    summary: '输出命令树或指定命令的帮助',
    usage: 'chips help [命令]',
    outputMode: 'human',
    run: async (context: ICommandContext): Promise<ICommandResult> => {
      const requested = context.args.filter((token) => !token.startsWith('-'));
      if (requested.length === 0) {
        const lines: string[] = ['薯片 CLI 命令：'];
        for (const definition of definitions) {
          lines.push(`  ${definition.path.join(' ')}  ${definition.summary}`);
        }
        lines.push('');
        lines.push('插件命令：');
        try {
          const result = await context.client.cliCommand.list();
          const paths = result.commands.map((command) => command.commandPath.join(' ')).sort();
          lines.push(...(paths.length > 0 ? paths.map((path) => `  ${path}`) : ['  （当前工作区无已启用插件命令）']));
        } catch {
          lines.push('  （命令索引不可用）');
        }
        return { json: { commands: definitions.map((definition) => definition.path.join(' ')) }, human: lines };
      }

      const builtin = definitions.find(
        (definition) => definition.path.join(' ').toLowerCase() === requested.join(' ').toLowerCase(),
      );
      if (builtin !== undefined) {
        return {
          json: { command: builtin.path.join(' '), usage: builtin.usage, summary: builtin.summary },
          human: renderCommandHelp(builtin),
        };
      }

      const resolved = await context.client.cliCommand.resolve({ commandPath: requested });
      if (resolved.command === undefined) {
        if (resolved.conflicts.length > 0) {
          throw cliError('CLI_COMMAND_CONFLICT', `命令路径存在冲突：${requested.join(' ')}`, {
            conflicts: resolved.conflicts,
          });
        }
        throw cliError('CLI_COMMAND_NOT_FOUND', `未知命令：${requested.join(' ')}`, {
          commandPath: requested,
        });
      }
      return {
        json: {
          command: resolved.command.commandPath.join(' '),
          title: resolved.command.declaration.title,
          description: resolved.command.declaration.description,
          examples: resolved.command.declaration.examples,
        },
        human: renderPluginHelp(resolved.command),
      };
    },
  };
}
