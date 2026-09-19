/**
 * 权限判定（02-Bridge三层设计 §5、08-权限系统设计 §7.2）。
 *
 * 放行条件：`capability.permissions` 中的每一项都能在会话快照中匹配（基础权限 + 限定值目标）；
 * 能力不能扩大自身声明的权限需求，插件不能通过调用参数扩大权限。
 * 判定按能力声明顺序短路，第一个未满足的权限即失败；判定只使用一个快照版本。
 */

import { BRIDGE_ERROR_CODES, createBridgeError, type ChipsError } from '../protocol/errors.js';
import type {
  IPermissionDecision,
  IPermissionDeniedDetails,
  IPermissionGrant,
  ISessionScope,
  PermissionDenyReason,
} from '../protocol/permission.js';
import { findPermissionDefinition, parsePermissionId } from '../protocol/permissions.js';
import { parseResourceUri } from '../protocol/resource-uri.js';
import type { ISessionSnapshot } from '../protocol/session.js';
import type { IPermissionTargetRule } from '../protocol/capability-contracts.js';
import { grantCovers, matchPathQualifier, type IPermissionEnvironment } from './qualifiers.js';

export interface IPermissionEvaluationInput {
  readonly capabilityId: string;
  readonly requiredPermissions: readonly string[];
  readonly targetRules: readonly IPermissionTargetRule[];
  readonly input: unknown;
  readonly scope: ISessionScope;
  readonly session: ISessionSnapshot;
}

export interface IPermissionEvaluationResult {
  readonly allowed: boolean;
  readonly decision: IPermissionDecision;
  /** 拒绝时的 `BRIDGE_PERMISSION_DENIED`（含 `IPermissionDeniedDetails`）。 */
  readonly error?: ChipsError;
}

/**
 * 会话权限快照（字符串集合）→ 结构化授权记录。
 * 快照项可为带限定值的形式（如 `filesystem:read:${userDocuments}/chips`），也可为 `domain:*` 域通配。
 */
export function grantsFromSnapshot(snapshot: ISessionSnapshot): IPermissionGrant[] {
  const grants: IPermissionGrant[] = [];
  for (const permission of snapshot.grantedPermissions) {
    const wildcard = /^([a-z0-9-]+):\*$/.exec(permission);
    if (wildcard !== null) {
      grants.push({ base: `${wildcard[1] ?? ''}:*`, state: 'granted', source: 'enable' });
      continue;
    }
    const parsed = parsePermissionId(permission);
    if (parsed === undefined) {
      continue;
    }
    grants.push({
      base: `${parsed.domain}:${parsed.scope}`,
      state: 'granted',
      source: 'enable',
      ...(parsed.qualifier !== undefined ? { qualifier: parsed.qualifier } : {}),
    });
  }
  return grants;
}

