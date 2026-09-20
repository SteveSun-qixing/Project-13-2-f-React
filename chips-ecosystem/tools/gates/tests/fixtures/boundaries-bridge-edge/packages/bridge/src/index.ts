/* 错误模型定义面占位：零内部依赖（与生产 @chips/bridge 依赖形态一致）。 */
export class ChipsError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export const isChipsError = (value: unknown): value is ChipsError =>
  value instanceof ChipsError;

export interface IChipsError {
  code: string;
  message: string;
  retryable?: boolean;
}
