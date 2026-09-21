/**
 * 卡片窗口装载输入投递契约面（主进程登记表 → 卡片窗口渲染侧的装载输入，请求/响应封套、
 * 判别联合与校验闸；刀7 前置契约，任务 #119 契约先行）。
 *
 * 权威：
 * - 工单035 裁定一（宿主内部通道 = 壳进程↔主进程 IPC 契约：无 capability ID、不进 Bridge
 *   能力注册表、不经 `window.chips` 链路；权限判定不适用——两端均为平台自身代码）与
 *   缝②批准先例（`__chipsHostViewChannel` 第二 contextBridge 世界，键集 `['requestView']`
 *   冻结）——本通道同族承载，但**独立挂载**：新全局键 `CARD_WINDOW_INIT_SURFACE_KEY`、
 *   新世界、新键集，不挤进取视图通道世界、不改动其任何一键（任务 #119 铁律）；
 * - 《05-渲染引擎设计》05.02 §2.3 承载段（`05.02:89`，2026-09-21 主智能体裁定原文：
 *   「窗口感知与装载投递细节归宿主实现，本节只裁承载形态与暴露边界」——本文件即该
 *   宿主实现细节的工程定义冻结，文档无需先行登记本消息）；
 * - 《05-渲染引擎设计》05.09 §9.3 帧生命周期消息在册清单（父帧↔子帧 postMessage 层）：
 *   本通道是窗口级宿主内部 IPC（渲染进程顶层 ↔ 主进程），**不属于帧协议消息面**，与
 *   §9.3 清单零交集由契约测试逐名锁定（漂移闸）；
 * - 《04-能力契约规范》§7.4（`windowId` = `webContents.id`，正安全整数）、§6.3/§十一
 *   （`additionalProperties: false` 精确键集纪律、`<DOMAIN>_<REASON>` 已登记码词法）；
 * - 《02-Bridge三层设计》§9.1/§9.2（错误归一与 `BRIDGE_*` 通道级码表、retryable 口径）；
 * - 《11-文档服务设计》§十（`DOCUMENT_NOT_OPEN` 会话域码——投递臂文档绑定未就绪的
 *   在册拒收码）；《05-ID生成规范》§二.1/§七.1（稳定文档标识 = 十位 Base62）；
 * - `src/main/card-window-orchestrator.ts`（登记表 `ICardWindowRecord{windowId, source,
 *   entryUrl, openedAt}` 为本通道装载输入的权威上游；`source` 词法闸与其
 *   `assertSource`（`card-window-orchestrator.ts:206-230`）同口径镜像）、
 *   `src/main/window-entries.ts`（卡片窗口入口无 query/fragment——文档绑定只能经本通道
 *   投递，装载 URI 不携带文档参数）；
 * - `src/renderer/entries/card.ts` `ICardWindowInit`（消费形状，:79-95）与
 *   `bootCardWindow(initProvider)`（:319，空载等待态语义）：投递封套 `payload` 与其
 *   **逐字段同形**由契约测试编译期互赋锁钉死（类型互赋值，shared 不 import 渲染运行时代码）。
 *
 * @remarks
 * - 本文件是**契约完整体而非实现**：封套字段、判别联合、两侧校验闸、在册错误面与窗口装载层
 *   最小传输面全部完备；不承载 IPC 注册、contextBridge 注入、轮询时序或任何运行时副作用
 *   （纯类型 + 纯常量 + 纯函数；运行期依赖仅 `@chips/bridge` 与文档域在册码表常量，零
 *   `electron` / `node:*` / DOM，可 node 直测，可安全 import 于主 / 渲染 / preload 任一侧）。
 * - 判别规则（四臂封套）：请求 `type = 'card-window-init:fetch'`；响应三臂——就绪
 *   `'card-window-init:result'`（携带装载输入 `payload`）、空载 `'card-window-init:pending'`
 *   （窗口存活但登记表未命中）、失败 `'card-window-init:error'`（携带 `IChipsError` 普通对象
 *   形态）。全部封套键集精确（§6.3 同口径：多一字段即两端契约漂移，确定性拒绝而非忽略）。
 * - `windowId ↔ init` 一致性锁：请求封套**不携带** windowId（渲染侧不得自报身份——身份由
 *   主进程从 `event.sender.id` 取证，伪造无通路）；三个响应臂一律回带主进程取证的
 *   `windowId`（正安全整数闸），result 臂的 `payload.source` 必为该 windowId 登记表记录的
 *   source（主进程投递臂职责，接线波以登记表单点命中构造，不经第二来源拼合）。
 *   `payload.documentId` 与 `document:open` 回包的一致性由主进程装载投递臂钉死
 *   （工单035 §九「待裁随账」腿，接线波收口）。
 * - 空载/未登记/竞态语义（三臂划分的裁决口径）：
 *   - **pending（空载/未登记竞态）**：卡片窗口 preload 在 `open()` 完成登记之前发起 fetch
 *     （`createWindow` 返回与 map 写入之间存在结构性时窗）——窗口存活但登记表未命中，
 *     属**合法瞬态而非错误**，回 pending 臂；渲染侧维持诚实空载等待（与 `bootCardWindow`
 *     空载态同一语义），重试节奏归接线波实现，本契约不定义超时/退避。
 *   - **error（`BRIDGE_SESSION_UNKNOWN`，销毁后投递竞态）**：投递目标窗口已销毁或记录已被
 *     `forget` 解绑——在册拒收码（§9.2 retryable=false），不新造「窗口不存在」码。
 *   - **error（`DOCUMENT_NOT_OPEN`，绑定未就绪）**：登记表命中但文档绑定腿无法钉死
 *     `source ↔ documentId` 一致性（#99 文档链路未就绪/会话不存在）——在册会话域码如实
 *     拒收，渲染侧继续空载等待，不伪造装载。
 * - 校验闸码映射（全部在册码，零自造）：请求面（不可信输入闸）一律
 *   `BRIDGE_INVALID_INPUT`；响应面（主进程回包契约闸，与取视图通道/刀3 `contractViolation`
 *   同口径）一律 `BRIDGE_INTERNAL`；失败臂错误码限本通道在册错误面
 *   {@link CARD_WINDOW_INIT_CHANNEL_ERROR_CODES}，面外已登记码经
 *   {@link normalizeCardWindowInitError} 归一 `BRIDGE_INTERNAL`（`details.cause` 承载
 *   原码用于诊断，不采信面外语义）。
 * - 通道版本锁：`CARD_WINDOW_INIT_PROTOCOL` 为唯一版本字面量；升级走版本号协商
 *   （与帧协议 / 取视图通道同纪律，禁止特性探测式分支）。消息名/键集漂移锁口径：
 *   通道名、四个消息类型、全局键、五个封套键集与五个 payload 字段名的唯一名字来源均在
 *   本文件；两侧实现与契约测试各自对照本文件常量断言，任何一处改名即测试红。
 * - 信任边界：卡片窗口顶层文档只运行平台自有 RenderHost 代码（`card.ts`），插件内容一律
 *   运行在无 `preload` 语境的沙箱帧——本面对插件代码不可见、不可达，与 §2.3
 *   「插件不可见、不可订阅」通道定性一致。窗口装载层最小面（{@link ICardWindowInitSurface}）
 *   按 SB-4 同纪律只暴露**单个动作方法**、无 channel 参数（通道钉死在 preload 侧），
 *   纯转发切片不解释负载语义。
 */

