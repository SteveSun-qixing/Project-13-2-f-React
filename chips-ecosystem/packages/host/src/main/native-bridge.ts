/**
 * `chips-native` 原生绑定适配层：`chips-native.node` 的类型视图与装载闸
 * （《核心接口规范》§5.3、§8.5、§8.6；工单 025「宿主未接原生绑定」的宿主侧收口交付）。
 *
 * 权威：`05-接口与契约/03.05-核心接口规范-五、Bridge` §5.3（本文件即契约点名的
 * `packages/host/src/main/native-bridge.ts`，`INativeBridge` 四方法类型视图与 §8.6
 * 导出总表一致）、`03.08-核心接口规范-八、Neon 绑定约定` §8.5（绑定层错误一律为
 * `ChipsError` 同构 `Error`，`code` / `retryable` / `details` 自有属性）、§8.6
 * （导出表只增不改；删除或改签名递增 `CORE_ABI_VERSION`）。
 *
 * @remarks
 * - 零依赖结构视图：`@chips/host` 与 `@chips/native` 无运行时依赖边（架构边界，与
 *   `protocol/error-codes.ts` 的镜像模式同构）；绑定形状镜像自
 *   `packages/native/types/chips-native.d.ts`，本模块镜像与 `abi/export-surface.json`
 *   （ABI 版本、导出名）及 `.d.ts` 函数面的三方一致性由 `tests/native-bridge.test.ts` 单点锁定。
 * - 消费面：本层消费 §8.6 登记的元信息两导出（`coreVersion` / `coreAbiVersion`，装载闸）
 *   与 Bridge 域四导出（`bridgeRegister` / `bridgeUnregister` / `bridgeRequest` /
 *   `bridgeCancelSession`，能力执行面）。装载闸要求六导出在位且 ABI 等值：任一不满足即
 *   整体判定不可用（fail-closed，不降级为部分可用）——旧产物缺能力执行导出的漂移（工单 025
 *   实测：`packages/host/native/chips-native.node` 曾滞留于 11 导出旧构建）自此在装载点显形。
 * - 内核链路现状（工单 025 剩余项，登记于工单任务说明「收口记录与剩余项」）：绑定面尚无
 *   提供方激活与会话登记导出（内核 §5.5 / §5.6 的 `activate_provider` / `open_session`
 *   前置；Neon 扩展导出名已由工单 026 RFC §五.3 裁定：`bridgeActivateProvider`、
 *   `bridgeDeactivateProvider`、`bridgeGrantCapabilityId`、`bridgeOpenSession`、
 *   `bridgeCloseSession`、`bridgeShutdown`，尚未在 `packages/native` 落地）。落地前内核
 *   `bridgeRegister` 因 owner 未激活按 `KERNEL_INVALID_TRANSITION` 拒绝、`bridgeRequest`
 *   因无会话登记按 `BRIDGE_SESSION_UNKNOWN` 拒绝；因此生产注册与调用权威暂留壳侧
 *   （`runtime/capability/**`），插件激活端口（装载器 `activationPortFor`）保持诚实回退臂。
 *   本模块交付的是完整、真实的绑定消费链与类型化桥面，剩余项收口后由集成单直接切换到本桥。
 * - 产物落位：`packages/host/native/chips-native.node`（`@chips/native` 的
 *   `scripts/copy-native.mjs` 生产口径，构建产物不入库）；默认路径按组合根
 *   `platformRoot`（`dist/renderer`）上溯两级推导，见 {@link defaultNativeBridgeModulePath}。
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { BRIDGE_ERROR_CODES } from '../protocol/error-codes.js';
import { toWireError } from '../protocol/wire.js';
import type { IBridgeResponse } from '../protocol/wire.js';

/**
 * 能力执行上下文（《核心接口规范》§5.3 原样镜像；与
 * `packages/native/types/chips-native.d.ts` 的 `INativeCapabilityContext` 一致）。
 */
export interface INativeCapabilityContext {
  /** 取消信号；会话销毁、超时、能力注销或 Bridge 关闭时触发。 */
  readonly signal: AbortSignal;
  /** 调用截止时间（Unix epoch 毫秒）；内核准入时即确定。 */
  readonly deadline: number;
}

/**
 * TS 能力注册形状（§5.3 原样镜像）；`handler` 在 JS 线程调用，返回值被等待。
 */
export interface INativeCapabilityRegistration {
  descriptor: {
    id: string;
    schema: Record<string, unknown>;
    permissions: string[];
  };
  owner: string;
  timeoutMs: number;
  concurrency: 'parallel' | 'serial';
  maxQueue: number;
  handler: (input: unknown, ctx: INativeCapabilityContext) => Promise<unknown>;
}

/**
 * 能力调用请求（§5.3 原样镜像）；`bin` 为 `x-chips-binary` 字段的字节表
 * （键为 JSON Pointer 位置对应的引用名）。
 */
export interface INativeBridgeRequest {
  requestId: string;
  capabilityId: string;
  sessionId: number;
  input: unknown;
  bin?: Record<string, Uint8Array>;
}

