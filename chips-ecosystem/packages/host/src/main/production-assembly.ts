/**
 * 生产组合根装配：`HostAssembly.createRuntime` → 真实运行时（P0-1 交付点 1、2）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动顺序：内核 → 解析器 / 资源管理器 → Bridge 能力注册）、
 * `02-Bridge三层设计` §4（能力注册与默认值）、§2.1（组合根装配职责）。
 *
 * @remarks
 * - `createRuntime` 按**显式能力清单**注册单元：内置能力（`system:info`）+ 注入的外部提供方
 *   （`capabilityProviders` 槽）+ 文档能力装载段（金链路刀4）产出的 `document:*` 描述符，
 *   替代旧空壳的统一 `BRIDGE_CAPABILITY_NOT_FOUND`。
 * - 外部提供方的接线契约是 {@link IHostCapabilityDescriptor}：一条描述 = 一个可注册单元
 *   （ID + 所需权限 + handler + 超时/并发）。注册冲突或权限校验失败即在 `start` 抛出、壳终止启动。
 * - 文档能力装载段（`capabilities/document/adapters/production-wiring.ts`）：解析域产物过
 *   17 必备名装载闸（解析域面波 A1 未动、维持 17）、资源管理器端口（chips-resource 注入面；
 *   Rust 侧能力面与 §11.3 挂载 / 作用域注册载体已落位在册（波 A1 任务 #209），正式适配器
 *   归波 A2b 接线——未接线期缺位，工单 036）可得时，经 `createDocumentCapabilityDescriptors`
 *   注册真实 `document:*` 四能力并绑定宿主事件总线；守卫快照提供者由组合根正式默认绑定
 *   （运行时 `sessionPermissionSnapshots()`，工单 036 §五.3-1 / 刀4 缝①收口，注入位保留为
 *   显式覆盖口）；任一硬依赖缺位即整体不装载（诊断留痕，调用维持真实
 *   注册表未命中语义——诚实降级不造假适配器）。
 * - CPK 装载器（阶段六接线）：`createRuntime` 时打开插件注册表（`<userData>/chips-plugins/registry.json`），
 *   经 `pluginLoaderFactory` 注入宿主运行时——`pluginsRoot = <userData>/chips-plugins`、内嵌编译期
 *   信任根（当前正式密钥材料缺位，工单 028，失效关闭）、`hostVersion` 取 PAL 宿主快照的
 *   `appVersion`；激活端口（工单 025 波 3 起默认接线）：缺省以波 2 正式激活通道
 *   `createHostPluginActivationChannel({ pluginRegistry, trustRoots, sessionRoot })` 直连
 *   `deps.activationPortFor`，`enable` 路径即通（通道恒返回端口，无「未注入」回退臂；
 *   `pluginActivationPortFor` 注入位保留为显式覆盖口，S6）。原生绑定仍在 `createRuntime`
 *   装载并校验（`native-bridge.ts` 消费链）；内核提供方 Bridge 权威移交未落地前维持
 *   壳侧回退诊断留痕（工单 025 剩余项①）。
 * - PAL 宿主构造由调用方注入（平台差异），本模块只负责运行时装配，保持与自检入口零逻辑分叉。
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { bindNativeDecisionSink, createPermissionDecisionIntake } from '../audit/decision-intake.js';
import type { IPalHost } from '../platform/contracts/index.js';
import type { CardWindowDocumentBindingResolver, IDocumentViewChannelEndpoint } from '../runtime/contracts.js';
import type { IHostCapabilityDescriptor } from '../runtime/capability/contracts.js';
import type { IHostCapabilityRegistryOptions } from '../runtime/capability/registry.js';
import type { IHostSessionProvisioner } from '../runtime/capability/session.js';
import type { DocumentGuardSessionSource } from '../capabilities/document/adapters/bridge-session-guard.js';
import {
  createDocumentCapabilityWiring,
  type IDocumentCapabilityWiringOptions,
} from '../capabilities/document/adapters/production-wiring.js';
import {
  createCpkPluginLoader,
  createEmbeddedTrustRootRegistry,
  openPluginRegistry,
  type IPluginActivationPort,
  type IPluginRegistry,
  type PluginRole,
} from '../loader/index.js';
import {
  createHostRuntime,
  type IHostPluginLoaderDeps,
  type IHostRuntime,
  type IPluginLoaderSurface,
} from '../runtime/host-runtime.js';
import { createBuiltinCapabilities } from '../runtime/capabilities/system-info.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import { defaultNativeBridgeModulePath, loadNativeBridgeBinding } from './native-bridge.js';
import { createHostPluginActivationChannel } from './plugin-activation.js';
import {
  createHostAssembly,
  type HostAssembly,
  type HostRuntimeContext,
  type PalHostContext,
} from './runtime-provider.js';

/** 插件激活端口供给签名（内核 §6.1 `PluginRunner` 通道；工单 025 正式注入位）。 */
export type PluginActivationPortFor = (plugin: {
  readonly id: string;
  readonly version: string;
  readonly role: PluginRole;
  readonly path: string;
}) => IPluginActivationPort | undefined;

