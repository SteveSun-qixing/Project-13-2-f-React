import { CommunityErrorCode, type CommunityErrorCodeType, type ErrorSpec } from './codes.js';

/**
 * 服务端业务异常：携带已登记业务码、HTTP 状态与结构化诊断。
 * 契约 §7.5：服务端只返回已归一异常，内部异常统一转换为 COMMUNITY_INTERNAL_ERROR。
 */
export class AppError extends Error {
  public readonly code: CommunityErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(
    code: CommunityErrorCodeType,
    message: string,
    options?: { details?: Record<string, unknown>; statusCode?: number; retryable?: boolean }
  ) {
    const registered: ErrorSpec = CommunityErrorCode[code];
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options?.statusCode ?? registered.httpStatus;
    this.retryable = options?.retryable ?? registered.retryable;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(
    code: CommunityErrorCodeType,
    message: string,
    details?: Record<string, unknown>
  ): AppError {
    return details === undefined
      ? new AppError(code, message)
      : new AppError(code, message, { details });
  }

  static unauthorized(code: CommunityErrorCodeType, message: string): AppError {
    return new AppError(code, message);
  }

  static forbidden(code: CommunityErrorCodeType, message: string): AppError {
    return new AppError(code, message);
  }

  static notFound(code: CommunityErrorCodeType, message: string): AppError {
    return new AppError(code, message);
  }

  static conflict(
    code: CommunityErrorCodeType,
    message: string,
    details?: Record<string, unknown>
  ): AppError {
    return details === undefined
      ? new AppError(code, message)
      : new AppError(code, message, { details });
  }

  static tooLarge(
    code: CommunityErrorCodeType,
    message: string,
    details?: Record<string, unknown>
  ): AppError {
    return details === undefined
      ? new AppError(code, message)
      : new AppError(code, message, { details });
  }

  static tooManyRequests(code: CommunityErrorCodeType, message: string): AppError {
    return new AppError(code, message);
  }

  static internal(message = '服务端内部错误'): AppError {
    return new AppError('COMMUNITY_INTERNAL_ERROR', message);
  }
}
