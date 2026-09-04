import type { EngineAction } from "./action";
import { BundleAction } from "./action";

export const HISTORY_LIMIT = 50;

const DEFAULT_MEMORY_BUDGET = 512 * 1024 * 1024;

export class HistoryStack {
  limit = HISTORY_LIMIT;
  private stack: EngineAction[] = [];
  private index = -1;
  private listeners = new Set<() => void>();

  constructor(private readonly memoryBudget: number = DEFAULT_MEMORY_BUDGET) {}

  async doAction(action: EngineAction, options?: { mergeWithHistory?: string[] }): Promise<void> {
    await action.do();
    if (options?.mergeWithHistory && options.mergeWithHistory.length > 0) {
      const currentIndex = this.index;
      if (currentIndex >= 0 && currentIndex < this.stack.length) {
        const current = this.stack[currentIndex];
        if (current instanceof BundleAction) {
          const descriptions = new Set(
            current.getActions().map((item) => item.description),
          );
          const shouldMerge = options.mergeWithHistory.some((name) => descriptions.has(name));
          if (shouldMerge) {
            const merged = new BundleAction(current.description, [
              ...current.getActions(),
              action,
            ]);
            merged.memoryEstimate = current.memoryEstimate + action.memoryEstimate;
            this.stack[currentIndex] = merged;
            this.notify();
            return;
          }
        }
      }
    }
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(action);
    if (this.stack.length > this.limit) {
      const removed = this.stack.splice(0, this.stack.length - this.limit);
      for (const item of removed) {
        item.free?.();
      }
    }
    this.index = this.stack.length - 1;
    this.free();
    this.notify();
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) {
      return;
    }
    const action = this.stack[this.index];
    this.index -= 1;
    await action.undo();
    this.notify();
  }

  async redo(): Promise<void> {
    if (!this.canRedo()) {
      return;
    }
    this.index += 1;
    const action = this.stack[this.index];
    await action.do();
    this.notify();
  }

  canUndo(): boolean {
    return this.index >= 0;
  }

  canRedo(): boolean {
    return this.index + 1 < this.stack.length;
  }

  async scrapLastAction(): Promise<void> {
    if (!this.canUndo()) {
      return;
    }
    const action = this.stack[this.index];
    this.stack.splice(this.index, 1);
    this.index -= 1;
    await action.undo();
    action.free?.();
    this.notify();
  }

  free(): void {
    let total = 0;
    for (const action of this.stack) {
      total += action.memoryEstimate;
    }
    let startIndex = 0;
    while (total > this.memoryBudget && startIndex < this.index) {
      total -= this.stack[startIndex].memoryEstimate;
      this.stack[startIndex].free?.();
      startIndex += 1;
    }
    if (startIndex > 0) {
      this.stack = this.stack.slice(startIndex);
      this.index -= startIndex;
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
