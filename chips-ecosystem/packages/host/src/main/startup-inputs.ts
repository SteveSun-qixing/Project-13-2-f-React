/**
 * 启动输入解析与队列。
 *
 * 权威：`14-资源打开与默认处理器契约`（操作系统打开请求的入口）、
 * `13-工作区设计` §7（开发工作区选择）。
 *
 * @remarks
 * 壳只负责把操作系统与第二实例传入的**原始输入**解析为结构化请求并排队，
 * 打开路由与处理器选择由核心的资源打开契约完成；壳不做文件关联判定。
 */

import { resolve } from 'node:path';

/** 结构化启动输入。 */
export type StartupInput =
  { readonly kind: 'open'; readonly path: string } | { readonly kind: 'workspace'; readonly path: string };

/** `--workspace=` 开关前缀。 */
export const WORKSPACE_SWITCH_PREFIX = '--workspace=';

/**
 * 解析应用参数为启动输入。
 *
 * @param argv 应用参数（已剥离 Electron 可执行文件与入口脚本参数）。
 * @param cwd 相对路径解析基准；默认当前工作目录。
 * @returns 结构化输入；无法识别的开关忽略，空参数忽略。
 */
export function parseStartupInputs(argv: readonly string[], cwd: string = process.cwd()): readonly StartupInput[] {
  const inputs: StartupInput[] = [];
  for (const argument of argv) {
    if (argument.length === 0) {
      continue;
    }
    if (argument.startsWith(WORKSPACE_SWITCH_PREFIX)) {
      const value = argument.slice(WORKSPACE_SWITCH_PREFIX.length).trim();
      if (value.length > 0) {
        inputs.push({ kind: 'workspace', path: resolve(cwd, value) });
      }
      continue;
    }
    if (argument.startsWith('-')) {
      continue;
    }
    inputs.push({ kind: 'open', path: resolve(cwd, argument) });
  }
  return inputs;
}

/** 启动输入队列；提前到达的输入（`open-file`、第二实例）排队到平台就绪后按序分发。 */
export class StartupInputQueue {
  private readonly pending: StartupInput[] = [];

  /** 入队一组输入。 */
  push(inputs: readonly StartupInput[]): void {
    for (const input of inputs) {
      this.pending.push(input);
    }
  }

  /** 取出全部待分发输入（FIFO）。 */
  drain(): readonly StartupInput[] {
    return this.pending.splice(0, this.pending.length);
  }

  /** 当前待分发数量。 */
  get size(): number {
    return this.pending.length;
  }
}
