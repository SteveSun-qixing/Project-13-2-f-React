/**
 * 窗口注册表。
 *
 * 权威：`04-能力契约规范` §7.4（`windowId` 为 Electron `webContents.id`）、
 * `02-Bridge三层设计` §7.4（会话绑定）、`17-跨端Shell与平台抽象设计` §2.4（退出顺序）。
 *
 * @remarks
 * - 注册表只保存壳自身创建与内核经能力创建的窗口；`windowId` 一律为 `webContents.id`。
 * - 内核经 PAL 端口创建的窗口不经过壳的窗口工厂，注册表记录允许 `window` 缺席：
 *   此时关闭与存活判定走 `webContents`。
 * - 注册表是纯数据结构，不订阅 Electron 事件；销毁通知由 `web-contents-binder` 驱动。
 */

import type { ShellSession, ShellWebContents, ShellWindow } from './shell-api.js';

/** 窗口记录。 */
export interface WindowRecord {
  /** 窗口 ID（`webContents.id`）。 */
  readonly windowId: number;
  /** 窗口内容。 */
  readonly webContents: ShellWebContents;
  /** 窗口所属会话。 */
  readonly session: ShellSession;
  /** 窗口句柄；内核经 PAL 创建的窗口在壳侧不可见时为 `null`。 */
  readonly window: ShellWindow | null;
  /** 注册时间（Unix epoch 毫秒）。 */
  readonly createdAt: number;
}

/** 注册表选项。 */
export interface WindowRegistryOptions {
  /** 时钟；默认 `Date.now`。 */
  readonly now?: () => number;
}

/** 窗口注册表实现。 */
export class WindowRegistry {
  private readonly records = new Map<number, WindowRecord>();
  private readonly now: () => number;

  constructor(options: WindowRegistryOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  /**
   * 注册或更新窗口记录。
   *
   * @param webContents 窗口内容。
   * @param window 窗口句柄；缺席表示内核经 PAL 端口创建的窗口。
   * @returns 注册后的记录。
   */
  register(webContents: ShellWebContents, window: ShellWindow | null = null): WindowRecord {
    const existing = this.records.get(webContents.id);
    const record: WindowRecord = {
      windowId: webContents.id,
      webContents,
      session: webContents.session,
      window: window ?? existing?.window ?? null,
      createdAt: existing?.createdAt ?? this.now(),
    };
    this.records.set(record.windowId, record);
    return record;
  }

  /** 解除注册。 */
  unregister(windowId: number): void {
    this.records.delete(windowId);
  }

  /** 读取记录。 */
  get(windowId: number): WindowRecord | undefined {
    return this.records.get(windowId);
  }

  /** 窗口是否存活（已注册且未销毁）。 */
  isAlive(windowId: number): boolean {
    const record = this.records.get(windowId);
    return record !== undefined && !record.webContents.isDestroyed();
  }

  /** 全部窗口记录（注册序）。 */
  list(): readonly WindowRecord[] {
    return [...this.records.values()];
  }

  /** 当前窗口数量。 */
  get size(): number {
    return this.records.size;
  }

  /**
   * 请求关闭全部窗口。
   *
   * @remarks 关闭是异步生效的；调用方随后可用 {@link destroyAll} 对未响应窗口强制收口。
   */
  closeAll(): void {
    for (const record of this.list()) {
      if (record.webContents.isDestroyed()) {
        continue;
      }
      try {
        if (record.window !== null) {
          record.window.close();
        } else {
          record.webContents.close();
        }
      } catch {
        // 关闭请求失败（窗口已被系统回收）不阻塞其余窗口收口。
      }
    }
  }

  /** 强制销毁全部窗口。 */
  destroyAll(): void {
    for (const record of this.list()) {
      if (record.webContents.isDestroyed()) {
        continue;
      }
      try {
        if (record.window !== null) {
          record.window.destroy();
        } else {
          record.webContents.close();
        }
      } catch {
        // 同上：销毁失败由进程退出兜底。
      }
    }
  }

  /** 清空注册表（不触碰窗口）。 */
  clear(): void {
    this.records.clear();
  }
}
