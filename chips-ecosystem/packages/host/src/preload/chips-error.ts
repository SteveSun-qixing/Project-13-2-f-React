/**
 * preload 侧错误薄消费面。
 *
 * 权威：`01-Bridge-API规范` §2.5（`ChipsError` 唯一错误类，`request` 与句柄异步方法失败以
 * `ChipsError` reject）、`02-Bridge三层设计` §9（错误归一）。
 *
 * @remarks
 * - 全生态唯一的 `ChipsError` 源码级定义归属 `@chips/bridge` 协议层
 *   （工单024 裁定，《RFC-ChipsError统一裁定》§3.2、§3.3 条 5）；本模块只做薄再导出
 *   （参照 `@chips/sdk` `errors.ts` 波 C 先例），不再自定义同形错误类。
 * - 跨 IPC 的错误一律为普通对象（`IChipsError` 同构）；还原点使用统一类的
 *   `ChipsError.fromPlain`，未识别异常的兜底归一使用 bridge `normalizeError`
 *   （§4.5 条 4），私有兜底文案随本裁定废弃。
 * - `toChipsError` 保留为 host 域自有归一口：`src/renderer` 面（渲染域快速失败与错误
 *   还原）以带域兜底码/文案的三参形态消费；该形态是本域自有的便捷封装，其基座仍是
 *   bridge 唯一类（工单登记：渲染面对本模块的依赖边待后续波次收敛到直连 `@chips/bridge`）。
 * - `@chips/bridge` 协议层为纯 TS、零依赖、`sideEffects: false`，可安全进入 preload 的
 *   renderer sandbox 语境（打包器按 import 面 tree-shaking，仅错误模块进入包体）。
 */

import { BRIDGE_ERROR_CODES, BRIDGE_ERROR_MESSAGES, ChipsError, isChipsError } from '@chips/bridge';
import type { IChipsError } from '@chips/bridge';

export { ChipsError, isChipsError };

/** 结构化错误形状；与 `@chips/bridge` 唯一别名 `IChipsError` 同源（本包私有镜像形状已废弃）。 */
export type IChipsErrorShape = IChipsError;

/**
 * 把任意异常归一为 {@link ChipsError}（host 域便捷封装，基座为 bridge 唯一类）。
 *
 * @param error 任意异常。
 * @param fallbackCode 未识别异常的兜底码（默认 `BRIDGE_INTERNAL`，取 bridge 域常量表）。
 * @param fallbackMessage 未识别异常的兜底文案（默认取 `BRIDGE_ERROR_MESSAGES.BRIDGE_INTERNAL`）。
 */
export function toChipsError(
  error: unknown,
  fallbackCode: string = BRIDGE_ERROR_CODES.internal,
  fallbackMessage: string = BRIDGE_ERROR_MESSAGES[BRIDGE_ERROR_CODES.internal],
): ChipsError {
  if (error instanceof ChipsError) {
    return error;
  }
  if (isChipsError(error)) {
    return ChipsError.fromPlain(error);
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
