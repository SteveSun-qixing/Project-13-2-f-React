/**
 * 卡片窗口装载输入投递·主进程投递臂（刀7 后续接线波，任务 #120；契约面 #119 冻结）。
 *
 * 权威：
 * - 封套、四臂判别、两侧校验闸与在册错误面的**唯一契约权威**在
 *   `src/shared/card-window-init-surface.ts`（任务 #119 冻结件，本模块是其主进程侧消费方，
 *   不重复声明任何形状、不新造任何错误码）；
 * - 工单035 裁定一（宿主内部壳进程↔主进程 IPC 契约：无 capability ID、不进 Bridge 能力注册表、
 *   不经 `window.chips`，两端均为平台自身代码故权限判定不适用）与 §九「待裁随账」收口
 *   （`payload.documentId` 与 `document:open` 回包的一致性由本投递臂钉死）；
 * - 《05-渲染引擎设计》05.02 §2.3 承载段（`05.02:89`「窗口感知与装载投递细节归宿主实现」）；
 * - 《04-能力契约规范》§7.4（`windowId` = `webContents.id`）——**身份只由主进程从
 *   `event.sender.id` 取证**，渲染侧自报 windowId 在请求闸即拒（伪造无通路）；
 * - 《11-文档服务设计》§十（`DOCUMENT_NOT_OPEN` 会话域在册拒收码）；《02-Bridge三层设计》
 *   §9.1/§9.2（`BRIDGE_SESSION_UNKNOWN` 与错误归一口径）。
 *
 * @remarks
 * - 投递腿四步（每步对应契约在册臂，逐竞态零静默）：
 *   1. 请求权威闸 `validateCardWindowInitRequest`（非法 → `BRIDGE_INVALID_INPUT` 失败臂；
 *      封套破损到取不出 `requestId` 时以固定未关联标识回包——关联丢失是契约违约的如实后果）；
 *   2. 登记表定位 `CardWindowOrchestrator.recordOf(windowId)`：命中 → 第 3 步；未命中且窗口存活
 *      → `pending`（`createWindow` 返回与 map 写入之间的结构性时窗，合法瞬态）；未命中且窗口
 *      不可达 → `BRIDGE_SESSION_UNKNOWN`（销毁/解绑后投递竞态）；
 *   3. 文档绑定腿 `resolveDocument(source)`（组合根交付的 `document:open` 同源查询面）：无存活
 *      会话记录或端口未接线 → `DOCUMENT_NOT_OPEN`（如实拒收，渲染侧继续空载等待，不伪造装载）；
 *      命中即凭 `CardWindowOrchestrator.bindDocument` 钉死登记表 `documentId` 承载位，承载位已钉
 *      异值 → `DOCUMENT_ID_CONFLICT`（经契约面外码归一落 `BRIDGE_INTERNAL`、`details.cause` 留原码）；
 *   4. 回包构造 `createCardWindowInitResult` → **发送前复用 `validateCardWindowInitResponse`
 *      自检**（契约 §10.3 待办 1 明载）：任何投递漂移在出桥前即收敛为失败臂，绝不由渲染侧观察
 *      到破损封套或悬空 promise。
 * - `pluginEntries` / `tokens` 交付口径（契约在册合法值，非占位）：
 *   - `pluginEntries` 空映射——插件渲染入口的正式绑定属插件链路波次（`renderer/entries/card.ts`
 *     头注在册），登记表侧不存在第二来源，本臂不从插件注册表拼合未经核验的入口；
 *   - `tokens` 空 CSS 变量表——主进程无 Design Token 快照源（主题系统随 task030 废弃，插件帧侧
 *     自带 `--chips-*` 变量作用域），契约 `tokens` 闸明载「空集合法——token 覆盖可后置」。
 *   两者均为渲染侧既有消费形状（空映射/空表不触发任何降级分支），后续波次接入正式源时只替换
 *   本臂取值，封套与闸零改动。
 * - 每请求零日志：本通道两端均为平台自身代码，失败以回包呈现（渲染侧消费闸负责落诊断），
 *   处理函数不写任何诊断输出（与取视图通道 `adapters/view-channel.ts` 同纪律，壳冒烟 stderr
 *   洁净闸同口径）。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '@chips/bridge';

import {
  CARD_WINDOW_INIT_REQUEST_CHANNEL,
  createCardWindowInitFailure,
  createCardWindowInitPending,
  createCardWindowInitResult,
  validateCardWindowInitPayload,
  validateCardWindowInitRequest,
  validateCardWindowInitResponse,
} from '../shared/card-window-init-surface.js';
import type { ICardWindowInitPayload } from '../shared/card-window-init-surface.js';
import { DOCUMENT_BUSINESS_ERROR_CODES, documentError } from '../capabilities/document/errors.js';
import type { CardWindowDocumentBindingResolver } from '../runtime/contracts.js';
import type { ShellIpcInvokeEvent, ShellIpcMain } from './shell-api.js';
import type { CardWindowOrchestrator } from './card-window-orchestrator.js';

/**
 * 请求封套破损到取不出合法 `requestId` 时的失败臂关联标识。
 *
 * @remarks 响应闸在册要求 `requestId` 为非空字符串——违约请求不得也回不去包；该固定标识
 * 如实呈现「关联丢失源于请求契约违约」（取视图通道 `DOCUMENT_VIEW_UNCORRELATED_REQUEST_ID` 同型）。
 */
