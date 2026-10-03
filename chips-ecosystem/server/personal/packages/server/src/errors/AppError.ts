import { PersonalErrorCode, type PersonalErrorCodeType, type ErrorSpec } from './codes.js';

/**
 * 服务端业务异常：携带已登记业务码、HTTP 状态与结构化诊断。
 * 状态与 retryable 以登记表为唯一权威（契约 §7.2）；服务端只返回已归一异常，
 * 内部异常统一转换为 INTERNAL_ERROR（契约 §7.4）。
 */
export class AppError extends Error {
  public readonly code: PersonalErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(
    code: PersonalErrorCodeType,
    message: string,
    options?: { details?: Record<string, unknown> }
  ) {
    const registered: ErrorSpec = PersonalErrorCode[code];
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = registered.httpStatus;
    this.retryable = registered.retryable;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(
    code: PersonalErrorCodeType,
    message: string,
    details?: Record<string, unknown>
  ): AppError {
    return details === undefined
      ? new AppError(code, message)
      : new AppError(code, message, { details });
  }

  static unauthorized(code: PersonalErrorCodeType, message: string): AppError {
    return new AppError(code, message);
  }

  static notFound(code: PersonalErrorCodeType, message: string): AppError {
    return new AppError(code, message);
  }

  static conflict(
    code: PersonalErrorCodeType,
    message: string,
    details?: Record<string, unknown>
  ): AppError {
    return details === undefined
      ? new AppError(code, message)
      : new AppError(code, message, { details });
  }

  static internal(message = '服务端内部错误'): AppError {
    return new AppError('INTERNAL_ERROR', message);
  }
}
