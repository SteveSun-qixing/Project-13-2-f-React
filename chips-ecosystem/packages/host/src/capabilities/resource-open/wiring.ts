/**
 * 组合根资源打开能力装载段（`production-assembly.ts` 的路由侧本体，工单036 残段 T4）。
 *
 * 权威：`14-资源打开与默认处理器契约` §二～§六（路由域全量契约）、
 * `04-能力契约规范` §6.2（R19：`resource:open`→`resources:read`、`resource:list-handlers` 免权限）、
 * `02-Bridge三层设计` §2.1（组合根装配职责）、§4.1（注册项）。
 *
 * @remarks
 * - 与文档能力装载段（`capabilities/document/adapters/production-wiring.ts`）同形制：
 *   生产端口在本段以真实载体构造，显式注入位保留为覆盖口（E2E 替身臂与测试注入，S6）。
 *   两臂恒在（路由域不依赖原生产物装载闸——解析、槽位视图与降级臂均不读资源字节，OR-10），
 *   `resource:open` / `resource:list-handlers` 恒注册；候选集合随装载器记录即时快照（§3.4），
 *   无候选即按 §4.6 降级，注册表不因生态空态缩水。
 * - 生产端口来源：候选目录 = 装载器记录 → manifest `fileAssociations`（本目录
 *   `manifest-catalog.ts`）；偏好 = PAL `config` 端口（分面缺位时按空偏好表处置）；
 *   投递 = 装载器 + 激活通道入口保管面（`production-delivery.ts`）；降级 = PAL
 *   `shellOpen` 端口（分面缺位时按回退失败语义收口）；文档形态探针 = 文档域在册账
 *   （工单036 波 C3 域内单源）。
 * - {@link IResourceOpenWiringOptions.appInstances} 为**显式覆盖口**：应用实例投递的生产
 *   默认实现中，新建实例的 `launch(ctx)` 调用臂候应用窗口运行时（工单066 / 判定表 T6）
 *   原位补齐；T6 亦经本口注入更完整的实例端口，消费方与描述符零改动。
 */

import type { IPluginRecord } from '../../loader/types.js';
import type { IPalConfigPort, IPalShellOpenPort } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../../runtime/capability/contracts.js';
import type { DiagnosticsSink } from '../../shared/diagnostics.js';
import type { DocumentScopeLedger } from '../document/adapters/scope-ledger.js';
import { createPalHandlerPreference } from './adapters/config-preference.js';
import { createManifestHandlerCatalog } from './adapters/manifest-catalog.js';
import {
  createLedgerDocumentScopeForm,
  createLoaderAppInstancePort,
  createLoaderServiceInstancePort,
  createPalResourceOpenFallback,
} from './adapters/production-delivery.js';
import type { ILoaderInstanceView } from './adapters/production-delivery.js';
import { createResourceOpenCapabilityDescriptors } from './descriptors.js';
import { createResourceOpenService } from './service.js';
import type { IAppInstancePort } from './ports.js';

/** 装载段注入选项。 */
export interface IResourceOpenWiringOptions {
  /** 插件记录视图源（宿主运行时装载器 `list()` 的同一实例；禁第二注册表）。 */
  readonly listPlugins: () => readonly IPluginRecord[];
  /** 装载与激活视图（`get` / `enable` / `activatedEntryOf`；组合根接同一实例）。 */
  readonly loader: ILoaderInstanceView;
  /** 宿主事件出口（`resource:opened` 经此投递；与 `plugin:*` 同面）。 */
  readonly publishEvent: (eventId: string, payload: unknown) => void;
  /** PAL 配置端口（分面缺位传 `undefined`：偏好按空表处置）。 */
  readonly config?: IPalConfigPort | undefined;
  /** PAL 外部打开端口（分面缺位传 `undefined`：降级臂按回退失败语义收口）。 */
  readonly shellOpen?: IPalShellOpenPort | undefined;
  /** 文档域作用域在册账（§4.6 文档形态探针的单点来源；缺位时文档作用域按不可回退处置）。 */
  readonly documentScopeLedger?: DocumentScopeLedger;
  /** 应用实例投递显式覆盖口（T6 / E2E 替身臂；缺省用装载器生产适配器）。 */
  readonly appInstances?: IAppInstancePort;
  /** 宿主诊断口。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 装载段产出句柄。 */
export interface IResourceOpenCapabilityWiring {
  /** `resource:open` / `resource:list-handlers` 注册单元（两臂恒在）。 */
  readonly descriptors: readonly IHostCapabilityDescriptor[];
}

/**
 * 执行资源打开能力装载并产出注册单元。
 *
 * @param options 装载注入选项。
 */
export function createResourceOpenCapabilityWiring(options: IResourceOpenWiringOptions): IResourceOpenCapabilityWiring {
  const catalog = createManifestHandlerCatalog({
    listPlugins: options.listPlugins,
    ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
  });
  const preferences = createPalHandlerPreference({
    config: options.config,
    ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
  });
  const appInstances =
    options.appInstances ??
    createLoaderAppInstancePort({
      loader: options.loader,
      publishEvent: options.publishEvent,
      ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
    });
  const serviceInstances = createLoaderServiceInstancePort({ loader: options.loader });
  const fallback = createPalResourceOpenFallback({
    shellOpen: options.shellOpen,
    ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
  });
  const service = createResourceOpenService({
    catalog,
    preferences,
    appInstances,
    serviceInstances,
    fallback,
    ...(options.documentScopeLedger === undefined
      ? {}
      : { documentScopes: createLedgerDocumentScopeForm(options.documentScopeLedger) }),
  });
  return { descriptors: createResourceOpenCapabilityDescriptors(service) };
}