function readFieldPath(input: unknown, path: string): unknown {
  let current: unknown = input;
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * 提取限定值目标；任一目标字段缺失或类型非法时返回 undefined（fail-closed：只能由宽授权覆盖）。
 */
export function extractTargets(rule: IPermissionTargetRule, input: unknown): string[] | undefined {
  if (rule.targetFields.length === 0) {
    return undefined;
  }
  const targets: string[] = [];
  for (const field of rule.targetFields) {
    const value = readFieldPath(input, field);
    if (typeof value === 'string' && value.length > 0) {
      targets.push(value);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      targets.push(String(value));
    } else {
      return undefined;
    }
  }
  return targets;
}

function baseMatchesGrant(grantBase: string, required: string): boolean {
  return (
    grantBase === required ||
    (grantBase.endsWith(':*') && required.startsWith(`${grantBase.slice(0, -1)}`))
  );
}

function isBroadlyCovered(grants: readonly IPermissionGrant[], required: string): boolean {
  const definition = findPermissionDefinition(required);
  return grants.some(
    (grant) =>
      grant.state === 'granted' &&
      baseMatchesGrant(grant.base, required) &&
      (grant.qualifier === undefined || definition?.kind === 'none')
  );
}

function describeReason(
  grants: readonly IPermissionGrant[],
  required: string
): PermissionDenyReason {
  const sameBase = grants.filter((grant) => baseMatchesGrant(grant.base, required));
  if (sameBase.length === 0) {
    return 'not_granted';
  }
  if (sameBase.some((grant) => grant.state === 'denied')) {
    return 'revoked';
  }
  return 'out_of_scope';
}

/** 插件私有数据目录：读写删除均免权限（08-权限系统设计 §4.4）。 */
function isPluginDataPath(
  targets: readonly string[],
  request: IPermissionEvaluationInput,
  env: IPermissionEnvironment
): boolean {
  const root = env.pluginDataRoot?.(request.session.pluginId);
  if (root === undefined) {
    return false;
  }
  return targets.every((target) => matchPathQualifier(root, target, env));
}

/** 自身配置命名空间：`plugins.<pluginId>` 免权限。 */
function isOwnConfigNamespace(targets: readonly string[], pluginId: string): boolean {
  return targets.every((target) => target === `plugins.${pluginId}`);
}

/** 自身资源作用域与平台作用域的只读免权限。 */
function isSelfOrPlatformResource(
  targets: readonly string[],
  request: IPermissionEvaluationInput,
  env: IPermissionEnvironment
): boolean {
  return targets.every((target) => {
    try {
      const parsed = parseResourceUri(target);
      if (parsed.authority === 'platform') {
        return true;
      }
      return env.isOwnResourceScope?.(request.session, parsed.authority) === true;
    } catch {
      return false;
    }
  });
}

function isSelfScoped(
  required: string,
  targets: readonly string[] | undefined,
  request: IPermissionEvaluationInput,
  env: IPermissionEnvironment
): boolean {
  const definition = findPermissionDefinition(required);
  if (definition === undefined || targets === undefined || targets.length === 0) {
    return false;
  }
  switch (definition.kind) {
    case 'path':
      return isPluginDataPath(targets, request, env);
    case 'config':
      return isOwnConfigNamespace(targets, request.session.pluginId);
    case 'resource':
      if (definition.scope !== 'read') {
        return false;
      }
      return isSelfOrPlatformResource(targets, request, env);
    case 'window':
      return targets.every((target) => target === String(request.session.windowId));
    default:
      return false;
  }
}

/** 会话内已打开文档的读取免重复校验（resources:read）。 */
function isOpenedDocumentRead(request: IPermissionEvaluationInput, required: string): boolean {
  if (request.capabilityId !== 'document:read' || required !== 'resources:read') {
    return false;
  }
  const documentId = readFieldPath(request.input, 'documentId');
  return typeof documentId === 'string' && request.session.openedDocuments.has(documentId);
}

export function evaluatePermissions(
  request: IPermissionEvaluationInput,
  env: IPermissionEnvironment
): IPermissionEvaluationResult {
  const grantedBases: string[] = [];
  for (const grant of request.scope.grants) {
    if (grant.state === 'granted' && !grantedBases.includes(grant.base)) {
      grantedBases.push(grant.base);
    }
  }
  const missing: string[] = [];
  let failure: { permission: string; reason: PermissionDenyReason; target?: string } | undefined;

  for (const required of request.requiredPermissions) {
    const rule = request.targetRules.find((item) => item.permission === required);
    const targets = rule !== undefined ? extractTargets(rule, request.input) : undefined;
    if (isOpenedDocumentRead(request, required)) {
      continue;
    }
    if (isSelfScoped(required, targets, request, env)) {
      continue;
    }
    // 无（禁止）限定值的权限没有可限定的目标：会话未记录该权限时不拦截调用；
    // 只要存在授权记录（granted / denied），仍按记录判定，显式拒绝与撤销保持有效。
    if (
      findPermissionDefinition(required)?.kind === 'none' &&
      !request.scope.grants.some((grant) => grant.base === required)
    ) {
      continue;
    }
    const covered =
      targets === undefined
        ? isBroadlyCovered(request.scope.grants, required)
        : targets.every((target) => grantCovers(request.scope.grants, required, target, env));
    if (!covered) {
      missing.push(required);
      if (failure === undefined) {
        const target = targets?.[0];
        failure = {
          permission: required,
          reason: describeReason(request.scope.grants, required),
          ...(target !== undefined ? { target } : {}),
        };
      }
    }
  }

  if (failure === undefined) {
    return { allowed: true, decision: { allowed: true, permission: '' } };
  }

  const details: IPermissionDeniedDetails = {
    capabilityId: request.capabilityId,
    permission: failure.permission,
    required: [...request.requiredPermissions],
    missing,
    granted: grantedBases,
    reason: failure.reason,
    ...(failure.target !== undefined ? { target: failure.target } : {}),
  };
  const error = createBridgeError(BRIDGE_ERROR_CODES.permissionDenied, {
    message: `插件缺少所需权限：${failure.permission}`,
    details: details satisfies IPermissionDeniedDetails,
    retryable: false,
  });
  return {
    allowed: false,
    decision: {
      allowed: false,
      permission: failure.permission,
      reason: failure.reason,
    },
    error,
  };
}

/** 判定结果审计载荷（08-权限系统设计 §8；审计写入由宿主注入）。 */
export interface IPermissionAuditRecord {
  readonly sessionId: string;
  readonly pluginId: string;
  readonly capabilityId: string;
  readonly allowed: boolean;
  readonly permission: string;
  readonly missing: readonly string[];
  readonly reason?: PermissionDenyReason;
  readonly target?: string;
}

export function toAuditRecord(
  request: IPermissionEvaluationInput,
  result: IPermissionEvaluationResult
): IPermissionAuditRecord {
  const details = (result.error?.details ?? undefined) as IPermissionDeniedDetails | undefined;
  return {
    sessionId: request.session.sessionId,
    pluginId: request.session.pluginId,
    capabilityId: request.capabilityId,
    allowed: result.allowed,
    permission: result.decision.permission,
    missing: details?.missing ?? [],
    ...(result.decision.reason !== undefined ? { reason: result.decision.reason } : {}),
    ...(details?.target !== undefined ? { target: details.target } : {}),
  };
}
