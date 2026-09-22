/**
 * 组合根文档能力装载段（`production-assembly.ts` 的文档侧本体，金链路刀4）。
 *
 * 权威：`11-文档服务设计` §二（宿主能力层职责边界与端口注入）、`03-核心接口规范` §6.4
 * （chips-parser Neon 导出面）、`04-能力契约规范` §6.2/§7.3（`document:*` 契约）、
 * `02-Bridge三层设计` §2.1（组合根装配职责）。
 *
 * @remarks
 * - 装载闸（fail-closed，逐项审计，与 `pluginActivationPortFor` 诚实回退臂同型）：
 *   五个端口的生产载体全部可得时，才经 `createDocumentCapabilityDescriptors` 产出
 *   `document:*` 注册单元——
 *   - `parser`：`chips-native.node` 经 `loadNativeDocumentParserBinding`（17 必备名
 *     fail-closed 闸）装载可用，`createNativeDocumentParserPort` 构造生产适配器；
 *   - `events`：宿主事件总线（`host-event-bus.ts`，载体为组合根运行时 `emitEvent` 出口，
 *     绑定发生在 `pluginLoaderFactory` 构造期，先于注册与调用）；
 *   - `guard`：Bridge 会话注册表判定面（`bridge-session-guard.ts`），快照视图提供者
 *     由调用方经 {@link IDocumentCapabilityWiringOptions.guardSessionSource} 注入；
 *   - `scope` / `storage`：文档载体为资源管理器（chips-resource，W3 波次；
 *     `04-资源管理设计` §5.2 作用域注册与受控提交路径）。crate 未建、正式适配器
 *     缺位已登记工单 036——**禁止内存替身**，唯一合法通道是经
 *     {@link IDocumentCapabilityWiringOptions.resourcePorts} 注入资源管理器侧交付的
 *     正式适配器。
 * - 任一硬依赖不可得即整体不装载：产出 `unavailable` + 逐项缺位原因，组合根据此
 *   **不注册** `document:*`（调用得到真实的注册表未命中错误 `BRIDGE_CAPABILITY_NOT_FOUND`，
 *   预留槽位诊断面维持 `wired=false`），诊断留痕后诚实回退，不造假适配器、不部分装配。
 */

import type { DiagnosticsSink } from '../../../shared/diagnostics.js';
import { windowIdOfSessionId } from '../../../runtime/host-runtime.js';
import type { IHostCapabilityDescriptor } from '../../../runtime/capability/contracts.js';
import type { IDocumentViewChannelEndpoint } from '../../../runtime/contracts.js';
import { createDocumentService } from '../service.js';
import type { IDocumentService } from '../service.js';
import { createDocumentCapabilityDescriptors } from '../descriptors.js';
import type { IDocumentScopePort, IDocumentStoragePort } from '../ports.js';
import { createNativeDocumentParserPort } from './native-parser.js';
import {
  defaultNativeDocumentParserModulePath,
  loadNativeDocumentParserBinding,
  type INativeDocumentParserBinding,
} from './native-parser-module.js';
import { createDocumentBridgeSessionGuardPort, type DocumentGuardSessionSource } from './bridge-session-guard.js';
import { createDocumentHostEventBusPort, type HostEventBusPublisher } from './host-event-bus.js';
import { createDocumentViewChannelHandler, createUnavailableDocumentViewChannelEndpoint } from './view-channel.js';

/** 资源管理器侧端口的正式适配器注入面（scope + 受控写；载体 = W3 chips-resource，工单 036）。 */
export interface IDocumentResourcePorts {
  /** 资源作用域端口（受管引用归一与作用域注册，`04-资源管理设计` §5.2）。 */
  readonly scope: IDocumentScopePort;
  /** 受控写端口（受控提交路径与 WriteCoordinator，`11-文档服务设计` §5.2、§5.3）。 */
  readonly storage: IDocumentStoragePort;
}

