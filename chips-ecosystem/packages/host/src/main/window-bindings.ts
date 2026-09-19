/**
 * 窗口与会话绑定注册表。
 *
 * @remarks
 * Electron `protocol.handle` 不提供请求来源帧（ADR-002 §现状注记），协议路径的会话解析按
 * "会话（session partition）→ 窗口 → 平台会话"完成：
 * - 每个窗口绑定一个 Electron session；同一 session 绑定多于一个窗口时视为**歧义**，
 *   协议请求一律拒绝（fail-closed），不接受错误归属（安全边界不得降级）；
 * - IPC 路径不依赖本注册表，按 `event.sender` + `senderFrame` 直接解析来源。
 */

/** 绑定注册表接口。 */
export interface IWindowBindings {
  /** 绑定窗口与会话；重复绑定同一窗口时替换旧绑定。 */
  register(windowId: number, session: object): void;
  /** 解除窗口绑定。 */
  unregister(windowId: number): void;
  /** 解析会话上的唯一窗口；无绑定或多绑定（歧义）时返回 `null`。 */
  resolveUniqueWindow(session: object): number | null;
  /** 列出会话上的全部窗口。 */
  windowsOf(session: object): readonly number[];
  /** 全部已绑定窗口。 */
  allWindows(): readonly number[];
}

const resolveSessionKey = (session: object): string | null => {
  const key = (session as { key?: unknown }).key;
  return typeof key === 'string' && key.length > 0 ? key : null;
};

/** 基于 `Map` 的绑定注册表实现。 */
export class WindowBindings implements IWindowBindings {
  private readonly windows = new Map<number, object>();

  register(windowId: number, session: object): void {
    this.windows.set(windowId, session);
  }

  unregister(windowId: number): void {
    this.windows.delete(windowId);
  }

  resolveUniqueWindow(session: object): number | null {
    const matches = this.windowsOf(session);
    return matches.length === 1 ? (matches[0] as number) : null;
  }

  windowsOf(session: object): readonly number[] {
    const key = resolveSessionKey(session);
    const result: number[] = [];
    for (const [windowId, boundSession] of this.windows) {
      if (boundSession === session || (key !== null && resolveSessionKey(boundSession) === key)) {
        result.push(windowId);
      }
    }
    return result;
  }

  allWindows(): readonly number[] {
    return [...this.windows.keys()];
  }
}
