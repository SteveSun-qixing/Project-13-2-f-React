/**
 * `chips-native` 文档解析域导出的宿主侧类型视图与装载闸
 * （《核心接口规范》§6.4、§8.6；《06-文档解析器设计》§12.1、§12.2；工单034）。
 *
 * 权威：`05-接口与契约/03.06-核心接口规范-六、文档解析入口` §6.4「Neon 导出」表
 * （13 项冻结名含 §6.6 的 `buildDocumentView`，加工单034 两项正式化名共 15 行）与
 * 《06-文档解析器设计》§12.1 十四项表（§6.4 去掉 `buildDocumentView` 的同一张面的机械投影）；
 * 调用约定与错误形状以
 * §12.2 为准（异步导出、`ChipsError` 同构 `Error`、`JsBox` 不透明句柄、GC 终结器兜底）。
 *
 * @remarks
 * - 零依赖结构视图：`@chips/host` 与 `@chips/native` 无运行时依赖边（架构边界，与
 *   `src/main/native-bridge.ts` 的镜像模式同构）；本模块镜像与
 *   `packages/native/abi/export-surface.json`、`packages/native/types/chips-native.d.ts`
 *   及契约文档 §6.4 表的三方一致性由 `tests/document-native-parser-adapter.test.ts` 单点锁定。
 * - 注入面 = 13 项 §6.4 冻结名 + 工单034 两项正式化名（`documentRevision`、
 *   `documentLayoutConfig`，按 §12.1「访问器与 Rust 方法一一对应、命名 camelCase」规则
 *   自 `DocumentHandle::revision()` / `layout_config()` 机械导出，主智能体裁决②修正后
 *   已落 `packages/native` 第 33/34 项导出；文档三面逐行落文在册——§12.1 表（06.12 分件
 *   v1.0.3，`documentReadResource` 行与 §12.2 值映射条两处 `Buffer` 已随 #107 清尾
 *   核正为 `Uint8Array`）、§6.4 表（03.06 分件 v1.0.3，`documentReadResource` 返回类型已随任务 #101
 *   核正为 `Promise<Uint8Array>`）、§8.6 总表（03.08 分件 v1.0.2，四行合计 34 项与
 *   `export-surface.json` 逐项一致），三表各补两行随任务 #98（提交 f84ad1b23）落文，
 *   表解析锁随跨单合缝（提交 06aa8b576）收紧为全集面比对（§6.4 表 15 项、
 *   §12.1 表 14 项）。
 *   `IDocumentParserPort` 的源指纹臂与箱子布局臂没有这两项即
 *   无原生载体（宿主侧自行做 `.card`/`.box` 字节解析违反工单015 红线，且「快速指纹
 *   不读取资源字节」（《11-文档服务设计》§5.5）禁止宿主读字节复算），故装载闸把两项与
 *   13 项冻结名同口径要求全部在位（fail-closed）：任何按旧表（13 项或 33 项产物）构建、
 *   缺任一正式化名的产物在装载点即被判 `surface-mismatch` 并逐项点名缺位导出，
 *   杜绝静默降级。
 * - 导出表只增不改（§8.6）：判定按「必备名全部在位」，不要求全等集合；后续域扩展不影响
 *   既有判定。签名变化递增 `coreAbiVersion`，与宿主期望 `NATIVE_DOCUMENT_PARSER_ABI_VERSION`
 *   不等即 `abi-mismatch`。
 * - 产物落位与 Bridge 域同一模块文件：`packages/host/native/chips-native.node`
 *   （Node 模块缓存保证同一 `.node` 进程级单例，两个装载闸共享同一内核）。
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/**
 * 文档解析域宿主期望的绑定 ABI 版本（`packages/native/abi/export-surface.json` 的
 * `abiVersion` 结构视图；§8.6 规则「删除或改签名才递增」）。与 Bridge 域
 * `NATIVE_BRIDGE_ABI_VERSION` 同源同值（单一内核一个 ABI 计数），双源不漂移由契约锁用例兜住。
 */
export const NATIVE_DOCUMENT_PARSER_ABI_VERSION = 1;

/**
 * §6.4 冻结的文档解析域导出名（13 项，含 §6.6 视图构建器）。键名逐字对齐契约表。
 */
