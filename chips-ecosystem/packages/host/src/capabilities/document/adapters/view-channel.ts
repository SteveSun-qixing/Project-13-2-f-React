/**
 * 宿主内部取视图通道·主进程侧接线（金链路刀5 段A；工单035 裁定 C+B 双层落点）。
 *
 * 权威：`05-渲染引擎设计` §2.3（跨进程时序：解析请求与 `DocumentView` 回传发生在
 * 渲染进程 ↔ 主进程之间）、§2.6（构建器执行位主进程、输入句柄+数值会话、无自有缓存）；
 * 封套、校验闸与在册错误面的唯一契约权威在 `renderer/document-view-channel.ts`（任务 #105
 * 冻结件，本模块是其主进程侧消费方，不重复声明任何形状）。
 *
 * @remarks
 * - **窗口↔会话归属臂（工单043 §五 G2 / 工单043-A4）**：注册臂消费 `event.sender.id`
 *   作为发起窗口身份（身份取证单点在主进程侧，渲染侧无自报入口——母型比照
 *   `main/card-window-init-channel.ts:183`，02 §7.4），逐请求交端点
 *   `handleRequest(windowId, data)`；`IDocumentService.resolveViewSession` 对记录会话做
 *   归属比对，无一会话归属发起窗口即以在册码 `BRIDGE_SESSION_UNKNOWN`（通道在册错误面，
 *   `renderer/document-view-channel.ts` 冻结件）失败臂回包——他窗换不来本窗文档的视图。
 * - **string↔u64 归一单点在此**（RFC O3 / 工单035 裁定二）：{@link createDocumentViewSessionResolver}
 *   把渲染侧端口输入 `{source, documentId}`（wire `string` 身份，全链路唯一对外身份）连同
 *   取证的发起窗口身份，经 `IDocumentService.resolveViewSession` 定位会话存储记录，取记录级
 *   `nativeSession`（backing 数值会话，唯一生成点在 `session-store.ts`）交刀3 构建器逐调用
 *   消费；句柄与数值会话全程留在主进程——回包封套只承载契约在册字段，深校验闸
 *   （`guardDocumentViewCardRenderView` + 响应侧 `validateDocumentViewChannelResponse`）
 *   可结构化克隆面保证任何宿主对象投影都无法越界。
 * - 两臂诚实语义：文档服务接线（`production-wiring` `wired` 臂）时端点执行真实构建链；
 *   未接线（当前生产恒回退态，工单036）时端点为**真实拒绝臂**——请求仍先过契约请求闸、
 *   以在册码 `BRIDGE_INTERNAL` 失败臂回包，绝不静默、绝不由渲染侧观察到悬空 promise。
 * - 错误面纪律：全部回包失败臂经 `createDocumentViewBuildFailure` 单点归一
 *   （面外码 → `BRIDGE_INTERNAL`，`details.cause` 承载登记码原值）；请求封套破损到
 *   取不出合法 `requestId` 时以固定回退关联标识回包（关联丢失属契约违约的如实后果）。
 * - 每请求零日志：本通道两端均为平台自身代码，失败以回包呈现（渲染侧消费闸负责呈现），
 *   处理函数不写任何诊断输出（壳冒烟 stderr 洁净闸同口径）。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '@chips/bridge';

import {
  DOCUMENT_VIEW_REQUEST_CHANNEL,
  createDocumentViewBuildFailure,
  createDocumentViewBuildResult,
  guardDocumentViewCardRenderView,
  validateDocumentViewChannelRequest,
} from '../../../renderer/document-view-channel.js';
import { createDocumentViewBuilder } from '../../../renderer/document-view-builder.js';
import type {
  DocumentViewSessionResolver,
  IDocumentViewBuildInput,
  IDocumentViewSessionBinding,
  INativeDocumentViewHandle,
  INativeDocumentViewModule,
} from '../../../renderer/document-view-builder.js';
import type { IDocumentViewChannelEndpoint } from '../../../runtime/contracts.js';
import type { ShellIpcMain } from '../../../main/shell-api.js';
import { getHostTrace } from '../../../shared/host-trace.js';
import { DOCUMENT_BUSINESS_ERROR_CODES, documentError } from '../errors.js';
import type { IDocumentService } from '../service.js';

/**
 * 取视图通道构建边界的标记点名。
 *
 * @remarks 「视图构建」阶段边界在《渲染引擎设计》§10.1 有预算语义，但
 * `@chips/perf` 规范标记点注册表（`src/scenarios.ts` `MARKERS`）尚无在册名；
 * 本波采用建议名 `render:view-built` / `render:view-build-failed` 导出，
 * 命名在册化随工单041 修复波 findings 交裁定（不阻塞观测链路）。
 */