/** 组合根文档能力装载段的注入选项。 */
export interface IDocumentCapabilityWiringOptions {
  /**
   * `chips-native.node` 解析域产物路径；缺省按上下文 `platformRoot` 经
   * {@link defaultNativeDocumentParserModulePath} 推导生产落位（与 Bridge 域同一模块文件）。
   */
  readonly parserModulePath?: string;
  /**
   * Bridge 会话注册表快照视图提供者（守卫端口判定输入源）。
   *
   * @remarks 生产注册与调用权威暂留壳侧（`runtime/host-runtime.ts` 头注）；组合根把
   * 运行时会话注册表的快照查询面接入本注入位，内核会话表接管后同源切换（开发日志
   * 刀4 缝位）。缺位即守卫不可得，装载段整体回退。
   */
  readonly guardSessionSource?: DocumentGuardSessionSource;
  /** 资源管理器侧端口正式适配器（W3 chips-resource 交付前缺位，装载段整体回退，工单 036）。 */
  readonly resourcePorts?: IDocumentResourcePorts;
}

/** 装载闸的一项缺位记录（诚实呈现，不静默降级）。 */
export interface IDocumentWiringMissingPort {
  /** 缺位的端口标识。 */
  readonly port: 'parser' | 'guard' | 'scope' | 'storage';
  /** 简体中文缺位原因（含出处）。 */
  readonly reason: string;
}

/** 装载段产出的句柄：注册单元 + 事件总线绑定入口 + 闸判据留痕。 */
export interface IDocumentCapabilityWiring {
  /**
   * 装载判定：硬依赖载体（parser / guard / scope / storage）全部可得为 `wired`，
   * 任一缺位为 `unavailable`（events 由组合根装配期绑定宿主事件总线，随装载必然可得）。
   */
  readonly status: 'wired' | 'unavailable';
  /** `document:*` 四条注册单元（`unavailable` 时为空数组——不注册、真实未命中语义）。 */
  readonly descriptors: readonly IHostCapabilityDescriptor[];
  /** 缺位逐项记录（`wired` 时为空数组；组合根诊断面与测试断言输入）。 */
  readonly missing: readonly IDocumentWiringMissingPort[];
  /**
   * 绑定宿主事件总线出口（组合根在 `pluginLoaderFactory` 构造时调用）。
   *
   * @remarks `unavailable` 时为 no-op（无服务实例消费总线）。
   */
  bindEventBus(publisher: HostEventBusPublisher): void;
  /**
   * 宿主内部取视图通道端点（刀5 段A / 工单035 裁定 C+B）：`wired` 臂为真实构建链
   * （请求闸 → 主进程构建器 → 会话解析 → 守门回包），`unavailable` 臂为诚实拒绝臂
   * （在册码 `BRIDGE_INTERNAL` 失败回包，不静默）——两臂恒在，通道注册不依赖装载判定。
   */
  readonly viewChannel: IDocumentViewChannelEndpoint;
  /**
   * 文档服务实例（`wired` 臂交付；组合根据此接线 Bridge 会话释放联动，刀4 缝②）。
   * `unavailable` 时缺位（无服务实例可释放）。
   */
  readonly service?: IDocumentService;
}

/** 装载段诊断域标识（组合根留痕口径）。 */
export const DOCUMENT_WIRING_DIAGNOSTIC_SCOPE = 'document-capability';

/**
 * 执行文档能力装载闸并（在依赖齐备时）装配生产服务。
 *
 * @param options 装载注入选项（缺省即真实生产环境：无注入 → 硬依赖缺位 → 回退）。
 * @param context 组合根上下文（取 `platformRoot` 推导解析域产物落位）。
 * @param diagnostics 宿主诊断口（缺位逐项留痕）。
 */
