/**
 * 脚手架错误。
 *
 * 错误码 `SDK_INVALID_SCAFFOLD_OPTIONS` 与《02-SDK-API规范》§8.4 一致；
 * `@chips/sdk/scaffold` 在导出边界把本错误转换为 `ChipsError`，保留 `code` 与 `details`。
 */
export class ScaffoldError extends Error {
  public readonly code = 'SDK_INVALID_SCAFFOLD_OPTIONS';

  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'ScaffoldError';
    if (details !== undefined) {
      this.details = details;
    }
  }
}

/** 类型守卫：判断任意值是否为 `ScaffoldError`。 */
export function isScaffoldError(value: unknown): value is ScaffoldError {
  return value instanceof ScaffoldError;
}