export const DOCUMENT_VIEW_TRACE_PHASES = {
  viewBuilt: 'render:view-built',
  viewBuildFailed: 'render:view-build-failed',
} as const;

/**
 * 请求封套破损到取不出合法 `requestId` 时的失败臂关联标识。
 *
 * @remarks 响应闸在册要求 `requestId` 为非空字符串——违约请求不得也回不去包；
 * 该固定标识如实呈现「关联丢失源于请求契约违约」。
 */
export const DOCUMENT_VIEW_UNCORRELATED_REQUEST_ID = 'document-view:uncorrelated-request';

/**
 * 受管引用的作用域段词法（`06-资源协议规范` §二 URI 语法的 scope 段词法本体：小写字母开头、
 * `[a-z0-9-]`、总长 ≤64）。
 *
 * @remarks 这里只取 **词法** 而不复用 `parseResourceUri` 的完整语法闸：后者按 §3.1 作用域种类
 * 枚举（`workspace-*` / `card-*` / `box-*` / `plugin-*` / `temp-*` 与三个保留名）校验 scope，
 * 而受管引用由资源管理器 `normalizeSource` 交付、其作用域命名属资源域登记事实（文档侧不判定种类）；
 * 本解析器只需把该命名逐字投影为构建器绑定的 `managedScope` 标签，供读资源臂做跨作用域拦截
 * （`document-view-builder.ts` 的 `packagePathFromManagedUri` 以字符串等式比对）。词法违约
 * （非 `chips-resource://` 前缀、空/非法 scope 段）仍是构造性漂移，如实 `BRIDGE_INTERNAL`。
 */
const SCOPE_SEGMENT_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const RESOURCE_URI_SCHEME = 'chips-resource';

/** 取 `chips-resource://<scope>/…` 的 scope 段（小写归一）；词法非法返回 `null`。 */
function scopeSegmentOf(managedUri: string): string | null {
  const separator = managedUri.indexOf('://');
  if (separator <= 0 || managedUri.slice(0, separator).toLowerCase() !== RESOURCE_URI_SCHEME) {
    return null;
  }
  const authority = managedUri.slice(separator + 3);
  const boundary = authority.search(/[/?#]/);
  const scope = (boundary < 0 ? authority : authority.slice(0, boundary)).toLowerCase();
  return SCOPE_SEGMENT_PATTERN.test(scope) ? scope : null;
}

/**
 * 逐调用解析视图会话绑定（同步判定；异步壳见 {@link createDocumentViewSessionResolver}）。
 *
 * @throws `DOCUMENT_NOT_OPEN`（来源无存活记录）、`DOCUMENT_ID_CONFLICT`（`{source, documentId}`
 *   对与会话存储声明冲突）、`BRIDGE_SESSION_UNKNOWN`（记录在册但无一会话归属发起窗口，
 *   工单043-A4 G2）；受管引用的作用域段词法违约（构造性漂移）以 `BRIDGE_INTERNAL` 抛出。
 */
function resolveViewSessionBinding(
  service: IDocumentService,
  input: IDocumentViewBuildInput,
  windowId: number,
): IDocumentViewSessionBinding {
  const resolution = service.resolveViewSession({ source: input.source, documentId: input.documentId, windowId });
  if (resolution.status === 'not-found') {
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, {
      details: { documentId: input.documentId, source: input.source },
    });
  }
  if (resolution.status === 'unowned') {
    // 归属臂（G2）：文档在册、标识相符，但发起窗口不持有该文档的任何桥接会话——
    // 跨窗口取视图以通道在册码如实拒绝（不泄露句柄/数值会话/视图）。
    throw createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown, {
      message: '取视图通道拒绝：发起窗口不持有该文档的任何会话',
      details: { documentId: input.documentId, source: input.source },
    });
  }
  if (resolution.status === 'conflict') {
    throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.idConflict, {
      details: {
        documentId: input.documentId,
        source: input.source,
        reason: `来源与标识的二元组与会话存储声明不一致（该标识存活记录数 ${String(resolution.candidateCount)}）`,
      },
    });
  }
  const managedScope = scopeSegmentOf(resolution.managedUri);
  if (managedScope === null) {
    // 受管引用由打开链路 `normalizeSource` 交付，词法违约即构造性漂移：如实内部错误、不猜测作用域。
    throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
      message: '视图会话解析得到的受管引用不符合资源 URI 作用域段词法',
      details: { reason: 'malformed_scope' },
    });
  }
  return {
    // 句柄 token 原样投影（工单035 裁定二句柄侧归一）：刀3 构建器逐字回交本侧注入面
    // `native.buildDocumentView`，还原真实原生句柄的唯一触达点在 native-parser 适配器
    // `view` 臂的私有簿记——本行不解释、不复制句柄内部结构。
    handle: resolution.handle as unknown as INativeDocumentViewHandle,
    sessionId: resolution.nativeSession,
    managedScope,
  };
}

