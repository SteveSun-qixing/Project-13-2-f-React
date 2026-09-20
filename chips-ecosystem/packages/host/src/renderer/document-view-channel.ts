/**
 * 宿主内部取视图通道契约面（壳渲染进程 RenderHost ↔ 主进程，请求/响应信封、判别联合与校验闸）。
 *
 * 定位（主智能体 2026-09-21 裁定，权威落文在途）：视图构建执行位 = 主进程——Neon
 * `buildDocumentView` 仅主进程可达，句柄 `JsBox` 投影不跨进程、数值会话不出主进程；壳渲染进程
 * RenderHost 的 `buildView({source, documentId, kind})`（`render-engine.ts`
 * `IDocumentViewBuilder` 端口形状）经本通道消费 `DocumentView`。本通道是**宿主内部 IPC**
 * （Electron `ipcRenderer.invoke` / `ipcMain.handle` 形态的单请求通道），不是插件能力：
 * 无 capability ID、不进 Bridge 能力注册表、不经 `window.chips` 链路，权限判定不适用
 * （R19 面向插件；本通道两端均为平台自身代码）。
 *
 * 权威：
 * - `05-渲染引擎设计` §2.3（跨进程时序：解析请求与 `DocumentView` 回传发生在渲染进程 ↔ 主进程
 *   之间）、§2.5（渲染视图模型消费字段与只读/可结构化克隆约束）、§2.6（构建器执行位主进程、
 *   输入句柄+会话、无自有缓存、确定性）；
 * - `03-核心接口规范` §6.6（`DocumentView = CardRenderView | BoxRenderView` 冻结形状、
 *   可结构化克隆、资源引用保持文件原样）；
 * - `02-Bridge三层设计` §9.1/§9.2（错误归一与 `BRIDGE_*` 通道级码表、retryable 口径）；
 * - `11-文档服务设计` §十（`DOCUMENT_*` 会话与写入错误码）；`06-文档解析器设计` §8.2
 *   （解析域登记码 `DOCUMENT_NOT_FOUND` / `DOCUMENT_PARSE_CANCELLED`）；
 * - `05-ID生成规范` §二.1、§七.1（稳定文档标识 = `card_id` / `box_id` 统一别名，
 *   `^[0-9A-Za-z]{10}$` 十位 Base62——本文件 `documentId` 闸按该在册口径执行；
 *   工单035 任务说明中「11 字符」表述与在册口径不符，已随本单开发日志反馈）；
 * - `04-能力契约规范` §6.3 / §十一（`additionalProperties: false` 精确键集纪律、
 *   `<DOMAIN>_<REASON>` 已登记码词法形态）；
 * - 工单035（端口 `{source, documentId, kind}` 与 §2.6 句柄+会话输入的漂移登记；
 *   本通道即漂移裁定的消费侧承载：句柄与数值会话全程留在主进程，跨进程只过本信封）。
 *
 * @remarks
 * - 本文件是**契约完整体而非实现**：消息封套字段、判别联合、两侧校验闸与错误面在册映射全部
 *   完备；不承载 IPC 注册、传输、超时、订阅或任何运行时副作用（纯类型 + 纯函数，可安全
 *   import 于主/渲染任一侧）。接线实现归属：主进程侧通道注册与构建链绑定归刀4（组合根，
 *   与 `DocumentViewSessionResolver` 生产化同位）；渲染进程侧 `RenderHost` 消费实现与
 *   `renderer/index.ts` 导出面随动归刀5。
 * - 判别规则：请求臂 `type = 'document-view:build'`；响应臂二选一——成功
 *   `'document-view:result'`（携带守门后的 `ICardRenderView`）或失败
 *   `'document-view:error'`（携带 `IChipsError` 跨边界普通对象形态）。封套键集精确
 *   （§6.3 同口径纪律：多一字段即两端契约漂移，确定性拒绝而非忽略）。
 * - 校验闸码映射（全部在册码，零自造）：请求面（不可信输入闸）一律
 *   `BRIDGE_INVALID_INPUT`；响应面（主进程回包契约闸，与刀3 `contractViolation` 同口径）
 *   一律 `BRIDGE_INTERNAL`；失败臂错误码限本通道在册错误面
 *   {@link DOCUMENT_VIEW_CHANNEL_ERROR_CODES}，面外已登记码经
 *   {@link normalizeDocumentViewChannelError} 归一 `BRIDGE_INTERNAL`（`details.cause`
 *   承载原码用于诊断，不采信面外语义）。
 * - `kind` 形状闸接受 §2.1 唯一分支点判别联合全体（`card` / `box`）；`box` 请求在主进程
 *   构建侧按当前交付面以 `BRIDGE_INVALID_INPUT` 诚实拒绝（刀3 `document-view-builder.ts`
 *   在册闸，箱子视图随箱子渲染波次开通），本通道不提前承载该拒绝。
 * - 交付面：本通道回包视图形状与 `render-engine.ts` 端口返回一致为 `ICardRenderView`
 *   （§6.6 联合的卡片支）；资源臂（`documentReadResource`）与 `host:update` 回流订阅不进
 *   本通道契约（资源读取归资源通路，回流编排归刀5）。
 */

