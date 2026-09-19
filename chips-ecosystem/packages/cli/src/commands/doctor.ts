/**
 * 诊断命令：`chips doctor [--fix] [--verbose]`（[CLI 完整参考] §3.8）。
 *
 * 检查项固定为：工作区标记与保留目录、工作区可写性、平台数据目录、插件注册表、日志目录、
 * 更新渠道配置、承载运行时依赖；存在 `error` 级检查项时退出 1，否则退出 0。
 */

import type { IParameterDeclaration } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, readBoolean } from './helpers.js';

const fixOption: IParameterDeclaration = {
  name: 'fix',
  type: 'boolean',
  mapsTo: 'fix',
};

const verboseOption: IParameterDeclaration = {
  name: 'verbose',
  type: 'boolean',
  mapsTo: 'verbose',
};

const STATUS_LABEL: Readonly<Record<'ok' | 'warn' | 'error', string>> = {
  ok: '正常',
  warn: '警告',
  error: '错误',
};

/** `chips doctor`。 */
export const doctorCommand: ICliCommandDefinition = {
  path: ['doctor'],
  summary: '诊断工作区、插件注册表与运行时依赖',
  usage: 'chips doctor [--fix] [--verbose]',
  parameters: { options: [fixOption, verboseOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { options: [fixOption, verboseOption] });
    const fix = readBoolean(values, 'fix') === true;
    const verbose = readBoolean(values, 'verbose') === true;
    const report = await context.client.platform.doctor({ fix, verbose });
    const human = [
      `工作区: ${report.workspace.path}（${report.workspace.kind === 'dev' ? '开发' : '用户'}）`,
      ...report.checks.map(
        (check) => `[${STATUS_LABEL[check.status]}] ${check.id}: ${check.detail}`
      ),
    ];
    const hasError = report.checks.some((check) => check.status === 'error');
    return { json: report, human, exitCode: hasError ? 1 : 0 };
  },
};
