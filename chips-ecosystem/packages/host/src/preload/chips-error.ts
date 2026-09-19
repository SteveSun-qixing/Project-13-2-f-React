/**
 * preload 侧错误还原。
 *
 * 权威：`01-Bridge-API规范` §2.5（`ChipsError` 唯一错误类，`request` 与句柄异步方法失败以
 * `ChipsError` reject）、`02-Bridge三层设计` §9（错误归一）。
 *
 * @remarks
 * - 跨 IPC 的错误一律为普通对象（`IChipsError` 同构）；preload 在还原点构造本类实例，
 *   保证调用方拿到 `Error` 且可按 `code` 分支。
 * - 错误类权威定义在 `@chips/bridge`（协议类型归属）；`@chips/bridge` 交付前本包以结构视图
 *   等价实现，交付后单点收敛（见开发日志"集成缺口"）。
 */

/** 结构化错误形状（与 `IChipsError` 同构）。 */
export interface IChipsErrorShape {
  /** 已登记错误码（`<DOMAIN>_<REASON>`）。 */
  readonly code: string;
  /** 面向用户的简体中文消息。 */
  readonly message: string;
  /** 结构化诊断；不含输入原文、凭证与内部路径。 */
  readonly details?: unknown;
  /** 是否可重试；缺省 `false`。 */
  readonly retryable?: boolean;
}

/** preload 错误还原类；名称与形状与全生态 `ChipsError` 一致。 */
export class ChipsError extends Error implements IChipsErrorShape {
  /** 已登记错误码。 */
  readonly code: string;
  /** 结构化诊断。 */
  readonly details?: unknown;
  /** 是否可重试。 */
  readonly retryable: boolean;

  constructor(shape: IChipsErrorShape) {
    super(shape.message);
    this.name = 'ChipsError';
    this.code = shape.code;
    this.retryable = shape.retryable ?? false;
    if (shape.details !== undefined) {
      this.details = shape.details;
    }
  }

  /** 归一为结构化克隆兼容的普通对象。 */
  toPlain(): IChipsErrorShape {
    const plain: IChipsErrorShape = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    return this.details === undefined ? plain : { ...plain, details: this.details };
  }
}

/** 判断值是否为结构化错误形状。 */
export function isChipsErrorShape(value: unknown): value is IChipsErrorShape {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record['code'] !== 'string' || record['code'].length === 0) {
    return false;
  }
  if (typeof record['message'] !== 'string' || record['message'].length === 0) {
    return false;
  }
  return record['retryable'] === undefined || typeof record['retryable'] === 'boolean';
}

/**
 * 把任意异常归一为 {@link ChipsError}。
 *
 * @param error 任意异常。
 * @param fallbackCode 未识别异常的兜底码（默认 `BRIDGE_INTERNAL`）。
 * @param fallbackMessage 未识别异常的兜底文案。
 */
export function toChipsError(
  error: unknown,
  fallbackCode = 'BRIDGE_INTERNAL',
  fallbackMessage = '宿主内部错误',
): ChipsError {
  if (error instanceof ChipsError) {
    return error;
  }
  if (isChipsErrorShape(error)) {
    return new ChipsError(error);
  }
  if (error instanceof Error && typeof (error as { code?: unknown }).code === 'string') {
    const code: string = (error as unknown as { code: string }).code;
    return new ChipsError({
      code,
      message: error.message.length > 0 ? error.message : fallbackMessage,
      retryable: false,
    });
  }
  return new ChipsError({ code: fallbackCode, message: fallbackMessage, retryable: false });
}
