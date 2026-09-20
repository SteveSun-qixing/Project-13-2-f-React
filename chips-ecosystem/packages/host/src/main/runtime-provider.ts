/**
 * 平台组合根契约与自检装配。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动顺序：内核 → 解析器 / 资源管理器 → Bridge）、
 * §3.2（唯一交互面：壳 → 核心只经端口）。
 *
 * @remarks
 * - 壳不装配内核与 Bridge：`createRuntime` 由组合根提供（见 `production-assembly.ts`）。
 * - 本文件是组合根契约与校验单点：`self-check.ts` 与生产打包入口都经
 *   `createProductionAssembly` 提供 `createRuntime`；壳逻辑对两者零改动。
 */

import type { IPalHost } from '../platform/contracts/index.js';
import type { IPlatformRuntime } from '../runtime/contracts.js';
import { HostStartupError } from '../shared/errors.js';

/** 组合根向壳提供的装配上下文。 */
export interface HostRuntimeContext {
  /** 壳自检通过的 PAL 宿主。 */
  readonly palHost: IPalHost;
  /** 平台构建产物根目录（`chips-resource://platform/<path>` 的映射根）。 */
  readonly platformRoot: string;
  /** 用户数据目录（Electron `app.getPath('userData')`）。 */
  readonly userDataPath: string;
}

/** PAL 宿主构造上下文。 */
export interface PalHostContext {
  /** 用户数据目录。 */
  readonly userDataPath: string;
  /** preload 脚本绝对路径。 */
  readonly preloadPath: string;
  /** 平台构建产物根目录。 */
  readonly platformRoot: string;
}

/**
 * 平台装配契约；由组合根实现。
 *
 * @typeParam TRuntime 组合根产出的运行时端口形态；默认取壳消费的 `IPlatformRuntime`。
 * 生产组合根产出的是附带诊断快照的 `IHostRuntime`（`runtime/host-runtime.ts`），以类型参数如实暴露；
 * 壳启动链（`main.ts`）仍按 `IPlatformRuntime` 端口消费，不因此感知诊断面。
 *
 * @remarks `createRuntime` 内部完成内核 → 解析器 / 资源管理器 / 文档服务 → Bridge 能力注册；
 * 注册校验失败时必须抛出，壳据此终止启动（17 §2.4 第 3 步）。
 */
export interface HostAssembly<TRuntime extends IPlatformRuntime = IPlatformRuntime> {
  /** 构造 PAL 宿主（壳自检前的平台差异实现）。 */
  createPalHost(electronModule: unknown, context: PalHostContext): IPalHost;
  /** 启动并返回平台运行时端口。 */
  createRuntime(context: HostRuntimeContext): TRuntime | Promise<TRuntime>;
}

/**
 * 校验装配契约完整性。
 *
 * @param assembly 组合根装配。
 * @returns 原装配对象。
 * @throws {HostStartupError} 缺少构造方法时抛出。
 */
export function createHostAssembly<TRuntime extends IPlatformRuntime = IPlatformRuntime>(
  assembly: HostAssembly<TRuntime>,
): HostAssembly<TRuntime> {
  if (typeof assembly.createPalHost !== 'function' || typeof assembly.createRuntime !== 'function') {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', '平台装配缺少 createPalHost / createRuntime');
  }
  return assembly;
}