import { BRIDGE_ERROR_CODES, ChipsError, createBridgeError, isChipsError, normalizeError } from '@chips/bridge';
import type { IChipsError } from '@chips/bridge';

import { DOCUMENT_BUSINESS_ERROR_CODES, DOCUMENT_PARSER_ERROR_CODES } from '../capabilities/document/errors.js';
import type { DocumentKind } from '../capabilities/document/contract.js';
import type { FrameTagView, ICardRenderView } from './frame-protocol.js';

/* ------------------------------------------------------------------ *
 * 通道常量
 * ------------------------------------------------------------------ */

/** 通道协议版本号；升级走版本号协商（与帧协议同纪律，禁止特性探测式分支）。 */
export const DOCUMENT_VIEW_PROTOCOL = 'chips-document-view/1';

/**
 * 通道名（宿主内部 IPC invoke 通道；插件不可见、不可订阅）。通道注册（`ipcMain.handle`）
 * 归刀4 组合根，本常量是其唯一名字来源。
 */
export const DOCUMENT_VIEW_REQUEST_CHANNEL = 'document-view:request';

/** 消息类型判别字面量集合（信封 `type` 字段全部合法取值）。 */
export const DOCUMENT_VIEW_MESSAGE_TYPES = {
  build: 'document-view:build',
  result: 'document-view:result',
  error: 'document-view:error',
} as const;

/** 信封 `type` 联合。 */
export type DocumentViewMessageType = (typeof DOCUMENT_VIEW_MESSAGE_TYPES)[keyof typeof DOCUMENT_VIEW_MESSAGE_TYPES];

/**
 * 通道 `kind` 形状闸取值（§2.1：链路分支点唯一，`DocumentKind = 'card' | 'box'` 全体为
 * 形状合法值；当前交付面在主进程构建侧仅受理 `card`，见文件头注）。
 */
export const DOCUMENT_VIEW_CHANNEL_KINDS: readonly DocumentKind[] = ['card', 'box'];

/**
 * 稳定文档标识闸（`05-ID生成规范` §二.1、§七.1 在册口径：十位 Base62、大小写精确、
 * 与宿主 `capabilities/document/validation.ts` `MEMBER_ID_PATTERN` 及 chips-parser
 * `is_base62_id` 三方同字面）。
 */
const DOCUMENT_ID_PATTERN = /^[0-9A-Za-z]{10}$/;

/** 已登记错误码词法形态（`04-能力契约规范` §11.1：`<DOMAIN>_<REASON>` 全大写下划线）。 */
const REGISTERED_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/* ------------------------------------------------------------------ *
 * 通道在册错误面（全部引用在册码表常量，零自造）
 * ------------------------------------------------------------------ */

/**
 * 本通道错误面：主进程构建链（通道闸 → 刀3 构建器 → 会话解析 → 文档服务/§6.4 注入面）
 * 可能如实交付到回包的全部登记码。
 *
 * - `BRIDGE_*`：`02-Bridge三层设计` §9.2 通道级码表（经 `@chips/bridge`
 *   `BRIDGE_ERROR_CODES` 常量引用）——`invalidInput`（请求闸与构建器 kind/定位字段闸）、
 *   `sessionUnknown` / `timeout` / `cancelled`（主进程链路的会话与在途取消面）、
 *   `internal`（绑定契约违约与面外码归一）；
 * - `DOCUMENT_*`：`11-文档服务设计` §十 会话域码（`notOpen` / `sourceChanged` /
 *   `idConflict` / `metadataInvalid` / `structureInvalid`）与 `06-文档解析器设计` §8.2
 *   解析域码（`formatUnknown` / `notFound` / `parseCancelled`）——构建链的会话解析与
 *   backing 触达可如实透传；保存/写入域码（`saveFailed` / `writeConflict` /
 *   `partUnsupported`）在本链路构造性不可达，不入面。
 */
