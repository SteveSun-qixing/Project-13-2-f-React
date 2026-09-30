/**
 * 测试辅助：`ChipsError.details` 在 SDK 侧声明为 `unknown`，
 * 本包诊断面只放标量，故统一经此窄化读取（仅测试面使用，不进产线码）。
 */

import type { ChipsError } from '@chips/sdk';

export function errorDetails(error: ChipsError | undefined): Record<string, unknown> {
  return (error?.details ?? {}) as Record<string, unknown>;
}