import { BRIDGE_ERROR_CODES, ChipsError, createBridgeError, isChipsError, normalizeError } from '@chips/bridge';
import type { IChipsError } from '@chips/bridge';

import { DOCUMENT_BUSINESS_ERROR_CODES } from '../capabilities/document/errors.js';

/* ------------------------------------------------------------------ *
 * 通道常量（唯一名字来源）
 * ------------------------------------------------------------------ */

/** 通道协议版本号；升级走版本号协商（帧协议 / 取视图通道同纪律）。 */
export const CARD_WINDOW_INIT_PROTOCOL = 'chips-card-window-init/1';

/**
 * 通道名（宿主内部 IPC invoke 通道，渲染 → 主；插件不可见、不可订阅）。
 * 通道注册（`ipcMain.handle`）归实现波组合根，本常量是其唯一名字来源。
 */
export const CARD_WINDOW_INIT_REQUEST_CHANNEL = 'card-window-init:request';

/**
 * 窗口装载层 `contextBridge` 全局键（preload 注入、RenderHost 读取的唯一名字来源）。
 *
 * @remarks 双下划线前缀标记「宿主内部、非公共契约面」，与 `window.chips` 及取视图通道世界
 * （`__chipsHostViewChannel`）显式区隔；本通道独立成世界，**不进入**取视图通道世界的
 * 键集（该世界键集 `['requestView']` 已由工单035 缝②冻结）。
 */