export const NATIVE_DOCUMENT_PARSER_FROZEN_EXPORTS = [
  'openDocument',
  'openCard',
  'openBox',
  'documentMetadata',
  'documentStructure',
  'documentContent',
  'documentEntries',
  'documentReadResource',
  'documentValidate',
  'buildDocumentView',
  'documentClose',
  'createCancelToken',
  'cancelTokenCancel',
] as const;

/**
 * 工单034 正式化名（2 项）：§12.1「访问器与 Rust 方法一一对应」的两项
 * `DocumentHandle::revision()` / `layout_config()` 机械导出名。主智能体裁决
 * （工单034 期望行为三项，①②）已裁定正式化，`packages/native` 已落第 33/34 项
 * 导出（`CORE_ABI_VERSION` 不 bump，新增不破坏）；本清单与 13 项冻结名同口径
 * 进入装载闸。文档三面（§12.1 / §6.4 / §8.6）补行已在册落文：任务 #98（提交
 * f84ad1b23）三表各补两行（06.12 分件 v1.0.3 / 03.06 分件 v1.0.3 / 03.08 分件
 * v1.0.1），本文件面的表解析锁随跨单合缝（提交 06aa8b576）收紧为全集面比对
 * （§6.4 表 15 项、§12.1 表 14 项）。
 */
export const NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS = ['documentRevision', 'documentLayoutConfig'] as const;

/**
 * 工单036 波 C3 存储序列化名（1 项）：RFC 点位四 D3「序列化载体」导出名。
 * backing = `chips-parser::serialize::serialize_document`（波 C1 纯函数），保存时刻由
 * 调用方单源交付（`savedAtUnixMs`）。文档表（§6.4 15 行 / §12.1 14 行）为冻结原文
 * 且文档库随动归主批，本名以「镜像尾段」形态补登：装载闸 fail-closed 全集面含本名
 * （旧 15+2 名产物在此判 `surface-mismatch`，杜绝静默降级），文档表原文锁对既有
 * 15 名维持**前缀锁**（恰等锁候主批落文后机械复原）。
 */
export const NATIVE_DOCUMENT_PARSER_STORAGE_EXPORTS = ['documentSerialize'] as const;

/**
 * 装载闸要求的解析域导出名集合（13 冻结 + 2 正式化 + 1 存储序列化，共 16 项）。
 * 元信息两项（`coreVersion` / `coreAbiVersion`）另见 {@link NATIVE_DOCUMENT_PARSER_REQUIRED_META_EXPORTS}。
 */
export const NATIVE_DOCUMENT_PARSER_SURFACE_EXPORTS = [
  ...NATIVE_DOCUMENT_PARSER_FROZEN_EXPORTS,
  ...NATIVE_DOCUMENT_PARSER_FORMALIZED_EXPORTS,
  ...NATIVE_DOCUMENT_PARSER_STORAGE_EXPORTS,
] as const;

/** 装载闸要求的元信息导出名（§8.6 元信息域两项，与 native-bridge 装载闸同判据）。 */
export const NATIVE_DOCUMENT_PARSER_REQUIRED_META_EXPORTS = ['coreVersion', 'coreAbiVersion'] as const;

/** 装载闸必备导出全集（元信息 2 + 解析域 16）；缺任一即 `surface-mismatch`。 */
export const NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS = [
  ...NATIVE_DOCUMENT_PARSER_REQUIRED_META_EXPORTS,
  ...NATIVE_DOCUMENT_PARSER_SURFACE_EXPORTS,
] as const;

/**
 * 不透明文档句柄的宿主侧视图（`JsBox<DocumentHandle>` 的 JS 投影；
 * 与 `packages/native/types/chips-native.d.ts` 的 `DocumentHandle` 同构品牌，不暴露内部结构）。
 */
export interface INativeDocumentHandle {
  readonly nativeDocumentHandleBrand: 'chips-native.document';
}

/** 不透明取消令牌句柄（§12.2；当前 15 项导出的传参位缺口由工单034 第三项跟踪）。 */
export interface INativeCancelTokenHandle {
  readonly nativeCancelTokenHandleBrand: 'chips-native.cancel-token';
}

