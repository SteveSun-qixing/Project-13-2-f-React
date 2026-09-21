/**
 * 插件激活端口的宿主实现（主进程侧执行通道）：RFC-插件执行通道与ModuleLoader裁定 §3.1A/§八 波 2。
 *
 * 权威：`项目日志与笔记/RFC-插件执行通道与ModuleLoader裁定` §3.1A（插件 JS 求值统一经
 * 波 1 `ICpkModuleLoader.loadModule()`，副作用经既有 `IPluginActivationContext` 门面登记）、
 * §5.1（失败语义表：全部失败只使用在册 `LIFECYCLE_ERROR_CODES`，阶段/原因经 `details.stage`
 * /`details.reason` 结构化承载，零自造码）、§6.1（`apply` 30s / `stop` 10s 强制点在
 * `lifecycle.ts` 契约视图，本实现不得旁路——全文零 `setTimeout`/零 `AbortController` 构造，
 * 只消费 `ctx.signal` 协作式取消）；角色 default 导出契约取施工规范 `04-插件体系.md` §2.2
 * 与 scaffold 模板（basecard：`validateConfig/createInitialContent/collectResourcePaths`；
 * boxlayout：`validateConfig`；app：`launch`（+`handleCommand`/`openFile` 可选）；
 * service：`start(ctx)`/`stop()`（+`health`/`handleFile` 可选））。
 *
 * @remarks
 * - **注册面边界**：卡片类型/布局/启动器的注册数据源是 manifest、由平台在启用时完成，
 *   不执行插件注册代码（`08.06-渲染与卡片体系` §6.4.1、`09.02-布局系统` §2.3）；本通道
 *   对 `basecard`/`boxlayout`/`app` 只做「受管装载 + 角色形状校验 + 入口保管」，
 *   求值后的 default 对象经 {@link IHostPluginActivationChannel.activatedEntry} 供后续波次
 *   （manifest 注册面/调度面）消费，不在本波伪造注册 sink。
 * - **service 激活**：`start(ctx)` 是服务唯一激活入口（`06.03-后端系统设计` §二），
 *   参数即生命周期注入的 `IPluginActivationContext` 门面本体（能力注册 owner 预绑定、
 *   事件发布、配置只读快照全部经门面发生）；`stop()` 于停用回调执行，失败/超时由
 *   `lifecycle.ts` 随 `stopError` 上报、不阻断撤销（内核 §6.4）。
 * - **失败归一**（§5.1 表第五行）：插件 `start`/`stop` 抛出的 `ChipsError` 同构错误
 *   （真 `Error` + 非空 `code`/`message` + 布尔 `retryable`，`code` 形如 `<DOMAIN>_<REASON>`）
 *   在册域码原样传播；其余一律归一 `KERNEL_APPLY_FAILED`，原文只进 `details.cause`，
 *   不落 `message`。波 1 装载器抛出的 `LoaderError` 已按 §5.1 归一，本层原样透传。
 * - **O1 归档再锚定**（RFC §十 O1，波 1 移交欠账①）：注册表 `record.hash` 在归档安装
 *   路径是「整包归档字节摘要」（`validate.ts` §八 口径），与 `loadModule` 期望的
 *   「装后目录包级合并摘要」不同口径，直接递交会确定性误拒全部归档安装插件。本实现在
 *   激活取数路径按来源归一：`development`（目录态安装，`record.hash` 即合并摘要口径）
 *   原样递交，保留真防篡改锚；`builtin`/`user` 以「目录重放 + Ed25519 再验签」为信任锚
 *   （签名缺失/摘要不合/信任根未登记 → 归一 `KERNEL_APPLY_FAILED`
 *   `details.stage='integrity'`，原因携 `causeCode`），期望摘要取验签后的目录全成员
 *   合并摘要重算值。`user` 未签名发布者按 §2.4 契约可安装，其无持久摘要锚可用，
 *   取同一重算口径（固有缝已登记交单，非临时分支）。
 * - **会话承载**：`lifecycle.ts` 在 `enable` 与 `disable` 各调用一次 `activationPortFor`
 *   （端口实例不同），激活产物必须存于本通道闭包按 `pluginId` 键控的会话表；`stop`
 *   无会话即幂等空操作（T9 允许从未经激活的路径走到停用回调）。
 */

import type {
  ICpkModuleLoader,
  IPluginActivationContext,
  IPluginActivationPort,
  IPluginRegistry,
  IPersistedPluginEntry,
  ITrustRootRegistry,
  PluginRole,
} from '../loader/index.js';
import {
  LIFECYCLE_ERROR_CODES,
  LoaderError,
  computeContentHash,
  createCpkModuleLoader,
  loadCpkDirectory,
  membersToZipEntries,
  throwCpkError,
  verifySignature,
} from '../loader/index.js';
import { isWireChipsError } from '../protocol/wire.js';