export const DOCUMENT_VIEW_CHANNEL_ERROR_CODES = {
  invalidInput: BRIDGE_ERROR_CODES.invalidInput,
  sessionUnknown: BRIDGE_ERROR_CODES.sessionUnknown,
  timeout: BRIDGE_ERROR_CODES.timeout,
  cancelled: BRIDGE_ERROR_CODES.cancelled,
  internal: BRIDGE_ERROR_CODES.internal,
  notOpen: DOCUMENT_BUSINESS_ERROR_CODES.notOpen,
  sourceChanged: DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged,
  idConflict: DOCUMENT_BUSINESS_ERROR_CODES.idConflict,
  metadataInvalid: DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid,
  structureInvalid: DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
  formatUnknown: DOCUMENT_PARSER_ERROR_CODES.formatUnknown,
  /** 解析句柄不存在或已释放（`06-文档解析器设计` §8.2 登记码；backing 抛码原样透传）。 */
  notFound: 'DOCUMENT_NOT_FOUND',
  /** 构建在途取消（`06-文档解析器设计` §8.2 登记码，retryable 在册为 true）。 */
  parseCancelled: 'DOCUMENT_PARSE_CANCELLED',
} as const;

/** 本通道在册错误码联合。 */
export type DocumentViewChannelErrorCode = (typeof DOCUMENT_VIEW_CHANNEL_ERROR_CODES)[keyof typeof DOCUMENT_VIEW_CHANNEL_ERROR_CODES];

const DOCUMENT_VIEW_CHANNEL_ERROR_CODE_SET: ReadonlySet<string> = new Set<string>(Object.values(DOCUMENT_VIEW_CHANNEL_ERROR_CODES));

/** 判断错误码是否属于本通道在册错误面。 */
export function isDocumentViewChannelErrorCode(value: string): value is DocumentViewChannelErrorCode {
  return DOCUMENT_VIEW_CHANNEL_ERROR_CODE_SET.has(value);
}

/* ------------------------------------------------------------------ *
 * 信封与判别联合（全部可结构化克隆的纯数据形状）
 * ------------------------------------------------------------------ */

/**
 * 通道请求输入面——与 `render-engine.ts` `IDocumentViewBuilder.buildView` 端口输入及刀3
 * `IDocumentViewBuildInput` 逐字段同形（端口 → 通道 → 主进程构建器全链同一形状）。
 */
export interface IDocumentViewChannelInput {
  readonly source: string;
  readonly documentId: string;
  readonly kind: DocumentKind;
}

/** 构建请求（壳渲染进程 → 主进程）。 */
export interface IDocumentViewBuildRequest {
  readonly protocol: typeof DOCUMENT_VIEW_PROTOCOL;
  readonly type: typeof DOCUMENT_VIEW_MESSAGE_TYPES.build;
  /** 调用关联标识（请求侧铸造、回包原样携带；形状闸为非空字符串）。 */
  readonly requestId: string;
  readonly input: IDocumentViewChannelInput;
}

/** 构建成功回包（主进程 → 壳渲染进程；`view` 为主进程守门后、本侧再守门的冻结形状视图）。 */
export interface IDocumentViewBuildResult {
  readonly protocol: typeof DOCUMENT_VIEW_PROTOCOL;
  readonly type: typeof DOCUMENT_VIEW_MESSAGE_TYPES.result;
  readonly requestId: string;
  readonly view: ICardRenderView;
}

/** 构建失败回包（`error` 为 `IChipsError` 跨边界普通对象形态，码限本通道在册错误面）。 */
export interface IDocumentViewBuildFailure {
  readonly protocol: typeof DOCUMENT_VIEW_PROTOCOL;
  readonly type: typeof DOCUMENT_VIEW_MESSAGE_TYPES.error;
  readonly requestId: string;
  readonly error: IChipsError;
}

/** 响应判别联合（成功/失败两臂）。 */
export type DocumentViewBuildResponse = IDocumentViewBuildResult | IDocumentViewBuildFailure;