/**
 * 解析选项（《核心接口规范》§6.1 `ParseOptions` 的 JS 侧 camelCase 形状）；
 * 适配器一律不传（回落 `ParseOptions::default`），仅在注入面按 §6.4 签名保留槽位。
 */
export interface INativeParseOptions {
  strict?: boolean;
  repair?: boolean;
  verifyHashes?: boolean;
  parallelism?: number;
  limits?: Record<string, unknown>;
}

/** 解析诊断（《06-文档解析器设计》§12.3 `Diagnostic` 同构；与壳侧 `IDocumentDiagnostic` 逐字段一致）。 */
export interface INativeDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  file?: string;
  pointer?: string;
  line?: number;
  column?: number;
  hint?: string;
}

/** 文档格式判别（与 backing `DocumentKind` 序列化逐字一致）。 */
export type INativeDocumentKindValue = 'card' | 'box';

/** 统一结果信封（§12.1 / §6.4：`{ kind, value, diagnostics }`，`kind` 为判别字段）。 */
export interface INativeDocumentEnvelope<TValue> {
  kind: INativeDocumentKindValue;
  value: TValue;
  diagnostics: INativeDiagnostic[];
}

/** L0 元数据结果（`value` 为 `CardMetadata` / `BoxMetadata` 的 snake_case 投影）。 */
export type INativeMetadataResult = INativeDocumentEnvelope<Record<string, unknown>>;

/** L1 结构结果。 */
export type INativeStructureResult = INativeDocumentEnvelope<Record<string, unknown>>;

/** L2 内容节点结果（`value` 为解析器内容节点投影，壳侧不解释）。 */
export type INativeContentResult = INativeDocumentEnvelope<Record<string, unknown>>;

/** L2 条目分页窗口（§12.1 `{ offset, limit }` 项数语义；端口 range 逐字转发）。 */
export interface INativeEntriesRange {
  offset: number;
  limit: number;
}

/** L3 资源字节窗口（§12.1 `{ offset, length }`；本适配器不消费 `documentReadResource`）。 */
export interface INativeResourceRange {
  offset: number;
  length: number;
}

/** L2 条目分页结果（卡片句柄调用以契约错误拒绝）。 */
export type INativeEntriesResult = INativeDocumentEnvelope<Record<string, unknown>[]>;

/** 箱子布局配置结果（工单034 正式化名 `documentLayoutConfig`：`layout_config()` 的信封投影）。 */
export type INativeLayoutConfigResult = INativeDocumentEnvelope<Record<string, unknown>>;

/** 严格校验报告（《06-文档解析器设计》§6.5 `ValidationReport` 投影；本适配器不消费，仅冻结签名）。 */
export interface INativeValidationReport {
  kind: INativeDocumentKindValue;
  chip_standards_version: string;
  status: 'valid' | 'validwithwarnings' | 'invalid';
  statistics: {
    member_count: number;
    yaml_bytes: number;
    resource_count: number;
    entry_count: number;
    uncompressed_bytes: number;
  };
  diagnostics: INativeDiagnostic[];
}

/** 文档视图（§6.6 `DocumentView = CardRenderView | BoxRenderView` 的壳侧不透明投影；渲染路由 Rust 侧构建器消费）。 */
export type INativeDocumentView = Record<string, unknown>;

/**
 * 序列化请求（工单036 波 C3，`IDocumentSerializeRequest` 同构 camelCase 形状；
 * 与 `packages/native/types/chips-native.d.ts` 的 `INativeDocumentSerializeRequest` 逐字同构，
 * 零依赖结构视图不 import 其类型）。
 */
export interface INativeDocumentSerializeRequest {
  readonly kind: 'card' | 'box';
  readonly form: 'directory' | 'archive';
  readonly localPath: string;
  readonly metadata: unknown;
  readonly structure: unknown;
  readonly contents: readonly { readonly nodeId: string; readonly value: unknown }[];
  readonly layoutConfig: unknown;
  readonly changedParts: readonly string[];
  readonly removedNodeIds: readonly string[];
}

/** 序列化产出的包内成员（`IDocumentSerializedMember` 同构；字节为 `Buffer` 交付的 `Uint8Array` 投影）。 */
export interface INativeSerializedMember {
  readonly packagePath: string;
  readonly bytes: Uint8Array;
}

