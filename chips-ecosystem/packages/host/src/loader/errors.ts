/**
 * 装载器错误模型：`ChipsError` 的壳侧同构实现。
 *
 * 权威：《03-插件包格式》§八、《01-薯片内核设计》§九（错误传播），
 * 与 `src/capabilities/document/errors.ts` 的壳侧错误类先例同构。
 *
 * @remarks
 * - `only-throw-error` 要求抛真 `Error`；本类携带与 `IWireChipsError` 同构的可枚举字段，
 *   `code` 只允许 `CPK_*` / `KERNEL_*` 登记码（来自 `codes.ts` 结构视图，禁止自造码）。
 * - `message` 一律简体中文；`details` 只承载结构化诊断（阶段 / 成员路径 / 字段指针 / keyId）。
 */

import type { IWireChipsError } from '../protocol/wire.js';
import { LOADER_ERROR_MESSAGES, LOADER_ERROR_RETRYABLE, type LoaderErrorCode } from './codes.js';

/** 装载器错误。 */
export class LoaderError extends Error {
  /** 已登记错误码。 */
  readonly code: LoaderErrorCode;

  /** 结构化诊断。 */
  readonly details: unknown;

  /** 是否可重试。 */
  readonly retryable: boolean;

  constructor(code: LoaderErrorCode, options: { readonly message?: string; readonly details?: unknown } = {}) {
    super(options.message ?? LOADER_ERROR_MESSAGES[code]);
    this.name = 'ChipsError';
    this.code = code;
    this.details = options.details;
    this.retryable = LOADER_ERROR_RETRYABLE[code];
  }

  /** 序列化为 `IWireChipsError` 同构对象。 */
  toWireError(): IWireChipsError {
    const error: IWireChipsError = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    return this.details === undefined ? error : { ...error, details: this.details };
  }
}

/** 校验阶段失败的快捷构造（抛出自 `codes.ts` 登记码）。 */
export function throwCpkError(
  code: LoaderErrorCode,
  message: string,
  details: Record<string, unknown>,
): never {
  throw new LoaderError(code, { message, details });
}

/** 从任意异常提取 `IWireChipsError` 面（非装载器异常归一为内部错误语义由调用方处理）。 */
export function asLoaderWireError(error: unknown): IWireChipsError | undefined {
  if (error instanceof LoaderError) {
    return error.toWireError();
  }
  return undefined;
}
