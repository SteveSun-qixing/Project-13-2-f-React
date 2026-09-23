/**
 * `chips-native` 资源域导出（§11.3）的宿主侧类型视图与装载闸
 * （W3-P0-1 段三宿主接线波，任务 #194；《04-资源管理设计》§十一）。
 *
 * 权威：`01-架构设计/01-子系统设计/04.11-04-资源管理设计-十一、Rust ResourceManager 与 Neon 暴露`
 * §11.3「Neon 导出」表（21 行逐字，camelCase 导出名 + 参数位次 + 返回形状）与
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
 * - 导出表只增不改（§8.6）：判定按「§11.3 二十一名 + 元信息两名全部在位」，不要求全等集合；
 *   签名变化递增 `coreAbiVersion`，与宿主期望 `NATIVE_RESOURCE_ABI_VERSION` 不等即
 *   `abi-mismatch`。任一产物在位但缺名即 `surface-mismatch` 并逐项点名，杜绝静默降级。
 * - 产物落位与解析域/Bridge 域同一模块文件：`packages/host/native/chips-native.node`
 *   （Node 模块缓存保证同一 `.node` 进程级单例，三个装载闸共享同一内核与同一
 *   `ResourceManager` 实例，§11.5）。
 * - **本模块只交付消费面，不交付端口适配器**：§11.3 二十一导出承载「已归一资源地址」的
 *   读写面、文档侧载体三项中的两项，点位三 `managedUri ↔ localPath` 双向换算两项，
 *   以及点位五授权注入一项——
 *   ① 作用域注册 / 挂载（`resourceRegisterTempScope` /
 *   `resourceMountDirectory` / `resourceMountArchive` / `resourceUnregisterScope`，波 A1
 *   任务 #209 三补名落位在册，行 16–18）；② 挂载即注册与级联注销的核心形（§11.2 在册）；
 *   ③ `managedUri ↔ localPath` 双向换算（`resourceLocalPathOf` / `resourceManagedUriOfPath`，
 *   行 19–20，波 B 任务 #231 落位在册；宿主消费臂已随工单036 波 B2 任务 #241 经
 *   `adapters/scope-adapter.ts` 接进 `document:*` 能力链路）；
 *   ④ 会话授权注入（`resourceGrantSession`，行 21，点位五 D1 任务 #244 落位在册，
 *   第 56 导出；宿主消费拍已随点位五 D2 任务 #249 经 `adapters/scope-adapter.ts`
 *   `registerScope` 的 grant 拍接线——文档服务建会话成功即注入 `resources:write`）。
 *   仍未承载的一项——跨成员原子提交与落盘序列化（`resourceCommitWrite` 为单成员一次
 *   写入，无包级事务面；序列化归点位四后续波，金链路刀6 裁决）——故
 *   `IDocumentScopePort` / `IDocumentStoragePort` 的正式适配器在该载体落地前**不得**
 *   以「部分实现」形态拼装（工单 036 禁止内存替身与临时实现；正式 scope 适配器与
 *   `DOCUMENT_SCOPE_OWNER` 常量注入归波 A2b），装载段维持诚实回退。
 *   孤儿常驻 scope 生命周期（文档域 `close_session` 不自动脱绑、最后绑定会话关闭后
 *   归属闸恒拒 `RESOURCE_PERMISSION_DENIED`）的裁定归波 A2b，本处如实登记现状。
 *   本模块闸判据即剩余载体的宿主侧接收面：导出落位即 `available`，端口适配器随
 *   A2b 接线（消费名清单随波机械补登，本波 #212 三名翻正即该承接的执行形态）。
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
 * §11.3「Neon 导出」表的 21 个导出名（逐字镜像，表行序即数组序；
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
  'resourceMountDirectory',
  'resourceMountArchive',
  'resourceUnregisterScope',
  'resourceLocalPathOf',
  'resourceManagedUriOfPath',
  'resourceGrantSession',
] as const;

/** 装载闸要求的元信息导出名（§8.6 元信息域两项，与解析域 / Bridge 域装载闸同判据）。 */
export const NATIVE_RESOURCE_REQUIRED_META_EXPORTS = ['coreVersion', 'coreAbiVersion'] as const;

/** 装载闸必备导出全集（元信息 2 + 资源域 21，共 23 项）；缺任一即 `surface-mismatch`。 */
export const NATIVE_RESOURCE_REQUIRED_EXPORTS = [
  ...NATIVE_RESOURCE_REQUIRED_META_EXPORTS,
  ...NATIVE_RESOURCE_SURFACE_EXPORTS,
] as const;

/**
 * 不透明写入流句柄（§11.3 `resourceCommitWriteStream` 返回 `WriteStreamHandle`）。
 *
 * 逐字段形状取《04-资源管理设计》§11.3「JS 投影形状冻结表」表二（任务 #204
 * 臂③落册权威，工单046 段四接线波 host 批承接翻正，任务 #205）：
 * `{ id, uri, append, commit, abort }` 闭包对象五成员恒在；`commit` / `abort`
 * 为互斥一次性收口通道（重复调用 `RESOURCE_NOT_FOUND`），对象被 GC 回收且
 * 仍未收口时由绑定层兜底中止清理（零残留）。
 */