export function createDocumentCapabilityWiring(
  options: IDocumentCapabilityWiringOptions | undefined,
  context: { readonly platformRoot: string },
  diagnostics: DiagnosticsSink,
): IDocumentCapabilityWiring {
  const modulePath = options?.parserModulePath ?? defaultNativeDocumentParserModulePath(context.platformRoot);
  const parserBinding: INativeDocumentParserBinding = loadNativeDocumentParserBinding(modulePath);
  const guardSessionSource: DocumentGuardSessionSource | undefined = options?.guardSessionSource;
  const resourcePorts: IDocumentResourcePorts | undefined = options?.resourcePorts;

  const missing: IDocumentWiringMissingPort[] = [];
  if (parserBinding.status === 'unavailable') {
    missing.push({ port: 'parser', reason: `${parserBinding.reason}（${parserBinding.detail}）` });
  }
  if (guardSessionSource === undefined) {
    missing.push({
      port: 'guard',
      reason:
        'Bridge 会话注册表快照视图提供者未注入：壳侧运行时暂不对外暴露会话权限快照查询面，' +
        '内核会话表接管（§5.5–§5.7）后由组合根接入正式快照提供者（见开发日志刀4 缝位）；不做本地替身',
    });
  }
  if (resourcePorts === undefined) {
    missing.push({
      port: 'scope',
      reason: '资源作用域端口的文档载体为资源管理器（W3 chips-resource，未建，工单 036）；禁止内存替身',
    });
    missing.push({
      port: 'storage',
      reason:
        '受控写端口的文档载体为资源管理器受控提交路径与 WriteCoordinator（W3 chips-resource，未建，工单 036）；禁止内存替身',
    });
  }

  // 后三个析取项与缺位清单判据等价（任一命中则 `missing` 必非空），仅承担编译期收窄，
  // 保证装载分支拿到的全部是已判据的类型化输入——不存在任何缺位形态能进入下方装配。
  if (
    missing.length > 0 ||
    parserBinding.status !== 'available' ||
    guardSessionSource === undefined ||
    resourcePorts === undefined
  ) {
    if (missing.length > 0) {
      diagnostics.warn(
        DOCUMENT_WIRING_DIAGNOSTIC_SCOPE,
        'document:* 未装载：硬依赖缺位，维持真实注册表未命中语义（诚实回退臂）',
        { missing, modulePath },
      );
    }
    return {
      status: 'unavailable',
      descriptors: [],
      missing,
      viewChannel: createUnavailableDocumentViewChannelEndpoint(),
      bindEventBus(): void {
        // 未装载：无服务实例，总线无绑定对象。
      },
    };
  }

  // 依赖齐备：构造生产端口与真实服务，交组合根注册四条 `document:*`。
  const eventBus = createDocumentHostEventBusPort();
  const parserPort = createNativeDocumentParserPort(parserBinding.parser);
  const service = createDocumentService({
    scope: resourcePorts.scope,
    storage: resourcePorts.storage,
    parser: parserPort,
    events: eventBus.port,
    guard: createDocumentBridgeSessionGuardPort(guardSessionSource),
    // G2 归属臂（工单043-A4）：会话→归属窗口解析接壳侧会话标识词法唯一权威
    // （`runtime/host-runtime.ts` `windowIdOfSessionId`，与注册表 `IHostSession.windowId`
    // 同源；载体会话与词法外标识解析为 `null` 即无窗口可归属）——公共契约形状不动。
    sessionWindowOf: windowIdOfSessionId,
    diagnostics,
  });

  return {
    status: 'wired',
    descriptors: createDocumentCapabilityDescriptors(service),
    missing: [],
    // 刀5 段A（缝③收口）：视图通道端点与四能力共用同一服务实例、同一原生装载闸产物——
    // 构建执行位主进程，句柄与数值会话经 `view-channel.ts` 归一单点消费。
    viewChannel: createDocumentViewChannelHandler({ service, native: parserPort.view }),
    service,
    bindEventBus(publisher: HostEventBusPublisher): void {
      eventBus.bind(publisher);
    },
  };
}
