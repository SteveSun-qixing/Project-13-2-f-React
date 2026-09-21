/**
 * 帧协议契约面（宿主-内容通信协议，父帧侧结构视图）。
 *
 * 权威：`05-渲染引擎设计` §9.2（消息封套与消息清单）、§9.3（约束）、§9.1（通道建立）、
 * §2.5（渲染视图模型消费字段）。类型命名与本节逐字一致。
 *
 * @remarks
 * - `@chips/host` 当前不在 `@chips/sdk` 的工作区依赖边内（集成缺口已按工单口径登记），视图模型
 *   在此以结构视图镜像（字段名与 `@chips/sdk` `types/views.ts` 逐项一致，只含父帧消费字段）。
 * - `host:handshake` 是端口外的一次性转移载体（§9.1 第 2 步：随首条 `contentWindow.postMessage`
 *   转移端口与令牌），不是 §9.3 端口消息清单成员，子帧校验令牌后即弃。
 */

import type { ChipsError } from '../preload/chips-error.js';

/** 帧协议版本号；协议升级走版本号协商，不允许特性探测式分支。 */
export const FRAME_PROTOCOL = 'chips-frame/1';

/** 帧握手超时（`frame:ready`）；超时视为帧启动失败。 */
export const FRAME_READY_TIMEOUT_MS = 5_000;

/** 单个 `frame:action` 超时；超时回 `host:action-error`。 */
export const FRAME_ACTION_TIMEOUT_MS = 5_000;

/** 帧销毁 ack 等待上限；超时强制移除帧并释放端口。 */
export const FRAME_DISPOSE_ACK_TIMEOUT_MS = 1_000;

/** 高度合并的最小变化量；小于该值的变化忽略。 */
export const FRAME_HEIGHT_MIN_DELTA_PX = 1;

/** 帧角色（§9.2 `FrameInitPayload.role`）。 */
export type FrameRole = 'card' | 'box-layout' | 'entry' | 'cover';

/** 帧能力声明（§9.2 `FrameCapability`）。 */
export type FrameCapability = 'measure' | 'nested-frames';

/** Design Tokens：CSS 变量名 → 变量值（§9.2 `DesignTokens`）。 */
export type DesignTokens = Readonly<Record<`--${string}`, string>>;

/** 帧尺寸限制（§9.2 `FrameLimits`）。 */
export interface FrameLimits {
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly maxNestedFrames: number;
}

/** 帧内单个内容节点的容器声明（§9.2 `FrameNodeInit`）。 */
export interface FrameNodeInit {
  readonly node_id: string;
  readonly card_type: string;
  readonly containerId: string;
}

/** 标签视图（§2.5 `TagView`）。 */
export type FrameTagView = string | readonly string[];

/** 卡片级上下文（§2.5 `BaseCardContext`）。 */
export interface IFrameBaseCardContext {
  readonly card_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly cover_ratio: string;
  readonly tags: readonly FrameTagView[];
}

/** 卡片渲染视图（§2.5 `CardRenderView` 消费字段镜像）。 */
export interface ICardRenderView {
  readonly kind: 'card';
  readonly revision: number;
  readonly card_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly cover_ratio: string;
  readonly tags: readonly FrameTagView[];
  readonly cover: { readonly entry: string; readonly ratio: string };
  readonly content_nodes: readonly {
    readonly node_id: string;
    readonly card_type: string;
    readonly content: Readonly<Record<string, unknown>>;
  }[];
}

/** 箱子布局渲染视图（§2.5 `BoxRenderView` 消费字段镜像；布局帧波次消费）。 */
export interface IBoxRenderView {
  readonly kind: 'box';
  readonly revision: number;
  readonly box_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly active_layout_type: string;
  readonly layout_config: Readonly<Record<string, unknown>>;
  readonly cover: { readonly entry: string; readonly ratio: string };
}

/** 箱子受控封面渲染视图（§2.5 `BoxCoverView` 消费字段镜像）。 */
export interface IBoxCoverView {
  readonly kind: 'box';
  readonly box_id: string;
  readonly name: string;
  readonly chip_standards_version: string;
  readonly cover: { readonly entry: string; readonly ratio: string };
}

/** 帧初始化视图联合（§9.2 `FrameInitPayload.view`）。 */
export type FrameView = ICardRenderView | IBoxRenderView | IBoxCoverView;

/** 帧初始化载荷（§9.2 `FrameInitPayload`）。 */
export interface FrameInitPayload {
  readonly role: FrameRole;
  readonly view: FrameView;
  readonly nodes: readonly FrameNodeInit[];
  readonly resourceBase: string;
  readonly pluginEntries: Readonly<Record<string, string>>;
  readonly tokens: DesignTokens;
  readonly limits: FrameLimits;
}