/** 已激活插件入口的保管投影（后续波次 manifest 注册/调度面的取数口）。 */
export interface IPluginActivatedEntry {
  readonly pluginId: string;
  readonly version: string;
  readonly role: PluginRole;
  /** 本次激活的复加载 nonce（波 1 装载面回执）。 */
  readonly nonce: string;
  /** 入口模块最终解析 URL（含 nonce 查询串）。 */
  readonly entryUrl: string;
  /** 已过角色形状校验的 default 导出对象（角色方法的可执行视图）。 */
  readonly entry: Readonly<Record<string, unknown>>;
}

/** 宿主激活通道（组合根注入 `activationPortFor` 的正式实现面）。 */
export interface IHostPluginActivationChannel {
  /**
   * 为指定插件提供激活端口（与 `lifecycle.ts` `ICpkPluginLoaderDeps.activationPortFor`
   * 同签名）。本通道即正式通道实现，恒返回端口——不存在「通道未注入」的回退臂。
   */
  activationPortFor(plugin: {
    readonly id: string;
    readonly version: string;
    readonly role: PluginRole;
    readonly path: string;
  }): IPluginActivationPort;
  /** 按插件 ID 取已激活入口保管投影；未激活/已停用返回 undefined。 */
  activatedEntry(pluginId: string): IPluginActivatedEntry | undefined;
  /** 释放通道：清空会话表；仅当装载器为通道自建时一并释放。幂等。 */
  dispose(): void;
}

/** 通道构造选项。 */
export interface ICreateHostPluginActivationChannelOptions {
  /** 持久化插件注册表（激活取数路径按 ID 查来源/路径/摘要锚）。 */
  readonly pluginRegistry: Pick<IPluginRegistry, 'get'>;
  /** 信任根注册表（`builtin`/`user` 归档再锚定的验签锚）。 */
  readonly trustRoots: ITrustRootRegistry;
  /**
   * 受管模块装载器（波 1 面）；缺省自建 `createCpkModuleLoader({ sessionRoot })`。
   * 注入实例的释放归注入方，通道 `dispose()` 不代为释放。
   */
  readonly moduleLoader?: ICpkModuleLoader;
  /** 自建装载器的会话目录根（缺省 `os.tmpdir()`）。 */
  readonly sessionRoot?: string;
}

/** 角色 default 导出必含方法（契约不符即激活失败；与 scaffold 模板逐项一致）。 */
const ROLE_ENTRY_REQUIRED_METHODS: Readonly<Record<PluginRole, readonly string[]>> = {
  basecard: ['validateConfig', 'createInitialContent', 'collectResourcePaths'],
  boxlayout: ['validateConfig'],
  app: ['launch'],
  service: ['start', 'stop'],
};

/** 角色 default 导出可选方法（出现即必须为函数；缺席合法）。 */
const ROLE_ENTRY_OPTIONAL_METHODS: Readonly<Record<PluginRole, readonly string[]>> = {
  basecard: [],
  boxlayout: [],
  app: ['handleCommand', 'openFile'],
  service: ['health', 'handleFile'],
};

/** 插件自带域错误码形状（§5.1 第五行：`<DOMAIN>_<REASON>`，原样保留不解释语义）。 */
const PLUGIN_DOMAIN_ERROR_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/** service 入口在形状校验后的可调用视图（06.03 §二：start 唯一激活入口）。 */
interface IServicePluginEntry {
  start(context: IPluginActivationContext): void | Promise<void>;
  stop(): void | Promise<void>;
}

/** 装载器抛拒的归一（波 1 已按 §5.1 携 `details.stage`；此处仅补充诊断字段）。 */
function reanchorFailure(
  entry: IPersistedPluginEntry,
  reason: 'unsafe-source-tree' | 'signature-reanchor',
  message: string,
  error: unknown,
): never {
  const cause =
    error instanceof LoaderError
      ? { causeCode: error.code, causeMessage: error.message }
      : { causeMessage: error instanceof Error ? error.message : String(error) };
  throw new LoaderError(LIFECYCLE_ERROR_CODES.applyFailed, {
    message: `${message}：${entry.id}`,
    details: { pluginId: entry.id, stage: 'integrity', reason, ...cause },
  });
}

