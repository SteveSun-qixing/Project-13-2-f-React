/**
 * `DocumentView` 文档视图构建器正式绑定（渲染层，W2 金链路刀3 / 集成缝 1）。
 *
 * 权威：
 * - `05-渲染引擎设计` §2.6（构建器输入 `DocumentHandle` + `SessionId`、执行位主进程（Rust 核心）、
 *   无自有缓存、`revision` 前进触发重建、同句柄同修订输出确定）；
 * - `03-核心接口规范` §6.4「Neon 导出」表（`buildDocumentView(handle, session)`、
 *   `documentReadResource(handle, path, range?)` 的导出名与参数位次逐字冻结）与 §6.6
 *   （`DocumentView = CardRenderView | BoxRenderView` 九导出类型、只读快照、可结构化克隆、
 *   资源引用保持文件原样）；
 * - 错误还原：backing 抛出的 `IChipsError` 同构错误经 `@chips/bridge` `normalizeError` 单点还原为
 *   唯一类 `ChipsError`（工单024 裁定；`preload/bridge.ts` 波 E 直连先例、刀2
 *   `adapters/native-parser.ts` 同款），backing 契约码（`DOCUMENT_*` / `RESOURCE_*`）透传不发明；
 *   非该形状的异常归一 `BRIDGE_INTERNAL`，绑定层契约违约以 `createBridgeError(internal, …)` 呈现。
 *
 * @remarks
 * - 注入面：`INativeDocumentViewModule` 是 §6.4 两消费臂的宿主本地结构镜像（零依赖边，
 *   不 import `packages/native` 源码路径；句柄品牌与
 *   `capabilities/document/adapters/native-parser-module.ts` 的 `INativeDocumentHandle` 同构，
 *   生产装载交付的模块对象结构兼容）。生产接线（装载 + `resolveSession` 绑定文档服务会话）
 *   属刀4 组合根职责；本模块不做装载判定。
 * - 端口形状：实现 `render-engine.ts` 的 `IDocumentViewBuilder.buildView({source, documentId, kind})`
 *   消费形态；§2.6 规定的原生输入（`DocumentHandle` + 数值会话）经 {@link DocumentViewSessionResolver}
 *   适配层逐调用解析（文档面漂移已登记工单035，以文档为准：本实现最终逐字调用
 *   `buildDocumentView(handle, sessionId)`）。
 * - 无自有缓存（§2.6）：模块零状态；每次 `buildView` 都完整触达 backing 一次，
 *   确定性由「同一解析句柄 + 同一会话模型在同一 `revision` 下产生相同视图」的后端保证承载。
 * - 句柄生命周期归文档服务（`IDocumentSessionStore` 记录级共享）；本构建器不打开、不关闭句柄。
 * - 交付面：卡片视图（端口返回 `ICardRenderView`）；箱子视图（`BoxRenderView`/`BoxCoverView`）
 *   随箱子渲染波次开通，此前 `kind !== 'card'` 以 `BRIDGE_INVALID_INPUT` 拒绝。
 * - 视图守门（§6.6 规则 3）：返回前逐字段按 §6.6 冻结形状校验并做可结构化克隆深校验
 *   （函数、`Symbol`、非纯数据原型、循环引用、非有限数值一律以 `BRIDGE_INTERNAL` 违约拒绝），
 *   校验后按冻结字段投影重建——不透明值（`DocumentValue`）原样保留、不解释插件专有语义、
 *   不读取资源字节、不拼接资源 URI（§2.6 构建规则）。
 * - 资源臂（`documentReadResource`）：视图内资源引用保持文件原样（§6.6 规则 4，包内相对路径或
 *   R13 受管 URI）；本臂负责把受管 URI 经 `06-资源协议规范` §2.6 归一为包内路径后逐位交
 *   backing——引用归一的语义权威在文档解析器，本臂只做语法归一与越权拦截
 *   （跨作用域 `RESOURCE_CROSS_SCOPE`、external 起源 `RESOURCE_NOT_SUPPORTED`）。
 */

import { BRIDGE_ERROR_CODES, ChipsError, createBridgeError, normalizeError } from '@chips/bridge';

import type { DocumentKind } from '../capabilities/document/contract.js';
import { normalizeResourceInput } from '../protocol/resource-uri.js';
import type { ResourceUriParseSuccess } from '../protocol/resource-uri.js';
import type { FrameTagView, ICardRenderView } from './frame-protocol.js';
import type { IDocumentViewBuilder } from './render-engine.js';