/** 通道消息判别联合（三臂全表）。 */
export type DocumentViewChannelMessage = IDocumentViewBuildRequest | DocumentViewBuildResponse;

/* ------------------------------------------------------------------ *
 * 构造器（纯函数；形状权威在两侧校验闸，不做隐式修补）
 * ------------------------------------------------------------------ */

/**
 * 构造构建请求（不加形状校验：与帧协议 `createFrameEnvelope` 同纪律，跨进程载荷的权威闸在
 * 接收端 {@link validateDocumentViewChannelRequest}；发送侧自检属刀5 消费实现职责）。
 */
export function createDocumentViewBuildRequest(
  requestId: string,
  input: IDocumentViewChannelInput
): IDocumentViewBuildRequest {
  return { protocol: DOCUMENT_VIEW_PROTOCOL, type: DOCUMENT_VIEW_MESSAGE_TYPES.build, requestId, input };
}

/**
 * 构造成功回包（`view` 应为 {@link guardDocumentViewCardRenderView} 守门后的投影；本函数
 * 不重复深校验，守门时点归主进程发送侧实现——刀4）。
 */
export function createDocumentViewBuildResult(requestId: string, view: ICardRenderView): IDocumentViewBuildResult {
  return { protocol: DOCUMENT_VIEW_PROTOCOL, type: DOCUMENT_VIEW_MESSAGE_TYPES.result, requestId, view };
}

/**
 * 构造失败回包（发送侧错误面纪律单点：任意异常经 {@link normalizeDocumentViewChannelError}
 * 映射为在册码后以 `toPlain()` 普通对象形态入包——跨边界不得传输 `Error` 实例，
 * `01-Bridge-API规范` §2.5 在册口径）。
 */
export function createDocumentViewBuildFailure(requestId: string, error: unknown): IDocumentViewBuildFailure {
  return {
    protocol: DOCUMENT_VIEW_PROTOCOL,
    type: DOCUMENT_VIEW_MESSAGE_TYPES.error,
    requestId,
    error: normalizeDocumentViewChannelError(error).toPlain(),
  };
}

/** 判别响应成功臂。 */
export function isDocumentViewBuildResult(response: DocumentViewBuildResponse): response is IDocumentViewBuildResult {
  return response.type === DOCUMENT_VIEW_MESSAGE_TYPES.result;
}

/** 判别响应失败臂。 */
export function isDocumentViewBuildFailure(response: DocumentViewBuildResponse): response is IDocumentViewBuildFailure {
  return response.type === DOCUMENT_VIEW_MESSAGE_TYPES.error;
}

/* ------------------------------------------------------------------ *
 * 错误面映射（在册码单点）
 * ------------------------------------------------------------------ */

/**
 * 任意异常 → 本通道在册错误面 `ChipsError`（错误归一，`02-Bridge三层设计` §9.1 + 工单024
 * 唯一类语义）：
 *
 * - `normalizeError` 先行：`ChipsError` 实例原样返回、`IChipsError` 同构普通对象还原、
 *   `AbortError` 归 `BRIDGE_CANCELLED`、未识别异常归 `BRIDGE_INTERNAL`；
 * - 还原后码在 {@link DOCUMENT_VIEW_CHANNEL_ERROR_CODES} 面内 → 原样透传（不发明映射）；
 * - 面外码（含他域登记码如 `RESOURCE_*` / `RENDER_*` 出现在本链路，即接线漂移）→
 *   归一 `BRIDGE_INTERNAL`，`details.cause` 承载符合词法的原码用于诊断；词法不合规的码
 *   不入 `details`（不采信不可信字符串）。
 */
export function normalizeDocumentViewChannelError(error: unknown): ChipsError {
  const normalized = normalizeError(error);
  if (isDocumentViewChannelErrorCode(normalized.code)) {
    return normalized;
  }
  return createBridgeError(BRIDGE_ERROR_CODES.internal, {
    message: '视图取回通道错误面收到非本通道在册码',
    ...(REGISTERED_CODE_PATTERN.test(normalized.code) ? { details: { cause: normalized.code } } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * 拒绝构造（两侧闸的码映射单点）
 * ------------------------------------------------------------------ */

/** 请求闸拒绝（不可信输入 → `BRIDGE_INVALID_INPUT`；`details` 只承载结构化诊断）。 */
function rejectRequest(field: string, reason: string): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
    message: '视图取回请求非法',
    details: { gate: 'request', field, reason },
  });
}

/** 响应闸拒绝（主进程回包契约违约 → `BRIDGE_INTERNAL`，刀3 `contractViolation` 同口径）。 */
function rejectResponse(reason: string, extra?: Record<string, unknown>): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.internal, {
    message: '视图取回回包的数据形状不符合契约',
    details: { gate: 'response', reason, ...(extra ?? {}) },
  });
}