/**
 * 生产视图会话解析器（string↔u64 归一单点 + G2 归属臂的窗口身份注入位）。
 *
 * @param service 文档服务（组合根装载段交付；`resolveViewSession` 为其主进程内部查询面）。
 * @param windowId 发起窗口身份（主进程侧 `event.sender.id` 取证；渲染侧无自报入口）。
 * @returns 刀3 构建器消费的 {@link DocumentViewSessionResolver}。
 */
export function createDocumentViewSessionResolver(
  service: IDocumentService,
  windowId: number,
): DocumentViewSessionResolver {
  return (input) => {
    try {
      return Promise.resolve(resolveViewSessionBinding(service, input, windowId));
    } catch (error: unknown) {
      // 本解析器抛出的全部为唯一类族真错误（`DocumentCapabilityError` / `ChipsError`）；
      // 兜底包装仅满足拒绝语义，不吞码。
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/** 通道处理函数创建项（组合根装载段注入）。 */
export interface IDocumentViewChannelHandlerOptions {
  /** 文档服务（会话解析与句柄生命周期的权威载体）。 */
  readonly service: IDocumentService;
  /** §6.4 视图构建域注入面（生产 = native-parser 适配器 `view` 臂；测试注入替身）。 */
  readonly native: INativeDocumentViewModule;
}

/**
 * 构造真实构建臂端点（文档服务已接线）：来源窗口取证 → 请求闸 → 归属解析 →
 * 刀3 构建器（主进程执行位）→ 发送侧视图守门 → 结果臂；链路任一失败以失败臂回包
 * （本函数不抛出）。
 *
 * @remarks 构建器逐请求构造（注入面 fail-closed 名闸照常触达）：G2 的窗口身份经
 * {@link createDocumentViewSessionResolver} 闭包注入解析器，不进入渲染侧冻结输入形状
 * （`IDocumentViewBuildInput` 键集不动，任务 #105 冻结件纪律）。
 */
export function createDocumentViewChannelHandler(
  options: IDocumentViewChannelHandlerOptions,
): IDocumentViewChannelEndpoint {
  const { service, native } = options;
  return {
    async handleRequest(windowId: number, data: unknown): Promise<unknown> {
      let requestId = DOCUMENT_VIEW_UNCORRELATED_REQUEST_ID;
      // 视图构建阶段导出（工单041 修复波；《调试指南》§2.3/§6.1 记录形态，`durationMs`
      // = 构建任务整体耗时。「视图构建」边界在 `@chips/perf` `MARKERS` 无在册名，
      // 暂用建议名 `render:view-built` 并登记 findings 待裁——见该单修复波说明）。
      const trace = getHostTrace();
      const traceEnabled = trace.enabled('render');
      const startedAtMs = performance.now();
      try {
        const request = validateDocumentViewChannelRequest(data);
        requestId = request.requestId;
        if (!Number.isInteger(windowId)) {
          // 来源窗口取证破防（调用方交付了非法窗口身份）：在册码如实拒绝，不触达构建链。
          throw createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown, {
            message: '取视图通道拒绝：发起窗口身份不可取证',
            details: { reason: 'invalid_sender_window' },
          });
        }
        const builder = createDocumentViewBuilder({
          native,
          resolveSession: createDocumentViewSessionResolver(service, windowId),
        });
        const view = await builder.buildView(request.input);
        const result = createDocumentViewBuildResult(requestId, guardDocumentViewCardRenderView(view));
        if (traceEnabled) {
          trace.record({
            category: 'render',
            phase: DOCUMENT_VIEW_TRACE_PHASES.viewBuilt,
            message: DOCUMENT_VIEW_REQUEST_CHANNEL,
            outcome: 'ok',
            durationMs: Math.max(0, performance.now() - startedAtMs),
            details: {
              requestId,
              source: request.input.source,
              documentId: request.input.documentId,
              kind: request.input.kind,
            },
          });
        }
        return result;
      } catch (error: unknown) {
        if (traceEnabled) {
          const code = (error as { code?: unknown } | null)?.code;
          trace.record({
            category: 'render',
            phase: DOCUMENT_VIEW_TRACE_PHASES.viewBuildFailed,
            message: DOCUMENT_VIEW_REQUEST_CHANNEL,
            outcome: 'error',
            errorCode: typeof code === 'string' ? code : null,
            durationMs: Math.max(0, performance.now() - startedAtMs),
            details: { requestId },
          });
        }
        return createDocumentViewBuildFailure(requestId, error);
      }
    },
  };
}

/**
 * 构造未接线诚实拒绝臂端点：请求先过契约请求闸（非法载荷如实 `BRIDGE_INVALID_INPUT`），
 * 合法请求以在册码 `BRIDGE_INTERNAL` 失败臂拒绝（文档能力硬依赖缺位，工单036）。
 * 与 `pluginActivationPortFor` / `document:*` 未注册臂同型：真实拒绝、留痕在组合根
 * 装载段既有诊断（本端点每请求零日志），不静默、不伪造成功。
 */
export function createUnavailableDocumentViewChannelEndpoint(): IDocumentViewChannelEndpoint {
  return {
    handleRequest(_windowId: number, data: unknown): Promise<unknown> {
      let requestId = DOCUMENT_VIEW_UNCORRELATED_REQUEST_ID;
      try {
        const request = validateDocumentViewChannelRequest(data);
        requestId = request.requestId;
        throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
          message: '取视图通道未接线：文档能力硬依赖缺位，维持诚实回退（工单036）',
          details: { gate: 'wiring' },
        });
      } catch (error: unknown) {
        return Promise.resolve(createDocumentViewBuildFailure(requestId, error));
      }
    },
  };
}

