/**
 * 权限词表（08-权限系统设计 §3、§4.1）。
 *
 * 权限 ID：`<domain>:<scope>[:<qualifier>]`；全部小写，冒号为唯一分隔符，
 * 限定值中允许出现 `:`（如网络端口），解析时按前两个冒号切分。
 * 段数只能是 2 段（基础形式）或 3 段（限定形式）；4 段及以上非法。
 */

/** 限定值文法种类；匹配算法见 `core/qualifiers.ts`。 */
export type PermissionQualifierKind =
  | 'path'
  | 'domain'
  | 'url'
  | 'window'
  | 'resource'
  | 'config'
  | 'none';

/** 限定值要求：必需 / 可选 / 禁止。 */
export type PermissionQualifierRequirement = 'required' | 'optional' | 'forbidden';

export interface IPermissionDefinition {
  /** 基础权限 ID（`<domain>:<scope>`；能力声明与判定比对使用基础形式）。 */
  readonly id: string;
  readonly domain: string;
  readonly scope: string;
  readonly qualifier: PermissionQualifierRequirement;
  readonly kind: PermissionQualifierKind;
}

/** 内置权限清单（08-权限系统设计 §4.1 与 §6.1 命令域权限）。 */
export const BUILTIN_PERMISSIONS: readonly IPermissionDefinition[] = [
  { id: 'filesystem:read', domain: 'filesystem', scope: 'read', qualifier: 'required', kind: 'path' },
  { id: 'filesystem:write', domain: 'filesystem', scope: 'write', qualifier: 'required', kind: 'path' },
  { id: 'filesystem:delete', domain: 'filesystem', scope: 'delete', qualifier: 'required', kind: 'path' },
  { id: 'network:http', domain: 'network', scope: 'http', qualifier: 'required', kind: 'domain' },
  { id: 'window:control', domain: 'window', scope: 'control', qualifier: 'optional', kind: 'window' },
  { id: 'menu:manage', domain: 'menu', scope: 'manage', qualifier: 'forbidden', kind: 'none' },
  { id: 'tray:manage', domain: 'tray', scope: 'manage', qualifier: 'forbidden', kind: 'none' },
  { id: 'shortcut:manage', domain: 'shortcut', scope: 'manage', qualifier: 'forbidden', kind: 'none' },
  { id: 'system:read', domain: 'system', scope: 'read', qualifier: 'forbidden', kind: 'none' },
  { id: 'power:read', domain: 'power', scope: 'read', qualifier: 'forbidden', kind: 'none' },
  { id: 'power:manage', domain: 'power', scope: 'manage', qualifier: 'forbidden', kind: 'none' },
  { id: 'transfer:manage', domain: 'transfer', scope: 'manage', qualifier: 'forbidden', kind: 'none' },
  { id: 'notifications:send', domain: 'notifications', scope: 'send', qualifier: 'forbidden', kind: 'none' },
  { id: 'clipboard:access', domain: 'clipboard', scope: 'access', qualifier: 'forbidden', kind: 'none' },
  { id: 'dialogs:use', domain: 'dialogs', scope: 'use', qualifier: 'forbidden', kind: 'none' },
  { id: 'shell:external', domain: 'shell', scope: 'external', qualifier: 'required', kind: 'url' },
  { id: 'resources:read', domain: 'resources', scope: 'read', qualifier: 'optional', kind: 'resource' },
  { id: 'resources:write', domain: 'resources', scope: 'write', qualifier: 'optional', kind: 'resource' },
  { id: 'config:read', domain: 'config', scope: 'read', qualifier: 'required', kind: 'config' },
  { id: 'config:write', domain: 'config', scope: 'write', qualifier: 'required', kind: 'config' },
  { id: 'credential:manage', domain: 'credential', scope: 'manage', qualifier: 'forbidden', kind: 'none' },
  { id: 'events:publish', domain: 'events', scope: 'publish', qualifier: 'forbidden', kind: 'none' },
  { id: 'command:read', domain: 'command', scope: 'read', qualifier: 'forbidden', kind: 'none' },
  { id: 'command:write', domain: 'command', scope: 'write', qualifier: 'forbidden', kind: 'none' },
  { id: 'command:execute', domain: 'command', scope: 'execute', qualifier: 'forbidden', kind: 'none' },
];

const PERMISSION_BY_ID: ReadonlyMap<string, IPermissionDefinition> = new Map(
  BUILTIN_PERMISSIONS.map((definition) => [definition.id, definition]),
);

/** 已注册的基础权限 ID 集合。 */
export const BUILTIN_PERMISSION_IDS: ReadonlySet<string> = new Set(PERMISSION_BY_ID.keys());

const DOMAIN_SCOPE_PATTERN = /^[a-z0-9-]+$/;

export interface IParsedPermissionId {
  readonly domain: string;
  readonly scope: string;
  readonly qualifier?: string;
}

/**
 * 解析权限 ID；按前两个冒号切分，限定值保留其余部分（含冒号）。
 * 语法非法（段数、字符集、空段）时返回 undefined。
 */
export function parsePermissionId(value: string): IParsedPermissionId | undefined {
  const firstSeparator = value.indexOf(':');
  if (firstSeparator <= 0) {
    return undefined;
  }
  const secondSeparator = value.indexOf(':', firstSeparator + 1);
  const domain = value.slice(0, firstSeparator);
  const scope =
    secondSeparator < 0 ? value.slice(firstSeparator + 1) : value.slice(firstSeparator + 1, secondSeparator);
  const qualifier = secondSeparator < 0 ? undefined : value.slice(secondSeparator + 1);
  if (!DOMAIN_SCOPE_PATTERN.test(domain) || !DOMAIN_SCOPE_PATTERN.test(scope)) {
    return undefined;
  }
  if (secondSeparator >= 0 && (qualifier === undefined || qualifier.length === 0)) {
    return undefined;
  }
  return qualifier === undefined ? { domain, scope } : { domain, scope, qualifier };
}

/** 基础权限 ID 是否在权限词表内。 */
export function isKnownBasePermission(value: string): boolean {
  return PERMISSION_BY_ID.has(value);
}

/** 查找基础权限定义。 */
export function findPermissionDefinition(value: string): IPermissionDefinition | undefined {
  return PERMISSION_BY_ID.get(value);
}

/**
 * 基础权限匹配（02-Bridge三层设计 §5.2）：精确匹配，或授权集合中存在 `domain:*` 通配。
 * 仅用于字符串快照形态；结构化授权记录由 `core/permission-evaluator.ts` 判定。
 */
export function matchesBasePermission(
  required: string,
  granted: ReadonlySet<string>,
): boolean {
  if (granted.has(required)) {
    return true;
  }
  const separator = required.lastIndexOf(':');
  if (separator < 0) {
    return false;
  }
  return granted.has(`${required.slice(0, separator)}:*`);
}