export interface INativeWriteStreamHandle {
  /** 写流句柄 ID（低于 2^53）。 */
  readonly id: number;
  /** 目标资源规范 URI（错误回执与审计定位）。 */
  readonly uri: string;
  /** 分块送入（背压承载：不送入即不推进）。 */
  append(bytes: Uint8Array): Promise<void>;
  /** 原子提交并返回新版本元数据（《03.07》§7.3 在册形状）。 */
  commit(): Promise<INativeResourceMetadata>;
  /** 主动中止并清理临时文件（零残留）。 */
  abort(): Promise<void>;
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
 * 目录条目（§11.3 `resourceListDirectory` 返回 `DirectoryEntry[]`）。
 *
 * 逐字段形状取《04-资源管理设计》§11.3「JS 投影形状冻结表」表一（任务 #204
 * 臂③落册权威，工单046 段四接线波 host 批承接翻正，任务 #205）：四字段恒在
 * （`name` / `isDirectory` / `size` / `modifiedUnixSeconds`，Unix 秒、不可得为
 * `0`）；数值腿由绑定层 `json_to_js` 的 2^53 闸把关（越界
 * `NATIVE_VALUE_OUT_OF_RANGE` 拒绝，不产生部分构造对象）。
 */
export interface INativeDirectoryEntry {
  /** 条目名（单层名，非路径）。 */
  readonly name: string;
  /** 是否目录（归档态按成员路径前缀合成）。 */
  readonly isDirectory: boolean;
  /** 字节大小（归档态合成目录行为 `0`）。 */
  readonly size: number;
  /** 修改时间（Unix 秒；不可得为 `0`；合成目录行为 `0`）。 */
  readonly modifiedUnixSeconds: number;
}

/** `resourceOpen` 返回（§11.3 表逐字：`{ handleId, metadata }`）。 */
export interface INativeResourceOpenResult {
  handleId: number;
  metadata: INativeResourceMetadata;
}

/**
 * 资源域注入面（21 函数结构接口）：键名、参数位次、返回形状逐字对齐 §11.3 表。
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
  /** 列举目录（§4.10 / §11.3 行 8；元素形状见 §11.3 JS 投影形状冻结表表一）。 */
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
  /**
   * 挂载目录域 Document 作用域（§11.3 行 16：注册 + 挂根 + 绑会话一体，失败全量回滚，
   * 返回规范 `ScopeId`）。`owner` 取 `DOCUMENT_SCOPE_OWNER` 哨兵
   * （`chips.official.document-service`，OQ-7 波 A1 定案，定义与注入归波 A2b）。
   */
  resourceMountDirectory(
    sessionId: number,
    scope: string,
    path: string,
    owner: string,
    writable: boolean,
  ): Promise<string>;
  /**
   * 挂载归档域 Document 作用域（§11.3 行 17：只读强制，索引构建失败整体回滚，
   * 返回规范 `ScopeId`）。`owner` 同目录挂载行哨兵口径。
   */
  resourceMountArchive(sessionId: number, scope: string, path: string, owner: string): Promise<string>;
  /**
   * 注销常驻作用域（§11.3 行 18：级联失效句柄/流/缓存，§11.2 注销级联口径；
   * 幂等性依核心实读——未在册核心形 `RESOURCE_NOT_FOUND`；绑定层前置会话归属闸，
   * 跨会话绑定形 `RESOURCE_PERMISSION_DENIED`）。
   */
  resourceUnregisterScope(scope: string, sessionId: number): Promise<void>;
  /**
   * 受管 URI → 本地绝对路径（点位三正向，§11.3 行 19）：复用核心 URI 解析与路径守卫
   * 单源；会话未绑定目标作用域时 `RESOURCE_PERMISSION_DENIED`，Memory/Http/Platform
   * 来源无本地路径返回 `RESOURCE_NOT_SUPPORTED`，归档 scope 恒返回归档文件路径。
   */
  resourceLocalPathOf(uri: string, sessionId: number): Promise<string>;
  /**
   * 本地绝对路径 → 受管 URI（点位三反向，§11.3 行 20）：符号链 canonical 化后按最长
   * 前缀匹配；未命中（路径不存在/未挂载/会话未绑定）一律返回 `null`，不报错、不区分成因。
   */
  resourceManagedUriOfPath(path: string, sessionId: number): Promise<string | null>;
  /**
   * 会话授权注入（点位五 D1，§11.3 行 21，任务 #244 落位）：幂等并入会话权限集，
   * 权限字符串零语法判定全量透传，空数组为合法 no-op。owner 非
   * `chips.official.document-service` 哨兵一律 `RESOURCE_PERMISSION_DENIED`
   * （target 仅 `chips-resource://session/<id>`，零真实路径），不存在会话
   * fail-closed `RESOURCE_NOT_FOUND`；不改动会话已绑定作用域集。
   * @remarks 本成员在此仅随装载闸薄镜像（与 `packages/native` 表位次一致）；
   * 宿主消费拍（文档链路授权调用位）已随点位五 D2 任务 #249 在
   * `adapters/scope-adapter.ts` `registerScope` 流程接线（open 成功紧邻同拍、先于挂载分叉，
   * 被拒即回收会话如实抛出，RFC 裁定J §七）。
   */
  resourceGrantSession(sessionId: number, permissions: readonly string[]): void;
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
  /** 资源域类型化消费面（21 函数结构接口）。 */
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
 * 装载并校验 `chips-native.node` 的资源域消费面（§11.3 二十一导出 + §8.6 元信息两项）。
 *
 * @remarks 判定顺序与 `loadNativeDocumentParserBinding` / `loadNativeBridgeBinding` 逐字同构：
 * 文件存在 → 加载成功且导出为对象 → 23 项必备导出全部在位且为函数（缺位逐项点名，
 * 旧构建产物零资源导出的形态在此判 `surface-mismatch`）→ `coreVersion` / `coreAbiVersion`
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
