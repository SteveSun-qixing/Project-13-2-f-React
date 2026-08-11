import { ErrorCode, ErrorCodeType } from './codes';

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCodeType,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // 保持正确的原型链
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }

  // ─── 工厂方法 ────────────────────────────────────────────────

  static unauthorized(code: ErrorCodeType, message: string): AppError {
    return new AppError(code, message, 401);
  }

  static forbidden(code: ErrorCodeType, message: string): AppError {
    return new AppError(code, message, 403);
  }

  static notFound(code: ErrorCodeType, message: string): AppError {
    return new AppError(code, message, 404);
  }

  static conflict(code: ErrorCodeType, message: string): AppError {
    return new AppError(code, message, 409);
  }

  static badRequest(
    code: ErrorCodeType,
    message: string,
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(code, message, 400, details);
  }

  static tooLarge(code: ErrorCodeType, message: string): AppError {
    return new AppError(code, message, 413);
  }

  static tooManyRequests(code: ErrorCodeType, message: string): AppError {
    return new AppError(code, message, 429);
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
