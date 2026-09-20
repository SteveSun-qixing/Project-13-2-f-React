/**
 * `.cpk` 包校验域与生命周期域错误码的壳侧结构视图（《03-插件包格式》§八、《01-薯片内核设计》§六）。
 *
 * 权威：`04-文件格式规范/03-插件包格式` §八（`CPK_*` 错误表）、
 * `01-架构设计/01-子系统设计/01-薯片内核设计` §6.2/§6.4/§6.7（生命周期域 `KERNEL_*`）。
 *
 * @remarks
 * - 错误码的权威事实源在契约生成面（`@chips/sdk` `generated/error-codes.ts`，其上游为
 *   `@chips/bridge`）；壳与 `@chips/bridge`、`@chips/sdk`、`@chips/cli` 无运行时依赖
 *   （架构边界：壳是运行时承载，不 import 被承载方），因此以本模块作为**结构视图**等价实现，
 *   与 `src/protocol/error-codes.ts` 同构约定一致。
 * - 逐项一致由 `tests/loader-contract.test.ts` 对契约生成源文本做漂移锁断言锁定。
 * - 消费方（装载器解包、校验、签名、生命周期）一律引用本模块常量，不得散落字符串字面量、
 *   不得自增自造码。
 */

import type { IWireChipsError } from '../protocol/wire.js';

/** `.cpk` 包校验域错误码（《03-插件包格式》§八；全部不可重试）。 */
export const CPK_ERROR_CODES = {
  archiveInvalid: 'CPK_ARCHIVE_INVALID',
  layoutInvalid: 'CPK_LAYOUT_INVALID',
  manifestMissing: 'CPK_MANIFEST_MISSING',
  manifestInvalid: 'CPK_MANIFEST_INVALID',
  engineUnsupported: 'CPK_ENGINE_UNSUPPORTED',
  entryMissing: 'CPK_ENTRY_MISSING',
  nativePayload: 'CPK_NATIVE_PAYLOAD',
  pathUnsafe: 'CPK_PATH_UNSAFE',
  limitExceeded: 'CPK_LIMIT_EXCEEDED',
  signatureRequired: 'CPK_SIGNATURE_REQUIRED',
  signatureInvalid: 'CPK_SIGNATURE_INVALID',
} as const;

/** `.cpk` 域错误码联合类型。 */
export type CpkErrorCode = (typeof CPK_ERROR_CODES)[keyof typeof CPK_ERROR_CODES];

/**
 * 生命周期域错误码（装载器在状态机与激活阶段直接构造的子集；权威在《01-薯片内核设计》§六，
 * 内核交付后由内核同名码承接，装载器侧不新增 `KERNEL_*` 码）。
 */
export const LIFECYCLE_ERROR_CODES = {
  invalidTransition: 'KERNEL_INVALID_TRANSITION',
  dependencyConflict: 'KERNEL_DEPENDENCY_CONFLICT',
  dependencyMissing: 'KERNEL_DEPENDENCY_MISSING',
  dependencyVersion: 'KERNEL_DEPENDENCY_VERSION',
  dependencyCycle: 'KERNEL_DEPENDENCY_CYCLE',
  lifecycleTimeout: 'KERNEL_LIFECYCLE_TIMEOUT',
  applyFailed: 'KERNEL_APPLY_FAILED',
  pluginNotFound: 'KERNEL_PLUGIN_NOT_FOUND',
} as const;

/** 生命周期域错误码联合类型。 */
export type LifecycleErrorCode = (typeof LIFECYCLE_ERROR_CODES)[keyof typeof LIFECYCLE_ERROR_CODES];

/** 装载器直接构造的全部错误码。 */
export type LoaderErrorCode = CpkErrorCode | LifecycleErrorCode;

/** `CPK_*` 的 `retryable` 口径（《03-插件包格式》§八：均不可重试）。 */
export const CPK_ERROR_RETRYABLE: Readonly<Record<CpkErrorCode, boolean>> = {
  CPK_ARCHIVE_INVALID: false,
  CPK_LAYOUT_INVALID: false,
  CPK_MANIFEST_MISSING: false,
  CPK_MANIFEST_INVALID: false,
  CPK_ENGINE_UNSUPPORTED: false,
  CPK_ENTRY_MISSING: false,
  CPK_NATIVE_PAYLOAD: false,
  CPK_PATH_UNSAFE: false,
  CPK_LIMIT_EXCEEDED: false,
  CPK_SIGNATURE_REQUIRED: false,
  CPK_SIGNATURE_INVALID: false,
};