/**
 * resource 域素材 `traceId` 腿的宿主侧固定来源哨兵（工单046 段四接线波，任务 #206 自裁）。
 *
 * @remarks 取值口径（RFC-权限审计跨层采集sink裁定 §5.3 `traceId` 行：「resource 域 crate
 * 无 → 宿主以段一横切 `InvocationContext.traceId` 贯通链补」）：native 观察帧经 Neon
 * `Channel` 回投 JS 线程事件循环，回调现场**没有**同步的请求上下文可回读段一横切键；
 * 逐帧自生成随机键即「另造关联键」（§5.3 原文与立项书段一口径禁止）。故采最小诚实形：
 * 固定来源哨兵——不伪装任何一侧的关联键、如实标注「宿主观察面直投」，`validateAuditEntry`
 * 必填非空约束满足，条目可比照既有 `source` 字段「运行时记录缺省不造值」的口径审计定位
 * （所有 resource 域条目共键，检索/关联价值由后续资源域横切贯通波经 `resolveTraceId`
 * 端口原位升级，组装面零改动）。
 */
export const AUDIT_RESOURCE_DOMAIN_TRACE_SOURCE = 'native-audit:resource-domain';

/** 生产运行时装配选项（在 `runtime/host-runtime.ts` 的 `HostRuntimeOptions` 之上的组合根视图）。 */
export interface ProductionRuntimeOptions {
  /**
   * 外部能力提供方清单：每个提供方产出一组 {@link IHostCapabilityDescriptor}。
   *
   * @remarks 文档能力（`document:open|read|write|save`）自金链路刀4 起由组合根装载段
   * 按依赖判据注册（{@link ProductionAssemblyOptions.documentWiring}），不再经本槽外部传入；
   * 本槽位保留给其余外部提供方，本模块不实现其业务逻辑。
   */
  readonly capabilityProviders?: readonly (readonly IHostCapabilityDescriptor[])[];
  /** 会话授权来源；缺省为平台会话全量授权（见 `host-runtime.ts`）。 */
  readonly sessionProvisioner?: IHostSessionProvisioner;
  /** 注册表注入项。 */
  readonly registryOptions?: IHostCapabilityRegistryOptions;
  /**
   * CPK 插件装载器工厂；缺省由 {@link createProductionAssembly} 按生产口径注入
   * （`<userData>/chips-plugins` + 内嵌编译期信任根）。仅当调用方绕过组合根直接调
   * {@link createProductionRuntime} 时才需自行供给。
   */
  readonly pluginLoaderFactory?: (deps: IHostPluginLoaderDeps) => IPluginLoaderSurface;
  /**
   * 激活端口显式覆盖注入位（工单 025 波 3；S6 口径）：缺省由组合根以波 2 正式
   * 激活通道直连（`enable` 即通）；仅供调用方自备通道或测试注入时覆盖。
   */
  readonly pluginActivationPortFor?: PluginActivationPortFor;
  /**
   * 宿主内部取视图通道端点（刀5 段A）：由组合根文档装载段两臂恒在地交付
   * （`wired` = 真实构建臂；`unavailable` = 诚实拒绝臂），透传给宿主运行时供壳
   * `ipc` 段注册 `document-view:request`。缺位即通道整体不可用。
   */
  readonly documentViewChannel?: IDocumentViewChannelEndpoint;
  /**
   * 卡片窗口装载投递的文档绑定解析端口（刀7 接线波，任务 #120）：由组合根文档装载段以
   * `document:open` 回包同源的 `IDocumentService.resolveWindowDocument` 交付，透传给宿主运行时
   * 供壳 `ipc` 段构造 `card-window-init:request` 投递处理函数。装载段诚实回退（`document:*`
   * 未注册）时缺位——投递臂按在册码 `DOCUMENT_NOT_OPEN` 如实拒收。
   */
  readonly cardWindowDocumentBinding?: CardWindowDocumentBindingResolver;
  /**
   * Bridge 会话关闭联动（刀4 缝②）：透传给宿主运行时，在会话订阅/句柄清理完成后
   * 通知文档服务释放该会话的文档会话与记录（§4.6）；可返回 Promise 交运行时登记在途释放，
   * 停机收口前逐条等待（工单036 波 A2b-β 两拍注销的退出清理）。
   */
  readonly onBridgeSessionClosed?: (sessionId: string) => void | Promise<void>;
  /**
   * `chips-native.node` 原生绑定产物路径；缺省按上下文 `platformRoot` 经
   * {@link defaultNativeBridgeModulePath} 推导生产落位（工单 025 消费链装载点）。
   */
  readonly nativeBridgeModulePath?: string;
  /** 诊断口。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 生产装配完整选项：运行时选项 + PAL 宿主工厂 + 文档能力装载注入面。 */
export interface ProductionAssemblyOptions extends ProductionRuntimeOptions {
  /** PAL 宿主工厂（平台差异）；与 {@link HostAssembly.createPalHost} 同签名。 */
  readonly createPalHost: (electronModule: unknown, context: PalHostContext) => IPalHost;
  /**
   * 文档能力装载段注入项（金链路刀4）：解析域产物落位、Bridge 会话快照视图提供者
   * （显式覆盖口，缺省由组合根正式默认绑定运行时快照面）与资源管理器侧端口正式适配器
   * （chips-resource 交付面）。
   *
   * @remarks 缺省即真实生产环境判据——资源管理器端口的 §11.3 Neon 载体未落位而缺位，
   * 装载段诚实回退、`document:*` 不注册（工单 036）；注入项齐备且解析域产物过闸时，
   * 组合根经 `createDocumentCapabilityDescriptors` 注册真实四能力。
   */
  readonly documentWiring?: IDocumentCapabilityWiringOptions;
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
    ...(options.pluginLoaderFactory === undefined ? {} : { pluginLoaderFactory: options.pluginLoaderFactory }),
    ...(options.documentViewChannel === undefined ? {} : { documentViewChannel: options.documentViewChannel }),
    ...(options.cardWindowDocumentBinding === undefined
      ? {}
      : { cardWindowDocumentBinding: options.cardWindowDocumentBinding }),
    ...(options.onBridgeSessionClosed === undefined ? {} : { onBridgeSessionClosed: options.onBridgeSessionClosed }),
    ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
    // 生产装配恒开承载面（《17》§2.6 的 socket 覆盖/离线条款属 CLI 侧消费面，波 2）。
    carrier: {
      userDataPath: context.userDataPath,
      hostVersion: context.palHost.info.appVersion,
    },
    // 生产装配恒开权限审计写入器（工单046 段二；《08.08》§8.3 落位
    // `<userData>/logs/audit/`，userData 根沿用组合根上下文既有注入形，不新造配置面；
    // 常开、不受 CHIPS_TRACE 门控；段四接线波起由下方审计绑定臂接入 native 素材流消费）。
    audit: {
      userDataPath: context.userDataPath,
    },
  });
}