/* ------------------------------------------------------------------ *
 * 形状守卫基础件（与刀3 `document-view-builder.ts` 私有守卫同形状口径——§6.6 冻结
 * 字段的消费侧镜像；两处互不 import，权威各自指向 §6.6 原文）
 * ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `DocumentKind` 判别闸（§2.1 唯一分支点；类型谓词供 `unknown` 收敛）。 */
function isDocumentViewChannelKind(value: unknown): value is DocumentKind {
  return value === 'card' || value === 'box';
}

/** 当前递归路径上的对象集合（循环引用检测；共享 DAG 允许，结构化克隆本身允许共享）。 */
type ActivePath = Set<unknown>;

/**
 * 可结构化克隆深校验（§2.5/§6.6 规则 3：不得包含句柄、函数、类实例、`Symbol`、循环引用与
 * 文件字节；经 IPC 已实际克隆过一轮，本闸防御构造性漂移）。
 */
function assertWireCloneable(value: unknown, path: string, active: ActivePath): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw rejectResponse('视图含非有限数值', { path });
    }
    return;
  }
  if (typeof value !== 'object') {
    // `undefined` / `function` / `symbol` / `bigint`：均非视图合法载荷（`DocumentValue` 出自 YAML 投影）。
    throw rejectResponse('视图含非纯数据成员', { path, type: typeof value });
  }
  if (active.has(value)) {
    throw rejectResponse('视图含循环引用', { path });
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw rejectResponse('视图含数组类实例', { path });
    }
    active.add(value);
    value.forEach((item, index) => {
      if (item === undefined) {
        throw rejectResponse('数组元素为 undefined', { path: `${path}[${String(index)}]` });
      }
      assertWireCloneable(item, `${path}[${String(index)}]`, active);
    });
    active.delete(value);
    return;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    // 类实例 / `Uint8Array`（文件字节不入视图）/ `Map`/`Set` 等一律违约。
    throw rejectResponse('视图含非普通对象（类实例或二进制）', { path });
  }
  active.add(value);
  for (const [key, item] of Object.entries(value)) {
    assertWireCloneable(item, `${path}.${key}`, active);
  }
  active.delete(value);
}

/** 精确键集校验（§6.6 冻结字段：多一字段即两端契约漂移，拒绝而非忽略）。 */
function assertWireExactKeys(record: Record<string, unknown>, expected: readonly string[], what: string): void {
  const actual = Object.keys(record).sort();
  const want = [...expected].sort();
  if (actual.length !== want.length || actual.some((key, index) => key !== want[index])) {
    throw rejectResponse(`${what} 字段集与 §6.6 冻结形状不一致`, {
      actual: actual.join(','),
      expected: want.join(','),
    });
  }
}

/** 非空字符串校验。 */
function requireWireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw rejectResponse(`字段 ${field} 不是非空字符串`);
  }
  return value;
}

/** 字符串校验（可空串，如 `name` / `cover_ratio`——刀3 守门同口径）。 */
function requireWireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw rejectResponse(`字段 ${field} 不是字符串`);
  }
  return value;
}

/** `TagView[]`（§6.6：`TagView = string | string[]`）。 */
function asWireTagViews(value: unknown): readonly FrameTagView[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw rejectResponse('tags 不是数组');
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
    throw rejectResponse('tags 成员不是 TagView', { index });
  });
}

/** `CoverView`（§6.6：`{ entry, ratio }` 精确两键）。 */
function asWireCoverView(value: unknown, path: string): ICardRenderView['cover'] {
  if (!isRecord(value)) {
    throw rejectResponse(`${path} 不是对象`);
  }
  assertWireCloneable(value, path, new Set<unknown>());
  assertWireExactKeys(value, ['entry', 'ratio'], path);
  return {
    entry: requireWireNonEmptyString(value['entry'], `${path}.entry`),
    ratio: requireWireString(value['ratio'], `${path}.ratio`),
  };
}

