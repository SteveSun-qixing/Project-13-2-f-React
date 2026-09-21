/**
 * 宿主内部取视图通道·渲染进程侧消费臂（金链路刀5 段B；工单035 裁定 C+B 的渲染侧承载）。
 *
 * 权威：
 * - 封套、请求/响应两侧校验闸与在册错误面的唯一契约权威在 `document-view-channel.ts`
 *   （任务 #105 冻结件）——本模块是其渲染侧消费方，不重复声明任何形状、不新增任何码；
 * - `05-渲染引擎设计` §2.3（跨进程时序：文档打开能力不回视图，`DocumentView` 经宿主内部
 *   取视图通道回传）、§2.6（构建执行位主进程，渲染侧 RenderHost 不可直触 Neon）；
 * - 工单035 裁定一（通道是宿主自有壳进程↔主进程 IPC 契约，**不是插件能力**：无
 *   capability ID、不进 Bridge 能力注册表、不经 `window.chips` 链路）；
 * - 工单024（`@chips/bridge` 唯一类语义：失败一律以 `ChipsError` 实例呈现给消费方）。
 *
 * @remarks
 * - 本臂实现 `render-engine.ts` 的 `IDocumentViewBuilder` 端口（`buildView({source,
 *   documentId, kind})`），即 §2.3 时序中 RenderHost 的「取视图请求」腿；端口形状、
 *   通道输入与主进程构建器输入全链逐字段同形（#105 契约 `IDocumentViewChannelInput`）。
 * - 传输注入面 {@link IDocumentViewChannelInvoke} 为 `ipcRenderer.invoke` 的通道钉定
 *   切片（与 `preload/transport.ts` 的 `IPreloadTransport` 同型纪律：宿主 TS 层不直接
 *   import `electron`，真实 `ipcRenderer` 臂由窗口装载层注入，测试注入替身即可在纯
 *   Node 环境覆盖全部消费逻辑）。
 * - 发送侧自检（#105 契约头注「发送侧自检属刀5 消费实现职责」）：请求出站前先过
 *   `validateDocumentViewChannelRequest`——非法请求在渲染侧即以 `BRIDGE_INVALID_INPUT`
 *   确定性拒绝，不触达 IPC；`kind: 'box'` 形状合法（§2.1 判别联合全体），其当前交付面
 *   拒绝由主进程构建侧在册闸承载（契约头注：本通道不提前承载该拒绝）。
 * - 到达侧防线：回包一律过 `validateDocumentViewChannelResponse`（封套判别 + §6.6 视图
 *   深校验 + 失败臂错误面归一）；`requestId` 关联一致由本臂逐字校验（契约「请求侧铸造、
 *   回包原样携带」的消费侧镜像防线，失配即主进程回包契约违约，`BRIDGE_INTERNAL`）。
 * - 错误面纪律：本臂全部抛出路径均为 `ChipsError` 实例——请求闸/响应闸的在册抛出直通；
 *   传输层异常（通道未注册、渲染进程被销毁等）经 `normalizeDocumentViewChannelError`
 *   单点归一（`AbortError` → `BRIDGE_CANCELLED`、未识别 → `BRIDGE_INTERNAL`、面外登记码
 *   → `BRIDGE_INTERNAL` + `details.cause`）；失败臂错误在响应闸内已完成在册归一，本臂
 *   以唯一类还原上抛，不发明二次映射。
 * - 无自有缓存、无重试、无退避（§2.6）：每次 `buildView` 完整触达通道一次；重试语义
 *   由消费方（渲染管线/编辑链路）按 §11 与在册 `retryable` 口径自行裁决。
 */

import { BRIDGE_ERROR_CODES, createBridgeError, normalizeError } from '@chips/bridge';

import {
  DOCUMENT_VIEW_REQUEST_CHANNEL,
  createDocumentViewBuildRequest,
  isDocumentViewBuildFailure,
  normalizeDocumentViewChannelError,
  validateDocumentViewChannelRequest,
  validateDocumentViewChannelResponse,
} from './document-view-channel.js';
import type { IDocumentViewChannelInput } from './document-view-channel.js';
import type { ICardRenderView } from './frame-protocol.js';
import type { IDocumentViewBuilder } from './render-engine.js';

/**
 * 通道传输注入面（`ipcRenderer.invoke` 的宿主本地结构镜像；通道名由本臂钉定为
 * {@link DOCUMENT_VIEW_REQUEST_CHANNEL}，注入面自身的 channel 参数供窗口装载层原样
 * 转发——替身与真实臂同契约）。
 */
export interface IDocumentViewChannelInvoke {
  invoke(channel: string, payload: unknown): Promise<unknown>;
}

/** 消费臂创建项。 */
export interface IDocumentViewChannelClientOptions {
  /** 通道传输切片（真实 = 窗口装载层注入的 `ipcRenderer.invoke` 臂；测试 = 替身）。 */
  readonly invoke: IDocumentViewChannelInvoke;
  /**
   * 关联标识铸造口（缺省 `crypto.randomUUID()`；注入口用于测试确定性与时序诊断，
   * 契约闸在册要求非空字符串——铸造口产出的空串同样被发送侧自检拒绝）。
   */
  readonly createRequestId?: () => string;
}

/**
 * 构造取视图通道消费臂（渲染进程侧 `IDocumentViewBuilder` 正式实现）。
 *
 * @param options 创建项。
 * @returns 渲染引擎/复合消费方直接使用的视图构建端口。
 */
export function createDocumentViewChannelBuilder(options: IDocumentViewChannelClientOptions): IDocumentViewBuilder {
  const createRequestId = options.createRequestId ?? ((): string => crypto.randomUUID());
  return {
    async buildView(input: IDocumentViewChannelInput): Promise<ICardRenderView> {
      // ① 发送侧自检：请求闸的在册抛出（`BRIDGE_INVALID_INPUT`）直通，非法请求不触达 IPC。
      const request = validateDocumentViewChannelRequest(createDocumentViewBuildRequest(createRequestId(), input));
      let raw: unknown;
      try {
        raw = await options.invoke.invoke(DOCUMENT_VIEW_REQUEST_CHANNEL, request);
      } catch (error: unknown) {
        // ② 传输层异常：错误面映射单点归一（面外一律 `BRIDGE_INTERNAL`，不裸抛非契约异常）。
        throw normalizeDocumentViewChannelError(error);
      }
      try {
        // ③ 到达侧防线：回包过响应权威闸（封套判别 + §6.6 视图深校验 + 失败臂在册归一）。
        const response = validateDocumentViewChannelResponse(raw);
        // ④ 关联一致防线：契约「回包原样携带 requestId」的消费侧镜像；失配即回包契约违约。
        if (response.requestId !== request.requestId) {
          throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
            message: '视图取回回包的关联标识与请求不一致',
            details: { gate: 'response', reason: 'request_id_mismatch' },
          });
        }
        if (isDocumentViewBuildFailure(response)) {
          // ⑤ 失败臂：错误已在响应闸内完成在册归一（唯一类实例），以契约码原样上抛消费方。
          throw normalizeError(response.error);
        }
        // 成功臂：`view` 为响应闸守门重建后的 §6.6 冻结形状投影。
        return response.view;
      } catch (error: unknown) {
        // 闸内在册抛出与失败臂均为 `ChipsError` 实例，经归一单点直通（面内原样、面外
        // 归一 `BRIDGE_INTERNAL`）——本臂抛出面恒为契约在册码的唯一类实例。
        throw normalizeDocumentViewChannelError(error);
      }
    },
  };
}
