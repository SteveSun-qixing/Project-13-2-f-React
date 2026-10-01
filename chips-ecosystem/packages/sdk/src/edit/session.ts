/**
 * 编辑会话契约类型（12-编辑引擎设计 §三、编辑会话 IEditSession）。
 *
 * 权威归属：
 * - 全部类型名与成员按 12 §3.1 原文逐字落位；字段级与文档库契约分件的对照由
 *   `tests/edit-contract-lock.test.ts` 锁定（任一侧漂移即确定性翻红）；
 * - `IEditSession` 是编辑链路对应用插件的**唯一入口**（12 §3.1 规则 1）：应用插件不得持有
 *   `IPluginRuntime`、文档会话或帧对象自行编排回流；
 * - 编辑句柄 `IBaseCardEditor` / `ILayoutEditor` 的权威定义在 08 §4.1 / 09 §7.1
 *   （本模块引用 `types/roles/*` 既有单点，不复制形状；SDK 分别导出两者，
 *   不导出笼统的 `IEditor`）；
 * - `DocumentKind` 与 04-能力契约规范 §2.3 / 12 §3.1 同名同形状（`'card' | 'box'`），
 *   SDK 只定义一次（`types/capabilities/common.ts` 判例，`types/roles/common.ts` 同纪律）；
 * - `preview` 的类型 `IRenderSession` 权威在 05 §2.4（本模块引用
 *   `types/render-session.ts`，不复制形状）；
 * - `EDIT_*` 错误域为生成契约常量（12 §9.2 新增表，`generated/error-codes.ts` 单源），
 *   本模块不复制清单。
 */

import type { ChipsError } from '../errors.js';
import type { ISubscription } from '../types/bridge.js';
import type { DocumentKind } from '../types/capabilities/common.js';
import type { IRenderSession } from '../types/render-session.js';
import type { IBaseCardEditor } from '../types/roles/basecard.js';
import type { ILayoutEditor } from '../types/roles/boxlayout.js';

/**
 * 编辑会话状态机（12 §3.1；生命周期与释放顺序见 12 §3.2）：
 * `opening` 成功后进入 `active`；`saving` 为 `document:save` 在途（期间新回流排队）；
 * `disposed` 为终态且幂等，`dispose()` 后再调用返回 `EDIT_SESSION_DISPOSED`。
 */
export type EditSessionState = 'opening' | 'active' | 'saving' | 'disposed';

/** 编辑打开请求（12 §3.1）；`source` 为受管引用（06-资源协议规范）。 */
export interface EditRequest {
  kind: DocumentKind;
  source: string;
  options?: EditOptions;
}

/** 编辑会话选项（12 §3.1）。 */
export interface EditOptions {
  /** 默认 `true`（12 §3.1；自动保存语义见 12 §6.3）。 */
  autoSave?: boolean;
  /** 默认 500；取值范围 100–5000（12 §3.1、§6.3 规则 2）。 */
  autoSaveDelayMs?: number;
  /** 默认 100；取值范围 10–1000，超限丢弃最旧记录（12 §3.1、§7.1）。 */
  historyLimit?: number;
  signal?: AbortSignal;
}

/**
 * 编辑引擎入口（12 §3.1）：由平台提供，官方编辑引擎应用经它打开编辑会话（12 §2.1）。
 * `open` 失败不产生半开会话（12 §3.2 opening 行）。
 */
export interface IEditEngine {
  open(request: EditRequest): Promise<IEditSession>;
}

/** 编辑会话事件与载荷映射（12 §3.1）。 */
export interface EditEventMap {
  ready: { sessionId: string };
  'revision-changed': { revision: number };
  'dirty-changed': { dirty: boolean };
  'history-changed': { canUndo: boolean; canRedo: boolean };
  saved: { digest: string };
  error: ChipsError;
  disposed: { sessionId: string };
}

/**
 * 编辑会话（12 §3.1 原文逐字）。
 *
 * 回流唯一时序（12 §6.1、08 §4.3 规则 1）：`getChange()` → 编辑链路校验 →
 * `document:write`（输出 `{ revision }`）→ 渲染会话 `update(view, revision)` →
 * `markCommitted(revision)`；`revision` 必须严格递增，回流失败不推进、不 `markCommitted`
 * （12 §3.5）。方法返回的 `Promise` 在对应回流完成（或报错）后 settle，连续调用按调用顺序
 * 串行执行（12 §3.1 规则 4）。
 */