/** 校验并原样保留不透明值（`DocumentValue`：不解释语义、不回填、不裁剪）。 */
function asWireOpaqueValue(value: unknown, path: string): Record<string, unknown> {
  assertWireCloneable(value, path, new Set<unknown>());
  return value as Record<string, unknown>;
}

/**
 * 回包视图守门（§6.6 `CardRenderView` 冻结形状消费侧镜像）：判别字段、修订、卡片级上下文、
 * 封面与内容节点逐项校验后按冻结字段投影重建。主进程构建侧已有同形状权威闸（刀3）；本闸
 * 承载通道回包的到达侧防线，两侧互不 import、各自直指 §6.6。
 */
export function guardDocumentViewCardRenderView(view: unknown): ICardRenderView {
  if (!isRecord(view)) {
    throw rejectResponse('视图根不是对象');
  }
  assertWireExactKeys(
    view,
    ['kind', 'revision', 'card_id', 'name', 'chip_standards_version', 'cover_ratio', 'tags', 'cover', 'content_nodes'],
    'CardRenderView'
  );
  if (view['kind'] !== 'card') {
    // 端口返回类型为 §6.6 联合的卡片支；非 card 判别即回包契约违约。
    throw rejectResponse('视图 kind 判别不是 card', { kind: String(view['kind']) });
  }
  const revision = view['revision'];
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) {
    throw rejectResponse('revision 不是非负安全整数');
  }
  const nodes = view['content_nodes'];
  if (!Array.isArray(nodes) || Object.getPrototypeOf(nodes) !== Array.prototype) {
    throw rejectResponse('content_nodes 不是数组');
  }
  const contentNodes = nodes.map((node: unknown, index: number) => {
    if (!isRecord(node)) {
      throw rejectResponse('content_nodes 成员不是对象', { index });
    }
    assertWireExactKeys(node, ['node_id', 'card_type', 'content'], `content_nodes[${String(index)}]`);
    const content = node['content'];
    if (!isRecord(content)) {
      throw rejectResponse('内容节点 content 不是映射', { index });
    }
    return {
      node_id: requireWireNonEmptyString(node['node_id'], `content_nodes[${String(index)}].node_id`),
      card_type: requireWireNonEmptyString(node['card_type'], `content_nodes[${String(index)}].card_type`),
      content: asWireOpaqueValue(content, `content_nodes[${String(index)}].content`),
    };
  });
  return {
    kind: 'card',
    revision,
    card_id: requireWireNonEmptyString(view['card_id'], 'card_id'),
    name: requireWireString(view['name'], 'name'),
    chip_standards_version: requireWireNonEmptyString(view['chip_standards_version'], 'chip_standards_version'),
    cover_ratio: requireWireString(view['cover_ratio'], 'cover_ratio'),
    tags: asWireTagViews(view['tags']),
    cover: asWireCoverView(view['cover'], 'cover'),
    content_nodes: contentNodes,
  };
}

/* ------------------------------------------------------------------ *
 * 两侧权威校验闸
 * ------------------------------------------------------------------ */

/**
 * 请求权威闸（主进程接收端；渲染进程发送前自检可复用同一函数）：封套判别 + 输入形状闸。
 * 全部拒绝以 `BRIDGE_INVALID_INPUT` 交付，`details` 点名闸位、字段与原因。
 */
export function validateDocumentViewChannelRequest(data: unknown): IDocumentViewBuildRequest {
  if (!isRecord(data)) {
    throw rejectRequest('envelope', '请求封套必须是对象');
  }
  assertRequestExactKeys(data, ['protocol', 'type', 'requestId', 'input'], '请求封套');
  if (data['protocol'] !== DOCUMENT_VIEW_PROTOCOL) {
    throw rejectRequest('protocol', '通道协议版本不符');
  }
  if (data['type'] !== DOCUMENT_VIEW_MESSAGE_TYPES.build) {
    throw rejectRequest('type', '消息类型不是构建请求');
  }
  const requestId = data['requestId'];
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw rejectRequest('requestId', 'requestId 必须是非空字符串');
  }
  const input = data['input'];
  if (!isRecord(input)) {
    throw rejectRequest('input', 'input 必须是对象');
  }
  assertRequestExactKeys(input, ['source', 'documentId', 'kind'], 'input');
  const source = input['source'];
  if (typeof source !== 'string' || source.length === 0) {
    // 与刀3 `guardRequest`、渲染引擎 `validateRequest` 同口径：非空字符串闸；
    // URI 语法权威在 `06-资源协议规范` §2.6 与文档服务，通道闸不解析 URI 语法。
    throw rejectRequest('input.source', '来源 URI 必须是非空字符串');
  }
  const documentId = input['documentId'];
  if (typeof documentId !== 'string') {
    throw rejectRequest('input.documentId', 'documentId 必须是字符串');
  }
  if (!DOCUMENT_ID_PATTERN.test(documentId)) {
    throw rejectRequest('input.documentId', 'documentId 不是 10 位 Base62 稳定标识（05-ID生成规范 §二.1）');
  }
  const kind = input['kind'];
  if (!isDocumentViewChannelKind(kind)) {
    throw rejectRequest('input.kind', "kind 必须是 DocumentKind 判别联合成员（'card' | 'box'）");
  }
  return {
    protocol: DOCUMENT_VIEW_PROTOCOL,
    type: DOCUMENT_VIEW_MESSAGE_TYPES.build,
    requestId,
    input: { source, documentId, kind },
  };
}

