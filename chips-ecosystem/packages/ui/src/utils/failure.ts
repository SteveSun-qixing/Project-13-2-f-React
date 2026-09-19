/**
 * 失败信息归一：把任意抛出物归一为界面可渲染的 `ChipsUiFailure`。
 *
 * 契约：《08-@chips-ui共享层使用指南》§2.4。`code` 只透传结构化错误自带的字符串 code
 * （如 `ChipsError.code`），否则取错误名；不发明平台错误码、不改写 `message`。
 */

/** 与 `ChipsError` 结构兼容的界面失败信息；`@chips/ui` 不依赖 `@chips/sdk`，按结构接收。 */
export interface ChipsUiFailure {
  readonly code: string;
  readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * 把未知错误归一为界面可渲染的失败信息。
 *
 * @param error 任意抛出物
 * @param fallbackMessage 无可用信息时的简体中文兜底说明
 * @returns 含 `code` 与 `message` 的失败信息
 */
export function toChipsUiFailure(error: unknown, fallbackMessage: string): ChipsUiFailure {
  if (isRecord(error)) {
    const code = readNonEmptyString(error.code);
    const message = readNonEmptyString(error.message);
    if (message !== null) {
      return { code: code ?? errorNameOf(error), message };
    }
    if (code !== null) {
      return { code, message: fallbackMessage };
    }
    return { code: errorNameOf(error), message: fallbackMessage };
  }
  return { code: 'Error', message: fallbackMessage };
}

/** 取错误名（`Error.name` 或对象构造名），无可用名称时返回 `Error`。 */
function errorNameOf(error: object): string {
  if (error instanceof Error) {
    return readNonEmptyString(error.name) ?? 'Error';
  }
  const constructorName = (error as { constructor?: { name?: unknown } }).constructor?.name;
  return readNonEmptyString(constructorName) ?? 'Error';
}
