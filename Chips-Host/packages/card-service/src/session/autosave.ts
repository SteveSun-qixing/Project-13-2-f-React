/**
 * 卡片会话自动保存调度器：防抖 + revision 并发合并 + 失败保留 dirty
 *
 * 逻辑来源：Chips-EditingEngine `src/core/card-service.ts`（task034 M2 上移）。
 * 职责转移：自动保存由 Host 主进程管理，应用只订阅事件。
 */

import { AUTOSAVE_DEBOUNCE_MS } from './constants';
import type { CardSessionSnapshot, CardSessionState } from './types';

export interface AutosaveSink {
  persist(state: CardSessionState): Promise<void>;
  onPersisted(state: CardSessionState): void;
  onPersistError(state: CardSessionState, error: unknown): void;
}

export class AutosaveScheduler {
  private readonly timerByCardId = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingByCardId = new Map<string, Promise<void>>();

  public constructor(private readonly sink: AutosaveSink) {}

  public schedule(state: CardSessionState): void {
    this.clear(state.snapshot.cardId);
    const timer = setTimeout(() => {
      this.timerByCardId.delete(state.snapshot.cardId);
      void this.flush(state);
    }, AUTOSAVE_DEBOUNCE_MS);
    this.timerByCardId.set(state.snapshot.cardId, timer);
  }

  public async flush(state: CardSessionState): Promise<void> {
    const cardId = state.snapshot.cardId;
    const existing = this.pendingByCardId.get(cardId);
    if (existing) {
      await existing;
      if (state.snapshot.isDirty) {
        this.schedule(state);
      }
      return;
    }

    if (!state.snapshot.isDirty) {
      return;
    }

    const pending = this.sink
      .persist(state)
      .then(() => {
        this.sink.onPersisted(state);
      })
      .catch((error) => {
        this.sink.onPersistError(state, error);
      })
      .finally(() => {
        if (this.pendingByCardId.get(cardId) === pending) {
          this.pendingByCardId.delete(cardId);
        }
        if (state.snapshot.isDirty) {
          this.schedule(state);
        }
      });

    this.pendingByCardId.set(cardId, pending);
    await pending;
  }

  public clear(cardId: string): void {
    const timer = this.timerByCardId.get(cardId);
    if (timer) {
      clearTimeout(timer);
      this.timerByCardId.delete(cardId);
    }
  }

  public clearAll(): void {
    for (const timer of this.timerByCardId.values()) {
      clearTimeout(timer);
    }
    this.timerByCardId.clear();
  }

  /** 供测试使用：当前是否有挂起任务。 */
  public hasPending(cardId: string): boolean {
    return this.timerByCardId.has(cardId) || this.pendingByCardId.has(cardId);
  }
}
