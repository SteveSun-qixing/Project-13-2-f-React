/**
 * 生产组合根装配：`HostAssembly.createRuntime` → 真实运行时（P0-1 交付点 1、2）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动顺序：内核 → 解析器 / 资源管理器 → Bridge 能力注册）、
 * `02-Bridge三层设计` §4（能力注册与默认值）、§2.1（组合根装配职责）。
 *
 * @remarks
 * - `createRuntime` 按**显式能力清单**注册单元：内置能力（`system:info`）+ 注入的外部提供方
 *   （如 `document:*` 由文档能力方产出描述符后经 `capabilityProviders` 附加），替代旧空壳的统一
 *   `BRIDGE_CAPABILITY_NOT_FOUND`。
 * - 外部提供方的接线契约是 {@link IHostCapabilityDescriptor}：一条描述 = 一个可注册单元
 *   （ID + 所需权限 + handler + 超时/并发）。注册冲突或权限校验失败即在 `start` 抛出、壳终止启动。
 * - PAL 宿主构造由调用方注入（平台差异），本模块只负责运行时装配，保持与自检入口零逻辑分叉。
 */

import type { IPalHost } from '../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../runtime/capability/contracts.js';
import type { IHostCapabilityRegistryOptions } from '../runtime/capability/registry.js';
import type { IHostSessionProvisioner } from '../runtime/capability/session.js';
import { createHostRuntime, type IHostRuntime } from '../runtime/host-runtime.js';
import { createBuiltinCapabilities } from '../runtime/capabilities/system-info.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import {
  createHostAssembly,
  type HostAssembly,
  type HostRuntimeContext,
  type PalHostContext,
} from './runtime-provider.js';

/** 生产运行时装配选项（在 `runtime/host-runtime.ts` 的 `HostRuntimeOptions` 之上的组合根视图）。 */
export interface ProductionRuntimeOptions {
  /**
   * 外部能力提供方清单：每个提供方产出一组 {@link IHostCapabilityDescriptor}。
   *
   * @remarks 文档能力（`document:open|read|write|save`）由文档侧装配为 provider 传入；本模块不实现其业务逻辑。
   */
  readonly capabilityProviders?: readonly (readonly IHostCapabilityDescriptor[])[];
  /** 会话授权来源；缺省为平台会话全量授权（见 `host-runtime.ts`）。 */
  readonly sessionProvisioner?: IHostSessionProvisioner;
  /** 注册表注入项。 */
  readonly registryOptions?: IHostCapabilityRegistryOptions;
  /** 诊断口。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 生产装配完整选项：运行时选项 + PAL 宿主工厂。 */
export interface ProductionAssemblyOptions extends ProductionRuntimeOptions {
  /** PAL 宿主工厂（平台差异）；与 {@link HostAssembly.createPalHost} 同签名。 */
  readonly createPalHost: (electronModule: unknown, context: PalHostContext) => IPalHost;
}

/**
 * 构造生产能力清单：内置 + 外部提供方。
 *
 * @param palHost 已通过壳自检的 PAL 宿主。
 * @param providers 外部能力提供方清单。
 */
export function buildProductionManifest(
  palHost: IPalHost,
  providers: readonly (readonly IHostCapabilityDescriptor[])[] = [],
): IHostCapabilityDescriptor[] {
  const external: IHostCapabilityDescriptor[] = [];
  for (const provider of providers) {
    external.push(...provider);
  }
  return [...createBuiltinCapabilities(palHost), ...external];
}

/**
 * 装配生产运行时（真实清单 + 会话 / 权限 / 资源接线）。
 *
 * @param context 组合根上下文（PAL 宿主、平台根、用户数据目录）。
 * @param options 运行时装配选项。
 */
export function createProductionRuntime(
  context: HostRuntimeContext,
  options: ProductionRuntimeOptions = {},
): IHostRuntime {
  const capabilities = buildProductionManifest(context.palHost, options.capabilityProviders);
  return createHostRuntime({
    capabilities,
    platformRoot: context.platformRoot,
    ...(options.sessionProvisioner === undefined ? {} : { sessionProvisioner: options.sessionProvisioner }),
    ...(options.registryOptions === undefined ? {} : { registryOptions: options.registryOptions }),
    ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
  });
}

/**
 * 构造生产装配（{@link HostAssembly}）。
 *
 * @param options 装配选项（含 PAL 宿主工厂与外部能力提供方）。
 */
export function createProductionAssembly(options: ProductionAssemblyOptions): HostAssembly<IHostRuntime> {
  const { createPalHost, capabilityProviders, sessionProvisioner, registryOptions, diagnostics } = options;
  return createHostAssembly({
    createPalHost,
    createRuntime: (context) =>
      createProductionRuntime(context, {
        ...(capabilityProviders === undefined ? {} : { capabilityProviders }),
        ...(sessionProvisioner === undefined ? {} : { sessionProvisioner }),
        ...(registryOptions === undefined ? {} : { registryOptions }),
        ...(diagnostics === undefined ? {} : { diagnostics }),
      }),
  });
}