/**
 * 生命周期域 `retryable` 口径（依据《01-薯片内核设计》§6.2/§6.7 的恢复语义：
 * 依赖暂缺自动续待、超时进入强制撤销后可显式重试、非法迁移与未命中为确定性失败）。
 */
export const LIFECYCLE_ERROR_RETRYABLE: Readonly<Record<LifecycleErrorCode, boolean>> = {
  KERNEL_INVALID_TRANSITION: false,
  KERNEL_DEPENDENCY_CONFLICT: false,
  KERNEL_DEPENDENCY_MISSING: true,
  KERNEL_DEPENDENCY_VERSION: false,
  KERNEL_DEPENDENCY_CYCLE: false,
  KERNEL_LIFECYCLE_TIMEOUT: true,
  KERNEL_APPLY_FAILED: true,
  KERNEL_PLUGIN_NOT_FOUND: false,
};

/** 面向用户的简体中文文案（不暴露堆栈与内部路径；细节经 `details` 承载）。 */
export const LOADER_ERROR_MESSAGES: Readonly<Record<LoaderErrorCode, string>> = {
  CPK_ARCHIVE_INVALID: '插件包归档不合法',
  CPK_LAYOUT_INVALID: '插件包结构不符合布局规则',
  CPK_MANIFEST_MISSING: '插件包缺少清单文件',
  CPK_MANIFEST_INVALID: '插件清单不符合格式要求',
  CPK_ENGINE_UNSUPPORTED: '插件要求的平台版本当前不满足',
  CPK_ENTRY_MISSING: '插件入口文件缺失或不合法',
  CPK_NATIVE_PAYLOAD: '插件包包含不受支持的原生可执行文件',
  CPK_PATH_UNSAFE: '插件包包含不安全路径',
  CPK_LIMIT_EXCEEDED: '插件包超出大小或数量限制',
  CPK_SIGNATURE_REQUIRED: '该来源渠道的插件包必须签名',
  CPK_SIGNATURE_INVALID: '插件包签名校验失败',
  KERNEL_INVALID_TRANSITION: '插件生命周期状态迁移非法',
  KERNEL_DEPENDENCY_CONFLICT: '插件依赖冲突',
  KERNEL_DEPENDENCY_MISSING: '插件依赖缺失',
  KERNEL_DEPENDENCY_VERSION: '插件依赖版本范围不可满足',
  KERNEL_DEPENDENCY_CYCLE: '插件依赖存在环',
  KERNEL_LIFECYCLE_TIMEOUT: '插件生命周期操作超时',
  KERNEL_APPLY_FAILED: '插件激活失败',
  KERNEL_PLUGIN_NOT_FOUND: '插件不存在',
};

/** 校验阶段（《03-插件包格式》§八：`details` 必须携带阶段）。 */
export type CpkValidationStage = 'archive' | 'layout' | 'manifest' | 'signature' | 'hash';

/** 构造装载器错误的可选项。 */
export interface LoaderErrorOptions {
  /** 覆盖默认文案（仍为简体中文）。 */
  readonly message?: string;
  /** 结构化诊断（阶段 / 成员路径 / 字段指针等），不含文件内容与凭证。 */
  readonly details?: unknown;
}

/** 装载器全部直接构造错误码的合并 `retryable` 口径表。 */
export const LOADER_ERROR_RETRYABLE: Readonly<Record<LoaderErrorCode, boolean>> = {
  ...CPK_ERROR_RETRYABLE,
  ...LIFECYCLE_ERROR_RETRYABLE,
};

/**
 * 按错误码构造 `IWireChipsError` 同构对象（装载器判定失败的统一出口）。
 *
 * @param code 已登记错误码。
 * @param options 覆盖项。
 */
export function loaderWireError(code: LoaderErrorCode, options: LoaderErrorOptions = {}): IWireChipsError {
  const error: IWireChipsError = {
    code,
    message: options.message ?? LOADER_ERROR_MESSAGES[code],
    retryable: LOADER_ERROR_RETRYABLE[code],
  };
  return options.details === undefined ? error : { ...error, details: options.details };
}
