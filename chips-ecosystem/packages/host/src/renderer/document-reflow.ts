/**
 * 编辑回流订阅编排（金链路刀5 段B：`document:changed → buildView → session.update`
 * 与 §2.6「写后重建」的触发编排本体）。
 *
 * 权威：
 * - `05-渲染引擎设计` §2.6（构建器无自有缓存：编辑态每次回流由编辑链路在 `document:write`
 *   成功后触发重新构建，`revision` 由文档服务推进）、§2.3（回流重建的视图经宿主内部取
 *   视图通道取回——`viewBuilder` 端口的正式实现即 `document-view-channel-client.ts`
 *   消费臂）、§8.3（变更回流唯一时序：`getChange()` → 编辑链路校验 → `document:write`
 *   （返回 `{ revision }`）→ 渲染会话 `update(view, revision)` → `markCommitted(revision)`；
 *   `revision` 只能取自 `document:write` 的返回值，编辑链路不得自行推算）、§2.4 第 5 条
 *   （`update` 仅在 `ready` 生效、revision 严格递增、失败保留旧帧）、§11（错误模型）、
 *   §7.3（`host:update` revision 约束）；
 * - `11-文档服务设计` §4.2（`document:write` 不落盘、不发布事件——写后重建的触发点是
 *   `write` 的**成功返回**，不是事件）、§十（写入域错误码）；`05-事件契约规范` §4.2
 *   （`document:changed` payload 在册字段 `{uri, documentId, kind, digest, size}`——
 *   保存持久化/外部变更采纳后的跨窗口与外部变化回流臂按该形状逐字段校验消费）；
 * - `04-能力契约规范` §7.3（`document:write` 输入输出冻结形状，写臂经 Bridge 正式链路、
 *   R19 权限判定在 Bridge 侧）；
 * - 工单024（失败一律 `ChipsError` 唯一类呈现）、工单035（视图承载=宿主内部取视图通道）。
 *
 * @remarks
 * - 编排器与渲染会话一一绑定（`{source, documentId, kind}` 定位一份在渲染的文档）：
 *   两臂触发、一条串行队列执行——`executeAction`（编辑链路写后重建）与
 *   `document:changed` 订阅臂（保存/外部变更采纳后的回流）共享同一 Promise 链，
 *   重建与更新的先后次序恒定，不与在途回包交错。
 * - `document:write` 不发布事件（§4.2）是设计事实：写后重建由本编排器在 `write` 成功
 *   返回后直接触发（§2.6），`revision` 取 `write` 返回值（§8.3 唯一时序）；
 *   `document:changed` 订阅臂承载**另一会话保存落盘**或**外部变更采纳**后的跨域回流，
 *   其重建视图的 `revision` 以主进程回包视图为准（事件 payload 不携带 revision，
 *   §4.2 在册字段集如此，不发明字段）。
 * - 事件臂失败不升级（§7.3 事件是通知不是状态）：形状违约、定位不符、重建失败的
 *   `document:changed` 一律落诊断并保留旧帧，不向事件总线抛出、不将会话置错；
 *   `executeAction` 臂的失败如实上抛编辑链路（调用方按 §8.3 保持编辑器脏状态并决定
 *   重试，渲染侧旧帧不动——`update` 的失败收敛由会话层 §2.4 第 5 条承载）。
 * - 会话状态机零旁路：本编排器只消费 `IRenderSession.update` 公开面，回退/重复
 *   revision 的忽略与诊断由会话层在册守卫承载，编排器不重复裁决、不伪造状态。
 * - dispose 语义（幂等）：注销事件订阅、拒绝后续 `executeAction`（`RENDER_SESSION_DISPOSED`），
 *   在途队列自然收敛（更新落到已 disposed 会话时由会话层守卫拒绝，不产生半更新态）。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '@chips/bridge';

import { DOCUMENT_CAPABILITY_IDS, DOCUMENT_EVENT_IDS } from '../capabilities/document/contract.js';
import type {
  DocumentKind,
  IDocumentWriteInput,
  IDocumentWriteOutput,
} from '../capabilities/document/contract.js';
import { normalizeDocumentFailure } from './document-gateway.js';
import type { IChipsRequestFacade } from './document-gateway.js';
import { createRenderError, RENDER_ERROR_CODES } from './codes.js';
import { toChipsError } from '../preload/chips-error.js';
import type { IDocumentViewBuilder, IRenderSession } from './render-engine.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';

/**
 * `document:write` 写臂端口（编辑链路的正式能力通路：Bridge 形态经 `window.chips.request`，
 * R19 权限判定在 Bridge 侧；失败经渲染面既有 `normalizeDocumentFailure` 归一）。
 */