/**
 * 原生绑定 Bridge 域类型视图（§5.3 `INativeBridge` 契约原样；四方法与 §8.6
 * Bridge 域导出逐项对应）。失败一律以 §8.5 `ChipsError` 同构 `Error` 呈现。
 */
export interface INativeBridge {
  /** 注册 TS 能力并持有其 handler；注册期内核校验失败即抛出。 */
  bridgeRegister(registration: INativeCapabilityRegistration): void;
  /** 注销能力；幂等，在途调用由内核按取消收口。 */
  bridgeUnregister(capabilityId: string): void;
  /** 发起一次能力调用；输入按 `{ json, bin }` 信封编码，输出中二进制原位嵌回。 */
  bridgeRequest(request: INativeBridgeRequest): Promise<unknown>;
  /** 取消会话全部在途调用；幂等；会话保持可用。 */
  bridgeCancelSession(sessionId: number): void;
}

/**
 * 宿主期望的原生绑定 ABI 版本（`packages/native/abi/export-surface.json` 的
 * `abiVersion` 结构视图；§8.6 规则「删除或改签名才递增」）。镜像一致性由
 * `tests/native-bridge.test.ts` 契约锁单点防漂移。
 */
export const NATIVE_BRIDGE_ABI_VERSION = 1;

/**
 * 装载闸要求的导出名集合：§8.6 元信息域两项 + Bridge 域四项。
 * 导出表只增不改（§8.6），故按「必备名全部在位」判定，不要求全等集合，
 * 后续域扩展导出（§8.6 新增行）不影响既有判定。
 */
export const NATIVE_BRIDGE_REQUIRED_EXPORTS = [
  'coreVersion',
  'coreAbiVersion',
  'bridgeRegister',
  'bridgeUnregister',
  'bridgeRequest',
  'bridgeCancelSession',
] as const;

/** 装载失败原因（fail-closed 四分面）。 */
export type NativeBridgeUnavailableReason =
  /** 产物文件不存在（未构建或落位漂移）。 */
  | 'module-missing'
  /** 文件存在但加载抛错（损坏、平台不匹配、依赖缺失）。 */
  | 'load-failed'
  /** 加载成功但 §8.6 必备导出缺位或非函数（旧产物 / 面漂移）。 */
  | 'surface-mismatch'
  /** 导出在位但 `coreAbiVersion()` 与宿主期望不等或取值非法（ABI 漂移）。 */
  | 'abi-mismatch';

/** 原生绑定可用态：类型化桥面 + 元信息快照。 */
export interface INativeBridgeAvailable {
  readonly status: 'available';
  /** 实际加载的模块路径。 */
  readonly modulePath: string;
  /** 绑定报告的 `coreVersion()`（与平台包同版本号）。 */
  readonly coreVersion: string;
  /** 绑定报告的 `coreAbiVersion()`。 */
  readonly abiVersion: number;
  /** Bridge 域类型化消费面（§5.3 `INativeBridge`）。 */
  readonly bridge: INativeBridge;
}

/** 原生绑定不可用态：诚实呈现原因，不伪造桥面。 */
export interface INativeBridgeUnavailable {
  readonly status: 'unavailable';
  readonly reason: NativeBridgeUnavailableReason;
  readonly modulePath: string;
  /** 简体中文诊断（不含堆栈与内部路径细节之外的敏感信息）。 */
  readonly detail: string;
}

/** 原生绑定装载结果。 */
export type INativeBridgeBinding = INativeBridgeAvailable | INativeBridgeUnavailable;

/**
 * 生产产物默认路径：`<platformRoot>/../../native/chips-native.node`。
 *
 * @remarks 组合根的 `platformRoot` 是壳构建产物目录 `dist/renderer`，产物落位口径
 * （`@chips/native` `copy-native.mjs`）为 `packages/host/native/chips-native.node`，
 * 即自 `dist/renderer` 上溯两级再进 `native/`。
 *
 * @param platformRoot 组合根上下文的平台构建产物根目录。
 */
export function defaultNativeBridgeModulePath(platformRoot: string): string {
  return resolve(platformRoot, '..', '..', 'native', 'chips-native.node');
}

/** 读取模块值的函数导出；非函数时返回 `undefined`。 */
function readFunction(moduleValue: Record<string, unknown>, name: string): boolean {
  return typeof moduleValue[name] === 'function';
}

/** 校验通过后的模块视图：六必备导出均为函数，返回值经桥面统一收敛（§8.5 错误以抛出呈现）。 */
interface INativeBridgeModule {
  coreVersion(): unknown;
  coreAbiVersion(): unknown;
  bridgeRegister(registration: INativeCapabilityRegistration): unknown;
  bridgeUnregister(capabilityId: string): unknown;
  bridgeRequest(request: INativeBridgeRequest): unknown;
  bridgeCancelSession(sessionId: number): unknown;
}