/** 通道注册项。 */
export interface IDocumentViewChannelRegistrationDeps {
  /** `ipcMain` 切片（与三个渲染 → 主通道同一注入面）。 */
  readonly ipcMain: ShellIpcMain;
  /** 端点（真实构建臂或未接线诚实拒绝臂，由组合根装载段判定）。 */
  readonly endpoint: IDocumentViewChannelEndpoint;
  /** 通道名覆写；缺省取契约唯一名字来源 {@link DOCUMENT_VIEW_REQUEST_CHANNEL}。 */
  readonly channel?: string;
}

/**
 * 注册宿主内部取视图通道（壳启动 `ipc` 段）。
 *
 * @remarks 权限判定不适用（两端均为平台自身代码），但**来源窗口身份照取证**
 * （工单043 §五 G2）：`event.sender.id` 逐请求交端点做窗口↔会话归属比对，
 * 渲染侧负载无身份自报入口（母型 `main/card-window-init-channel.ts`）。
 *
 * @param deps 注册项。
 * @returns 注销函数（幂等，随壳逆序收口）。
 */
export function registerDocumentViewChannel(deps: IDocumentViewChannelRegistrationDeps): () => void {
  const channel = deps.channel ?? DOCUMENT_VIEW_REQUEST_CHANNEL;
  deps.ipcMain.handle(channel, async (event, ...args: readonly unknown[]): Promise<unknown> =>
    deps.endpoint.handleRequest(event.sender.id, args[0]),
  );
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    deps.ipcMain.removeHandler(channel);
  };
}
