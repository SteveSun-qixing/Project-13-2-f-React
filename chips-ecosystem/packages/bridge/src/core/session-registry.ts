/**
 * 会话注册表（02-Bridge三层设计 §7.4、01-Bridge-API规范 §4.2）。
 *
 * 会话由插件运行时在创建窗口/表面时向 Bridge 层登记，绑定关系保存在主进程；
 * 每次调用按来源（`windowId` + `frameId`）解析会话，解析失败即拒绝，不接受负载自报身份。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '../protocol/errors.js';
import type { ISessionCreateInput, ISessionSnapshot, ISessionSource } from '../protocol/session.js';

export interface ISessionRegistry {
  /** 登记会话；同一 `sessionId` 或同一 `(windowId, frameId)` 冲突时抛出内部错误（宿主集成缺陷）。 */
  create(input: ISessionCreateInput): ISessionSnapshot;
  /** 按来源解析活跃会话；不存在或已关闭返回 undefined。 */
  resolve(source: ISessionSource): ISessionSnapshot | undefined;
  /** 按 ID 查询会话（含已关闭的终态快照，供诊断与清理）。 */
  resolveById(sessionId: string): ISessionSnapshot | undefined;
  /** 授权变更：整体替换权限快照并递增 `permissionVersion`。 */
  updatePermissions(sessionId: string, grantedPermissions: readonly string[]): ISessionSnapshot;
  /** 覆盖会话已打开文档集合。 */
  setOpenedDocuments(sessionId: string, documentIds: readonly string[]): ISessionSnapshot;
  /** 记录一个已打开文档。 */
  addOpenedDocument(sessionId: string, documentId: string): ISessionSnapshot;
  /** 关闭会话：拒绝新调用、中止在途信号、通知清理订阅与句柄。幂等。 */
  close(sessionId: string): void;
  /** 会话取消信号；会话不存在返回 undefined。 */
  signalFor(sessionId: string): AbortSignal | undefined;
  /** 订阅会话关闭事件；返回退订函数（幂等）。 */
  onSessionClosed(listener: (session: ISessionSnapshot) => void): () => void;
  /** 活跃会话数。 */
  readonly size: number;
}

interface IInternalSession {
  snapshot: ISessionSnapshot;
  readonly controller: AbortController;
  readonly sourceKey: string;
}

function bindingKey(source: ISessionSource): string {
  return `${String(source.windowId)}:${String(source.frameId)}`;
}

function snapshotOf(
  sessionId: string,
  pluginId: string,
  source: ISessionSource,
  grantedPermissions: ReadonlySet<string>,
  openedDocuments: ReadonlySet<string>,
  state: 'active' | 'closed',
  permissionVersion: number,
): ISessionSnapshot {
  return Object.freeze({
    sessionId,
    pluginId,
    windowId: source.windowId,
    frameId: source.frameId,
    grantedPermissions,
    openedDocuments,
    state,
    permissionVersion,
  });
}

function requireSession(sessions: ReadonlyMap<string, IInternalSession>, sessionId: string): IInternalSession {
  const session = sessions.get(sessionId);
  if (session === undefined || session.snapshot.state === 'closed') {
    throw createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown, {
      details: { sessionId },
    });
  }
  return session;
}

