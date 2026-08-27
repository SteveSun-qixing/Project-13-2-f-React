/**
 * 泛型 undo/redo 历史栈（Host 公共模块）
 *
 * 语义基线：Chips-EditingEngine `src/core/command-manager.ts`（task034 M2 上移闭环）。
 * card-service 与 box-service 的会话历史共用本实现。
 * - 合并窗口：同一 mergeKey 连续记录在 HISTORY_MERGE_WINDOW_MS 内合并为一步；
 * - 历史上限：limit，超出丢弃最旧一步；
 * - 入栈语义：调用方在**修改前**记录当前状态，undo 恢复修改前快照。
 */

export const HISTORY_MERGE_WINDOW_MS = 500;

export const HISTORY_DEFAULT_LIMIT = 100;

export interface HistoryEntry<T> {
  snapshot: T;
  label: string;
  recordedAt: number;
  mergeKey?: string;
}

export interface HistoryView {
  undoAvailable: boolean;
  redoAvailable: boolean;
  undoStack: Array<{ label: string; recordedAt: number }>;
  redoStack: Array<{ label: string; recordedAt: number }>;
}

export class HistoryStack<T> {
  private readonly undoStack: HistoryEntry<T>[] = [];
  private readonly redoStack: HistoryEntry<T>[] = [];
  private readonly limit: number;

  public constructor(limit: number = HISTORY_DEFAULT_LIMIT) {
    this.limit = limit;
  }

  /** 入栈一条历史（覆盖性记录，不改变当前快照；应在修改前调用）。 */
  public record(snapshot: T, label: string, mergeKey?: string): void {
    const last = this.undoStack[this.undoStack.length - 1];
    const now = Date.now();
    if (
      last &&
      last.mergeKey &&
      last.mergeKey === mergeKey &&
      now - last.recordedAt <= HISTORY_MERGE_WINDOW_MS
    ) {
      this.undoStack[this.undoStack.length - 1] = {
        snapshot: this.clone(snapshot),
        label,
        recordedAt: now,
        mergeKey,
      };
      return;
    }

    this.undoStack.push({
      snapshot: this.clone(snapshot),
      label,
      recordedAt: now,
      mergeKey,
    });
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /** 撤销：返回上一步快照与标签；无可撤销时返回 null。 */
  public undo(current: T): { snapshot: T; label: string } | null {
    const entry = this.undoStack.pop();
    if (!entry) {
      return null;
    }
    this.redoStack.push({ snapshot: this.clone(current), label: entry.label, recordedAt: Date.now(), mergeKey: entry.mergeKey });
    return { snapshot: entry.snapshot, label: entry.label };
  }

  /** 重做：返回下一步快照与标签；无可重做时返回 null。 */
  public redo(current: T): { snapshot: T; label: string } | null {
    const entry = this.redoStack.pop();
    if (!entry) {
      return null;
    }
    this.undoStack.push({ snapshot: this.clone(current), label: entry.label, recordedAt: Date.now(), mergeKey: entry.mergeKey });
    return { snapshot: entry.snapshot, label: entry.label };
  }

  public view(): HistoryView {
    return {
      undoAvailable: this.undoStack.length > 0,
      redoAvailable: this.redoStack.length > 0,
      undoStack: this.undoStack
        .slice()
        .reverse()
        .map((entry) => ({ label: entry.label, recordedAt: entry.recordedAt })),
      redoStack: this.redoStack
        .slice()
        .reverse()
        .map((entry) => ({ label: entry.label, recordedAt: entry.recordedAt })),
    };
  }

  public clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /** 快照克隆钩子：默认浅拷贝；深拷贝语义由子类/调用方覆盖。 */
  protected clone(value: T): T {
    return value;
  }
}