/** 不可用结果的构造器。 */
function unavailable(
  reason: NativeBridgeUnavailableReason,
  modulePath: string,
  detail: string,
): INativeBridgeUnavailable {
  return { status: 'unavailable', reason, modulePath, detail };
}

/**
 * 装载并校验 `chips-native.node` 原生绑定（§8.6 元信息 + Bridge 域消费链入口）。
 *
 * @remarks 同步加载（Electron 主进程 CJS 链路；`.node` 由 `require` 经 dlopen 载入）。
 * 判定顺序：文件存在 → 加载成功 → 六必备导出在位 → ABI 版本与 `coreVersion` 合法；
 * 任一步失败即返回对应 {@link NativeBridgeUnavailableReason}，全部通过才交付类型化桥面。
 * Node 的模块缓存保证同一路径重复装载返回同一实例（内核进程级单例语义，§5.4）。
 *
 * @param modulePath 绑定模块绝对路径（生产默认由 {@link defaultNativeBridgeModulePath} 推导；
 *   测试与特殊落位显式注入）。
 * @returns 可用 / 不可用的诚实呈现。
 */
export function loadNativeBridgeBinding(modulePath: string): INativeBridgeBinding {
  if (!existsSync(modulePath)) {
    return unavailable('module-missing', modulePath, '原生绑定产物不存在，未构建或落位漂移');
  }

  let moduleValue: Record<string, unknown>;
  try {
    const requireCjs = createRequire(pathToFileURL(modulePath).href);
    const loaded: unknown = requireCjs(modulePath);
    if (typeof loaded !== 'object' || loaded === null) {
      return unavailable('load-failed', modulePath, '原生绑定模块导出的不是对象');
    }
    moduleValue = loaded as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error;
    return unavailable('load-failed', modulePath, `原生绑定加载失败：${message}`);
  }

  const missing = NATIVE_BRIDGE_REQUIRED_EXPORTS.filter((name) => !readFunction(moduleValue, name));
  if (missing.length > 0) {
    return unavailable(
      'surface-mismatch',
      modulePath,
      `§8.6 必备导出缺位或非函数：${missing.join('、')}（疑似旧构建产物，请重新构建 @chips/native）`,
    );
  }
  const bridgeModule = moduleValue as unknown as INativeBridgeModule;

  let coreVersion: unknown;
  let abiVersion: unknown;
  try {
    coreVersion = bridgeModule.coreVersion();
    abiVersion = bridgeModule.coreAbiVersion();
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error;
    return unavailable('surface-mismatch', modulePath, `元信息导出调用失败：${message}`);
  }

  if (typeof coreVersion !== 'string' || coreVersion.length === 0) {
    return unavailable('surface-mismatch', modulePath, 'coreVersion() 未返回非空字符串');
  }
  if (typeof abiVersion !== 'number' || !Number.isInteger(abiVersion)) {
    return unavailable('abi-mismatch', modulePath, 'coreAbiVersion() 未返回整数');
  }
  if (abiVersion !== NATIVE_BRIDGE_ABI_VERSION) {
    return unavailable(
      'abi-mismatch',
      modulePath,
      `coreAbiVersion()=${String(abiVersion)} 与宿主期望 ${String(NATIVE_BRIDGE_ABI_VERSION)} 不等`,
    );
  }

  const bridge: INativeBridge = {
    bridgeRegister: (registration) => {
      void bridgeModule.bridgeRegister(registration);
    },
    bridgeUnregister: (capabilityId) => {
      void bridgeModule.bridgeUnregister(capabilityId);
    },
    bridgeRequest: (request) => Promise.resolve(bridgeModule.bridgeRequest(request)),
    bridgeCancelSession: (sessionId) => {
      void bridgeModule.bridgeCancelSession(sessionId);
    },
  };

  return { status: 'available', modulePath, coreVersion, abiVersion, bridge };
}

/**
 * 经原生桥发起一次调用并归一为 Bridge 响应（§5.3 适配层示例的壳侧正式实现）。
 *
 * @remarks 绑定层失败已是 §8.5 `ChipsError` 同构 `Error`（携带 `code` / `retryable` /
 * `details`），`toWireError` 原样透传；非该形状的值（含 JS 反向归一缺位等异常形态）
 * 归一为通道级 `BRIDGE_INTERNAL`，不回传堆栈与内部路径。
 *
 * @param bridge 类型化桥面（{@link loadNativeBridgeBinding} 可用态交付）。
 * @param request 已含内核会话号的能力调用请求。
 * @returns 与壳侧 Bridge 响应面一致的成功 / 失败信封。
 */
export async function dispatchNativeBridgeRequest(
  bridge: INativeBridge,
  request: INativeBridgeRequest,
): Promise<IBridgeResponse> {
  try {
    const result = await bridge.bridgeRequest(request);
    return { requestId: request.requestId, ok: true, result };
  } catch (error) {
    return {
      requestId: request.requestId,
      ok: false,
      error: toWireError(error, BRIDGE_ERROR_CODES.internal, '桥接内部错误'),
    };
  }
}
