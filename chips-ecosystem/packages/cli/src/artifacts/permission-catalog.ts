/**
 * 权限词表与校验（[插件清单规范] §6.2、§6.3；命令域权限见 [命令系统契约] §3.1）。
 *
 * 本模块是 CLI 侧 manifest 校验所使用的登记目录：基础表逐行取自《插件清单规范》§6.2 的
 * "manifest 申请侧视图"，命令域权限取自《命令系统契约》§3.1；CLI 不新增权限 ID。
 * 卡片类型 / 布局类型登记表由平台目录注入，未注入时按文法校验。
 */

import { cliError } from '../errors.js';
import type { CliPluginRole } from '../client/types.js';

/** 限定值要求。 */
export type PermissionQualifierRule = 'required' | 'optional' | 'forbidden';

/** 权限规则。 */
export interface IPermissionRule {
  readonly id: string;
  readonly qualifier: PermissionQualifierRule;
  /** `all` 表示四种角色均可申请。 */
  readonly roles: readonly CliPluginRole[] | 'all';
}

const ALL_ROLES: readonly CliPluginRole[] = ['app', 'basecard', 'boxlayout', 'service'];
const APP_ONLY: readonly CliPluginRole[] = ['app'];

/** 基础权限表（[插件清单规范] §6.2）。 */
const BASE_PERMISSION_RULES: readonly IPermissionRule[] = [
  { id: 'filesystem:read', qualifier: 'required', roles: 'all' },
  { id: 'filesystem:write', qualifier: 'required', roles: 'all' },
  { id: 'filesystem:delete', qualifier: 'required', roles: 'all' },
  { id: 'resources:read', qualifier: 'optional', roles: 'all' },
  { id: 'resources:write', qualifier: 'optional', roles: 'all' },
  { id: 'window:control', qualifier: 'optional', roles: APP_ONLY },
  { id: 'menu:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'tray:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'shortcut:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'system:read', qualifier: 'forbidden', roles: 'all' },
  { id: 'power:read', qualifier: 'forbidden', roles: 'all' },
  { id: 'power:manage', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'transfer:manage', qualifier: 'forbidden', roles: 'all' },
  { id: 'notifications:send', qualifier: 'forbidden', roles: 'all' },
  { id: 'clipboard:access', qualifier: 'forbidden', roles: 'all' },
  { id: 'dialogs:use', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'shell:external', qualifier: 'required', roles: APP_ONLY },
  { id: 'network:http', qualifier: 'required', roles: 'all' },
  { id: 'config:read', qualifier: 'required', roles: 'all' },
  { id: 'config:write', qualifier: 'required', roles: 'all' },
  { id: 'credential:manage', qualifier: 'forbidden', roles: 'all' },
  { id: 'events:publish', qualifier: 'forbidden', roles: 'all' },
  { id: 'command:write', qualifier: 'forbidden', roles: APP_ONLY },
  { id: 'command:read', qualifier: 'forbidden', roles: 'all' },
  { id: 'command:execute', qualifier: 'forbidden', roles: 'all' },
];

/** 登记目录端口。 */
export interface IPermissionCatalog {
  readonly rules: readonly IPermissionRule[];
  /** 已登记卡片类型 ID（缺失时按文法校验）。 */
  readonly cardTypeIds?: readonly string[];
  /** 已登记布局类型 ID（缺失时按文法校验）。 */
  readonly layoutTypeIds?: readonly string[];
  /** 已登记 Bridge 能力 ID（缺失时 `cli.commands[].target.capability` 只校验文法）。 */
  readonly capabilityIds?: readonly string[];
  find(base: string): IPermissionRule | undefined;
}

/** 构造内置登记目录。 */
export function createDocumentedPermissionCatalog(options?: {
  readonly cardTypeIds?: readonly string[];
  readonly layoutTypeIds?: readonly string[];
  readonly capabilityIds?: readonly string[];
}): IPermissionCatalog {
  const rules = [...BASE_PERMISSION_RULES];
  return {
    rules,
    ...(options?.cardTypeIds === undefined ? {} : { cardTypeIds: options.cardTypeIds }),
    ...(options?.layoutTypeIds === undefined ? {} : { layoutTypeIds: options.layoutTypeIds }),
    ...(options?.capabilityIds === undefined ? {} : { capabilityIds: options.capabilityIds }),
    find: (base: string): IPermissionRule | undefined => rules.find((rule) => rule.id === base),
  };
}

/** 全部角色（导出供校验使用）。 */
export function allPluginRoles(): readonly CliPluginRole[] {
  return ALL_ROLES;
}

/** 解析权限申请串为 `{ base, qualifier }`；段数非法返回 undefined。 */
export function splitPermissionRequest(
  request: string
): { readonly base: string; readonly qualifier?: string } | undefined {
  const first = request.indexOf(':');
  if (first === -1) {
    return undefined;
  }
  const second = request.indexOf(':', first + 1);
  const base = second === -1 ? request : request.slice(0, second);
  const qualifier = second === -1 ? undefined : request.slice(second + 1);
  if (base.split(':').length !== 2) {
    return undefined;
  }
  const [domain, scope] = base.split(':');
  if (domain === undefined || scope === undefined || domain === '*' || scope === '*') {
    return undefined;
  }
  if (!/^[a-z][a-z0-9-]*$/.test(domain) || !/^[a-z][a-z0-9-]*$/.test(scope)) {
    return undefined;
  }
  const result: { base: string; qualifier?: string } = { base };
  if (qualifier !== undefined) {
    result.qualifier = qualifier;
  }
  return result;
}

const PATH_QUALIFIER_PATTERN = /^\$\{[a-zA-Z][a-zA-Z0-9]*\}(?:\/[^\s:]+)*$/;
const DOMAIN_QUALIFIER_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/;
const URL_QUALIFIER_PATTERN = /^https?:\/\/[^\s]+$/;
const WINDOW_QUALIFIER_PATTERN = /^[A-Za-z0-9*][A-Za-z0-9*-]*$/;
const SCOPE_QUALIFIER_PATTERN = /^[a-z][a-z0-9-]*\*?$/;
const NAMESPACE_QUALIFIER_PATTERN = /^(platform|plugins\.[a-z0-9.-]+)$/;

function qualifierInvalid(domain: string, qualifier: string): boolean {
  switch (domain) {
    case 'filesystem':
      return !PATH_QUALIFIER_PATTERN.test(qualifier);
    case 'network':
      return !DOMAIN_QUALIFIER_PATTERN.test(qualifier);
    case 'shell':
      return !URL_QUALIFIER_PATTERN.test(qualifier);
    case 'window':
      return !WINDOW_QUALIFIER_PATTERN.test(qualifier);
    case 'resources':
      return !SCOPE_QUALIFIER_PATTERN.test(qualifier);
    case 'config':
      return !NAMESPACE_QUALIFIER_PATTERN.test(qualifier);
    default:
      return qualifier.length === 0;
  }
}

/**
 * 校验单条权限申请（[插件清单规范] §6.3.3–6.3.5）。
 *
 * @returns 归一后的权限申请串
 */
export function validatePermissionRequest(input: {
  readonly request: string;
  readonly role: CliPluginRole;
  readonly catalog: IPermissionCatalog;
  readonly pointer: string;
}): string {
  const parsed = splitPermissionRequest(input.request);
  if (parsed === undefined) {
    throw cliError('PERMISSION_UNKNOWN', `权限 ID 非法：${input.request}`, {
      stage: 'manifest',
      pointer: input.pointer,
    });
  }
  const rule = input.catalog.find(parsed.base);
  if (rule === undefined) {
    throw cliError('PERMISSION_UNKNOWN', `未登记的权限 ID：${input.request}`, {
      stage: 'manifest',
      pointer: input.pointer,
    });
  }
  if (rule.roles !== 'all' && !rule.roles.includes(input.role)) {
    throw cliError('PERMISSION_ROLE_NOT_ALLOWED', `${input.role} 角色不得申请权限：${rule.id}`, {
      stage: 'manifest',
      pointer: input.pointer,
    });
  }
  const qualifier = parsed.qualifier;
  if (rule.qualifier === 'required' && (qualifier === undefined || qualifier.length === 0)) {
    throw cliError('PERMISSION_INVALID', `权限 ${rule.id} 必须携带限定值`, {
      stage: 'manifest',
      pointer: input.pointer,
    });
  }
  if (rule.qualifier === 'forbidden' && qualifier !== undefined) {
    throw cliError('PERMISSION_INVALID', `权限 ${rule.id} 禁止携带限定值`, {
      stage: 'manifest',
      pointer: input.pointer,
    });
  }
  if (qualifier !== undefined) {
    const domain = parsed.base.split(':')[0] ?? '';
    if (qualifierInvalid(domain, qualifier)) {
      throw cliError('PERMISSION_INVALID', `权限 ${rule.id} 的限定值非法：${qualifier}`, {
        stage: 'manifest',
        pointer: input.pointer,
      });
    }
  }
  return qualifier === undefined ? parsed.base : `${parsed.base}:${qualifier}`;
}
