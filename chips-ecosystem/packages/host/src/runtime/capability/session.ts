/**
 * 壳侧会话注册表与权限判定（02-Bridge三层设计 §7.4、01-Bridge-API规范 §4.2、08-权限系统设计 §7）。
 *
 * 权威：`08-权限系统设计` §7.1（判定点与输入）、§7.2（判定算法）、§7.6（会话权限快照）、§9.1（拒绝错误码）。
 *
 * @remarks
 * - 会话按 IPC 来源（`windowId` + `frameId`）解析；身份不取自调用参数（08 §7.7）。
 * - 组合根在平台核心（Rust Bridge）交付前承担 `02` §2.1 的主进程适配层职责：解析会话、判定权限、
 *   归一错误；判定口径对齐 08 §7.2，只覆盖基础权限与 `domain:*` 通配（限定值细粒度匹配由内核承接）。
 * - 权限快照来源由 {@link IHostSessionProvisioner} 注入；快照变更整体替换并递增 `permissionVersion`，
 *   经 `IPlatformHostChannel.pushSessionPermissions` 下行到窗口（08 §7.6）。
 */

import type { ISessionSource } from '../contracts.js';
import type {
  IHostSession,
  IHostSessionCreateInput,
  IHostSessionView,
} from './contracts.js';

/** 会话打开时的授权来源；返回 `null` 表示无法为来源建立会话（拒绝 `BRIDGE_SESSION_UNKNOWN`）。 */
export interface IHostSessionGrant {
  readonly pluginId: string;
  readonly grantedPermissions: readonly string[];
  readonly openedDocuments?: readonly string[];
}

/** 会话来源解析器：按 IPC 来源解析出插件身份与权限快照。 */
export interface IHostSessionProvisioner {
  /** 为来源提供授权；无法识别或未获准建立会话时返回 `null`（fail-closed）。 */
  provision(source: ISessionSource): IHostSessionGrant | null;
}

/** 会话注册表内部记录。 */
interface ISessionRecord {
  session: IHostSession;
  readonly controller: AbortController;
  readonly sourceKey: string;
}

/** 会话关闭回调。 */
export type SessionClosedListener = (session: IHostSession) => void;

/** 权限快照变更回调（供下行推送）。 */
export type PermissionsChangedListener = (session: IHostSession) => void;

/** 会话注册表接口。 */
export interface IHostSessionRegistry {
  /** 打开会话；同一来源已绑定其他会话或 sessionId 冲突时返回既有会话（幂等）。 */
  open(input: IHostSessionCreateInput): IHostSession;
  /** 按来源解析活跃会话。 */
  resolve(source: ISessionSource): IHostSession | undefined;
  /** 按 ID 查询会话（含终态快照）。 */
  getById(sessionId: string): IHostSession | undefined;
  /** 整体替换权限快照并递增版本；会话不存在或已关闭返回 `undefined`。 */
  updatePermissions(sessionId: string, grantedPermissions: readonly string[]): IHostSession | undefined;
  /** 记录一个已打开文档。 */
  addOpenedDocument(sessionId: string, documentId: string): void;
  /** 关闭会话；幂等；触发在途取消与关闭回调。 */
  close(sessionId: string): void;
  /** 关闭某窗口的全部会话（含 `frameId === null` 与各子帧）。 */
  closeByWindow(windowId: number): void;
  /** 会话取消信号。 */
  signalFor(sessionId: string): AbortSignal | undefined;
  /** 订阅会话关闭；返回退订函数。 */
  onClosed(listener: SessionClosedListener): () => void;
  /** 订阅权限快照变更；返回退订函数。 */
  onPermissionsChanged(listener: PermissionsChangedListener): () => void;
  /** 活跃会话数。 */
  readonly activeCount: number;
  /** 会话诊断视图。 */
  list(): readonly IHostSessionView[];
}

function sourceKey(source: { windowId: number; frameId: number | null }): string {
  return `${String(source.windowId)}:${String(source.frameId)}`;
}

function freezeSession(input: {
  sessionId: string;
  pluginId: string;
  windowId: number;
  frameId: number | null;
  grantedPermissions: ReadonlySet<string>;
  openedDocuments: ReadonlySet<string>;
  state: 'active' | 'closed';
  permissionVersion: number;
}): IHostSession {
  return Object.freeze(input);
}

