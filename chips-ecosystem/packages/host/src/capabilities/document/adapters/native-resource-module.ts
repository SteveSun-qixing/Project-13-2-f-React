/**
 * `chips-native` 资源域导出（§11.3）的宿主侧类型视图与装载闸
 * （W3-P0-1 段三宿主接线波，任务 #194；《04-资源管理设计》§十一）。
 *
 * 权威：`01-架构设计/01-子系统设计/04.11-04-资源管理设计-十一、Rust ResourceManager 与 Neon 暴露`
 * §11.3「Neon 导出」表（15 行逐字，camelCase 导出名 + 参数位次 + 返回形状）与
 * §11.4（异步导出经 `cx.channel()` 回主线程 settle、失败路径 `ChipsError` 经 Bridge 归一）、
 * §11.5（单一 `ResourceManager` 实例随主进程生命周期）；
 * `ResourceMetadata` 的 JS 投影形状取
 * `05-接口与契约/03.07-03-核心接口规范-七、资源管理器（chips-resource）` §7.3 在册表。
 *
 * @remarks
 * - 零依赖结构视图：`@chips/host` 与 `@chips/native` 无运行时依赖边（架构边界，与
 *   `native-parser-module.ts` / `main/native-bridge.ts` 的镜像模式同构）。本模块镜像与
 *   `packages/native/abi/export-surface.json`、`packages/native/types/chips-native.d.ts`
 *   及 §11.3 表的三方一致性由 `tests/document-native-resource-module.test.ts` 单点锁定。
 * - 导出表只增不改（§8.6）：判定按「§11.3 十五名 + 元信息两名全部在位」，不要求全等集合；
 *   签名变化递增 `coreAbiVersion`，与宿主期望 `NATIVE_RESOURCE_ABI_VERSION` 不等即
 *   `abi-mismatch`。任一产物在位但缺名即 `surface-mismatch` 并逐项点名，杜绝静默降级。
 * - 产物落位与解析域/Bridge 域同一模块文件：`packages/host/native/chips-native.node`
 *   （Node 模块缓存保证同一 `.node` 进程级单例，三个装载闸共享同一内核与同一
 *   `ResourceManager` 实例，§11.5）。
 * - **本模块只交付消费面，不交付端口适配器**：§11.3 十五导出承载的是「已归一资源地址」的
 *   读写面，未承载文档侧所需的三项载体——① 作用域注册 / 挂载
 *   （Rust `register_scope` / `mount_directory`，§11.2 在册、§11.3 无导出行）；
 *   ② 跨成员原子提交（`resourceCommitWrite` 为单成员一次写入，无包级事务面）；
 *   ③ 落盘序列化（金链路刀6 裁决归本波协作面，未在任何导出表在册）。故
 *   `IDocumentScopePort` / `IDocumentStoragePort` 的正式适配器在这三项载体落地前**不得**
 *   以「部分实现」形态拼装（工单 036 禁止内存替身与临时实现），装载段维持诚实回退。
 *   三项载体的契约补登与导出随资源域波次交付，本模块的闸判据即为该落地的宿主侧接收面：
 *   导出落位即 `available`，端口适配器随之接线，宿主侧判定逻辑零改动。
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { defaultNativeDocumentParserModulePath } from './native-parser-module.js';

/**
 * 资源域宿主期望的绑定 ABI 版本（`packages/native/abi/export-surface.json` 的
 * `abiVersion` 结构视图）。与解析域 / Bridge 域同源同值（单一内核一个 ABI 计数，§8.6），
 * 双源不漂移由契约锁用例兜住。
 */
export const NATIVE_RESOURCE_ABI_VERSION = 1;

/**
 * §11.3「Neon 导出」表的 15 个导出名（逐字镜像，表行序即数组序；
 * 表原文以 monospace 包裹，锁测比对前双侧去反引号）。
 */
export const NATIVE_RESOURCE_SURFACE_EXPORTS = [
  'resourceOpen',
  'resourceStat',
  'resourceRead',
  'resourceReadChunk',
  'resourceRelease',
  'resourceCommitWrite',
  'resourceCommitWriteStream',
  'resourceListDirectory',
  'resourceDelete',
  'resourceRename',
  'resourceCopy',
  'resourceCreateDirectory',
  'resourceOpenSession',
  'resourceCloseSession',
  'resourceRegisterTempScope',
] as const;

/** 装载闸要求的元信息导出名（§8.6 元信息域两项，与解析域 / Bridge 域装载闸同判据）。 */
export const NATIVE_RESOURCE_REQUIRED_META_EXPORTS = ['coreVersion', 'coreAbiVersion'] as const;

