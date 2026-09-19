/**
 * 窗口内容绑定：会话绑定、`chips-resource://` 处理器注册与销毁清理。
 *
 * 权威：`02-Bridge三层设计` §7.4（会话解析与绑定）、`06-资源协议规范` §5.3（协议处理器来源解析）、
 * `17-跨端Shell与平台抽象设计` §2.4（窗口与协议就绪顺序）。
 *
 * @remarks
 * - 所有窗口（壳自建窗口与内核经 PAL 端口创建的窗口）统一经 `app.on('web-contents-created')`
 *   进入本模块：绑定会话、注册协议处理器、登记注册表。
 * - `getType()` 存在且不为 `window` 的内容（DevTools、工具进程宿主）不进入窗口注册表。
 * - 同一 session 上的协议处理器按窗口引用计数：最后一个窗口销毁时注销。
 */

import type { IResourceBackend } from '../runtime/contracts.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { attachResourceProtocol } from './resource-protocol.js';
import type { IWindowBindings } from './window-bindings.js';
import type { ShellWebContents, ShellWindow } from './shell-api.js';
import type { WindowRecord, WindowRegistry } from './window-registry.js';

/** 绑定器依赖。 */
export interface WebContentsBinderDeps {
  /** 窗口注册表。 */
  readonly registry: WindowRegistry;
  /** 会话 ↔ 窗口绑定注册表（协议路径解析）。 */
  readonly bindings: IWindowBindings;
  /** 资源读取后端（核心资源管理器）。 */
  readonly backend: IResourceBackend;
  /** 诊断口。 */
  readonly diagnostics: DiagnosticsSink;
  /** 窗口销毁回调（核心清理会话、订阅与句柄）。 */
  readonly onClosed: (windowId: number) => void;
}

interface SessionProtocolLease {
  readonly dispose: () => void;
  count: number;
}

/** 窗口内容绑定器。 */
export class WebContentsBinder {
  private readonly deps: WebContentsBinderDeps;
  private readonly leases = new Map<string, SessionProtocolLease>();
  private readonly tracked = new Set<number>();

  constructor(deps: WebContentsBinderDeps) {
    this.deps = deps;
  }

  /**
   * 绑定窗口内容。
   *
   * @param webContents 窗口内容。
   * @param window 窗口句柄；`web-contents-created` 路径未知时为 `null`。
   * @returns 绑定后的窗口记录；非窗口类型内容返回 `null`。
   */
  bind(webContents: ShellWebContents, window: ShellWindow | null = null): WindowRecord | null {
    const type = webContents.getType?.();
    if (type !== undefined && type !== 'window') {
      return null;
    }
    const record = this.deps.registry.register(webContents, window);
    this.deps.bindings.register(record.windowId, record.session);
    this.acquireProtocol(record);
    if (!this.tracked.has(record.windowId)) {
      this.tracked.add(record.windowId);
      record.webContents.onDestroyed(() => {
        this.unbind(record.windowId);
      });
    }
    return record;
  }

  /** 解除绑定并释放协议处理器租约。 */
  unbind(windowId: number): void {
    const record = this.deps.registry.get(windowId);
    this.deps.registry.unregister(windowId);
    this.deps.bindings.unregister(windowId);
    if (record !== undefined) {
      this.releaseProtocol(record.session.key);
    }
    if (this.tracked.delete(windowId)) {
      this.deps.onClosed(windowId);
    }
  }

  /** 释放全部绑定（应用退出时调用；不触发 `onClosed`）。 */
  disposeAll(): void {
    for (const record of this.deps.registry.list()) {
      this.deps.bindings.unregister(record.windowId);
      this.tracked.delete(record.windowId);
    }
    this.deps.registry.clear();
    for (const lease of this.leases.values()) {
      lease.dispose();
    }
    this.leases.clear();
  }

  /** 获取 session 的协议处理器租约；失败时记诊断并关闭该窗口（fail-closed）。 */
  private acquireProtocol(record: WindowRecord): void {
    const key = record.session.key;
    const existing = this.leases.get(key);
    if (existing !== undefined) {
      existing.count += 1;
      return;
    }
    try {
      const dispose = attachResourceProtocol(record.session, {
        backend: this.deps.backend,
        bindings: this.deps.bindings,
        diagnostics: this.deps.diagnostics,
      });
      this.leases.set(key, { dispose, count: 1 });
    } catch (error) {
      this.deps.diagnostics.error('protocol', '资源协议处理器注册失败', {
        windowId: record.windowId,
        reason: error instanceof Error ? error.message : typeof error,
      });
      try {
        if (record.window !== null) {
          record.window.destroy();
        } else {
          record.webContents.close();
        }
      } catch {
        // 关闭失败由进程退出兜底。
      }
    }
  }

  /** 释放 session 的协议处理器租约。 */
  private releaseProtocol(key: string): void {
    const lease = this.leases.get(key);
    if (lease === undefined) {
      return;
    }
    lease.count -= 1;
    if (lease.count <= 0) {
      lease.dispose();
      this.leases.delete(key);
    }
  }
}
