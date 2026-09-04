/**
 * 快照式撤销/重做（移植自 GenOffice Slides 主进程的 session-state.ts 历史部分，
 * 由主进程态改为本地会话态）：文档事实源是会话持有的 deck.slides（就地变更）+
 * archive.entries 手术，历史同样保存在会话内——每次编辑前做快照。
 * slides 需要深拷贝（元素被就地修改）；entries 只需浅拷贝 Map（字节缓冲只被整体
 * 替换、从不就地修改——与 op 执行器快照回滚共用同一不变式）。
 */
import type { OpenedPptx, Slide } from '@genoffice/pptx-engine'

export interface HistorySnapshot {
  slides: Slide[]
  entries: Map<string, Uint8Array>
  size: { cx: number; cy: number }
}

const MAX_HISTORY = 50

function trimHistory(stack: HistorySnapshot[]): void {
  while (stack.length > MAX_HISTORY) stack.shift()
}

export function takeSnapshot(opened: OpenedPptx): HistorySnapshot {
  return {
    slides: structuredClone(opened.deck.slides),
    entries: new Map(opened.archive.entries),
    size: { ...opened.deck.size },
  }
}

/** 恢复必须深拷贝：快照数组交给活动 deck 后会被就地修改。 */
function cloneSnapshot(snap: HistorySnapshot): HistorySnapshot {
  return {
    slides: structuredClone(snap.slides),
    entries: new Map(snap.entries),
    size: { ...snap.size },
  }
}

export function restoreSnapshot(
  opened: OpenedPptx,
  snap: HistorySnapshot,
  clone = true,
): void {
  const next = clone ? cloneSnapshot(snap) : snap
  opened.deck.slides = next.slides
  opened.deck.size = next.size
  const entries = opened.archive.entries
  entries.clear()
  for (const [key, value] of next.entries) entries.set(key, value)
}

/** 撤销/重做栈对（容量上限内整体快照，语义与原版一致）。 */
export class SessionHistory {
  private undoStack: HistorySnapshot[] = []
  private redoStack: HistorySnapshot[] = []

  constructor(private readonly opened: OpenedPptx) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** 编辑前调用：压入撤销栈并清空重做栈。 */
  push(): void {
    this.undoStack.push(takeSnapshot(this.opened))
    trimHistory(this.undoStack)
    this.redoStack = []
  }

  /** 编辑失败时撤销刚压入的快照（无变更不得占用历史步骤）。 */
  pop(): void {
    this.undoStack.pop()
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false
    this.redoStack.push(takeSnapshot(this.opened))
    restoreSnapshot(this.opened, this.undoStack.pop()!)
    return true
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false
    this.undoStack.push(takeSnapshot(this.opened))
    restoreSnapshot(this.opened, this.redoStack.pop()!)
    return true
  }
}