export const CARD_WINDOW_INIT_SURFACE_KEY = '__chipsCardWindowInit';

/** 消息类型判别字面量集合（封套 `type` 字段全部合法取值）。 */
export const CARD_WINDOW_INIT_MESSAGE_TYPES = {
  fetch: 'card-window-init:fetch',
  result: 'card-window-init:result',
  pending: 'card-window-init:pending',
  error: 'card-window-init:error',
} as const;

/** 封套 `type` 联合。 */
export type CardWindowInitMessageType = (typeof CARD_WINDOW_INIT_MESSAGE_TYPES)[keyof typeof CARD_WINDOW_INIT_MESSAGE_TYPES];

/**
 * 装载输入 `payload` 精确字段名清单（与 `card.ts` `ICardWindowInit` 逐字段同形的键集侧
 * 镜像；消费形状一致性由契约测试编译期互赋锁钉死）。
 */
export const CARD_WINDOW_INIT_PAYLOAD_FIELDS = ['source', 'documentId', 'resourceBase', 'pluginEntries', 'tokens'] as const;

/**
 * 稳定文档标识闸（《05-ID生成规范》§二.1/§七.1 在册口径：十位 Base62、大小写精确——
 * 与取视图通道契约、宿主 `capabilities/document/validation.ts`、Rust `is_base62_id`
 * 三方同字面）。
 */
const DOCUMENT_ID_PATTERN = /^[0-9A-Za-z]{10}$/;

/** 已登记错误码词法形态（《04-能力契约规范》§11.1：`<DOMAIN>_<REASON>` 全大写下划线）。 */
const REGISTERED_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/**
 * 来源引用最大长度（`card-window-orchestrator.ts:66` `SOURCE_MAX_LENGTH` 同值镜像；
 * 登记表侧硬闸在先，本闸为投递封套的独立防线，两处漂移由契约测试值锁捕获）。
 */
const SOURCE_MAX_LENGTH = 4096;

/** Design Tokens 投递形状（CSS 变量名 → 变量值；与 `renderer/frame-protocol.ts` `DesignTokens` 同定义的结构性镜像）。 */
export type CardWindowInitDesignTokens = Readonly<Record<`--${string}`, string>>;

/* ------------------------------------------------------------------ *
 * 通道在册错误面（全部引用在册码表常量，零自造）
 * ------------------------------------------------------------------ */

/**
 * 本通道错误面：主进程投递腿（请求闸 → 登记表命中 → 文档绑定钉死 → 回包构造）可能
 * 如实交付到失败臂的全部登记码。
 *
 * - `BRIDGE_INVALID_INPUT`（§9.2）：请求封套非法（不可信输入闸）；
 * - `BRIDGE_SESSION_UNKNOWN`（§9.2）：投递目标窗口已销毁/已解绑（销毁后投递竞态）；
 * - `DOCUMENT_NOT_OPEN`（《11-文档服务设计》§10.2，经文档域码表常量引用）：登记表命中但
 *   文档绑定腿无法钉死 `source ↔ documentId` 一致性（会话不存在/未就绪）；
 * - `BRIDGE_INTERNAL`（§9.2）：回包契约闸违约与面外码归一。
 */
export const CARD_WINDOW_INIT_CHANNEL_ERROR_CODES = {
  invalidInput: BRIDGE_ERROR_CODES.invalidInput,
  sessionUnknown: BRIDGE_ERROR_CODES.sessionUnknown,
  documentNotOpen: DOCUMENT_BUSINESS_ERROR_CODES.notOpen,
  internal: BRIDGE_ERROR_CODES.internal,
} as const;