/** 源指纹成员（工单034 冻结形状：`modifiedMillis`/`crc32` 对应 Rust `Option` → `null`）。 */
export interface INativeSourceMember {
  path: string;
  size: number;
  modifiedMillis: number | null;
  crc32: number | null;
}

/**
 * 修订与源指纹结果（工单034 正式化名 `documentRevision`：`DocumentHandle::revision()` 的
 * JS 投影，形状逐字按工单任务说明「期望行为」第 1 项冻结）。
 */
export interface INativeDocumentRevision {
  source: {
    kind: 'directory' | 'archive';
    members: readonly INativeSourceMember[];
  };
  chipStandardsVersion: string;
  indexDigest: string;
}

/**
 * 文档解析域注入面（16 函数结构接口）：调用方（组合根，刀4）经
 * {@link loadNativeDocumentParserBinding} 或直接构造兼容对象注入；本工单不做生产接线。
 * 键名、参数位次、返回形状逐字对齐 §6.4 / §12.1 表（含两正式化名的冻结形状）。
 */
export interface INativeDocumentParserModule {
  /** 打开并解析到 L0（自动识别 `.card` / `.box`，§6.2）。 */
  openDocument(path: string, options?: INativeParseOptions): Promise<INativeDocumentHandle>;
  /** 严格 card 入口；形状与错误语义同 `openDocument`。 */
  openCard(path: string, options?: INativeParseOptions): Promise<INativeDocumentHandle>;
  /** 严格 box 入口；形状与错误语义同 `openDocument`。 */
  openBox(path: string, options?: INativeParseOptions): Promise<INativeDocumentHandle>;
  /** L0 元数据（打开时冻结，常数时间）+ 诊断快照。 */
  documentMetadata(handle: INativeDocumentHandle): Promise<INativeMetadataResult>;
  /** L1 结构与引用索引（首次访问触发解析）+ 诊断快照。 */
  documentStructure(handle: INativeDocumentHandle): Promise<INativeStructureResult>;
  /** L2 单个内容节点；`nodeId` 为 10 位 Base62 编号。 */
  documentContent(handle: INativeDocumentHandle, nodeId: string): Promise<INativeContentResult>;
  /** L2 条目分页读取（箱子句柄）。 */
  documentEntries(handle: INativeDocumentHandle, range?: INativeEntriesRange): Promise<INativeEntriesResult>;
  /** L3 资源字节窗口（本适配器不消费；端口无对应臂，签名冻结在案）。 */
  documentReadResource(handle: INativeDocumentHandle, path: string, range?: INativeResourceRange): Promise<Uint8Array>;
  /** 严格校验报告（本适配器不消费；签名冻结在案）。 */
  documentValidate(handle: INativeDocumentHandle): Promise<INativeValidationReport>;
  /** 文档视图构建器（§6.6；渲染路消费，本适配器不消费，签名冻结在案）。 */
  buildDocumentView(handle: INativeDocumentHandle, session: number): Promise<INativeDocumentView>;
  /** 显式释放归档映射；幂等，未关闭时由 GC 终结器兜底（§12.2）。 */
  documentClose(handle: INativeDocumentHandle): Promise<void>;
  /** 创建取消令牌（传参位缺口由工单034 第三项跟踪；本适配器仅声明面）。 */
  createCancelToken(): INativeCancelTokenHandle;
  /** 触发取消；幂等（本适配器仅声明面）。 */
  cancelTokenCancel(token: INativeCancelTokenHandle): void;
  /** 修订与源指纹（工单034 正式化名；`DocumentHandle::revision()`）。 */
  documentRevision(handle: INativeDocumentHandle): Promise<INativeDocumentRevision>;
  /** 箱子布局配置（工单034 正式化名；`DocumentHandle::layout_config()`，卡片句柄误用按契约码拒绝）。 */
  documentLayoutConfig(handle: INativeDocumentHandle): Promise<INativeLayoutConfigResult>;
  /**
   * 序列化变更成员与依赖成员（工单036 波 C3 存储序列化名；算法权威
   * `chips-parser::serialize`，`savedAtUnixMs` 为保存时刻 `Date.now()` 形）。
   * 产出成员按包内路径升序、字节以 `Buffer` 交付；解析域契约码原样透传。
   */
  documentSerialize(
    request: INativeDocumentSerializeRequest,
    savedAtUnixMs: number,
  ): Promise<readonly INativeSerializedMember[]>;
}