/**
 * O1 归档再锚定：按来源类型归一激活期期望的包级合并摘要。
 *
 * @returns 递交 `loadModule` 的 `expectedPackageHash`（`sha256:` + 64 位十六进制）。
 */
async function resolveExpectedPackageHash(
  entry: IPersistedPluginEntry,
  trustRoots: ITrustRootRegistry,
): Promise<string> {
  // development 为目录态安装（《03-插件包格式》§2.7）：record.hash 即全成员合并摘要口径，
  // 原样递交保留真防篡改锚（安装后篡改由装载器逐文件复算 + 包级复算拒绝）。
  if (entry.source === 'development') {
    return entry.hash;
  }
  let members: ReadonlyMap<string, Uint8Array>;
  try {
    const pkg = await loadCpkDirectory(entry.path);
    members = pkg.members;
  } catch (error) {
    reanchorFailure(entry, 'unsafe-source-tree', '插件目录源树不可信或不可读，激活取数失败', error);
  }
  try {
    // Ed25519 再验签 = 归档态信任锚：签名声明的 contentHash 覆盖除 signature.json 外
    // 全部成员，篡改/增删任一文件都会在此确定性拒装；user 缺签按 §2.4 契约判
    // 「未签名发布者」（skipped，不阻断，本波维持安装期同一口径）。
    verifySignature({ members, source: entry.source, trustRoots });
  } catch (error) {
    reanchorFailure(entry, 'signature-reanchor', '插件签名再锚定失败，激活取数被拒', error);
  }
  // 装后目录全成员（含 signature.json）合并摘要 = 波 1 `prepareActivation` 复算口径。
  return computeContentHash(membersToZipEntries(members));
}

/** 角色形状校验：`default` 导出与角色契约方法逐项判定。 */
function assertRoleShape(
  pluginId: string,
  role: PluginRole,
  namespace: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const shapeFail = (reason: string, method?: string): never =>
    throwCpkError(
      LIFECYCLE_ERROR_CODES.applyFailed,
      `插件入口不符合角色契约（${role}：${reason}），激活失败：${pluginId}`,
      {
        pluginId,
        role,
        stage: 'role',
        reason,
        ...(method === undefined ? {} : { method }),
      },
    );
  const defaultExport = namespace['default'];
  if (defaultExport === undefined || defaultExport === null) {
    shapeFail('default-export-missing');
  }
  if (typeof defaultExport !== 'object') {
    shapeFail('default-export-not-object');
  }
  const record = defaultExport as Record<string, unknown>;
  for (const method of ROLE_ENTRY_REQUIRED_METHODS[role]) {
    const value = record[method];
    if (value === undefined || value === null) {
      shapeFail('required-method-missing', method);
    }
    if (typeof value !== 'function') {
      shapeFail('method-not-function', method);
    }
  }
  for (const method of ROLE_ENTRY_OPTIONAL_METHODS[role]) {
    const value = record[method];
    if (value !== undefined && value !== null && typeof value !== 'function') {
      shapeFail('method-not-function', method);
    }
  }
  return record;
}

/**
 * 插件代码抛出错误的 §5.1 归一：`LoaderError` 与在册形状插件码原样传播，
 * 其余归一 `KERNEL_APPLY_FAILED`（原文只进 `details.cause`，不落 `message`）。
 */
function normalizePluginError(error: unknown, pluginId: string): never {
  if (error instanceof LoaderError) {
    throw error;
  }
  if (
    error instanceof Error &&
    isWireChipsError(error) &&
    PLUGIN_DOMAIN_ERROR_CODE.test(error.code) &&
    typeof error.retryable === 'boolean'
  ) {
    // 插件自带 `<DOMAIN>_<REASON>` 域码（如 APP_*/CARD_*）由契约侧定义，宿主不解释
    // 其语义、原样传播（§5.1 第五行「原样保留」）；确定性/可重试由码主自证。
    throw error;
  }
  const cause = error instanceof Error ? error.message : String(error);
  throw new LoaderError(LIFECYCLE_ERROR_CODES.applyFailed, {
    message: `插件激活执行失败：${pluginId}`,
    details: { pluginId, stage: 'plugin', reason: 'apply-threw', cause },
  });
}

/**
 * 创建宿主插件激活通道（波 2 交付面；组合根经 `pluginActivationPortFor` 注入位接线）。
 *
 * @param options 注册表、信任根与可选装载器注入。
 * @returns 激活通道：端口供给 + 已激活入口保管 + 释放。
 */