/** 本通道在册错误码联合。 */
export type CardWindowInitChannelErrorCode = (typeof CARD_WINDOW_INIT_CHANNEL_ERROR_CODES)[keyof typeof CARD_WINDOW_INIT_CHANNEL_ERROR_CODES];

const CARD_WINDOW_INIT_CHANNEL_ERROR_CODE_SET: ReadonlySet<string> = new Set<string>(
  Object.values(CARD_WINDOW_INIT_CHANNEL_ERROR_CODES)
);

/** 判断错误码是否属于本通道在册错误面。 */
export function isCardWindowInitChannelErrorCode(value: string): value is CardWindowInitChannelErrorCode {
  return CARD_WINDOW_INIT_CHANNEL_ERROR_CODE_SET.has(value);
}

/* ------------------------------------------------------------------ *
 * 装载输入与封套（全部可结构化克隆的纯数据形状）
 * ------------------------------------------------------------------ */

/**
 * 投递的装载输入（主进程登记表 → 窗口壳的输入面）。
 *
 * @remarks 与 `src/renderer/entries/card.ts` `ICardWindowInit` 逐字段同形（编译期互赋锁
 * 由 `tests/card-window-init-contract.test.ts` 钉死；本文件不 import 渲染运行时代码）。
 * `source` 承载登记表记录的来源引用；`documentId` 为回流定位键（十位 Base62），其与
 * `document:open` 回包的一致性钉死属主进程投递臂职责（工单035 §九 待裁随账）。
 */
export interface ICardWindowInitPayload {
  /** 文档来源引用（`RenderRequest.source`；词法闸见 {@link validateCardWindowInitPayload}）。 */
  readonly source: string;
  /** 稳定文档标识（十位 Base62 `card_id` 别名，《05-ID生成规范》§二.1）。 */
  readonly documentId: string;
  /** 资源基址（资源管理器作用域产物；语法权威在《06-资源协议规范》，本闸只做非空字符串防线）。 */
  readonly resourceBase: string;
  /** 插件渲染入口映射（类型标识 → 插件渲染入口 URL）。 */
  readonly pluginEntries: Readonly<Record<string, string>>;
  /** Design Tokens（CSS 变量表；键 `--` 前缀、值字符串）。 */
  readonly tokens: CardWindowInitDesignTokens;
}

/** 装载输入取回请求（壳渲染进程 → 主进程；不携带 windowId，身份由主进程 sender 取证）。 */
export interface ICardWindowInitFetchRequest {
  readonly protocol: typeof CARD_WINDOW_INIT_PROTOCOL;
  readonly type: typeof CARD_WINDOW_INIT_MESSAGE_TYPES.fetch;
  /** 调用关联标识（请求侧铸造、回包原样携带；形状闸为非空字符串）。 */
  readonly requestId: string;
}

/** 装载输入就绪回包（主进程 → 壳渲染进程；`windowId` 为主进程 sender 取证回带）。 */
export interface ICardWindowInitResult {
  readonly protocol: typeof CARD_WINDOW_INIT_PROTOCOL;
  readonly type: typeof CARD_WINDOW_INIT_MESSAGE_TYPES.result;
  readonly requestId: string;
  /** 主进程取证的窗口 ID（`event.sender.id` = `webContents.id`，§7.4）——windowId↔init 一致性锁的响应侧承载。 */
  readonly windowId: number;
  readonly payload: ICardWindowInitPayload;
}

/** 空载回包（窗口存活但登记表未命中——合法瞬态竞态，渲染侧维持诚实空载等待）。 */
export interface ICardWindowInitPending {
  readonly protocol: typeof CARD_WINDOW_INIT_PROTOCOL;
  readonly type: typeof CARD_WINDOW_INIT_MESSAGE_TYPES.pending;
  readonly requestId: string;
  readonly windowId: number;
}

/** 失败回包（`error` 为 `IChipsError` 跨边界普通对象形态，码限本通道在册错误面）。 */
export interface ICardWindowInitFailure {
  readonly protocol: typeof CARD_WINDOW_INIT_PROTOCOL;
  readonly type: typeof CARD_WINDOW_INIT_MESSAGE_TYPES.error;
  readonly requestId: string;
  readonly windowId: number;
  readonly error: IChipsError;
}

