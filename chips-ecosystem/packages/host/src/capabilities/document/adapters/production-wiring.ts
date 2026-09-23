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
 *     fail-closed 闸，解析域面波 A1 未动、维持 17）装载可用，`createNativeDocumentParserPort`
 *     构造生产适配器；
 *   - `events`：宿主事件总线（`host-event-bus.ts`，载体为组合根运行时 `emitEvent` 出口，
 *     绑定发生在 `pluginLoaderFactory` 构造期，先于注册与调用）；
 *   - `guard`：Bridge 会话注册表判定面（`bridge-session-guard.ts`），快照视图提供者由
 *     组合根**正式默认绑定**到运行时 `sessionPermissionSnapshots()`（08 §7.6 快照本体，
 *     工单 036 §五.3-1 / 刀4 缝①收口）；{@link IDocumentCapabilityWiringOptions.guardSessionSource}
 *     升格为显式覆盖口（真进程 E2E 替身臂与测试注入）；
 *   - `scope`：文档载体为资源管理器（chips-resource；`04-资源管理设计` §5.2 作用域注册）。
 *     crate 与 §11.3 Neon 暴露面（20 导出逐字，波 A1 任务 #209 补登挂载 / 作用域注册三名、
 *     波 B 任务 #231 补登 `managedUri ↔ localPath` 双向换算两名）
 *     已承载作用域注册 / 挂载入口，**正式 scope 适配器已在册**（波 A2b-α
 *     `adapters/scope-adapter.ts`，波 A2b-β 任务 #219 在本装载段接线：`resourceBinding`
 *     可用即以类型化消费面构造，40-hex 派生 + 两拍注销 + `DOCUMENT_SCOPE_OWNER` 注入齐备）；
 *     {@link IDocumentCapabilityWiringOptions.resourcePorts} 的 `scope` 位降为显式覆盖口
 *     （真进程 E2E 替身臂与测试注入，同 `guardSessionSource` 口径）。
 *   - `storage`：跨成员原子提交与落盘序列化载体**仍未在册**（点位四后续波，工单 036），
 *     正式适配器无原生载体可依赖 ⇒ 本装载段唯一缺位项——
 *     **禁止内存替身**，唯一合法通道是经
 *     {@link IDocumentCapabilityWiringOptions.resourcePorts} 注入资源管理器侧交付的
 *     正式适配器（组合根的资源域装载闸见 `native-resource-module.ts`）。
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
import { loadNativeResourceBinding, type INativeResourceBinding } from './native-resource-module.js';
import { createDocumentScopeAdapter } from './scope-adapter.js';
import { createDocumentBridgeSessionGuardPort, type DocumentGuardSessionSource } from './bridge-session-guard.js';
import { createDocumentHostEventBusPort, type HostEventBusPublisher } from './host-event-bus.js';
import { createDocumentViewChannelHandler, createUnavailableDocumentViewChannelEndpoint } from './view-channel.js';

/**
 * 资源管理器侧端口的显式注入面（scope 覆盖口 + 受控写唯一合法交付通道）。
 *
 * @remarks 波 A2b-β（任务 #219）装载开闸后本注入面的性质分工：
 * `scope` 位是**显式覆盖口**（真进程 E2E 替身臂与测试注入；生产缺省路径由本装载段以
 * 资源域类型化消费面构造正式适配器，见文件头注），`storage` 位仍是受控写端口的唯一
 * 合法交付通道（点位四载体未落位，生产侧必然缺位 ⇒ 整体不装载，工单 036）。
 */
