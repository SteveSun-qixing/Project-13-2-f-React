/* RFC-ChipsError统一裁定 §3.3 条 1 消费形态：SDK 以运行时 import 薄再导出 bridge 错误模型面。 */
import { ChipsError, isChipsError } from '@chips/bridge';
import type { IChipsError } from '@chips/bridge';

export { ChipsError, isChipsError };
export type { IChipsError };

export const narrowError = (value: unknown): ChipsError | null =>
  isChipsError(value) ? value : null;