/** 响应判别联合（就绪 / 空载 / 失败三臂）。 */
export type CardWindowInitResponse = ICardWindowInitResult | ICardWindowInitPending | ICardWindowInitFailure;

/** 通道消息判别联合（四臂全表）。 */
export type CardWindowInitMessage = ICardWindowInitFetchRequest | CardWindowInitResponse;

/**
 * 卡片窗口装载输入投递的窗口装载层最小传输面（`contextBridge.exposeInMainWorld` 挂载形状）。
 *
 * @remarks 单一动作方法、无 channel 参数（通道钉死为 {@link CARD_WINDOW_INIT_REQUEST_CHANNEL}，
 * 在 preload 侧内部引用，本面不重复声明字面量逻辑）；入出参为本契约封套的普通对象形态。
 * 真实注入臂归实现波（preload 新独立世界，与 `__chipsHostViewChannel` 世界互不扩面）。
 */
export interface ICardWindowInitSurface {
  /**
   * 发起一次装载输入取回请求（渲染进程 → 主进程）。
   *
   * @param payload {@link ICardWindowInitFetchRequest} 封套（渲染侧已过发送侧自检）。
   * @returns {@link CardWindowInitResponse} 三臂封套（到达侧权威闸再校验）。
   */
  requestInit(payload: unknown): Promise<unknown>;
}

/* ------------------------------------------------------------------ *
 * 构造器（纯函数；形状权威在两侧校验闸，不做隐式修补）
 * ------------------------------------------------------------------ */

/**
 * 构造取回请求（不加形状校验：与取视图通道 `createDocumentViewBuildRequest` 同纪律，
 * 权威闸在接收端 {@link validateCardWindowInitRequest}；发送侧自检可复用同一函数）。
 */
export function createCardWindowInitFetchRequest(requestId: string): ICardWindowInitFetchRequest {
  return { protocol: CARD_WINDOW_INIT_PROTOCOL, type: CARD_WINDOW_INIT_MESSAGE_TYPES.fetch, requestId };
}

/**
 * 构造就绪回包（`payload` 应为 {@link validateCardWindowInitPayload} 闸后投影；主进程
 * 发送侧守门时点归实现波——与取视图通道 `createDocumentViewBuildResult` 同纪律）。
 */
export function createCardWindowInitResult(
  requestId: string,
  windowId: number,
  payload: ICardWindowInitPayload
): ICardWindowInitResult {
  return { protocol: CARD_WINDOW_INIT_PROTOCOL, type: CARD_WINDOW_INIT_MESSAGE_TYPES.result, requestId, windowId, payload };
}

/** 构造空载回包（登记表未命中的合法瞬态；语义见文件头注）。 */
export function createCardWindowInitPending(requestId: string, windowId: number): ICardWindowInitPending {
  return { protocol: CARD_WINDOW_INIT_PROTOCOL, type: CARD_WINDOW_INIT_MESSAGE_TYPES.pending, requestId, windowId };
}

/**
 * 构造失败回包（发送侧错误面纪律单点：任意异常经 {@link normalizeCardWindowInitError}
 * 映射为在册码后以 `toPlain()` 普通对象形态入包——跨边界不得传输 `Error` 实例，
 * 《01-Bridge-API规范》§2.5 在册口径）。
 */
export function createCardWindowInitFailure(requestId: string, windowId: number, error: unknown): ICardWindowInitFailure {
  return {
    protocol: CARD_WINDOW_INIT_PROTOCOL,
    type: CARD_WINDOW_INIT_MESSAGE_TYPES.error,
    requestId,
    windowId,
    error: normalizeCardWindowInitError(error).toPlain(),
  };
}

/** 判别响应就绪臂。 */
export function isCardWindowInitResult(response: CardWindowInitResponse): response is ICardWindowInitResult {
  return response.type === CARD_WINDOW_INIT_MESSAGE_TYPES.result;
}

/** 判别响应空载臂。 */
export function isCardWindowInitPending(response: CardWindowInitResponse): response is ICardWindowInitPending {
  return response.type === CARD_WINDOW_INIT_MESSAGE_TYPES.pending;
}