/**
 * §6.4 冻结的视图构建域消费导出名（本绑定消费的臂；名字与参数位次逐字对齐导出表）。
 */
export const NATIVE_DOCUMENT_VIEW_FROZEN_EXPORTS = ['buildDocumentView', 'documentReadResource'] as const;

/**
 * 不透明文档句柄的宿主侧视图（`JsBox<DocumentHandle>` 的 JS 投影；品牌与
 * `adapters/native-parser-module.ts` 的 `INativeDocumentHandle` 同构，生产模块对象结构兼容）。
 */
export interface INativeDocumentViewHandle {
  readonly nativeDocumentHandleBrand: 'chips-native.document';
}

/**
 * L3 资源字节窗口（§12.1 `{ offset, length }` 字节语义；与刀2 注入面同名同形）。
 */
export interface INativeDocumentViewResourceRange {
  offset: number;
  length: number;
}

/**
 * 视图构建域注入面（§6.4 两消费臂的宿主本地结构接口；DI 注入，不 import
 * `packages/native` 源码路径）。键名、参数位次、返回形状逐字对齐 §6.4 表。
 */
export interface INativeDocumentViewModule {
  /** 文档视图构建器（§6.6：字段投影 + 不透明值保留，产出可结构化克隆 `DocumentView`）。 */
  buildDocumentView(handle: INativeDocumentViewHandle, session: number): Promise<Record<string, unknown>>;
  /** L3 资源字节窗口（解析阶段永不读取资源正文；渲染按需经本臂触达）。 */
  documentReadResource(
    handle: INativeDocumentViewHandle,
    path: string,
    range?: INativeDocumentViewResourceRange
  ): Promise<Uint8Array>;
}

/** {@link IDocumentViewBuilder.buildView} 的输入形状（与 `render-engine.ts` 端口逐字段一致）。 */
export interface IDocumentViewBuildInput {
  readonly source: string;
  readonly documentId: string;
  readonly kind: DocumentKind;
}

/** 会话绑定结果：原生句柄 + 数值会话 + 文档受管作用域（读资源臂的越权拦截依据）。 */
export interface IDocumentViewSessionBinding {
  /** 文档记录当前只读解析句柄（主进程侧由文档服务持有；本构建器不打开、不关闭）。 */
  readonly handle: INativeDocumentViewHandle;
  /** 数值会话标识（§6.4 `session: number`；string↔u64 漂移在册——工单035 / 插件执行通道 RFC O3）。 */
  readonly sessionId: number;
  /** 文档登记的受管作用域 ID（`chips-resource://<scope>/…` 的 scope 段，归一后小写形态）。 */
  readonly managedScope: string;
}

/**
 * 会话解析入口（刀4 组合根接线位：文档服务 → `IDocumentSessionStore` 记录句柄与会话模型）。
 * 解析失败以已登记码抛出，由本构建器经 `normalizeError` 还原后原样上抛。
 */
export type DocumentViewSessionResolver = (input: IDocumentViewBuildInput) => Promise<IDocumentViewSessionBinding>;

/** 视图构建器资源臂请求（`reference` 为视图内原样引用：包内相对路径或 R13 受管 URI）。 */
export interface IDocumentViewResourceRequest extends IDocumentViewBuildInput {
  /** 视图内的资源引用（§6.6 规则 4：保持文件原样，本臂不改写视图、只做读取归一）。 */
  readonly reference: string;
  /** 字节窗口（§12.1 `{ offset, length }`；缺省整读）。 */
  readonly range?: INativeDocumentViewResourceRange;
}

/** 构建器服务面：渲染管线消费的 {@link IDocumentViewBuilder} + 资源准备阶段的按需读取臂。 */
export interface IDocumentViewBuilderService extends IDocumentViewBuilder {
  /** 经注入面 `documentReadResource` 读取包内资源字节（URI 语法归一 + 越权拦截）。 */
  readResource(request: IDocumentViewResourceRequest): Promise<Uint8Array>;
}

/** 构建器创建选项（全部依赖注入；本模块零全局状态、零自有缓存）。 */
export interface IDocumentViewBuilderOptions {
  /** §6.4 视图构建域注入面（生产由刀4 组合根经装载闸交付；测试注入替身）。 */
  readonly native: INativeDocumentViewModule;
  /** 会话解析入口（文档服务会话模型 → 原生句柄 + 数值会话）。 */
  readonly resolveSession: DocumentViewSessionResolver;
}

