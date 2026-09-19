/**
 * 固定命令共用的解析与取值辅助。
 */

import { parseParameters, type IParseRequest, type IParseResult } from '../args/parse.js';
import type { IParameterSet } from '../args/types.js';
import type { ICommandContext } from './types.js';

/** 解析命令参数（与插件命令同一引擎）。 */
export function parseCommandOptions(
  context: ICommandContext,
  declarations: IParameterSet
): IParseResult {
  const request: IParseRequest = {
    argv: context.args,
    declarations,
    cwd: context.cwd,
    fileSystem: context.fileSystem,
  };
  return parseParameters(request);
}

/**
 * 扫描命令路径之后的原始 token，收集出现的长选项名（`--name` / `--name=值`）。
 *
 * 用于必须在类型转换之前完成的跨参数约束（例如互斥选项）：`jsonFile` / `path` 类型会在解析
 * 阶段读取文件，晚于互斥判断就会把参数错误（退出码 2）误报为路径错误（退出码 5）。
 */
export function providedOptionNames(argv: readonly string[]): ReadonlySet<string> {
  const names = new Set<string>();
  let terminated = false;
  for (const token of argv) {
    if (terminated) {
      continue;
    }
    if (token === '--') {
      terminated = true;
      continue;
    }
    if (!token.startsWith('--')) {
      continue;
    }
    const body = token.slice(2);
    const equalsIndex = body.indexOf('=');
    names.add(equalsIndex === -1 ? body : body.slice(0, equalsIndex));
  }
  return names;
}

/** 解析工作区（懒解析；本地命令不触发承载链路）。 */
export async function requireWorkspace(
  context: ICommandContext
): Promise<{ readonly path: string; readonly kind: 'user' | 'dev' }> {
  return context.workspace.resolve();
}

/** 读取字符串取值。 */
export function readString(values: ReadonlyMap<string, unknown>, name: string): string | undefined {
  const value = values.get(name);
  return typeof value === 'string' ? value : undefined;
}

/** 读取数值取值。 */
export function readNumber(values: ReadonlyMap<string, unknown>, name: string): number | undefined {
  const value = values.get(name);
  return typeof value === 'number' ? value : undefined;
}

/** 读取布尔取值。 */
export function readBoolean(
  values: ReadonlyMap<string, unknown>,
  name: string
): boolean | undefined {
  const value = values.get(name);
  return typeof value === 'boolean' ? value : undefined;
}
