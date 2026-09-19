/**
 * 日志命令：`chips logs [-n <行数>] [-l <级别>] [-f|--follow]`（[CLI 完整参考] §3.4）。
 *
 * - 非跟踪模式：读取末尾 N 行并以 JSON 数组输出（stdout 只承载最终结果）；
 * - 跟踪模式：增量行按 JSON Lines 写 stdout，`Ctrl+C` 结束跟踪并返回 0；
 * - 来源为平台主日志、调试追踪、工作区日志与 CLI 操作日志（承载适配器负责聚合）。
 */

import type { CliLogLevel } from '../client/types.js';
import type { IParameterDeclaration } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import { serializeJsonLine } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, readBoolean, readNumber, readString } from './helpers.js';

const linesOption: IParameterDeclaration = {
  name: 'lines',
  short: 'n',
  type: 'integer',
  default: 100,
  validation: { min: 1 },
  mapsTo: 'lines',
};

const levelOption: IParameterDeclaration = {
  name: 'level',
  short: 'l',
  type: 'enum',
  choices: ['error', 'warn', 'info', 'debug'],
  mapsTo: 'level',
};

const followOption: IParameterDeclaration = {
  name: 'follow',
  short: 'f',
  type: 'boolean',
  mapsTo: 'follow',
};

function readLevel(level: string | undefined): CliLogLevel | undefined {
  return level === 'error' || level === 'warn' || level === 'info' || level === 'debug' ? level : undefined;
}

/** `chips logs`。 */
export const logsCommand: ICliCommandDefinition = {
  path: ['logs'],
  summary: '读取或跟踪工作区与平台日志',
  usage: 'chips logs [-n <行数>] [-l <级别>] [-f|--follow]',
  parameters: { options: [linesOption, levelOption, followOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, {
      options: [linesOption, levelOption, followOption],
    });
    const lines = readNumber(values, 'lines') ?? 100;
    const level = readLevel(readString(values, 'level'));
    const follow = readBoolean(values, 'follow') === true;

    if (!follow) {
      const entries = await context.client.platform.logsRead({
        lines,
        ...(level === undefined ? {} : { level }),
      });
      return { json: entries };
    }

    let followed = 0;
    await context.client.platform.logsFollow(
      { ...(level === undefined ? {} : { level }) },
      (entry) => {
        followed += 1;
        // 增量行按 JSON Lines 紧凑写出（§3.4：`--follow` 输出增量行，非交互环境无动画控制字符）。
        context.io.writeOut(serializeJsonLine(entry));
      },
      context.signal,
    );
    // 跟踪模式的最终结果就是已流式写出的增量行，不再追加结果文档（§2.4.1）。
    return { json: { ok: true, followed }, streamed: true };
  },
};
