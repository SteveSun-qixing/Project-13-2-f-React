/**
 * `resource:open` 路由域的错误模型。
 *
 * 权威：`14-资源打开与默认处理器契约` §4.6（未命中降级）、§4.7（失败语义）、§10（错误码）、
 * `02-Bridge三层设计` §9（错误归一）、`06-资源协议规范` §七（资源域错误码）。
 *
 * @remarks
 * - 抛出的错误与 `ChipsError` 同构（`code` / `message` / `details` / `retryable`），
 *   Bridge 适配层按结构消费（与 `capabilities/document/errors.ts` 同一形制）。
 * - 本域直接构造的码只有 `RESOURCE_HANDLER_MISSING`（§10 唯一本域产生方）；
 *   处理器启用/投递失败（`KERNEL_*` / `APP_*`）与资源域 `RESOURCE_*` 经
 *   {@link asResourceOpenError} 原样透传，禁第二套语义。
 * - `message` 一律简体中文、面向用户；`details` 不含文件内容、凭证与未脱敏路径（§4.7）。
 */

/** 本域直接构造的错误码与 `retryable` 口径（§10：`RESOURCE_HANDLER_MISSING` 不可重试）。 */
export const RESOURCE_OPEN_ERROR_RETRYABLE: Readonly<Record<string, boolean>> = {
  RESOURCE_HANDLER_MISSING: false,
};

/** 本域直接构造码的默认简体中文文案（§4.6：无可用回退即「没有可以打开该资源的处理器」语义）。 */
export const RESOURCE_OPEN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  RESOURCE_HANDLER_MISSING: '没有可以打开该资源的处理器',
};

/** 结构化诊断载荷：只允许登记字段，不含文件内容与未脱敏路径。 */
export interface IResourceOpenErrorDetails {
  readonly capabilityId?: string;
  readonly field?: string;
  readonly uri?: string;
  readonly scope?: string;
  readonly slot?: string;
  readonly pluginId?: string;
  readonly mode?: string;
  readonly reason?: string;
  /** 底层失败原因码（如系统打开臂的 `SHELL_OPEN_FAILED`）。 */
  readonly cause?: string;
}

/** 端口透传错误缺少消息时的兜底文案。 */
const PASSTHROUGH_FALLBACK_MESSAGE = '资源打开路由失败';

/** 资源打开路由错误：`ChipsError` 的壳侧同构实现（形制与文档能力错误一致）。 */
export class ResourceOpenError extends Error {
  /** 已登记错误码（`<DOMAIN>_<REASON>`）。 */
  readonly code: string;

  /** 结构化诊断。 */
  readonly details: IResourceOpenErrorDetails | undefined;

  /** 是否可重试。 */
  readonly retryable: boolean;

  constructor(
    code: string,
    options: {
      readonly message?: string;
      readonly details?: IResourceOpenErrorDetails;
      readonly retryable?: boolean;
    } = {},
  ) {
    super(
      options.message ??
        (isResourceOpenErrorCode(code) ? RESOURCE_OPEN_ERROR_MESSAGES[code] : PASSTHROUGH_FALLBACK_MESSAGE),
    );
    this.name = 'ChipsError';
    this.code = code;
    this.details = options.details;
    this.retryable =
      options.retryable ?? (isResourceOpenErrorCode(code) ? (RESOURCE_OPEN_ERROR_RETRYABLE[code] ?? false) : false);
  }
}

/** 判断错误码是否属于本域直接构造的登记码集合。 */
export function isResourceOpenErrorCode(code: string): code is 'RESOURCE_HANDLER_MISSING' {
  return Object.prototype.hasOwnProperty.call(RESOURCE_OPEN_ERROR_MESSAGES, code);
}

/** 已登记错误码的词法形态：`<DOMAIN>_<REASON>`（`04-能力契约规范` §11.1）。 */
const REGISTERED_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/**
 * 任意异常 → 资源打开路由错误（错误归一，`02-Bridge三层设计` §9.1）：
 *
 * - `ResourceOpenError` 原样返回；
 * - 携带已登记码形态 `code` 的抛出值（`KERNEL_*` / `APP_*` / `RESOURCE_*` / `SHELL_*`）
 *   同构透传，`retryable` 透传布尔、缺省 `false`；
 * - `AbortError` 归一为 `BRIDGE_CANCELLED`；
 * - 其余未识别异常归一为 `BRIDGE_INTERNAL`（不透出原始消息，防泄漏内部路径）。
 */
export function asResourceOpenError(error: unknown): ResourceOpenError {
  if (error instanceof ResourceOpenError) {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown; details?: unknown; retryable?: unknown };
    if (typeof candidate.code === 'string' && REGISTERED_CODE_PATTERN.test(candidate.code)) {
      const message =
        typeof candidate.message === 'string' && candidate.message.length > 0 ? candidate.message : undefined;
      const details =
        typeof candidate.details === 'object' && candidate.details !== null
          ? (candidate.details as IResourceOpenErrorDetails)
          : undefined;
      const retryable = typeof candidate.retryable === 'boolean' ? candidate.retryable : undefined;
      return new ResourceOpenError(candidate.code, {
        ...(message === undefined ? {} : { message }),
        ...(details === undefined ? {} : { details }),
        ...(retryable === undefined ? {} : { retryable }),
      });
    }
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError' &&
    typeof (error as { code?: unknown }).code !== 'string'
  ) {
    return new ResourceOpenError('BRIDGE_CANCELLED', { message: '能力调用已取消' });
  }
  return new ResourceOpenError('BRIDGE_INTERNAL', { message: '平台内部错误' });
}