/** 判别响应失败臂。 */
export function isCardWindowInitFailure(response: CardWindowInitResponse): response is ICardWindowInitFailure {
  return response.type === CARD_WINDOW_INIT_MESSAGE_TYPES.error;
}

/* ------------------------------------------------------------------ *
 * 错误面映射（在册码单点）
 * ------------------------------------------------------------------ */

/**
 * 任意异常 → 本通道在册错误面 `ChipsError`（错误归一，《02-Bridge三层设计》§9.1 +
 * 工单024 唯一类语义）：
 *
 * - `normalizeError` 先行：`ChipsError` 实例原样返回、`IChipsError` 同构普通对象还原、
 *   `AbortError` 归 `BRIDGE_CANCELLED`、未识别异常归 `BRIDGE_INTERNAL`；
 * - 还原后码在 {@link CARD_WINDOW_INIT_CHANNEL_ERROR_CODES} 面内 → 原样透传（不发明映射）；
 * - 面外码（含他域登记码出现在本链路，即接线漂移）→ 归一 `BRIDGE_INTERNAL`，
 *   `details.cause` 承载符合词法的原码用于诊断；词法不合规的码不入 `details`。
 */
export function normalizeCardWindowInitError(error: unknown): ChipsError {
  const normalized = normalizeError(error);
  if (isCardWindowInitChannelErrorCode(normalized.code)) {
    return normalized;
  }
  return createBridgeError(BRIDGE_ERROR_CODES.internal, {
    message: '装载输入投递通道错误面收到非本通道在册码',
    ...(REGISTERED_CODE_PATTERN.test(normalized.code) ? { details: { cause: normalized.code } } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * 拒绝构造（两侧闸的码映射单点）
 * ------------------------------------------------------------------ */

/** 请求闸拒绝（不可信输入 → `BRIDGE_INVALID_INPUT`；`details` 只承载结构化诊断）。 */
function rejectRequest(field: string, reason: string): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
    message: '装载输入取回请求非法',
    details: { gate: 'request', field, reason },
  });
}

/** 响应闸拒绝（主进程回包契约违约 → `BRIDGE_INTERNAL`，取视图通道/刀3 同口径）。 */
function rejectResponse(reason: string, extra?: Record<string, unknown>): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.internal, {
    message: '卡片窗口装载输入回包的数据形状不符合契约',
    details: { gate: 'response', reason, ...(extra ?? {}) },
  });
}

/* ------------------------------------------------------------------ *
 * 形状守卫基础件（与取视图通道契约同口径的私有件；两处互不 import）
 * ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 精确键集校验（§6.3 纪律：多一字段即两端契约漂移，拒绝而非忽略）。 */
function assertExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  onMismatch: (actual: string, expectedKeys: string) => ChipsError
): void {
  const actual = Object.keys(record).sort();
  const want = [...expected].sort();
  if (actual.length !== want.length || actual.some((key, index) => key !== want[index])) {
    throw onMismatch(actual.join(','), want.join(','));
  }
}

/** 键集漂移拒绝件（请求侧：`BRIDGE_INVALID_INPUT`，envelope 闸位）。 */
function rejectEnvelopeDrift(what: string): (actual: string, expectedKeys: string) => ChipsError {
  return (actual, expectedKeys) => rejectRequest('envelope', `${what} 字段集与通道契约不一致（actual=${actual} expected=${expectedKeys}）`);
}

/** 键集漂移拒绝件（响应侧：`BRIDGE_INTERNAL`）。 */
function rejectResponseDrift(what: string): (actual: string, expectedKeys: string) => ChipsError {
  return (actual, expectedKeys) => rejectResponse(`${what} 字段集与通道契约不一致`, { actual, expected: expectedKeys });
}

/** 窗口 ID 闸（§7.4：`webContents.id` 为正安全整数）。 */
function requireWindowId(value: unknown, reject: (reason: string, extra?: Record<string, unknown>) => ChipsError): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw reject('windowId 不是正安全整数（窗口身份取证值，04-能力契约规范 §7.4）', { field: 'windowId' });
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * 装载输入闸（payload 形状权威：主进程发送侧自检与渲染侧到达闸共用同一函数）
 * ------------------------------------------------------------------ */

