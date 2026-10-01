/**
 * 编辑历史记录模型（12-编辑引擎设计 §7.2、历史记录模型）。
 *
 * 权威归属：
 * - 形状按 12 §7.2 原文逐字落位；历史栈归属编辑链路（会话级），卡片与箱子共用同一套
 *   实现（12 §7.1）；`IEditSession` 面上只暴露 `canUndo` / `canRedo` / `undo()` /
 *   `redo()`（12 §3.1），历史记录本体是编辑链路平台内部模型；
 * - `forward` / `inverse` 都是完整的模型切片载荷（`replace` 语义），不是补丁：文档服务
 *   只接受完整切片（12 §7.2 规则 1，11-文档服务设计 §4.4）；
 * - 撤销/重做必须走与普通编辑完全相同的时序（校验 → `document:write` → `update` →
 *   `markCommitted`），不回退 revision（12 §7.1）；
 * - `change` 载荷引用 `LayoutChange`（09 §7.1）既有单点（`types/roles/boxlayout.ts`），
 *   不复制形状。
 */

import type { LayoutChange } from '../types/roles/boxlayout.js';

/** 历史记录的模型分片键（12 §7.2）；封面资源写入与资源导入/删除不进入历史栈（12 §7.1）。 */
export type EditPayloadPart = 'metadata' | 'structure' | 'content' | 'layout';

/**
 * 历史记录（12 §7.2 原文逐字）。
 *
 * `label` 为简体中文操作名，如"插入节点""调整布局"；合并（coalescing）策略：同一
 * `target`、同一编辑场、连续输入且间隔 < 300ms 的操作合并为一条记录，插入/删除/重排/
 * 布局替换等结构操作不合并（12 §7.2 规则 3）。历史记录只包含模型切片，不含 DOM、句柄、
 * 字节或路径（12 §7.2 规则 6）。
 */
export interface EditHistoryEntry {
  id: string;
  label: string;
  createdAt: number;
  target: { part: EditPayloadPart; nodeId?: string };
  /** 正向回流载荷（重做使用），按 §6.1 时序回流（12 §7.2 规则 2）。 */
  forward: ChangePayload;
  /** 逆向回流载荷（撤销使用），按 §6.1 时序回流（12 §7.2 规则 2）。 */
  inverse: ChangePayload;
}

/**
 * 回流模型切片载荷（12 §7.2 原文逐字）：`document:write` 各分片写入语义的载荷形状
 * （12 §6.2 节点级变更与 `document:write` 扩展语义表）。
 */
export type ChangePayload =
  | { part: 'metadata'; value: Record<string, unknown> }
  | { part: 'structure'; value: Record<string, unknown> }
  | { part: 'content'; nodeId: string; value: Record<string, unknown> | null }
  | { part: 'layout'; layoutType: string; change: LayoutChange };