/** 封套（§9.2 `FrameEnvelope`）。 */
export interface FrameEnvelope<TMessage> {
  readonly protocol: typeof FRAME_PROTOCOL;
  readonly sessionId: string;
  readonly frameId: string;
  readonly message: TMessage;
}

// --- 子帧 → 父帧（§9.2 逐字镜像） ---

/** 子帧就绪（§9.2 `FrameReady`）。 */
export interface FrameReady {
  readonly type: 'frame:ready';
  readonly payload: { readonly capabilities: readonly FrameCapability[] };
}

/** 高度上报（§9.2 `FrameHeight`）。 */
export interface FrameHeight {
  readonly type: 'frame:height';
  readonly payload: { readonly height: number; readonly epoch: number };
}

/** 布局帧条目请求（§9.2 `FrameEntryRequest`；仅布局帧允许）。 */
export interface FrameEntryRequest {
  readonly type: 'frame:entry-request';
  readonly payload: {
    readonly requestId: string;
    readonly entry_ids: readonly string[];
    readonly firstVisible: number;
    readonly lastVisible: number;
  };
}

/** 帧动作载荷（§9.2 `FrameActionPayload`）。 */
export type FrameActionPayload =
  | { readonly kind: 'open-external'; readonly url: string }
  | { readonly kind: 'open-resource'; readonly request: Readonly<Record<string, unknown>> }
  | { readonly kind: 'copy-text'; readonly text: string }
  | { readonly kind: 'notify'; readonly level: 'info' | 'warning' | 'error'; readonly message: string };

/** 帧动作请求（§9.2 `FrameActionRequest`）。 */
export interface FrameActionRequest {
  readonly type: 'frame:action';
  readonly payload: { readonly requestId: string; readonly action: FrameActionPayload };
}

/** 帧内错误（§9.2 `FrameError`）。 */
export interface FrameError {
  readonly type: 'frame:error';
  readonly payload: ChipsError;
}

/** 帧销毁回执（§9.2 `FrameDisposeAck`）。 */
export interface FrameDisposeAck {
  readonly type: 'frame:dispose-ack';
  readonly payload: null;
}

/** 子帧 → 父帧出站消息联合（§9.2 `FrameOutboundMessage`）。 */
export type FrameOutboundMessage =
  FrameReady | FrameHeight | FrameEntryRequest | FrameActionRequest | FrameError | FrameDisposeAck;

// --- 父帧 → 子帧（§9.2 逐字镜像） ---

/** 初始装载（§9.2 `HostInit`）。 */
export interface HostInit {
  readonly type: 'host:init';
  readonly payload: FrameInitPayload;
}

/** 会话视图更新（§9.2 `HostUpdate`；revision 严格递增且来自 `document:write`）。 */
export interface HostUpdate {
  readonly type: 'host:update';
  readonly payload: { readonly view: FrameView; readonly revision: number };
}

/** 批量下发条目 ticket（§9.2 `HostEntries`；只允许发往布局帧）。 */
export interface HostEntries {
  readonly type: 'host:entries';
  readonly payload: {
    readonly requestId: string;
    readonly tickets: readonly Readonly<Record<string, unknown>>[];
  };
}

/** 高度回执（§9.2 `HostHeightAck`）。 */
export interface HostHeightAck {
  readonly type: 'host:height-ack';
  readonly payload: { readonly epoch: number };
}

/** 动作拒绝/失败（§9.2 `HostActionError`）。 */
export interface HostActionError {
  readonly type: 'host:action-error';
  readonly payload: { readonly requestId: string; readonly error: ChipsError };
}

/** 帧销毁指令（§9.2 `HostDispose`）。 */
export interface HostDispose {
  readonly type: 'host:dispose';
  readonly payload: null;
}

/** 父帧 → 子帧出站消息联合（§9.2 `HostOutboundMessage`）。 */
export type HostOutboundMessage = HostInit | HostUpdate | HostEntries | HostHeightAck | HostActionError | HostDispose;

/** 端口上的子帧入站消息联合。 */
export type FrameInboundMessage = FrameOutboundMessage;

/** 端口上的父帧入站消息联合（本帧会话消费的 host:* 子集）。 */
export type HostInboundMessage = HostOutboundMessage;