/** 资源域已登记码（`06-资源协议规范` §7.2 子集；本臂只引用登记码，不自造码）。 */
const RESOURCE_CODE = {
  pathInvalid: 'RESOURCE_PATH_INVALID',
  notSupported: 'RESOURCE_NOT_SUPPORTED',
  crossScope: 'RESOURCE_CROSS_SCOPE',
} as const;

/** 外部起源判定（`06-资源协议规范` §2.6：裸 `http(s)://` 归一为 external 作用域）。 */
const EXTERNAL_SCOPE = 'external';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** backing / 解析入口调用的错误还原单点（§12.2 + 工单024：同构形状原样还原，其余归一 `BRIDGE_INTERNAL`）。 */
async function attempt<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error: unknown) {
    throw normalizeError(error);
  }
}

/** 绑定层契约违约（注入面缺位 / 返回形状非法）：归一 `BRIDGE_INTERNAL`，不发明码。 */
function contractViolation(source: string, reason: string, extra?: Record<string, unknown>): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.internal, {
    message: '视图构建绑定返回的数据形状不符合契约',
    details: { source, reason, ...(extra ?? {}) },
  });
}

/* ------------------------------------------------------------------ *
 * §6.6 冻结形状守门（可结构化克隆深校验 + 字段投影）
 * ------------------------------------------------------------------ */

/** 当前递归路径上的对象集合（循环引用检测；共享 DAG 允许，结构化克隆本身允许共享）。 */
type ActivePath = Set<unknown>;

/**
 * 可结构化克隆深校验（§6.6 规则 3：不得包含句柄、函数、类实例、`Symbol`、循环引用与文件字节）。
 * 通过校验的值按「纯数据」对待：仅 `null` / 有限数值 / 字符串 / 布尔 / 纯数组 / 纯对象。
 */
function assertCloneableValue(value: unknown, path: string, active: ActivePath): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw contractViolation('buildDocumentView', '视图含非有限数值', { path });
    }
    return;
  }
  if (typeof value !== 'object') {
    // `undefined` / `function` / `symbol` / `bigint`：均非视图合法载荷（`DocumentValue` 出自 YAML 投影）。
    throw contractViolation('buildDocumentView', '视图含非纯数据成员', { path, type: typeof value });
  }
  if (active.has(value)) {
    throw contractViolation('buildDocumentView', '视图含循环引用', { path });
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw contractViolation('buildDocumentView', '视图含数组类实例', { path });
    }
    active.add(value);
    value.forEach((item, index) => {
      if (item === undefined) {
        throw contractViolation('buildDocumentView', '数组元素为 undefined', { path: `${path}[${String(index)}]` });
      }
      assertCloneableValue(item, `${path}[${String(index)}]`, active);
    });
    active.delete(value);
    return;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    // 类实例 / `Uint8Array`（文件字节不入视图）/ `Map`/`Set` 等一律违约。
    throw contractViolation('buildDocumentView', '视图含非普通对象（类实例或二进制）', { path });
  }
  active.add(value);
  for (const [key, item] of Object.entries(value)) {
    assertCloneableValue(item, `${path}.${key}`, active);
  }
  active.delete(value);
}

/** 校验并原样保留不透明值（`DocumentValue` → 普通对象/数组/标量；不解释语义、不回填）。 */
function asOpaqueValue(value: unknown, path: string): Record<string, unknown> {
  assertCloneableValue(value, path, new Set<unknown>());
  return value as Record<string, unknown>;
}

/** 精确键集校验（§6.6 冻结字段：多一字段即绑定面漂移，拒绝而非忽略）。 */
function assertExactKeys(record: Record<string, unknown>, expected: readonly string[], what: string): void {
  const actual = Object.keys(record).sort();
  const want = [...expected].sort();
  if (actual.length !== want.length || actual.some((key, index) => key !== want[index])) {
    throw contractViolation('buildDocumentView', `${what} 字段集与 §6.6 冻结形状不一致`, {
      actual: actual.join(','),
      expected: want.join(','),
    });
  }
}

/** 非空字符串校验。 */
function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw contractViolation('buildDocumentView', `字段 ${field} 不是非空字符串`);
  }
  return value;
}

