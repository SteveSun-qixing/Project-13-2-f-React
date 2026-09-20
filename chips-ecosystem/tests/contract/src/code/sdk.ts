/**
 * 实现侧（SDK 生成契约）登记表：契约测试读取的生成物侧事实。
 *
 * 说明：与 `src/code/bridge.ts` / `src/code/host.ts` 同口径，按源码相对路径读取
 * `packages/sdk/src/generated/` 的生成常量（纯数据模块，无运行时依赖）；
 * 生成契约由 `tools/contract-gen` 从文档库权威表生成，禁止手写。
 * SDK 构建产物发布后，本文件与 `bridge.ts` / `host.ts` 一起作为唯一切换点。
 */

import { ERROR_CODES } from '../../../../packages/sdk/src/generated/error-codes';

export interface SdkGeneratedCodeModel {
  readonly errorCodes: readonly string[];
}

export function loadSdkGeneratedCodeModel(): SdkGeneratedCodeModel {
  return { errorCodes: [...ERROR_CODES] };
}
