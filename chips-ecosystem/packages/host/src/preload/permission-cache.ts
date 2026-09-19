/**
 * preload 会话权限快照缓存。
 *
 * 权威：`02-Bridge三层设计` §7.4（权限快照同步下行，供 preload 快速失败预检）、
 * §5.3（预检不是安全边界，权威判定在主进程）。
 *
 * @remarks
 * - 快照经 `session:permissions` 单向下行；`permissionVersion` 单调递增，迟到推送按版本丢弃。
 * - 限定权限（如 `resources:read:platform`）命中所查询的基础权限（`resources:read`）。
 * - 快照未到达时一律不拦截（fail-open）：预检只做快速失败，永不替代权威判定。
 */

import type { ISessionPermissionsUpdate } from '../protocol/wire.js';

/** 会话权限快照。 */
export class SessionPermissionCache {
  private readonly granted = new Set<string>();
  private version = -1;
  private sessionId: string | null = null;

  /** 应用下行推送；版本非递增时丢弃。 */
  update(update: ISessionPermissionsUpdate): void {
    if (update.permissionVersion <= this.version) {
      return;
    }
    this.version = update.permissionVersion;
    this.sessionId = update.sessionId;
    this.granted.clear();
    for (const permission of update.grantedPermissions) {
      this.granted.add(permission);
    }
  }

  /** 快照是否已到达。 */
  get ready(): boolean {
    return this.version >= 0;
  }

  /** 当前授权版本；未收到推送时为 `-1`。 */
  get permissionVersion(): number {
    return this.version;
  }

  /** 当前会话标识；未收到推送时为 `null`。 */
  get currentSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 判断基础权限是否被授予。
   *
   * @param permission 基础权限 ID（如 `resources:read`）。
   */
  has(permission: string): boolean {
    if (this.granted.has(permission)) {
      return true;
    }
    for (const granted of this.granted) {
      if (granted.startsWith(`${permission}:`)) {
        return true;
      }
    }
    return false;
  }

  /** 当前授权集合快照。 */
  snapshot(): readonly string[] {
    return [...this.granted];
  }

  /** 清空快照（会话关闭）。 */
  clear(): void {
    this.granted.clear();
    this.version = -1;
    this.sessionId = null;
  }
}