export interface IEditSession {
  /** 编辑会话 ID（12 §3.1）。 */
  readonly id: string;
  /** = `card_id` / `box_id`，跨会话稳定（12 §3.1）。 */
  readonly documentId: string;
  readonly kind: DocumentKind;
  /** 受管引用，会话内不变（12 §3.1）。 */
  readonly source: string;
  readonly state: EditSessionState;
  /** 与渲染会话、文档模型共享的修订号；取自 `document:write` 的输出（12 §3.1、§3.5）。 */
  readonly revision: number;
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** 编辑态预览渲染会话（同一解析结果；12 §3.1），应用插件把它挂载到自身容器（12 §3.3 规则 3）。 */
  readonly preview: IRenderSession;

  /** 挂载节点编辑器；每个节点至多一个，重复挂载同一 `nodeId` 先释放旧实例（12 §3.4）。 */
  mountNodeEditor(nodeId: string, container: HTMLElement): Promise<IBaseCardEditor>;
  /** 释放节点编辑器：调用 `IBaseCardEditor.dispose()` 并清空容器（12 §3.4）。 */
  unmountNodeEditor(nodeId: string): void;
  /** 挂载布局编辑器；每个编辑会话至多一个（12 §3.4）。 */
  mountLayoutEditor(container: HTMLElement): Promise<ILayoutEditor>;
  unmountLayoutEditor(): void;

  /** 仅对 `kind: 'card'` 有效；不匹配时返回 `EDIT_TARGET_UNSUPPORTED`（12 §3.1 规则 2）。 */
  insertNode(index: number, cardType: string): Promise<string>;
  removeNode(nodeId: string): Promise<void>;
  moveNode(nodeId: string, toIndex: number): Promise<void>;

  /** 仅对 `kind: 'box'` 有效；不匹配时返回 `EDIT_TARGET_UNSUPPORTED`（12 §3.1 规则 2）。 */
  insertEntry(index: number, input: EntryInput): Promise<string>;
  removeEntry(entryId: string): Promise<void>;
  moveEntry(entryId: string, toIndex: number): Promise<void>;
  switchLayout(layoutType: string): Promise<void>;

  updateMetadata(patch: MetadataPatch): Promise<void>;
  /** 经资源管理受控提交写入封面 HTML；不提供资源级撤销（12 §6.2 规则 5）。 */
  writeCover(html: string): Promise<void>;

  /** 撤销/重做按新内容生成一次新的回流，不回退 revision（12 §7.1）。 */
  undo(): Promise<void>;
  redo(): Promise<void>;
  /** 完成当前全部待提交回流后立即 `document:save`（12 §6.3 规则 3）。 */
  flush(): Promise<void>;
  /** `dirty == false` 时幂等 no-op（12 §6.3 规则 5）。 */
  save(): Promise<void>;
  /**
   * 形态受文档类型约束：卡片支持 `archive` 与 `directory`；箱子只有单文件形态，
   * 对箱子请求 `directory` 返回 `EDIT_TARGET_UNSUPPORTED`（12 §3.1 规则 5；
   * 联合同域于 `document:export` 的 `DocumentExportForm`）。
   */
  exportDocument(form: 'archive' | 'directory', target: string): Promise<void>;

  subscribe<TEvent extends keyof EditEventMap>(
    event: TEvent,
    handler: (payload: EditEventMap[TEvent]) => void
  ): ISubscription;
  /** 释放固定顺序见 12 §3.2；幂等；释放后操作返回 `EDIT_SESSION_DISPOSED`。 */
  dispose(): Promise<void>;
}

/** 箱子条目输入（12 §3.1）；`url` 形态以 02-箱子文件格式 第三节为准（R13）。 */
export interface EntryInput {
  url: string;
  /** 默认 `true`。 */
  enabled?: boolean;
  snapshot?: Record<string, unknown>;
  layout_hints?: Record<string, unknown>;
}

/** 卡片元数据补丁（12 §3.1）；`cover_ratio` 为 `'宽:高'`。 */
export interface MetadataPatch {
  name?: string;
  tags?: string[];
  cover_ratio?: string;
}
