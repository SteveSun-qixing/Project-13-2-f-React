export interface EngineAction {
  readonly id: string;
  readonly description: string;
  memoryEstimate: number;
  do(): void;
  undo(): void;
  free?(): void;
}

export class BundleAction implements EngineAction {
  readonly id = "bundle";
  readonly description: string;
  memoryEstimate = 0;
  private executed: EngineAction[] = [];

  constructor(description: string, private readonly actions: EngineAction[]) {
    this.description = description;
    this.memoryEstimate = actions.reduce((total, action) => total + action.memoryEstimate, 0);
  }

  getActions(): EngineAction[] {
    return this.actions;
  }

  do(): void {
    this.executed = [];
    for (const action of this.actions) {
      try {
        action.do();
        this.executed.push(action);
      } catch (error) {
        for (const done of [...this.executed].reverse()) {
          try {
            done.undo();
          } catch {
            // 回滚失败时保持栈完整，继续回滚剩余项
          }
        }
        this.executed = [];
        throw error;
      }
    }
  }

  undo(): void {
    for (const action of [...this.executed].reverse()) {
      action.undo();
    }
    this.executed = [];
  }

  free(): void {
    for (const action of this.actions) {
      action.free?.();
    }
  }
}
