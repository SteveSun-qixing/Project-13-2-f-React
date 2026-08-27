/**
 * 箱子会话自动保存调度器：防抖 + 串行化 + 失败保留 dirty
 *
 * 逻辑来源：Chips-EditingEngine `src/services/box-document-service.ts`（task034 M3 上移）。
 * 职责转移：自动保存由 Host 主进程管理，应用只订阅事件。
 */

import { BOX_AUTOSAVE_DEBOUNCE_MS } from './constants';
import type { BoxSessionSnapshot, BoxSessionState } from './types';

export interface BoxAutosaveSink {
  persist(state: BoxSessionState): Promise<void>;
  onPersisted(snapshot: BoxSessionSnapshot): void;
  onPersistError(snapshot: BoxSessionSnapshot, error: unknown): void;
}

export class BoxAutosaveScheduler {
  private readonly timerByBoxId = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingByBoxId = new Map<string, Promise<void>>();

  public constructor(private readonly sink: BoxAutosaveSink) {}

  public schedule(snapshot: BoxSessionSnapshot): void {
    this.clear(snapshot.boxId);
    const timer = setTimeout(() => {
      this.timerByBoxId.delete(snapshot.boxId);
      void this.flush(snapshot);
    }, BOX_AUTOSAVE_DEBOUNCE_MS);
    this.timerByBoxId.set(snapshot.boxId, timer);
  }

  public async flush(snapshot: BoxSessionSnapshot): Promise<void> {
    const boxId = snapshot.boxId;
    const existing = this.pendingByBoxId.get(boxId);
    if (existing) {
      await existing;
      if (snapshot.isDirty) {
        this.schedule(snapshot);
      }
      return;
    }

    if (!snapshot.isDirty) {
      return;
    }

    const pending = this.sink
      .persist({ snapshot })
      .then(() => {
        this.sink.onPersisted(snapshot);
      })
      .catch((error) => {
        this.sink.onPersistError(snapshot, error);
      })
      .finally(() => {
        if (this.pendingByBoxId.get(boxId) === pending) {
          this.pendingByBoxId.delete(boxId);
        }
        if (snapshot.isDirty) {
          this.schedule(snapshot);
        }
      });

    this.pendingByBoxId.set(boxId, pending);
    await pending;
  }

  public clear(boxId: string): void {
    const timer = this.timerByBoxId.get(boxId);
    if (timer) {
      clearTimeout(timer);
      this.timerByBoxId.delete(boxId);
    }
  }

  public clearAll(): void {
    for (const timer of this.timerByBoxId.values()) {
      clearTimeout(timer);
    }
    this.timerByBoxId.clear();
  }
}