/** 请求侧精确键集（拒绝以 `BRIDGE_INVALID_INPUT`——请求面码映射单点）。 */
function assertRequestExactKeys(record: Record<string, unknown>, expected: readonly string[], what: string): void {
  const actual = Object.keys(record).sort();
  const want = [...expected].sort();
  if (actual.length !== want.length || actual.some((key, index) => key !== want[index])) {
    throw rejectRequest(what === 'input' ? 'input' : 'envelope', `${what} 字段集与通道契约不一致`);
  }
}

/**
 * 响应权威闸（渲染进程接收端）：封套判别 + 两臂各自守门。
 *
 * - 成功臂：`view` 过 {@link guardDocumentViewCardRenderView}（§6.6 精确键集 + 可结构化克隆
 *   深校验），返回守门重建后的新封套；
 * - 失败臂：`error` 须为 `IChipsError` 同构形状（`isChipsError` 宽进），码经
 *   {@link normalizeDocumentViewChannelError} 在册映射（面外码归一 `BRIDGE_INTERNAL`）；
 * - 全部封套级与形状违例以 `BRIDGE_INTERNAL` 交付（主进程回包违约，非调用方输入问题）。
 */
export function validateDocumentViewChannelResponse(data: unknown): DocumentViewBuildResponse {
  if (!isRecord(data)) {
    throw rejectResponse('响应封套必须是对象');
  }
  if (data['protocol'] !== DOCUMENT_VIEW_PROTOCOL) {
    throw rejectResponse('通道协议版本不符', { field: 'protocol' });
  }
  const type = data['type'];
  if (type !== DOCUMENT_VIEW_MESSAGE_TYPES.result && type !== DOCUMENT_VIEW_MESSAGE_TYPES.error) {
    throw rejectResponse('消息类型不是响应臂（result / error）', { field: 'type' });
  }
  const requestId = data['requestId'];
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw rejectResponse('requestId 必须是非空字符串', { field: 'requestId' });
  }
  if (type === DOCUMENT_VIEW_MESSAGE_TYPES.result) {
    assertResponseExactKeys(data, ['protocol', 'type', 'requestId', 'view']);
    return {
      protocol: DOCUMENT_VIEW_PROTOCOL,
      type: DOCUMENT_VIEW_MESSAGE_TYPES.result,
      requestId,
      view: guardDocumentViewCardRenderView(data['view']),
    };
  }
  assertResponseExactKeys(data, ['protocol', 'type', 'requestId', 'error']);
  const error = data['error'];
  if (!isRecord(error) || !isChipsError(error)) {
    throw rejectResponse('error 载荷不是 IChipsError 同构形状', { field: 'error' });
  }
  return {
    protocol: DOCUMENT_VIEW_PROTOCOL,
    type: DOCUMENT_VIEW_MESSAGE_TYPES.error,
    requestId,
    error: normalizeDocumentViewChannelError(error),
  };
}

/** 响应侧精确键集（拒绝以 `BRIDGE_INTERNAL`——响应面码映射单点）。 */
function assertResponseExactKeys(record: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const want = [...expected].sort();
  if (actual.length !== want.length || actual.some((key, index) => key !== want[index])) {
    throw rejectResponse('响应封套字段集与通道契约不一致', {
      actual: actual.join(','),
      expected: want.join(','),
    });
  }
}