/**
 * 准备生产装载器工厂（阶段六接线）：打开插件持久化注册表并闭合生产依赖。
 *
 * 波 3 裁定（工单 025）：缺省以波 2 正式激活通道直连 `deps.activationPortFor`——
 * `createHostPluginActivationChannel({ pluginRegistry, trustRoots, sessionRoot })`，
 * enable 通道即通（S10 能力/会话权威不动；通道恒返回端口，不新建回退臂）。
 * `pluginActivationPortFor` 注入位保留为显式覆盖口（S6：测试注入/调用方自备通道）。
 *
 * @param context 组合根上下文（取 `userDataPath` 与 PAL 宿主快照的 `appVersion`）。
 * @param activationPortFor 激活端口显式覆盖注入位（缺省走正式通道）。
 * @returns 工厂与注册表句柄：`loaderFactory` 交予宿主运行时 `pluginLoaderFactory`；
 *   `pluginRegistry` 供组合根审计接线臂读取插件版本（工单046 段四，RFC §5.3
 *   `pluginVersion`「宿主授权/会话权威侧补挂」的在册生产源，禁第二注册表实例）。
 * @throws 注册表文档非法时原样上抛（整表拒绝不静默降级；壳以 `HOST_STARTUP_FAILED` 终止启动）。
 */