/** 握手转移消息（§9.1 第 2 步的一次性载体，随 `contentWindow.postMessage` 转移远端端口）。 */
export interface IFrameHandshakeTransfer {
  readonly protocol: typeof FRAME_PROTOCOL;
  readonly type: 'host:handshake';
  readonly sessionId: string;
  readonly frameId: string;
  readonly token: string;
}

/**
 * 构造封套（sessionId / frameId 必须与通道登记一致）。
 *
 * @remarks 消息体不加类型约束：跨端口载荷必须可结构化克隆（05.04 §4.5 通信红线），
 * 形状校验在接收端 {@link parseFrameEnvelope} 完成。
 */
export function createFrameEnvelope<TMessage>(
  sessionId: string,
  frameId: string,
  message: TMessage,
): FrameEnvelope<TMessage> {
  return { protocol: FRAME_PROTOCOL, sessionId, frameId, message };
}

/** 构造握手转移消息。 */
export function createHandshakeTransfer(sessionId: string, frameId: string, token: string): IFrameHandshakeTransfer {
  return { protocol: FRAME_PROTOCOL, type: 'host:handshake', sessionId, frameId, token };
}

/** 判断值是否为字符串。 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** 判断值是否为普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 端口入站消息类型集合（§9.3：未列入清单的类型一律忽略并记录诊断）。 */
const FRAME_INBOUND_TYPES: ReadonlySet<string> = new Set<string>([
  'frame:ready',
  'frame:height',
  'frame:entry-request',
  'frame:action',
  'frame:error',
  'frame:dispose-ack',
]);

/**
 * 解析端口入站消息：封套形状与协议版本不符、消息类型未列入清单时返回 `null`
 * （调用方据此忽略并记录诊断，不抛错）。
 */
export function parseFrameEnvelope(data: unknown): FrameEnvelope<FrameInboundMessage> | null {
  if (
    !isRecord(data) ||
    data['protocol'] !== FRAME_PROTOCOL ||
    !isString(data['sessionId']) ||
    !isString(data['frameId'])
  ) {
    return null;
  }
  const message = data['message'];
  if (!isRecord(message) || !isString(message['type']) || !FRAME_INBOUND_TYPES.has(message['type'])) {
    return null;
  }
  // §9.2 清单中仅 `frame:dispose-ack` 的载荷为 null，其余消息载荷均为对象。
  const payload = message['payload'];
  if (payload === null) {
    if (message['type'] !== 'frame:dispose-ack') {
      return null;
    }
  } else if (!isRecord(payload)) {
    return null;
  }
  return data as unknown as FrameEnvelope<FrameInboundMessage>;
}

/** 判断入站封套是否与本通道登记一致（§9.6 通道安全校验）。 */
export function envelopeMatchesSession(
  envelope: FrameEnvelope<FrameInboundMessage>,
  sessionId: string,
  frameId: string,
): boolean {
  return envelope.sessionId === sessionId && envelope.frameId === frameId;
}

/** 提取 `frame:height` 载荷（形状不符返回 `null`，由调用方拒绝）。 */
export function asFrameHeight(
  message: FrameInboundMessage,
): { readonly height: number; readonly epoch: number } | null {
  if (message.type !== 'frame:height') {
    return null;
  }
  const { height, epoch } = message.payload;
  return typeof height === 'number' && Number.isFinite(height) && typeof epoch === 'number' ? { height, epoch } : null;
}

/** 提取 `frame:action` 载荷（形状不符返回 `null`，由调用方拒绝）。 */
export function asFrameAction(
  message: FrameInboundMessage,
): { readonly requestId: string; readonly action: FrameActionPayload } | null {
  if (message.type !== 'frame:action') {
    return null;
  }
  const { requestId, action } = message.payload;
  if (!isString(requestId) || !isRecord(action) || !isString(action['kind'])) {
    return null;
  }
  return { requestId, action: message.payload.action };
}

/** 判断是否为 `frame:ready`。 */
export function isFrameReady(message: FrameInboundMessage): message is FrameReady {
  return message.type === 'frame:ready';
}

/** 判断是否为 `frame:dispose-ack`。 */
export function isFrameDisposeAck(message: FrameInboundMessage): message is FrameDisposeAck {
  return message.type === 'frame:dispose-ack';
}

/** 判断是否为 `frame:error`。 */
export function isFrameError(message: FrameInboundMessage): message is FrameError {
  return message.type === 'frame:error';
}

/** 判断是否为 `frame:entry-request`（布局帧越级发送时由调用方按协议违规拒绝）。 */
export function isFrameEntryRequest(message: FrameInboundMessage): message is FrameEntryRequest {
  return message.type === 'frame:entry-request';
}