/** 可空字符串校验（`CoverView` 等窄形状用）。 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw contractViolation('buildDocumentView', `字段 ${field} 不是字符串`);
  }
  return value;
}

/** `TagView[]`（§6.6：`TagView = string | string[]`，与 metadata.yaml 口径一致）。 */
function asTagViews(value: unknown): readonly FrameTagView[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw contractViolation('buildDocumentView', 'tags 不是数组');
  }
  return value.map((item: unknown, index: number): FrameTagView => {
    if (typeof item === 'string') {
      return item;
    }
    if (Array.isArray(item)) {
      const entries: readonly unknown[] = item;
      if (entries.every((entry) => typeof entry === 'string')) {
        return entries.filter((entry): entry is string => typeof entry === 'string');
      }
    }
    throw contractViolation('buildDocumentView', 'tags 成员不是 TagView', { index });
  });
}

/** `CoverView`（§6.6：`{ entry, ratio }`）。 */
function asCoverView(value: unknown, path: string): ICardRenderView['cover'] {
  if (!isRecord(value)) {
    throw contractViolation('buildDocumentView', `${path} 不是对象`);
  }
  assertCloneableValue(value, path, new Set<unknown>());
  assertExactKeys(value, ['entry', 'ratio'], path);
  return { entry: requireNonEmptyString(value['entry'], `${path}.entry`), ratio: requireString(value['ratio'], `${path}.ratio`) };
}

/**
 * 卡片视图逐字段守门（§6.6 `CardRenderView` 冻结形状）：判别字段、修订、卡片级上下文、
 * 封面与内容节点逐项校验后按冻结字段投影重建；不透明值原样保留。
 */
function guardCardRenderView(view: unknown): ICardRenderView {
  if (!isRecord(view)) {
    throw contractViolation('buildDocumentView', '视图根不是对象');
  }
  assertExactKeys(
    view,
    ['kind', 'revision', 'card_id', 'name', 'chip_standards_version', 'cover_ratio', 'tags', 'cover', 'content_nodes'],
    'CardRenderView'
  );
  if (view['kind'] !== 'card') {
    // §2.1：链路分支点在 `DocumentKind`；当前交付面端口返回卡片视图，非 card 判别即形状违约。
    throw contractViolation('buildDocumentView', '视图 kind 判别不是 card', { kind: String(view['kind']) });
  }
  const revision = view['revision'];
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) {
    throw contractViolation('buildDocumentView', 'revision 不是非负安全整数（u64 传输越界按后端码拒绝）');
  }
  const nodes = view['content_nodes'];
  if (!Array.isArray(nodes) || Object.getPrototypeOf(nodes) !== Array.prototype) {
    throw contractViolation('buildDocumentView', 'content_nodes 不是数组');
  }
  const contentNodes = nodes.map((node: unknown, index: number) => {
    if (!isRecord(node)) {
      throw contractViolation('buildDocumentView', 'content_nodes 成员不是对象', { index });
    }
    assertExactKeys(node, ['node_id', 'card_type', 'content'], `content_nodes[${String(index)}]`);
    const content = node['content'];
    if (!isRecord(content)) {
      throw contractViolation('buildDocumentView', '内容节点 content 不是映射', { index });
    }
    return {
      node_id: requireNonEmptyString(node['node_id'], `content_nodes[${String(index)}].node_id`),
      card_type: requireNonEmptyString(node['card_type'], `content_nodes[${String(index)}].card_type`),
      content: asOpaqueValue(content, `content_nodes[${String(index)}].content`),
    };
  });
  return {
    kind: 'card',
    revision,
    card_id: requireNonEmptyString(view['card_id'], 'card_id'),
    name: requireString(view['name'], 'name'),
    chip_standards_version: requireNonEmptyString(view['chip_standards_version'], 'chip_standards_version'),
    cover_ratio: requireString(view['cover_ratio'], 'cover_ratio'),
    tags: asTagViews(view['tags']),
    cover: asCoverView(view['cover'], 'cover'),
    content_nodes: contentNodes,
  };
}

/* ------------------------------------------------------------------ *
 * 资源引用归一（§6.6 规则 4：视图保持原样；本臂只做读取前的语法归一）
 * ------------------------------------------------------------------ */