/**
 * 装载输入权威闸：精确五字段 + 逐字段形状。全部拒绝经调用方语境（本契约内为响应闸）
 * 交付；`source` 词法闸与 `card-window-orchestrator.ts` `assertSource` 同口径镜像
 * （非空、无空白、不超长），URI 语法权威在《06-资源协议规范》与文档服务，本闸不解析
 * URI 语法（与取视图通道 `source` 闸同一收敛口径）。
 */
export function validateCardWindowInitPayload(data: unknown): ICardWindowInitPayload {
  if (!isRecord(data)) {
    throw rejectResponse('payload 不是对象');
  }
  assertExactKeys(data, CARD_WINDOW_INIT_PAYLOAD_FIELDS, rejectResponseDrift('payload'));

  const source = data['source'];
  if (typeof source !== 'string' || source.trim().length === 0) {
    throw rejectResponse('source 必须是非空字符串', { field: 'source' });
  }
  if (source.length > SOURCE_MAX_LENGTH || /\s/.test(source)) {
    throw rejectResponse('source 含空白或超长', { field: 'source' });
  }

  const documentId = data['documentId'];
  if (typeof documentId !== 'string' || !DOCUMENT_ID_PATTERN.test(documentId)) {
    throw rejectResponse('documentId 不是 10 位 Base62 稳定标识（05-ID生成规范 §二.1）', { field: 'documentId' });
  }

  const resourceBase = data['resourceBase'];
  if (typeof resourceBase !== 'string' || resourceBase.length === 0) {
    throw rejectResponse('resourceBase 必须是非空字符串', { field: 'resourceBase' });
  }

  const pluginEntries = validatePluginEntries(data['pluginEntries']);
  const tokens = validateTokens(data['tokens']);

  return { source, documentId, resourceBase, pluginEntries, tokens };
}

/** `Record<string, string>` 映射闸（pluginEntries / tokens 共用基件；键非空、值字符串）。 */
function validateStringMap(
  value: unknown,
  field: string,
  options?: { readonly keyPattern?: RegExp; readonly nonEmptyValue?: boolean }
): Readonly<Record<string, string>> {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw rejectResponse(`${field} 不是普通对象映射`, { field });
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.length === 0 || typeof item !== 'string') {
      throw rejectResponse(`${field} 成员不是字符串值`, { field, key });
    }
    if (options?.keyPattern !== undefined && !options.keyPattern.test(key)) {
      throw rejectResponse(`${field} 键不合约定`, { field, key });
    }
    if (options?.nonEmptyValue === true && item.length === 0) {
      throw rejectResponse(`${field} 值为空串`, { field, key });
    }
    out[key] = item;
  }
  return out;
}

/** `pluginEntries` 闸：类型标识 → 入口 URL，键非空（基件）、值非空字符串（空 URL 无装载意义）。 */
function validatePluginEntries(value: unknown): Readonly<Record<string, string>> {
  return validateStringMap(value, 'pluginEntries', { nonEmptyValue: true });
}

/** `tokens` 闸：CSS 变量表（键 `--` 前缀、值字符串，空集合法——token 覆盖可后置）。 */
function validateTokens(value: unknown): CardWindowInitDesignTokens {
  return validateStringMap(value, 'tokens', { keyPattern: /^--/ });
}

/* ------------------------------------------------------------------ *
 * 两侧权威校验闸
 * ------------------------------------------------------------------ */

/**
 * 请求权威闸（主进程接收端；渲染进程发送前自检可复用同一函数）：封套判别 + 关联标识闸。
 * 全部拒绝以 `BRIDGE_INVALID_INPUT` 交付，`details` 点名闸位、字段与原因。
 * 主进程据此再执行 `windowId := event.sender.id` 的登记表取证（本函数不触达 IPC 事件，
 * sender 取证归实现波接线臂）。
 */