export const CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID = 'card-window-init:uncorrelated-request';

/**
 * 请求闸拒绝后的关联标识尽力恢复（失败臂回带口径）：
 *
 * - 封套键集恰为在册请求三键（`protocol`/`requestId`/`type`）且 `requestId` 为非空字符串 →
 *   逐字回带（判别值漂移不消灭关联——与取视图通道回包同纪律）；
 * - 其余形态（非对象、键集漂移含自报 windowId、requestId 缺失/非字符串）→ 关联确实取不出，
 *   以 {@link CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID} 如实回包。
 *
 * @remarks 只读恢复、不采信任何语义：恢复值仅用于回包关联，不进入投递腿。
 */
function recoverRequestId(data: unknown): string {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID;
  }
  const record = data as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 3 || keys[0] !== 'protocol' || keys[1] !== 'requestId' || keys[2] !== 'type') {
    return CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID;
  }
  const requestId = record['requestId'];
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID;
}

/** 投递臂依赖（组合根装载段与壳 `ipc` 段共同闭合）。 */
export interface CardWindowInitHandlerDeps {
  /** 卡片窗口编排器（登记表：装载输入 `source` 与 `documentId` 承载位的权威上游）。 */
  readonly orchestrator: CardWindowOrchestrator;
  /** 窗口存活判定（壳 `ipc` 段以 `WindowRegistry.isAlive` 交付；pending 与销毁竞态的区分依据）。 */
  readonly isWindowAlive: (windowId: number) => boolean;
  /**
   * 文档绑定解析端口（`document:open` 回包同源查询面，组合根文档能力装载段交付）。
   *
   * @remarks 缺位即绑定腿未接线（`document:*` 未装载的生产回退态）——如实以
   * `DOCUMENT_NOT_OPEN` 失败臂拒收，不静默、不伪造装载。
   */
  readonly resolveDocument?: CardWindowDocumentBindingResolver;
}

/** 投递处理函数（`ipcMain.handle` 监听器形态：入出参均为可结构化克隆的普通对象）。 */
export type CardWindowInitHandler = (event: ShellIpcInvokeEvent, data: unknown) => Promise<unknown>;

/**
 * 登记表命中后的投递腿（第 2~4 步）。
 *
 * 投递腿各步同步完成，监听器契约的 Promise 形态由 {@link createCardWindowInitHandler} 承载。
 *
 * @throws 契约在册错误（`DOCUMENT_NOT_OPEN` / `DOCUMENT_ID_CONFLICT` / 回包自检违约），由
 * {@link createCardWindowInitHandler} 统一收敛为失败臂。
 */