/** 装载闸必备导出全集（元信息 2 + 资源域 15）；缺任一即 `surface-mismatch`。 */
export const NATIVE_RESOURCE_REQUIRED_EXPORTS = [
  ...NATIVE_RESOURCE_REQUIRED_META_EXPORTS,
  ...NATIVE_RESOURCE_SURFACE_EXPORTS,
] as const;

/**
 * 不透明写入流句柄（§11.3 `resourceCommitWriteStream` 返回 `WriteStreamHandle`；
 * Rust 侧 `WriteStreamHandle` 定义面未在该结构体处展开——见交回项，宿主侧按品牌化
 * 不透明句柄承载，不猜测其内部结构）。
 */
export interface INativeWriteStreamHandle {
  readonly nativeWriteStreamHandleBrand: 'chips-native.write-stream';
}

/**
 * 资源元数据的 JS 投影（§7.3 在册形状：`uri` / `size` / `mimeType` / `version` / `scope`）。
 * 与壳侧 `IWireResourceMetadata`（`protocol/wire.ts`，Bridge 下行面）逐字段同构，
 * 归一单点不另造第二形状。
 */
export interface INativeResourceMetadata {
  uri: string;
  size: number;
  mimeType: string;
  version: string;
  scope: string;
}

/**
 * 目录条目（§11.3 `resourceListDirectory` 返回 `DirectoryEntry[]`，struct 定义在
 * 《04-资源管理设计》§三）。**JS 投影形状未在册**（文档面只冻结 Rust struct，未给出
 * camelCase / 时间载体的 JS 形状，见交回项），故本视图按不透明记录承载：宿主侧不得
 * 据未冻结的字段名解码（防第二套猜测），端口适配器落地前须先冻结该形状。
 */
export type INativeDirectoryEntry = Record<string, unknown>;

/** `resourceOpen` 返回（§11.3 表逐字：`{ handleId, metadata }`）。 */
export interface INativeResourceOpenResult {
  handleId: number;
  metadata: INativeResourceMetadata;
}

/**
 * 资源域注入面（15 函数结构接口）：键名、参数位次、返回形状逐字对齐 §11.3 表。
 * `HandleId` / `SessionId` 为单调递增 `u64`（低于 2^53，§11.3 表后注），JS 侧以 `number`
 * 承载即安全整数域；释放后不复用。
 */
export interface INativeResourceModule {
  /** 解析、权限、打开（§11.3 行 1）。 */
  resourceOpen(uri: string, sessionId: number): Promise<INativeResourceOpenResult>;
  /** 元数据（§11.3 行 2）。 */
  resourceStat(handleId: number): Promise<INativeResourceMetadata>;
  /** 范围读（§11.3 行 3）。 */
  resourceRead(handleId: number, offset: number, length: number): Promise<Uint8Array>;
  /** 流式拉取，`null` 为结尾（§11.3 行 4）。 */
  resourceReadChunk(handleId: number, maxBytes: number): Promise<Uint8Array | null>;
  /** 释放句柄（§11.3 行 5，同步）。 */
  resourceRelease(handleId: number): void;
  /** 一次性写入提交（仅内部与文档服务，§11.3 行 6）。 */
  resourceCommitWrite(
    scope: string,
    path: string,
    bytes: Uint8Array,
    sessionId: number,
  ): Promise<INativeResourceMetadata>;
  /** 流式写入提交（分块 + 背压 + 失败回滚，§4.8 / §11.3 行 7）。 */
  resourceCommitWriteStream(scope: string, path: string, sessionId: number): Promise<INativeWriteStreamHandle>;
  /** 列举目录（§4.10 / §11.3 行 8；JS 投影形状未在册，见 {@link INativeDirectoryEntry}）。 */
  resourceListDirectory(uri: string, sessionId: number): Promise<INativeDirectoryEntry[]>;
  /** 删除文件/目录（§4.9 / §11.3 行 9）。 */
  resourceDelete(uri: string, recursive: boolean, sessionId: number): Promise<void>;
  /** 重命名/移动（§4.9 / §11.3 行 10）。 */
  resourceRename(fromUri: string, toUri: string, sessionId: number): Promise<void>;
  /** 复制（§4.9 / §11.3 行 11）。 */
  resourceCopy(fromUri: string, toUri: string, sessionId: number): Promise<INativeResourceMetadata>;
  /** 创建目录（§4.9 / §11.3 行 12）。 */
  resourceCreateDirectory(uri: string, sessionId: number): Promise<void>;
  /** 打开资源会话（主进程内部使用，§11.3 行 13，同步）。 */
  resourceOpenSession(kind: string, owner: string): number;
  /** 关闭会话并级联释放（§11.3 行 14，同步）。 */
  resourceCloseSession(sessionId: number): void;
  /** 注册临时作用域（dialog 授权后调用，§11.3 行 15，同步返回 `ScopeId`）。 */
  resourceRegisterTempScope(path: string, writable: boolean): string;
}

