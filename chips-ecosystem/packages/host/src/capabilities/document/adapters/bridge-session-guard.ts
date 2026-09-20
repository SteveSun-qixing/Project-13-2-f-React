/**
 * `IDocumentGuardPort` 的 Bridge 会话注册表承载适配器（金链路刀4 · 组合根装载段）。
 *
 * 权威：`11-文档服务设计` §9.1（权限判定由 Bridge 与权限系统执行；服务不自行放行、
 * 不缓存授权，每次调用经本端口查询）、`08-权限系统设计` §7.2（判定算法）与 §7.6
 * （会话权限快照）、`02-Bridge三层设计` §7.4（会话按来源解析，身份不取自调用参数）。
 *
 * @remarks
 * - 本适配器只做「会话注册表调用面」的查询转发与判定复用，不承载第二套判定逻辑：
 *   权限覆盖判定逐项调用壳侧 Bridge 判定层的单点实现 `evaluateHostPermissions`
 *   （`runtime/capability/session.ts`，08 §7.2 算法：基础权限、`domain:*` 与全通配），
 *   与路由管线（`runtime/capability/router.ts` §5.2 阶段序）共享同一判定本体，
 *   服务侧复查与路由侧准入天然不漂移。
 * - 快照来源（{@link DocumentGuardSessionSource}）由组合根注入：生产注册与调用权威
 *   暂留壳侧（`runtime/host-runtime.ts` 头注），装载段把壳侧会话注册表的快照视图
 *   提供者接入；Rust Bridge 内核接管会话表（工单 025 剩余项 / §5.5–§5.7 激活与会话
 *   链路）后，同一注入面切换到内核会话快照提供者，本适配器判定逻辑零改动。
 * - 每调用查询、不缓存（§9.1）：`isSessionActive` / `hasPermission` 每次触达快照
 *   提供者；已关闭或不存在的会话一律 `false`（服务侧归一 `BRIDGE_SESSION_UNKNOWN` /
 *   `BRIDGE_PERMISSION_DENIED`）。
 */

import { evaluateHostPermissions } from '../../../runtime/capability/session.js';
import type { IDocumentGuardPort } from '../ports.js';

/**
 * Bridge 会话注册表的一条会话快照视图（`runtime/capability/contracts.ts` 的
 * `IHostSession` 在守卫端口上的最小投影：判定只消费这三项，不解释其余字段）。
 */
export interface IDocumentGuardSessionView {
  /** 会话标识（与能力上下文 `sessionId` 同一命名空间）。 */
  readonly sessionId: string;
  /** 会话状态；仅 `active` 视为活跃。 */
  readonly state: 'active' | 'closed';
  /** 当前权限快照（已物化的基础权限 ID 集合，支持 `*` 与 `domain:*` 通配）。 */
  readonly grantedPermissions: ReadonlySet<string>;
}

/** 会话快照视图提供者：每次查询触达 Bridge 会话注册表的当前实态。 */
export type DocumentGuardSessionSource = () => readonly IDocumentGuardSessionView[];

/** 判定入口的能力标识（权限判定本体与调用者无关；保留字段仅为 `evaluateHostPermissions` 入参完整）。 */
const GUARD_EVALUATION_CAPABILITY_ID = 'document:guard';

/**
 * 构造 Bridge 会话注册表承载的文档守卫端口适配器。
 *
 * @param getSessions 会话快照视图提供者（组合根注入；每调用触达注册表实态）。
 */
export function createDocumentBridgeSessionGuardPort(getSessions: DocumentGuardSessionSource): IDocumentGuardPort {
  function activeSession(sessionId: string): IDocumentGuardSessionView | undefined {
    return getSessions().find((view) => view.sessionId === sessionId && view.state === 'active');
  }

  return {
    isSessionActive(sessionId: string): Promise<boolean> {
      return Promise.resolve(activeSession(sessionId) !== undefined);
    },

    hasPermission(sessionId: string, permission: string): Promise<boolean> {
      const session = activeSession(sessionId);
      if (session === undefined) {
        return Promise.resolve(false);
      }
      const decision = evaluateHostPermissions({
        capabilityId: GUARD_EVALUATION_CAPABILITY_ID,
        requiredPermissions: [permission],
        grantedPermissions: session.grantedPermissions,
      });
      return Promise.resolve(decision.allowed);
    },
  };
}