export interface IDocumentWritePort {
  write(input: IDocumentWriteInput): Promise<IDocumentWriteOutput>;
}

/** 构造 Bridge 形态写臂（渲染进程编辑链路唯一正式写通路）。 */
export function createBridgeDocumentWritePort(chips: IChipsRequestFacade): IDocumentWritePort {
  return {
    async write(input: IDocumentWriteInput): Promise<IDocumentWriteOutput> {
      try {
        return await chips.request<IDocumentWriteOutput>(DOCUMENT_CAPABILITY_IDS.write, input);
      } catch (error: unknown) {
        throw normalizeDocumentFailure(error);
      }
    },
  };
}

/** 事件订阅句柄（与 `window.chips.subscribe` 返回面同形）。 */
export interface IDocumentReflowSubscription {
  dispose(): void;
}

/**
 * 事件订阅注入口（渲染进程正式通路 = `window.chips.subscribe`；本编排器只消费
 * `document:changed` 一个事件 ID，订阅权限与投递语义归 Bridge 事件系统在册链路）。
 */
export type DocumentReflowEventSubscribe = (
  eventId: string,
  handler: (payload: unknown) => void
) => IDocumentReflowSubscription;

/**
 * 编辑动作（编辑链路完成 `getChange()` 采集与 `configSchema`/`validateConfig` 校验后的
 * 写入请求——与 `document:write` 输入逐字段同形，§8.3 唯一时序的宿主侧入口）。
 */
export type DocumentReflowAction = IDocumentWriteInput;

/** 回流编排器创建项。 */
export interface IDocumentReflowBindings {
  /** 会话登记的文档来源 URI（`document:changed` 定位比对键之一）。 */
  readonly source: string;
  /** 稳定文档标识（写臂与视图构建的定位字段；事件定位比对键之二）。 */
  readonly documentId: string;
  /** 文档类型（链路分支点唯一判别，§2.1）。 */
  readonly kind: DocumentKind;
  /** 被回流的渲染会话（更新面唯一入口，§8.3 `update(view, revision)`）。 */
  readonly session: IRenderSession;
  /** 写臂端口（Bridge 形态 = {@link createBridgeDocumentWritePort}）。 */
  readonly write: IDocumentWritePort;
  /** 视图构建端口（正式实现 = 取视图通道消费臂 `createDocumentViewChannelBuilder`）。 */
  readonly viewBuilder: IDocumentViewBuilder;
  /** 事件订阅注入口（正式实现 = `window.chips.subscribe`）。 */
  readonly subscribe: DocumentReflowEventSubscribe;
  /** 诊断口。 */
  readonly diagnostics: DiagnosticsSink;
}

/** 回流编排器面。 */
export interface IDocumentReflowCoordinator {
  /**
   * 执行编辑动作（§8.3 唯一时序的宿主侧承载）：`document:write` → 写后重建
   * （经取视图通道）→ `session.update(view, write 返回的 revision)`。
   *
   * @returns 回流完成（帧更新落定）；任一环节失败以 `ChipsError` 如实拒绝。
   */
  executeAction(action: DocumentReflowAction): Promise<void>;
  /** 注销订阅并拒绝后续动作（幂等）。 */
  dispose(): void;
}

/** `document:changed` payload 在册字段集（`05-事件契约规范` §4.2 精确五键）。 */
const DOCUMENT_CHANGED_FIELDS = ['uri', 'documentId', 'kind', 'digest', 'size'] as const;

/** 事件臂定位结果：匹配本会话 / 非本会话（忽略）/ 形状或声明违约（诊断后忽略）。 */
type ChangedOutcome = 'match' | 'ignore' | 'malformed';