/** 装载失败原因（fail-closed 四分面；与 `native-bridge.ts` 同构语义）。 */
export type NativeDocumentParserUnavailableReason =
  /** 产物文件不存在（未构建或落位漂移）。 */
  | 'module-missing'
  /** 文件存在但加载抛错（损坏、平台不匹配、依赖缺失）。 */
  | 'load-failed'
  /** 加载成功但必备导出缺位或非函数（旧产物 / 面漂移，含工单034 正式化名缺位形态）。 */
  | 'surface-mismatch'
  /** 导出在位但 `coreAbiVersion()` 与宿主期望不等或取值非法（ABI 漂移）。 */
  | 'abi-mismatch';

/** 装载结果可用态：类型化解析域消费面 + 元信息快照。 */
export interface INativeDocumentParserAvailable {
  readonly status: 'available';
  readonly modulePath: string;
  readonly coreVersion: string;
  readonly abiVersion: number;
  /** 解析域类型化消费面（16 函数结构接口）。 */
  readonly parser: INativeDocumentParserModule;
}

/** 装载结果不可用态：诚实呈现原因，不伪造消费面。 */
export interface INativeDocumentParserUnavailable {
  readonly status: 'unavailable';
  readonly reason: NativeDocumentParserUnavailableReason;
  readonly modulePath: string;
  /** 简体中文诊断（逐项点名缺位导出，防静默降级）。 */
  readonly detail: string;
}

/** 原生绑定解析域装载结果。 */
export type INativeDocumentParserBinding = INativeDocumentParserAvailable | INativeDocumentParserUnavailable;

/**
 * 生产产物默认路径：`<platformRoot>/../../native/chips-native.node`
 * （与 `native-bridge.ts` 的 `defaultNativeBridgeModulePath` 同落位口径）。
 */
export function defaultNativeDocumentParserModulePath(platformRoot: string): string {
  return resolve(platformRoot, '..', '..', 'native', 'chips-native.node');
}

/** 不可用结果构造器。 */
function unavailable(
  reason: NativeDocumentParserUnavailableReason,
  modulePath: string,
  detail: string,
): INativeDocumentParserUnavailable {
  return { status: 'unavailable', reason, modulePath, detail };
}

/**
 * 装载并校验 `chips-native.node` 的文档解析域消费面（§8.6 元信息 + §6.4/工单034 解析域）。
 *
 * @remarks 判定顺序与 `loadNativeBridgeBinding` 同构：文件存在 → 加载成功且导出为对象 →
 * 18 项必备导出全部在位且为函数（13 冻结 + 2 正式化 + 1 存储序列化 + 元信息 2；旧 13 项产物与
 * 缺任一正式化名的 33 项产物在此被判
 * `surface-mismatch` 并逐项点名）→ `coreVersion` / `coreAbiVersion` 合法且 ABI 等值。
 * 任一步失败即返回对应原因，全部通过才交付类型化消费面。
 */
export function loadNativeDocumentParserBinding(modulePath: string): INativeDocumentParserBinding {
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

  const missing = NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS.filter((name) => typeof moduleValue[name] !== 'function');
  if (missing.length > 0) {
    return unavailable(
      'surface-mismatch',
      modulePath,
      `§6.4/工单034 必备导出缺位或非函数：${missing.join('、')}（疑似旧构建产物，请重新构建 @chips/native）`,
    );
  }
  const parser = moduleValue as unknown as INativeDocumentParserModule & {
    coreVersion(): unknown;
    coreAbiVersion(): unknown;
  };

  let coreVersion: unknown;
  let abiVersion: unknown;
  try {
    coreVersion = parser.coreVersion();
    abiVersion = parser.coreAbiVersion();
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
  if (abiVersion !== NATIVE_DOCUMENT_PARSER_ABI_VERSION) {
    return unavailable(
      'abi-mismatch',
      modulePath,
      `coreAbiVersion()=${String(abiVersion)} 与宿主期望 ${String(NATIVE_DOCUMENT_PARSER_ABI_VERSION)} 不等`,
    );
  }

  return { status: 'available', modulePath, coreVersion, abiVersion, parser };
}