/** 创建壳侧会话注册表。 */
export function createHostSessionRegistry(): IHostSessionRegistry {
  const sessions = new Map<string, ISessionRecord>();
  const bindings = new Map<string, string>();
  const closedListeners = new Set<SessionClosedListener>();
  const permissionListeners = new Set<PermissionsChangedListener>();

  const notifyClosed = (session: IHostSession): void => {
    for (const listener of [...closedListeners]) {
      listener(session);
    }
  };
  const notifyPermissions = (session: IHostSession): void => {
    for (const listener of [...permissionListeners]) {
      listener(session);
    }
  };

  return {
    open(input: IHostSessionCreateInput): IHostSession {
      const key = sourceKey({ windowId: input.windowId, frameId: input.frameId });
      const bound = bindings.get(key);
      if (bound !== undefined) {
        const existing = sessions.get(bound);
        if (existing !== undefined && existing.session.state === 'active') {
          return existing.session;
        }
      }
      const session = freezeSession({
        sessionId: input.sessionId,
        pluginId: input.pluginId,
        windowId: input.windowId,
        frameId: input.frameId,
        grantedPermissions: Object.freeze(new Set(input.grantedPermissions ?? [])),
        openedDocuments: Object.freeze(new Set(input.openedDocuments ?? [])),
        state: 'active',
        permissionVersion: 0,
      });
      sessions.set(input.sessionId, { session, controller: new AbortController(), sourceKey: key });
      bindings.set(key, input.sessionId);
      return session;
    },

    resolve(source: ISessionSource): IHostSession | undefined {
      const sessionId = bindings.get(sourceKey(source));
      if (sessionId === undefined) {
        return undefined;
      }
      const record = sessions.get(sessionId);
      return record === undefined || record.session.state !== 'active' ? undefined : record.session;
    },

    getById(sessionId: string): IHostSession | undefined {
      return sessions.get(sessionId)?.session;
    },

    updatePermissions(sessionId: string, grantedPermissions: readonly string[]): IHostSession | undefined {
      const record = sessions.get(sessionId);
      if (record === undefined || record.session.state !== 'active') {
        return undefined;
      }
      record.session = freezeSession({
        ...record.session,
        grantedPermissions: Object.freeze(new Set(grantedPermissions)),
        permissionVersion: record.session.permissionVersion + 1,
      });
      notifyPermissions(record.session);
      return record.session;
    },

    addOpenedDocument(sessionId: string, documentId: string): void {
      const record = sessions.get(sessionId);
      if (record === undefined || record.session.state !== 'active') {
        return;
      }
      const opened = new Set(record.session.openedDocuments);
      opened.add(documentId);
      record.session = freezeSession({ ...record.session, openedDocuments: Object.freeze(opened) });
    },

    close(sessionId: string): void {
      const record = sessions.get(sessionId);
      if (record === undefined || record.session.state === 'closed') {
        return;
      }
      const closed = freezeSession({ ...record.session, state: 'closed' });
      record.session = closed;
      bindings.delete(record.sourceKey);
      record.controller.abort();
      notifyClosed(closed);
    },

    closeByWindow(windowId: number): void {
      const targets: string[] = [];
      for (const [sessionId, record] of sessions) {
        if (record.session.windowId === windowId && record.session.state === 'active') {
          targets.push(sessionId);
        }
      }
      for (const sessionId of targets) {
        this.close(sessionId);
      }
    },

    signalFor(sessionId: string): AbortSignal | undefined {
      return sessions.get(sessionId)?.controller.signal;
    },

    onClosed(listener: SessionClosedListener): () => void {
      closedListeners.add(listener);
      let disposed = false;
      return () => {
        if (disposed) {
          return;
        }
        disposed = true;
        closedListeners.delete(listener);
      };
    },

    onPermissionsChanged(listener: PermissionsChangedListener): () => void {
      permissionListeners.add(listener);
      let disposed = false;
      return () => {
        if (disposed) {
          return;
        }
        disposed = true;
        permissionListeners.delete(listener);
      };
    },

    get activeCount(): number {
      let count = 0;
      for (const record of sessions.values()) {
        if (record.session.state === 'active') {
          count += 1;
        }
      }
      return count;
    },

    list(): readonly IHostSessionView[] {
      const views: IHostSessionView[] = [];
      for (const record of sessions.values()) {
        views.push({
          sessionId: record.session.sessionId,
          pluginId: record.session.pluginId,
          windowId: record.session.windowId,
          frameId: record.session.frameId,
          permissionVersion: record.session.permissionVersion,
          grantedCount: record.session.grantedPermissions.size,
          openedDocumentCount: record.session.openedDocuments.size,
          state: record.session.state,
        });
      }
      return views;
    },
  };
}

/** 权限判定输入。 */
export interface IHostPermissionEvaluation {
  readonly capabilityId: string;
  readonly requiredPermissions: readonly string[];
  readonly grantedPermissions: ReadonlySet<string>;
}

/** 权限判定结果。 */
export interface IHostPermissionDecision {
  readonly allowed: boolean;
  /** 第一个未满足的权限（`allowed` 为 `true` 时为 `undefined`）。 */
  readonly permission?: string;
  /** 缺失的全部权限。 */
  readonly missing: readonly string[];
  /** 拒绝原因（08 §7.2 `describeReason`）。 */
  readonly reason?: 'not_granted' | 'revoked';
}

function covered(required: string, granted: ReadonlySet<string>): boolean {
  if (granted.has(required) || granted.has('*')) {
    return true;
  }
  const domain = required.slice(0, required.indexOf(':'));
  return granted.has(`${domain}:*`);
}

/**
 * 运行时权限判定（08-权限系统设计 §7.2）。
 *
 * @remarks 按能力声明顺序短路；无目标限定值的基础权限判定在本阶段直接按授予集合覆盖，
 * 限定值细粒度匹配在 Rust Bridge 交付后由内核承接（见开发日志集成缺口）。
 */
export function evaluateHostPermissions(input: IHostPermissionEvaluation): IHostPermissionDecision {
  const missing: string[] = [];
  let firstDenied: string | undefined;
  for (const required of input.requiredPermissions) {
    if (!covered(required, input.grantedPermissions)) {
      missing.push(required);
      if (firstDenied === undefined) {
        firstDenied = required;
      }
    }
  }
  if (firstDenied === undefined) {
    return { allowed: true, missing: [] };
  }
  return { allowed: false, permission: firstDenied, missing, reason: 'not_granted' };
}