export function createHostPluginActivationChannel(
  options: ICreateHostPluginActivationChannelOptions,
): IHostPluginActivationChannel {
  const ownLoader = options.moduleLoader === undefined;
  const moduleLoader: ICpkModuleLoader =
    options.moduleLoader ??
    createCpkModuleLoader(options.sessionRoot === undefined ? {} : { sessionRoot: options.sessionRoot });
  /** 激活会话表：端口实例在 enable/disable 两侧不同，产物必须按 pluginId 通道级键控。 */
  const sessions = new Map<string, IPluginActivatedEntry>();
  let disposed = false;

  const ensureLive = (pluginId: string): void => {
    if (disposed) {
      throwCpkError(LIFECYCLE_ERROR_CODES.applyFailed, `激活通道已释放，拒绝装载：${pluginId}`, {
        pluginId,
        stage: 'channel',
        reason: 'channel-disposed',
      });
    }
  };

  const apply = async (
    bound: { readonly id: string; readonly version: string; readonly role: PluginRole; readonly path: string },
    context: IPluginActivationContext,
  ): Promise<void> => {
    const pluginId = context.pluginId;
    ensureLive(pluginId);
    // 端口按插件创建，上下文与端口身份必须一致（不一致即装配错位，确定性拒绝）。
    if (pluginId !== bound.id) {
      throwCpkError(LIFECYCLE_ERROR_CODES.applyFailed, `激活上下文与端口绑定身份不一致：${pluginId}`, {
        pluginId,
        boundPluginId: bound.id,
        stage: 'role',
        reason: 'context-plugin-mismatch',
      });
    }
    // 超时强制撤销由 lifecycle 触发 signal；本实现只协作式响应，不自设时限。
    if (context.signal.aborted) {
      throwCpkError(LIFECYCLE_ERROR_CODES.applyFailed, `激活在取数前已被取消：${pluginId}`, {
        pluginId,
        stage: 'activation',
        reason: 'cancelled',
      });
    }
    const entry = options.pluginRegistry.get(pluginId);
    if (entry === undefined) {
      throw new LoaderError(LIFECYCLE_ERROR_CODES.pluginNotFound, {
        details: { pluginId },
      });
    }
    const expectedPackageHash = await resolveExpectedPackageHash(entry, options.trustRoots);
    // 波 1 装载面：白名单/完整性/入口/通道四类门禁失败已按 §5.1 归一，原样透传。
    const loaded = await moduleLoader.loadModule({
      pluginId,
      rootDir: entry.path,
      expectedPackageHash,
    });
    if (context.signal.aborted) {
      // 装载与求值窗口内被取消（超时撤销/停用竞态）：拒绝对已求值模块继续登记副作用。
      throwCpkError(LIFECYCLE_ERROR_CODES.applyFailed, `激活在装载后已被取消：${pluginId}`, {
        pluginId,
        stage: 'activation',
        reason: 'cancelled',
      });
    }
    const shaped = assertRoleShape(pluginId, context.role, loaded.exports);
    sessions.set(pluginId, {
      pluginId,
      version: context.version,
      role: context.role,
      nonce: loaded.nonce,
      entryUrl: loaded.entryUrl,
      entry: shaped,
    });
    if (context.role === 'service') {
      try {
        // 服务唯一激活入口：ctx 即激活上下文门面本体（RFC §3.1A 副作用登记面）。
        await (shaped as unknown as IServicePluginEntry).start(context);
      } catch (error) {
        sessions.delete(pluginId);
        normalizePluginError(error, pluginId);
      }
    }
  };

  const stop = async (context: IPluginActivationContext): Promise<void> => {
    const pluginId = context.pluginId;
    // 通道已释放即会话表已清空（loader 同步失效），停用回调幂等空操作而非报错——
    // 释放面只拒新激活，不得反向污染撤销路径。
    if (disposed) {
      return;
    }
    // 先清会话再执行停用回调：回调失败也不残留可复用会话（幂等性由缺席保证）。
    const session = sessions.get(pluginId);
    sessions.delete(pluginId);
    if (session === undefined || session.role !== 'service') {
      return;
    }
    try {
      await (session.entry as unknown as IServicePluginEntry).stop();
    } catch (error) {
      // 停用回调失败不阻断撤销（内核 §6.4）：归一错误照常抛出，由 lifecycle 随
      // `stopError` 上报并维持 T9 → installed。
      normalizePluginError(error, pluginId);
    }
  };

  return {
    activationPortFor(plugin) {
      return {
        apply: (context) => apply(plugin, context),
        stop: (context) => stop(context),
      };
    },
    activatedEntry(pluginId) {
      return sessions.get(pluginId);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      sessions.clear();
      if (ownLoader) {
        moduleLoader.dispose();
      }
    },
  };
}