export function validateCardWindowInitRequest(data: unknown): ICardWindowInitFetchRequest {
  if (!isRecord(data)) {
    throw rejectRequest('envelope', '请求封套必须是对象');
  }
  assertExactKeys(data, ['protocol', 'type', 'requestId'], rejectEnvelopeDrift('请求封套'));
  if (data['protocol'] !== CARD_WINDOW_INIT_PROTOCOL) {
    throw rejectRequest('protocol', '通道协议版本不符');
  }
  if (data['type'] !== CARD_WINDOW_INIT_MESSAGE_TYPES.fetch) {
    throw rejectRequest('type', '消息类型不是装载输入取回请求');
  }
  const requestId = data['requestId'];
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw rejectRequest('requestId', 'requestId 必须是非空字符串');
  }
  return { protocol: CARD_WINDOW_INIT_PROTOCOL, type: CARD_WINDOW_INIT_MESSAGE_TYPES.fetch, requestId };
}

/**
 * 响应权威闸（渲染进程接收端）：封套判别 + 三臂各自守门。
 *
 * - 就绪臂：`payload` 过 {@link validateCardWindowInitPayload}（精确键集 + 逐字段闸）；
 * - 空载臂：无负载字段（合法瞬态，语义见文件头注）；
 * - 失败臂：`error` 须为 `IChipsError` 同构形状（`isChipsError` 宽进），码经
 *   {@link normalizeCardWindowInitError} 在册映射（面外码归一 `BRIDGE_INTERNAL`）；
 * - 全部封套级与形状违例以 `BRIDGE_INTERNAL` 交付（主进程回包违约，非调用方输入问题）。
 *
 * @param expectedRequestId 请求侧铸造的关联标识；回包必须逐字一致（错配即投递漂移）。
 */
export function validateCardWindowInitResponse(data: unknown, expectedRequestId: string): CardWindowInitResponse {
  if (typeof expectedRequestId !== 'string' || expectedRequestId.length === 0) {
    throw rejectResponse('expectedRequestId 必须是非空字符串', { field: 'expectedRequestId' });
  }
  if (!isRecord(data)) {
    throw rejectResponse('响应封套必须是对象');
  }
  if (data['protocol'] !== CARD_WINDOW_INIT_PROTOCOL) {
    throw rejectResponse('通道协议版本不符', { field: 'protocol' });
  }
  const type = data['type'];
  if (
    type !== CARD_WINDOW_INIT_MESSAGE_TYPES.result &&
    type !== CARD_WINDOW_INIT_MESSAGE_TYPES.pending &&
    type !== CARD_WINDOW_INIT_MESSAGE_TYPES.error
  ) {
    throw rejectResponse('消息类型不是响应臂（result / pending / error）', { field: 'type' });
  }
  const requestId = data['requestId'];
  if (requestId !== expectedRequestId) {
    throw rejectResponse('requestId 与请求关联标识不一致', { field: 'requestId' });
  }
  const windowId = requireWindowId(data['windowId'], rejectResponse);

  if (type === CARD_WINDOW_INIT_MESSAGE_TYPES.result) {
    assertExactKeys(data, ['protocol', 'type', 'requestId', 'windowId', 'payload'], rejectResponseDrift('就绪封套'));
    return {
      protocol: CARD_WINDOW_INIT_PROTOCOL,
      type: CARD_WINDOW_INIT_MESSAGE_TYPES.result,
      requestId: expectedRequestId,
      windowId,
      payload: validateCardWindowInitPayload(data['payload']),
    };
  }
  if (type === CARD_WINDOW_INIT_MESSAGE_TYPES.pending) {
    assertExactKeys(data, ['protocol', 'type', 'requestId', 'windowId'], rejectResponseDrift('空载封套'));
    return { protocol: CARD_WINDOW_INIT_PROTOCOL, type: CARD_WINDOW_INIT_MESSAGE_TYPES.pending, requestId: expectedRequestId, windowId };
  }
  assertExactKeys(data, ['protocol', 'type', 'requestId', 'windowId', 'error'], rejectResponseDrift('失败封套'));
  const error = data['error'];
  if (!isRecord(error) || !isChipsError(error)) {
    throw rejectResponse('error 载荷不是 IChipsError 同构形状', { field: 'error' });
  }
  return {
    protocol: CARD_WINDOW_INIT_PROTOCOL,
    type: CARD_WINDOW_INIT_MESSAGE_TYPES.error,
    requestId: expectedRequestId,
    windowId,
    error: normalizeCardWindowInitError(error),
  };
}
