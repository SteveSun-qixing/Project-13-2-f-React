/**
 * 结果渲染：内建命令默认 JSON；声明 `output.mode: human` 的插件命令输出摘要，
 * 用户传 `--json` 时强制 JSON（[CLI 完整参考] §2.4、§5.4）。
 */

import type { ChipsError } from '../errors.js';
import type { IOutputSink } from './io.js';

/**
 * 命令执行结果：`json` 为默认/可编程形态；`human` 为可读摘要行。
 *
 * 渲染规则（[CLI 完整参考] §2.4）：
 * - `mode: 'human'` 且未传 `--json` 时输出人读摘要；
 * - `humanEnvelope: true` 时摘要之后追加同一结果的 JSON 文档，使脚本与人读通道共用一次调用
 *   （插件命令的结果信封是稳定契约，§2.4.5）；
 * - `streamed: true` 表示结果已按 JSON Lines 逐行写出（如 `chips logs --follow`，§3.4），
 *   渲染阶段不再追加文档。
 */
export interface ICommandResult {
  readonly json: unknown;
  readonly human?: readonly string[];
  readonly mode?: 'json' | 'human';
  /** 命令自身决定的退出码（如 `doctor` 存在 error 级检查项时为 1）；缺省 0。 */
  readonly exitCode?: number;
  /** human 摘要之后追加 JSON 结果文档。 */
  readonly humanEnvelope?: boolean;
  /** 结果已按行流式写出，渲染阶段不重复输出。 */
  readonly streamed?: boolean;
}

/** JSON 序列化（2 空格缩进 + 换行；stdout 单对象纪律）。 */
export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** 单行 JSON 序列化（JSON Lines：跟踪日志与增量输出，§3.4）。 */
export function serializeJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

/** 渲染命令结果到 stdout。 */
export function renderResult(sink: IOutputSink, result: ICommandResult, forceJson: boolean): void {
  if (result.streamed === true) {
    return;
  }
  const useHuman = !forceJson && result.mode === 'human' && result.human !== undefined;
  if (useHuman) {
    const lines = result.human ?? [];
    if (lines.length > 0) {
      sink.writeOut(`${lines.join('\n')}\n`);
    }
    if (result.humanEnvelope === true) {
      sink.writeOut(serializeJson(result.json));
    }
    return;
  }
  sink.writeOut(serializeJson(result.json));
}

/**
 * stdout 错误信封（[CLI 完整参考] §2.6）：唯一序列化出口是统一类的 `toPlain()`
 * （《RFC-ChipsError统一裁定》§4.3），CLI 域只做信封键名映射 `message` → `error`。
 *
 * `retryable` 恒带（缺省 `false`），`code` 是脚本唯一判定依据；`exitCode` 不是错误对象成员，
 * 只由进程内旁表映射为真实退出码，永不出现在输出里（§4.6）。
 */
function toErrorEnvelope(error: ChipsError): {
  error: string;
  code: string;
  details?: unknown;
  retryable: boolean;
} {
  const plain = error.toPlain();
  return {
    error: plain.message,
    code: plain.code,
    ...(plain.details === undefined ? {} : { details: plain.details }),
    // `toPlain()` 恒输出已归一的 boolean；`IChipsError.retryable` 的可选性只服务跨边界输入端。
    retryable: plain.retryable ?? false,
  };
}

/** 渲染错误对象到 stdout（任何模式下失败都输出单个错误对象）。 */
export function renderError(sink: IOutputSink, error: ChipsError): void {
  sink.writeOut(serializeJson(toErrorEnvelope(error)));
}