export interface IDocumentResourcePorts {
  /** 资源作用域端口（受管引用归一与作用域注册，`04-资源管理设计` §5.2）——显式覆盖口。 */
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
   * 资源域（§11.3 二十导出）装载判据的产物路径；缺省沿用 {@link parserModulePath}
   * （解析域 / 资源域 / Bridge 域同一 `chips-native.node` 文件、单一内核，§11.5，
   * Node 模块缓存保证进程级单例）。
   *
   * @remarks 本注入位只承载**判据留痕与类型化消费面交付**（见
   * {@link IDocumentCapabilityWiring.resourceBinding} 与 scope/storage 缺位原因内嵌的
   * 实态判据），不是装载闸的第六项硬依赖：调用方自备 `resourcePorts` 正式适配器（真进程
   * E2E 替身臂）时，原生资源导出面缺位不参与 `document:*` 装载判定——否则会把「端口注入面」
   * 与「原生导出面」两条独立通道焊死，令 E2E 通道无法成立（在册判例：刀4a 装载闸五项端口
   * 口径）。资源域导出面的类型化消费面与闸见 `native-resource-module.ts`；导出面落位后
   * 本判据随波机械翻正（消费名清单补登即闸收紧，波 A2a 任务 #212 三名补登在册），
   * 判定分支结构不动。
   */
  readonly resourceModulePath?: string;
  /**
   * Bridge 会话注册表快照视图提供者（守卫端口判定输入源）。
   *
   * @remarks
   * 生产接线由组合根默认绑定完成（工单 036 §五.3-1 / 开发日志刀4 缝①收口）：
   * `main/production-assembly.ts` 把运行时 `sessionPermissionSnapshots()`（08 §7.6 快照本体，
   * 含完整权限集与终态会话）注入本位——判定每调用触达登记表实态、不缓存（11 §9.1），
   * 判定本体与路由管线共用 `evaluateHostPermissions` 单点实现（08 §7.2），不新建第二会话表。
   * 本注入位因此升格为**显式覆盖口**：真进程 E2E 替身臂（`main/e2e-app.ts` 在册枚举实现）与
   * 测试注入仍可覆盖（S6 口径）。绕过组合根直接调用装载段且未注入即守卫缺位，整体回退。
   */
  readonly guardSessionSource?: DocumentGuardSessionSource;
  /**
   * 资源侧端口显式注入（性质分工见 {@link IDocumentResourcePorts} 头注）：`scope` 为覆盖口
   * （缺省时由装载段构造正式适配器，波 A2b-β），`storage` 为受控写端口唯一合法交付通道
   * （点位四载体未落位 ⇒ 生产侧缺位、装载段整体回退，工单 036）。
   */
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
  /**
   * 资源域（§11.3 二十导出）装载判据与类型化消费面（任务 #194 交付③的宿主侧合缝位）。
   *
   * @remarks 两臂恒在：`available` 交付 `INativeResourceModule` 消费面（现态部署产物
   * 55 导出、资源域 20 名在册，波 A1 任务 #209 落位、波 A2a 任务 #212 清单补登、波 B
   * 任务 #231 两换算名补登后过闸）；
   * `unavailable` 逐项点名缺位导出（产物缺位 / 旧构建漂移 / ABI 漂移形态）。本字段是端口
   * 注入面之外的独立判据留痕，资源域波次落位即随波机械翻正；文档端口正式适配器的接线条件
   * 与剩余未落载体（跨成员原子提交 / 落盘序列化，点位四后续波）见
   * `native-resource-module.ts` 头注与工单 036——scope 正式适配器随本字段 `available` 臂在装载段
   * 构造（波 A2b-β 接线），storage 适配器仍无原生载体，装载段维持 fail-closed。
   */
  readonly resourceBinding: INativeResourceBinding;
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
  // 资源域（§11.3）装载判据：与解析域同一 `chips-native.node`（单一内核，§11.5），
  // 交付类型化消费面与实态留痕；不作装载闸第六项硬依赖（判据理由见选项头注）。
  const resourceBinding: INativeResourceBinding = loadNativeResourceBinding(options?.resourceModulePath ?? modulePath);
  const resourceSurfaceVerdict =
    resourceBinding.status === 'available'
      ? `available（coreVersion ${resourceBinding.coreVersion}，ABI ${String(resourceBinding.abiVersion)}）`
      : `${resourceBinding.reason}`;
  const guardSessionSource: DocumentGuardSessionSource | undefined = options?.guardSessionSource;
  const resourcePorts: IDocumentResourcePorts | undefined = options?.resourcePorts;