async function createProductionPluginLoaderFactory(
  context: HostRuntimeContext,
  activationPortFor: PluginActivationPortFor | undefined,
): Promise<{
  loaderFactory: (deps: IHostPluginLoaderDeps) => IPluginLoaderSurface;
  pluginRegistry: IPluginRegistry;
}> {
  const pluginsRoot = join(context.userDataPath, 'chips-plugins');
  const pluginRegistry = await openPluginRegistry({ filePath: join(pluginsRoot, 'registry.json') });
  const trustRoots = createEmbeddedTrustRootRegistry();
  const hostVersion = context.palHost.info.appVersion;
  // 通道单例：会话表与自建装载器随通道存续，端口供给只转接不重建。
  const activationChannel = createHostPluginActivationChannel({
    pluginRegistry,
    trustRoots,
    // 会话目录落位随插件根（`.cpk-install-tmp` 同前例）；装载器会话惰性创建，
    // 构造期零启动副作用。
    sessionRoot: join(pluginsRoot, '.cpk-activation-sessions'),
  });
  const portFor: PluginActivationPortFor =
    activationPortFor ?? ((plugin) => activationChannel.activationPortFor(plugin));
  return {
    loaderFactory: (deps) =>
      createCpkPluginLoader({
        pluginsRoot,
        registry: pluginRegistry,
        hostCapabilityRegistry: deps.hostCapabilityRegistry,
        emitEvent: deps.emitEvent,
        hostVersion,
        trustRoots,
        activationPortFor: portFor,
      }),
    pluginRegistry,
  };
}

/**
 * 构造生产装配（{@link HostAssembly}）。
 *
 * @param options 装配选项（含 PAL 宿主工厂与外部能力提供方）。
 */