/** 资源域已登记码的构造（简体中文消息；码本体全部在册，不发明）。 */
function resourceError(code: (typeof RESOURCE_CODE)[keyof typeof RESOURCE_CODE], message: string, details?: Record<string, unknown>): ChipsError {
  return new ChipsError({ code, message, retryable: false, ...(details === undefined ? {} : { details }) });
}

/** 包内相对路径语法校验（`02-箱子文件格式` §一：`/` 分隔、禁 `..`、前导 `/`、反斜杠与控制字符）。 */
function normalizePackagePath(reference: string): string {
  if (reference.length === 0 || reference.includes('\\') || reference.startsWith('/')) {
    throw resourceError(RESOURCE_CODE.pathInvalid, '资源引用不是合法包内路径', { reason: 'empty-or-absolute' });
  }
  for (const segment of reference.split('/')) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      throw resourceError(RESOURCE_CODE.pathInvalid, '资源引用不是合法包内路径', { reason: 'bad-segment' });
    }
    for (const character of segment) {
      const codePoint = character.codePointAt(0);
      if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
        throw resourceError(RESOURCE_CODE.pathInvalid, '资源引用不是合法包内路径', { reason: 'control' });
      }
    }
  }
  return reference;
}

/** 受管 URI 归一（`chips-resource://<scope>/<包内路径>`；external 与跨作用域一律拒绝）。 */
function packagePathFromManagedUri(parsed: ResourceUriParseSuccess, binding: IDocumentViewSessionBinding): string {
  if (parsed.scope === EXTERNAL_SCOPE) {
    throw resourceError(
      RESOURCE_CODE.notSupported,
      '外部起源资源不经文档句柄读取（由渲染帧与资源管理器直连通路承载）',
      { reason: 'external-origin' }
    );
  }
  if (parsed.scope !== binding.managedScope) {
    throw resourceError(RESOURCE_CODE.crossScope, '资源引用跨越本文档受管作用域', {
      expected: binding.managedScope,
      actual: parsed.scope,
    });
  }
  if (parsed.path.length === 0) {
    throw resourceError(RESOURCE_CODE.pathInvalid, '受管资源 URI 缺少包内路径段', { reason: 'empty-path' });
  }
  return parsed.path;
}

/** 把视图内原样引用归一为 backing `documentReadResource` 的包内路径。 */
function normalizeResourceReference(request: IDocumentViewResourceRequest, binding: IDocumentViewSessionBinding): string {
  if (request.reference.length === 0) {
    throw resourceError(RESOURCE_CODE.pathInvalid, '资源引用为空', { reason: 'empty' });
  }
  if (!request.reference.includes('://')) {
    return normalizePackagePath(request.reference);
  }
  const parsed = normalizeResourceInput(request.reference);
  if (parsed.ok === false) {
    // URI 语法码（`RESOURCE_INVALID_URI` / `RESOURCE_UNSUPPORTED_SCHEME` / `RESOURCE_PATH_INVALID`）
    // 均为 §7.2 登记码：原样透传，不发明映射。
    throw new ChipsError({
      code: parsed.code,
      message: '资源引用归一失败：URI 语法非法',
      retryable: false,
      details: { reason: parsed.reason, ...(parsed.pathReason === undefined ? {} : { pathReason: parsed.pathReason }) },
    });
  }
  return packagePathFromManagedUri(parsed, binding);
}

/** 字节窗口校验（§12.1 `{ offset, length }`：非负安全整数）。 */
function validatedRange(range: INativeDocumentViewResourceRange | undefined): INativeDocumentViewResourceRange | undefined {
  if (range === undefined) {
    return undefined;
  }
  if (
    !Number.isSafeInteger(range.offset) ||
    range.offset < 0 ||
    !Number.isSafeInteger(range.length) ||
    range.length < 0
  ) {
    throw createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
      message: '资源字节窗口非法：offset/length 必须为非负安全整数',
      details: { range },
    });
  }
  return { offset: range.offset, length: range.length };
}