/** 装载失败原因（fail-closed 四分面；与解析域 / Bridge 域装载闸同构语义）。 */
export type NativeResourceUnavailableReason =
  /** 产物文件不存在（未构建或落位漂移）。 */
  | 'module-missing'
  /** 文件存在但加载抛错（损坏、平台不匹配、依赖缺失）。 */
  | 'load-failed'
  /** 加载成功但 §11.3 必备导出缺位或非函数（旧产物 / 面漂移）。 */
  | 'surface-mismatch'
  /** 导出在位但 `coreAbiVersion()` 与宿主期望不等或取值非法（ABI 漂移）。 */
  | 'abi-mismatch';

/** 装载结果可用态：类型化资源域消费面 + 元信息快照。 */
export interface INativeResourceAvailable {
  readonly status: 'available';
  readonly modulePath: string;
  readonly coreVersion: string;
  readonly abiVersion: number;
  /** 资源域类型化消费面（15 函数结构接口）。 */
  readonly resource: INativeResourceModule;
}

/** 装载结果不可用态：诚实呈现原因，不伪造消费面。 */
export interface INativeResourceUnavailable {
  readonly status: 'unavailable';
  readonly reason: NativeResourceUnavailableReason;
  readonly modulePath: string;
  /** 简体中文诊断（逐项点名缺位导出，防静默降级）。 */
  readonly detail: string;
}

/** 原生绑定资源域装载结果。 */
export type INativeResourceBinding = INativeResourceAvailable | INativeResourceUnavailable;

/**
 * 生产产物默认路径：与解析域同一模块文件（单一内核，§11.5）——
 * `packages/host/native/chips-native.node`。
 */
export function defaultNativeResourceModulePath(platformRoot: string): string {
  return defaultNativeDocumentParserModulePath(platformRoot);
}

/** 不可用结果构造器。 */
function unavailable(
  reason: NativeResourceUnavailableReason,
  modulePath: string,
  detail: string,
): INativeResourceUnavailable {
  return { status: 'unavailable', reason, modulePath, detail };
}

/**
 * 装载并校验 `chips-native.node` 的资源域消费面（§11.3 十五导出 + §8.6 元信息两项）。
 *
 * @remarks 判定顺序与 `loadNativeDocumentParserBinding` / `loadNativeBridgeBinding` 逐字同构：
 * 文件存在 → 加载成功且导出为对象 → 17 项必备导出全部在位且为函数（缺位逐项点名，
 * 当前产物零资源导出的形态在此判 `surface-mismatch`）→ `coreVersion` / `coreAbiVersion`
 * 合法且 ABI 等值。任一步失败即返回对应原因，全部通过才交付类型化消费面。
 * 本函数不抛错、不降级：调用方（组合根）按 `status` 如实呈现装载判据。
 */
export function loadNativeResourceBinding(modulePath: string): INativeResourceBinding {
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

  const missing = NATIVE_RESOURCE_REQUIRED_EXPORTS.filter((name) => typeof moduleValue[name] !== 'function');
  if (missing.length > 0) {
    return unavailable(
      'surface-mismatch',
      modulePath,
      `§11.3 必备导出缺位或非函数：${missing.join('、')}（疑似旧构建产物，请重新构建 @chips/native）`,
    );
  }
  const loadedModule = moduleValue as unknown as INativeResourceModule & {
    coreVersion(): unknown;
    coreAbiVersion(): unknown;
  };

  let coreVersion: unknown;
  let abiVersion: unknown;
  try {
    coreVersion = loadedModule.coreVersion();
    abiVersion = loadedModule.coreAbiVersion();
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
  if (abiVersion !== NATIVE_RESOURCE_ABI_VERSION) {
    return unavailable(
      'abi-mismatch',
      modulePath,
      `coreAbiVersion()=${String(abiVersion)} 与宿主期望 ${String(NATIVE_RESOURCE_ABI_VERSION)} 不等`,
    );
  }

  return { status: 'available', modulePath, coreVersion, abiVersion, resource: loadedModule };
}