  // scope 端口两位来源（波 A2b-β 装载开闸）：显式覆盖口（真进程 E2E 替身臂 / 测试注入）优先，
  // 缺位时以已过闸的资源域类型化消费面构造**正式适配器**（`adapters/scope-adapter.ts`，
  // 40-hex 派生 + `DOCUMENT_SCOPE_OWNER` + 两拍注销）。资源域消费面未落位即无正式载体，
  // 如实缺位——禁止任何内存替身顶上（工单 036 红线）。
  const formalScopePort: IDocumentScopePort | undefined =
    resourceBinding.status === 'available'
      ? createDocumentScopeAdapter({ native: resourceBinding.resource, diagnostics })
      : undefined;
  const scopePort: IDocumentScopePort | undefined = resourcePorts?.scope ?? formalScopePort;
  // storage 端口：跨成员原子提交与落盘序列化载体（点位四）尚无原生导出面可依赖，
  // 正式适配器无载体可构造 ⇒ 唯一合法来源仍是显式注入（真进程 E2E 替身臂 / 测试注入）。
  const storagePort: IDocumentStoragePort | undefined = resourcePorts?.storage;

  const missing: IDocumentWiringMissingPort[] = [];
  if (parserBinding.status === 'unavailable') {
    missing.push({ port: 'parser', reason: `${parserBinding.reason}（${parserBinding.detail}）` });
  }
  if (guardSessionSource === undefined) {
    missing.push({
      port: 'guard',
      reason:
        'Bridge 会话注册表快照视图提供者未注入：生产组合根已把运行时 `sessionPermissionSnapshots`' +
        '（08 §7.6 快照本体，工单 036 §五.3-1 / 刀4 缝①收口）作为正式默认绑定注入本注入位，' +
        '本臂仅在调用方绕过组合根直接装载且未注入时命中；不做本地替身',
    });
  }
  if (scopePort === undefined) {
    missing.push({
      port: 'scope',
      reason:
        '资源作用域端口的文档载体为资源管理器（chips-resource，工单 036）：正式适配器已在册' +
        '（波 A2b-α `adapters/scope-adapter.ts`，波 A2b-β 装载段接线），构造前提是 §11.3 资源域' +
        '类型化消费面过装载闸（resourceMountDirectory / resourceMountArchive / ' +
        'resourceUnregisterScope 三名在册，波 A1 任务 #209）；本臂仅在资源域导出面未落位' +
        `且无显式注入时命中，禁止内存替身（原生侧资源域实态判据：${resourceSurfaceVerdict}）`,
    });
  }
  if (storagePort === undefined) {
    missing.push({
      port: 'storage',
      reason:
        '受控写端口的文档载体为资源管理器受控提交路径与 WriteCoordinator（chips-resource，工单 036）：' +
        'Rust 侧已交付，§11.3 Neon 暴露面尚无跨成员原子提交与落盘序列化载体（刀6 裁决、点位四后续波），' +
        `正式适配器随该载体落地；禁止内存替身（原生侧资源域实态判据：${resourceSurfaceVerdict}）`,
    });
  }

  // 后四个析取项与缺位清单判据等价（任一命中则 `missing` 必非空），仅承担编译期收窄，
  // 保证装载分支拿到的全部是已判据的类型化输入——不存在任何缺位形态能进入下方装配。
  if (
    missing.length > 0 ||
    parserBinding.status !== 'available' ||
    guardSessionSource === undefined ||
    scopePort === undefined ||
    storagePort === undefined
  ) {
    if (missing.length > 0) {
      diagnostics.warn(
        DOCUMENT_WIRING_DIAGNOSTIC_SCOPE,
        'document:* 未装载：硬依赖缺位，维持真实注册表未命中语义（诚实回退臂）',
        {
          missing,
          modulePath,
          // 资源域（§11.3）实态判据随留痕透出：真进程取证时一行之内即可区分
          // 「端口未注入」与「原生导出面未落位」两条独立成因（同一条 warn，不新增行）。
          resourceSurface:
            resourceBinding.status === 'available'
              ? 'available'
              : `${resourceBinding.reason}（${resourceBinding.detail}）`,
        },
      );
    }
    return {
      status: 'unavailable',
      descriptors: [],
      missing,
      resourceBinding,
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
    scope: scopePort,
    storage: storagePort,
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
    resourceBinding,
    // 刀5 段A（缝③收口）：视图通道端点与四能力共用同一服务实例、同一原生装载闸产物——
    // 构建执行位主进程，句柄与数值会话经 `view-channel.ts` 归一单点消费。
    viewChannel: createDocumentViewChannelHandler({ service, native: parserPort.view }),
    service,
    bindEventBus(publisher: HostEventBusPublisher): void {
      eventBus.bind(publisher);
    },
  };
}