/**
 * 校验并判定 `document:changed` payload（消费侧在册字段闸：公开事件面，载荷按不可信
 * 输入逐字段核验）。
 *
 * @remarks 身份比对：`uri` 与 `documentId` 二元组共同定位本会话文档；命中身份但
 * `kind` 声明与会话不符即发布侧自相矛盾（`05-ID生成规范`：`documentId` 是 `card_id`/
 * `box_id` 的全局唯一统一别名），按违约忽略不重建。
 */
function classifyChangedPayload(
  payload: unknown,
  source: string,
  documentId: string,
  kind: DocumentKind
): ChangedOutcome {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'malformed';
  }
  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [...DOCUMENT_CHANGED_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return 'malformed';
  }
  const { uri, documentId: changedId, digest, size } = record;
  const changedKind = record['kind'];
  if (
    typeof uri !== 'string' ||
    typeof changedId !== 'string' ||
    typeof digest !== 'string' ||
    (changedKind !== 'card' && changedKind !== 'box') ||
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size < 0
  ) {
    return 'malformed';
  }
  if (uri !== source || changedId !== documentId) {
    return 'ignore';
  }
  return changedKind === kind ? 'match' : 'malformed';
}

/**
 * 构造编辑回流编排器（会话级；订阅在构造时建立，`dispose()` 幂等收口）。
 *
 * @param bindings 编排项。
 * @returns 编排器面。
 */
export function createDocumentReflowCoordinator(bindings: IDocumentReflowBindings): IDocumentReflowCoordinator {
  const { source, documentId, kind, session, write, viewBuilder, subscribe, diagnostics } = bindings;
  let disposed = false;
  /** 两臂共享的串行队列尾（失败不阻断后续：队列只承载时序，错误归各调用方与诊断）。 */
  let chain: Promise<void> = Promise.resolve();

  const subscription = subscribe(DOCUMENT_EVENT_IDS.changed, (payload: unknown): void => {
    if (disposed) {
      return;
    }
    const outcome = classifyChangedPayload(payload, source, documentId, kind);
    if (outcome === 'malformed') {
      diagnostics.warn('render.reflow', 'document:changed 载荷不符合在册字段集，已忽略', {
        documentId,
        source,
      });
      return;
    }
    if (outcome === 'ignore') {
      return;
    }
    // 事件臂：重建取主进程回包视图的 revision；失败落诊断保留旧帧（事件是通知不是状态）。
    enqueue(async () => {
      const view = await viewBuilder.buildView({ source, documentId, kind });
      await session.update(view, view.revision);
    }).catch((error: unknown) => {
      diagnostics.warn('render.reflow', 'document:changed 回流重建失败，已保留旧帧', {
        documentId,
        source,
        reason: describeError(error),
      });
    });
  });

  /** 并入串行队列；返回本次任务自身的完成/拒绝（队列推进与任务结果解耦）。 */
  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  }

  return {
    executeAction(action: DocumentReflowAction): Promise<void> {
      if (disposed) {
        return Promise.reject(
          createRenderError({
            code: RENDER_ERROR_CODES.sessionDisposed,
            details: { documentId, source },
          })
        );
      }
      if (action.documentId !== documentId) {
        // 会话级编排器只受理绑定文档的写入（跨文档动作 = 编辑链路接线漂移，确定性拒绝）。
        return Promise.reject(
          createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
            message: '编辑动作的文档标识与渲染会话绑定的文档不一致',
            details: { gate: 'reflow', field: 'documentId', sessionId: session.id },
          })
        );
      }
      // §8.3 唯一时序：write 成功 → 经取视图通道写后重建 → update(view, write 返回的 revision)。
      // 请求逐字段物化（`nodeId` 缺席即不携带该键，与 §7.3 additionalProperties:false 同纪律）。
      const input: IDocumentWriteInput = {
        documentId: action.documentId,
        part: action.part,
        ...(action.nodeId === undefined ? {} : { nodeId: action.nodeId }),
        value: action.value,
      };
      return enqueue(async () => {
        const written = await write.write(input);
        const view = await viewBuilder.buildView({ source, documentId, kind });
        await session.update(view, written.revision);
      });
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      subscription.dispose();
    },
  };
}

/** 提取错误摘要（诊断用，不含敏感内容；唯一类还原后取在册码，与渲染面既有口径同形）。 */
function describeError(error: unknown): string {
  return toChipsError(error).code;
}