function deliverInit(deps: CardWindowInitHandlerDeps, windowId: number, requestId: string): unknown {
  const record = deps.orchestrator.recordOf(windowId);
  if (record === null) {
    if (deps.isWindowAlive(windowId)) {
      // 窗口存活而登记表未命中：合法瞬态竞态，渲染侧维持诚实空载等待。
      return createCardWindowInitPending(requestId, windowId);
    }
    throw createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown, {
      details: { windowId },
    });
  }

  const binding = deps.resolveDocument === undefined ? null : deps.resolveDocument(record.source);
  if (binding === null) {
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, {
      message: '卡片窗口装载输入投递：该来源的文档绑定腿尚未就绪',
      details: { source: record.source },
    });
  }

  if (record.documentId !== null && record.documentId !== binding.documentId) {
    // 登记表承载位与 `document:open` 同源记录声明不一致：构造性漂移，经契约面外码归一呈现。
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.idConflict, {
      message: '卡片窗口装载输入投递：窗口登记的文档标识与来源会话记录声明冲突',
      details: { source: record.source, documentId: binding.documentId },
    });
  }

  const documentId = record.documentId ?? binding.documentId;
  const payload: ICardWindowInitPayload = {
    source: record.source,
    documentId,
    resourceBase: binding.resourceBase,
    pluginEntries: {},
    tokens: {},
  };
  // 绑定腿交付值先过 payload 权威闸再落承载位：不合 ID 词法的脏绑定不进登记表（渲染侧不会
  // 观察到「已绑定却投递失败」的半钉死态）。
  const validatedPayload = validateCardWindowInitPayload(payload);
  if (record.documentId === null) {
    const outcome = deps.orchestrator.bindDocument(windowId, binding.documentId);
    if (outcome.status === 'unregistered') {
      throw createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown, { details: { windowId } });
    }
    if (outcome.status === 'conflict') {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.idConflict, {
        message: '卡片窗口装载输入投递：窗口登记的文档标识与来源会话记录声明冲突',
        details: { source: record.source, documentId: binding.documentId },
      });
    }
  }

  const result = createCardWindowInitResult(requestId, windowId, validatedPayload);
  // 发送前自检：回包违约（含 windowId↔init 一致性漂移、payload 字段漂移）在出桥前收敛。
  return validateCardWindowInitResponse(result, requestId);
}

/**
 * 构造卡片窗口装载输入投递处理函数（两臂恒在：就绪/空载/失败全部以封套交付，本函数不抛出）。
 *
 * @param deps 投递臂依赖。
 * @returns `ipcMain.handle(CARD_WINDOW_INIT_REQUEST_CHANNEL, …)` 直接可注册的监听器。
 */
export function createCardWindowInitHandler(deps: CardWindowInitHandlerDeps): CardWindowInitHandler {
  return (event: ShellIpcInvokeEvent, data: unknown): Promise<unknown> => {
    // 身份取证单点：`event.sender.id` = `webContents.id`（§7.4），渲染侧无自报入口。
    const windowId = event.sender.id;
    let requestId = CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID;
    try {
      const request = validateCardWindowInitRequest(data);
      requestId = request.requestId;
      return Promise.resolve(deliverInit(deps, windowId, requestId));
    } catch (error: unknown) {
      // 关联标识尽力恢复：投递腿未运行、请求闸即拒时，封套键集完好则逐字回带（见
      // {@link recoverRequestId}）；破损到取不出的形态才落未关联标识。
      const correlated = requestId === CARD_WINDOW_INIT_UNCORRELATED_REQUEST_ID ? recoverRequestId(data) : requestId;
      return Promise.resolve(createCardWindowInitFailure(correlated, windowId, error));
    }
  };
}

/** 通道注册项（与 `registerDocumentViewChannel` 同型）。 */
export interface CardWindowInitRegistrationDeps {
  /** `ipcMain` 切片（与其余渲染 → 主通道同一注入面）。 */
  readonly ipcMain: ShellIpcMain;
  /** 投递处理函数（真实臂；{@link createCardWindowInitHandler} 产出）。 */
  readonly handler: CardWindowInitHandler;
  /** 通道名覆写；缺省取契约唯一名字来源 {@link CARD_WINDOW_INIT_REQUEST_CHANNEL}。 */
  readonly channel?: string;
}

/**
 * 注册卡片窗口装载输入投递通道（壳启动 `ipc` 段；权限判定不适用——两端均为平台自身代码）。
 *
 * @param deps 注册项。
 * @returns 注销函数（幂等，随壳逆序收口）。
 */
export function registerCardWindowInitChannel(deps: CardWindowInitRegistrationDeps): () => void {
  const channel = deps.channel ?? CARD_WINDOW_INIT_REQUEST_CHANNEL;
  deps.ipcMain.handle(channel, (event, ...args: readonly unknown[]): Promise<unknown> => deps.handler(event, args[0]));
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    deps.ipcMain.removeHandler(channel);
  };
}