/** 会话绑定校验（句柄对象 + 数值会话 + 归一作用域；非法即拒绝，不触达 backing）。 */
function guardBinding(binding: unknown, resolverName: string): IDocumentViewSessionBinding {
  if (!isRecord(binding)) {
    throw contractViolation(resolverName, '会话绑定结果不是对象');
  }
  if (typeof binding['handle'] !== 'object' || binding['handle'] === null) {
    throw contractViolation(resolverName, '会话绑定缺少解析句柄');
  }
  const sessionId: unknown = binding['sessionId'];
  if (typeof sessionId !== 'number' || !Number.isSafeInteger(sessionId) || sessionId < 0) {
    // §6.4 `session: number`（u64 语义）：非负安全整数是 JS 侧合法传输的硬边界。
    throw createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
      message: '视图构建拒绝：会话标识不是非负安全整数',
      details: { sessionId: typeof sessionId === 'number' ? sessionId : String(sessionId) },
    });
  }
  const managedScope: unknown = binding['managedScope'];
  if (typeof managedScope !== 'string' || managedScope.length === 0) {
    throw contractViolation(resolverName, '会话绑定缺少受管作用域');
  }
  return {
    handle: binding['handle'] as INativeDocumentViewHandle,
    sessionId,
    managedScope,
  };
}

/** 输入定位字段校验（`source` / `documentId` 非空；渲染引擎请求校验之外的独立绑定闸）。 */
function guardRequest(input: IDocumentViewBuildInput): void {
  if (typeof input.source !== 'string' || input.source.length === 0) {
    throw createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
      message: '视图构建拒绝：来源 URI 不能为空',
    });
  }
  if (typeof input.documentId !== 'string' || input.documentId.length === 0) {
    throw createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
      message: '视图构建拒绝：文档标识不能为空',
    });
  }
}

/**
 * 构造文档视图构建器（§2.6 正式实现的宿主 TS 绑定；实现 `IDocumentViewBuilder`）。
 *
 * @param options 依赖注入面（`native` 两臂按 §6.4 冻结名逐字校验在位，fail-closed：
 *   缺任一导出即以 `BRIDGE_INTERNAL` 拒绝构造，不静默降级）。
 *
 * @remarks 与刀2 `createNativeDocumentParserPort` 同范式：本函数不做装载判定，装载闸
 * 四分面由调用方（刀4 组合根）执行；构造完成即注入面契约成立，此后全部失败以唯一类
 * `ChipsError` 交付。
 */
export function createDocumentViewBuilder(options: IDocumentViewBuilderOptions): IDocumentViewBuilderService {
  const { native, resolveSession } = options;
  for (const exportName of NATIVE_DOCUMENT_VIEW_FROZEN_EXPORTS) {
    if (typeof native?.[exportName] !== 'function') {
      throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
        message: '视图构建注入面缺少必备导出，拒绝构造（fail-closed）',
        details: { export: exportName },
      });
    }
  }
  if (typeof resolveSession !== 'function') {
    throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
      message: '视图构建注入面缺少会话解析入口，拒绝构造（fail-closed）',
      details: { port: 'resolveSession' },
    });
  }

  /** 逐调用解析会话绑定（无缓存：§2.6 构建器不持有任何跨调用状态）。 */
  async function requireBinding(input: IDocumentViewBuildInput): Promise<IDocumentViewSessionBinding> {
    guardRequest(input);
    let resolved: unknown;
    try {
      resolved = await resolveSession(input);
    } catch (error: unknown) {
      throw normalizeError(error);
    }
    return guardBinding(resolved, 'resolveSession');
  }

  return {
    async buildView(input: IDocumentViewBuildInput): Promise<ICardRenderView> {
      if (input.kind !== 'card') {
        // 当前交付面（§2.4 卡片查看态链路）；箱子视图随箱子渲染波次随端口返回类型开通。
        throw createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
          message: '视图构建拒绝：当前交付面仅支持卡片视图（kind=card）',
          details: { kind: input.kind },
        });
      }
      const binding = await requireBinding(input);
      const view = await attempt(() => native.buildDocumentView(binding.handle, binding.sessionId));
      return guardCardRenderView(view);
    },

    async readResource(request: IDocumentViewResourceRequest): Promise<Uint8Array> {
      const binding = await requireBinding(request);
      const packagePath = normalizeResourceReference(request, binding);
      const range = validatedRange(request.range);
      const bytes = await attempt(() =>
        range === undefined
          ? native.documentReadResource(binding.handle, packagePath)
          : native.documentReadResource(binding.handle, packagePath, range)
      );
      if (!(bytes instanceof Uint8Array)) {
        throw contractViolation('documentReadResource', '资源字节返回值不是 Uint8Array');
      }
      return bytes;
    },
  };
}