export function createSessionRegistry(): ISessionRegistry {
  const sessions = new Map<string, IInternalSession>();
  const bindings = new Map<string, string>();
  const closeListeners = new Set<(session: ISessionSnapshot) => void>();

  return {
    create(input: ISessionCreateInput): ISessionSnapshot {
      if (input.sessionId.length === 0 || input.pluginId.length === 0) {
        throw new Error('会话标识与插件标识不得为空');
      }
      if (!Number.isInteger(input.windowId) || !Number.isInteger(input.frameId)) {
        throw new Error('会话窗口与框架标识必须为整数');
      }
      const source: ISessionSource = { windowId: input.windowId, frameId: input.frameId };
      const key = bindingKey(source);
      const existingId = bindings.get(key);
      if (existingId !== undefined && existingId !== input.sessionId) {
        throw new Error('同一窗口与框架已绑定其他会话，须先关闭旧会话');
      }
      const existing = sessions.get(input.sessionId);
      if (existing !== undefined && existing.snapshot.state === 'active') {
        throw new Error('会话标识已存在');
      }
      const snapshot = snapshotOf(
        input.sessionId,
        input.pluginId,
        source,
        new Set(input.grantedPermissions ?? []),
        new Set(input.openedDocuments ?? []),
        'active',
        0,
      );
      sessions.set(input.sessionId, {
        snapshot,
        controller: new AbortController(),
        sourceKey: key,
      });
      bindings.set(key, input.sessionId);
      return snapshot;
    },

    resolve(source: ISessionSource): ISessionSnapshot | undefined {
      const sessionId = bindings.get(bindingKey(source));
      if (sessionId === undefined) {
        return undefined;
      }
      const session = sessions.get(sessionId);
      if (session === undefined || session.snapshot.state !== 'active') {
        return undefined;
      }
      return session.snapshot;
    },

    resolveById(sessionId: string): ISessionSnapshot | undefined {
      return sessions.get(sessionId)?.snapshot;
    },

    updatePermissions(sessionId: string, grantedPermissions: readonly string[]): ISessionSnapshot {
      const session = requireSession(sessions, sessionId);
      session.snapshot = snapshotOf(
        session.snapshot.sessionId,
        session.snapshot.pluginId,
        session.snapshot,
        new Set(grantedPermissions),
        session.snapshot.openedDocuments,
        'active',
        session.snapshot.permissionVersion + 1,
      );
      return session.snapshot;
    },

    setOpenedDocuments(sessionId: string, documentIds: readonly string[]): ISessionSnapshot {
      const session = requireSession(sessions, sessionId);
      session.snapshot = snapshotOf(
        session.snapshot.sessionId,
        session.snapshot.pluginId,
        session.snapshot,
        session.snapshot.grantedPermissions,
        new Set(documentIds),
        'active',
        session.snapshot.permissionVersion,
      );
      return session.snapshot;
    },

    addOpenedDocument(sessionId: string, documentId: string): ISessionSnapshot {
      const session = requireSession(sessions, sessionId);
      const opened = new Set(session.snapshot.openedDocuments);
      opened.add(documentId);
      session.snapshot = snapshotOf(
        session.snapshot.sessionId,
        session.snapshot.pluginId,
        session.snapshot,
        session.snapshot.grantedPermissions,
        opened,
        'active',
        session.snapshot.permissionVersion,
      );
      return session.snapshot;
    },

    close(sessionId: string): void {
      const session = sessions.get(sessionId);
      if (session === undefined || session.snapshot.state === 'closed') {
        return;
      }
      sessions.set(sessionId, {
        snapshot: snapshotOf(
          session.snapshot.sessionId,
          session.snapshot.pluginId,
          session.snapshot,
          session.snapshot.grantedPermissions,
          session.snapshot.openedDocuments,
          'closed',
          session.snapshot.permissionVersion,
        ),
        controller: session.controller,
        sourceKey: session.sourceKey,
      });
      bindings.delete(session.sourceKey);
      session.controller.abort(createBridgeError(BRIDGE_ERROR_CODES.cancelled));
      const closedSnapshot = sessions.get(sessionId)?.snapshot;
      if (closedSnapshot !== undefined) {
        for (const listener of [...closeListeners]) {
          listener(closedSnapshot);
        }
      }
    },

    signalFor(sessionId: string): AbortSignal | undefined {
      return sessions.get(sessionId)?.controller.signal;
    },

    onSessionClosed(listener: (session: ISessionSnapshot) => void): () => void {
      closeListeners.add(listener);
      let disposed = false;
      return () => {
        if (disposed) {
          return;
        }
        disposed = true;
        closeListeners.delete(listener);
      };
    },

    get size(): number {
      let count = 0;
      for (const session of sessions.values()) {
        if (session.snapshot.state === 'active') {
          count += 1;
        }
      }
      return count;
    },
  };
}