export function createProductionAssembly(options: ProductionAssemblyOptions): HostAssembly<IHostRuntime> {
  const {
    createPalHost,
    capabilityProviders,
    sessionProvisioner,
    registryOptions,
    pluginActivationPortFor,
    nativeBridgeModulePath,
    documentWiring,
    diagnostics,
  } = options;
  return createHostAssembly({
    createPalHost,
    createRuntime: async (context) => {
      // 工单 025 消费链装载点：校验并持有原生绑定（Node 模块缓存保证内核单例语义，
      // §5.4）；不可用时诊断留痕，Bridge 权威暂留壳侧路由（诚实回退臂，口径见
      // `native-bridge.ts` 头注与工单任务说明剩余项）。
      const bridgeDiagnostics = diagnostics ?? createStderrDiagnostics();
      const nativeBridge = loadNativeBridgeBinding(
        nativeBridgeModulePath ?? defaultNativeBridgeModulePath(context.platformRoot),
      );
      if (nativeBridge.status === 'unavailable') {
        bridgeDiagnostics.warn('native-bridge', '原生绑定不可用，Bridge 内核通道保持壳侧回退（工单 025 剩余项）', {
          reason: nativeBridge.reason,
          modulePath: nativeBridge.modulePath,
          detail: nativeBridge.detail,
        });
      }
      // 金链路刀4 文档能力装载段：解析域产物过装载闸、守卫快照视图提供者与资源管理器
      // 端口正式适配器全部可得时，经 `createDocumentCapabilityDescriptors` 注册真实
      // `document:*` 四能力；任一硬依赖缺位即整体不装载（诊断留痕 `document-capability`
      // 域，调用维持真实注册表未命中语义——诚实降级不造假适配器）。事件总线绑定发生在
      // 下方 `pluginLoaderFactory` 构造期（早于
      // `start` 注册与任何能力调用，见 `adapters/host-event-bus.ts` 头注）。
      //
      // 工单036 §五.3-1 收口（开发日志刀4 缝①）：守卫快照提供者**正式默认绑定**——
      // 组合根把本运行时的会话权限快照查询面（08 §7.6 快照本体，含完整权限集与终态会话）
      // 作为 `IDocumentGuardPort` 的会话来源注入装载段。判定每次调用触达会话登记表实态、
      // 不缓存（11 §9.1），判定本体单点复用 `evaluateHostPermissions`（08 §7.2 / 路由管线
      // 同一实现），不新建第二会话表、不引入第二套判定。运行时在装载段之后构造，故本绑定
      // 以惰性引用承载：`start` 之前的任何判定得到空快照即如实拒绝（fail-closed，不猜测
      // 授权）。`documentWiring.guardSessionSource` 注入位保留为**显式覆盖口**（真进程
      // E2E 替身臂经 `main/e2e-app.ts` 注入在册枚举实现；S6 口径，同激活端口注入位）。
      let runtimeForGuardSnapshots: IHostRuntime | null = null;
      const defaultGuardSessionSource: DocumentGuardSessionSource = () =>
        runtimeForGuardSnapshots === null ? [] : runtimeForGuardSnapshots.sessionPermissionSnapshots();
      const documentWiringOptions: IDocumentCapabilityWiringOptions = {
        ...documentWiring,
        guardSessionSource: documentWiring?.guardSessionSource ?? defaultGuardSessionSource,
      };
      const documentAssembly = createDocumentCapabilityWiring(documentWiringOptions, context, bridgeDiagnostics);
      const { loaderFactory: productionPluginLoaderFactory, pluginRegistry } =
        await createProductionPluginLoaderFactory(context, pluginActivationPortFor);
      const pluginLoaderFactory =
        documentAssembly.status === 'wired'
          ? (deps: IHostPluginLoaderDeps): IPluginLoaderSurface => {
              documentAssembly.bindEventBus(deps.emitEvent);
              return productionPluginLoaderFactory(deps);
            }
          : productionPluginLoaderFactory;
      const providers =
        documentAssembly.status === 'wired'
          ? [...(capabilityProviders ?? []), documentAssembly.descriptors]
          : capabilityProviders;
      // 刀4 缝②落地：Bridge 会话关闭 → 文档服务释放该会话的文档会话与记录（§4.6）。
      // 释放链内部完成事件发布与诊断留痕；此处兜底 catch 防异步拒绝逃逸（fire-and-forget
      // 口径见 `host-runtime.ts` `onBridgeSessionClosed` 选项头注）。
      const documentService = documentAssembly.service;
      // 刀7 接线波（任务 #120）：装载投递通道的绑定腿端口——与 `document:open` 回包同源
      // （同一 `findRecord(source)` 会话键口径），钉死 `windowId ↔ source ↔ documentId`
      // 一致性（工单035 §九待裁随账收口）。装载段回退态（service 缺位）不注入，投递臂如实拒收。
      const cardWindowDocumentBinding: CardWindowDocumentBindingResolver | undefined =
        documentService === undefined ? undefined : (source) => documentService.resolveWindowDocument(source);
      // 刀4 缝② + 工单036 波 A2b-β（任务 #219）退出清理：把释放链的 Promise 如实交回运行时
      // （不再 fire-and-forget）——运行时登记在途释放，`shutdown()` 停机收口前逐条等待，
      // 使文档记录驱逐的两拍注销（`unregisterScope` → 关原生会话）不被进程退出抢先；
      // 异步失败的留痕与终态抛出统一由运行时承载（`host-runtime.ts` `pendingSessionCleanups`
      // 头注 + `shutdown` 收口臂），本处不再自行吞拒绝。
      const onBridgeSessionClosed =
        documentService === undefined
          ? undefined
          : (sessionId: string): Promise<void> => documentService.releaseSessions(sessionId);
      const runtime = createProductionRuntime(context, {
        ...(providers === undefined ? {} : { capabilityProviders: providers }),
        ...(sessionProvisioner === undefined ? {} : { sessionProvisioner }),
        ...(registryOptions === undefined ? {} : { registryOptions }),
        pluginLoaderFactory,
        // 刀5 段A：视图通道端点两臂恒在（wired = 真实构建臂，unavailable = 诚实拒绝臂），
        // 交壳 `ipc` 段注册 `document-view:request`。
        documentViewChannel: documentAssembly.viewChannel,
        ...(cardWindowDocumentBinding === undefined ? {} : { cardWindowDocumentBinding }),
        ...(onBridgeSessionClosed === undefined ? {} : { onBridgeSessionClosed }),
        ...(diagnostics === undefined ? {} : { diagnostics }),
      });
      // 守卫快照默认绑定的惰性引用在此闭合（上方 `defaultGuardSessionSource` 读取本变量）：
      // 运行时已构造、尚未 `start`，装载段若已注入显式覆盖口则本引用不参与判定。
      runtimeForGuardSnapshots = runtime;
      // 工单046 段四接线波（任务 #206 收口）：审计观察面绑定臂——native 绑定过装载闸
      // 且运行时审计写入器常开时，把 §8.2 条目唯一组装点（`createPermissionDecisionIntake`，
      // RFC §九 9.2-2「单条目单落点」）经 `auditBindDecisionSink`（§8.6 第 53 导出，波 A1
      // 任务 #209 三资源名补登后位次随动）绑定进
      // native 观察者。绑定发生在 `createRuntime` 返回前、`start` 与任何 `bridge*` /
      // `resource*` 判定流量之前（组合根启动序消除未绑定窗口，RFC §八条 2）。构造期注入、
      // 终身不可换（§八条 1）。绑定三态一律诊断留痕、fail-closed 不伪造：export-missing /
      // bind-failed 臂素材流滞留 native 观察侧 dropped 计数（观察失败永不回传判定面，G2），
      // writer 与宿主 TS 判定臂（段三在册接线位）零扰动。`resolvePluginVersion` 走插件
      // 持久化注册表在册供给面（无值即拒组装，不伪造版本串）；`resolveTraceId` 为
      // resource 域固定来源哨兵（口径见 {@link AUDIT_RESOURCE_DOMAIN_TRACE_SOURCE} 头注）。
      if (nativeBridge.status === 'available' && runtime.auditWriter !== null) {
        const intake = createPermissionDecisionIntake({
          auditWriter: runtime.auditWriter,
          diagnostics: bridgeDiagnostics,
          resolvePluginVersion: (pluginId) => pluginRegistry.get(pluginId)?.version ?? null,
          resolveTraceId: () => AUDIT_RESOURCE_DOMAIN_TRACE_SOURCE,
        });
        // 同一 `.node` 路径再取：Node 模块缓存保证与装载闸同一进程级导出实例
        // （`native-bridge.ts` 头注在册单例语义，§5.4），装载闸交付形状零扩面。
        try {
          const moduleValue = createRequire(pathToFileURL(nativeBridge.modulePath).href)(
            nativeBridge.modulePath,
          ) as Record<string, unknown>;
          const outcome = bindNativeDecisionSink(moduleValue, intake.consume);
          if (outcome.status !== 'bound') {
            bridgeDiagnostics.warn('native-audit', '审计观察面绑定未成功，native 判定素材滞留观察侧计数', {
              status: outcome.status,
              detail: outcome.detail,
              modulePath: nativeBridge.modulePath,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : typeof error;
          bridgeDiagnostics.warn('native-audit', '审计观察面绑定臂取模块实例失败', {
            reason: message,
            modulePath: nativeBridge.modulePath,
          });
        }
      }
      return runtime;
    },
  });
}
