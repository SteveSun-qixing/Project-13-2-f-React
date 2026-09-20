/**
 * 渲染错误码常量与构造（壳渲染进程结构视图）。
 *
 * 权威：`05-渲染引擎设计` §11（错误模型九码、retryable 口径、简体中文文案规则）、
 * `src/preload/chips-error.ts`（`ChipsError` 唯一错误类）。
 *
 * @remarks
 * - 错误码在本模块内只出现于常量定义处；业务路径一律引用常量，不得散落硬编码字符串。
 * - 与文档的逐码一致性由 `tests/renderer-frame-protocol.test.ts` 漂移锁锁定（读取 §11 分册
 *   原文比对，任一侧漂移即红）。
 */

import { ChipsError } from '../preload/chips-error.js';

/** 渲染错误码（§11 错误模型全表）。 */
export const RENDER_ERROR_CODES = {
  documentInvalid: 'RENDER_DOCUMENT_INVALID',
  pluginMissing: 'RENDER_PLUGIN_MISSING',
  pluginFailed: 'RENDER_PLUGIN_FAILED',
  frameTimeout: 'RENDER_FRAME_TIMEOUT',
  resourceDenied: 'RENDER_RESOURCE_DENIED',
  schemaUnsupported: 'RENDER_SCHEMA_UNSUPPORTED',
  sessionDisposed: 'RENDER_SESSION_DISPOSED',
  updateFailed: 'RENDER_UPDATE_FAILED',
  protocolViolation: 'RENDER_PROTOCOL_VIOLATION',
} as const;

/** 渲染错误码联合。 */
export type RenderErrorCode = (typeof RENDER_ERROR_CODES)[keyof typeof RENDER_ERROR_CODES];

/** 各错误码的 `retryable` 口径（§11 表格逐行镜像）。 */
export const RENDER_ERROR_RETRYABLE: Readonly<Record<RenderErrorCode, boolean>> = {
  RENDER_DOCUMENT_INVALID: false,
  RENDER_PLUGIN_MISSING: false,
  RENDER_PLUGIN_FAILED: true,
  RENDER_FRAME_TIMEOUT: true,
  RENDER_RESOURCE_DENIED: false,
  RENDER_SCHEMA_UNSUPPORTED: false,
  RENDER_SESSION_DISPOSED: false,
  RENDER_UPDATE_FAILED: true,
  RENDER_PROTOCOL_VIOLATION: false,
};

/** 各错误码的默认用户可见简体中文文案（§11 表"用户可见表现"列的口径归一）。 */
export const RENDER_ERROR_MESSAGES: Readonly<Record<RenderErrorCode, string>> = {
  RENDER_DOCUMENT_INVALID: '文档内容损坏，无法渲染',
  RENDER_PLUGIN_MISSING: '缺少对应的基础卡片插件，请安装后再试',
  RENDER_PLUGIN_FAILED: '插件渲染出现错误，可重试',
  RENDER_FRAME_TIMEOUT: '渲染帧启动超时，可重试',
  RENDER_RESOURCE_DENIED: '资源访问被拒绝',
  RENDER_SCHEMA_UNSUPPORTED: '已安装插件版本与内容要求不匹配，请升级插件',
  RENDER_SESSION_DISPOSED: '渲染会话已释放',
  RENDER_UPDATE_FAILED: '渲染更新失败，已保留当前内容',
  RENDER_PROTOCOL_VIOLATION: '渲染帧通信异常，已断开通道',
};

/** 判断值是否为已登记的渲染错误码。 */
export function isRenderErrorCode(value: string): value is RenderErrorCode {
  return Object.prototype.hasOwnProperty.call(RENDER_ERROR_RETRYABLE, value);
}

/** 渲染错误构造选项。 */
export interface IRenderErrorOptions {
  /** 已登记渲染错误码。 */
  readonly code: RenderErrorCode;
  /** 覆盖默认文案的简体中文消息（面向用户的部分必须简体中文）。 */
  readonly message?: string;
  /** 结构化诊断；不含文件字节与敏感路径。 */
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * 构造渲染域 `ChipsError`（码 / 简体中文文案 / retryable 均以 §11 登记口径为准）。
 */
export function createRenderError(options: IRenderErrorOptions): ChipsError {
  return new ChipsError({
    code: options.code,
    message: options.message ?? RENDER_ERROR_MESSAGES[options.code],
    retryable: RENDER_ERROR_RETRYABLE[options.code],
    ...(options.details === undefined ? {} : { details: options.details }),
  });
}
