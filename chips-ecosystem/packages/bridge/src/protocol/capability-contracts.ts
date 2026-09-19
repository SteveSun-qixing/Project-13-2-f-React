/**
 * Bridge 内置能力登记表（04-能力契约规范 §6.2 R19 全表 + §7 输入要点 + 08-权限系统设计 §4.3 限定值匹配目标）。
 *
 * 登记表是注册校验（ID 是否登记、权限映射是否一致）与权限判定（限定值目标字段）的 TS 侧权威数据。
 * 每条能力只声明**基础权限 ID**；限定值只存在于授权记录，判定时与输入中的目标字段比对。
 * `targetFields` 为输入字段路径（点分）；空数组表示该权限无调用目标（纯基础权限判定）。
 */

export interface IPermissionTargetRule {
  /** 基础权限 ID。 */
  readonly permission: string;
  /** 输入中的限定值目标字段路径；空数组表示无限定值目标。 */
  readonly targetFields: readonly string[];
}

export interface IBuiltinCapabilityContract {
  readonly id: string;
  readonly permissions: readonly string[];
  readonly targets: readonly IPermissionTargetRule[];
  /**
   * 归属校验型能力：不进入权限词表，按 owner 归属校验（04-能力契约规范 §6.2 注 7）。
   * 校验实现位于能力实现（Host 侧），Bridge 只保证权限判定不拦。
   */
  readonly ownerBound?: boolean;
}

/**
 * 内置能力的提供方标识（平台服务域）。
 *
 * 文档库未给出平台服务域 ID 的具体命名；此处以 `chips.platform` 作为默认内置提供方标识，
 * 由 `CapabilityRegistry` 选项 `builtinOwner` 覆盖，宿主可注入正式值。
 */
export const PLATFORM_CAPABILITY_OWNER = 'chips.platform';

function contract(
  id: string,
  permissions: readonly string[],
  targets: readonly IPermissionTargetRule[] = [],
  ownerBound = false,
): IBuiltinCapabilityContract {
  return ownerBound ? { id, permissions, targets, ownerBound } : { id, permissions, targets };
}

function target(permission: string, ...targetFields: string[]): IPermissionTargetRule {
  return { permission, targetFields };
}

/** R19 内置能力与权限总表（60 项）。 */
export const BUILTIN_CAPABILITIES: readonly IBuiltinCapabilityContract[] = [
  contract('file:read', ['filesystem:read'], [target('filesystem:read', 'path')]),
  contract('file:list', ['filesystem:read'], [target('filesystem:read', 'directory')]),
  contract('file:watch', ['filesystem:read'], [target('filesystem:read', 'path')]),
  contract('file:write', ['filesystem:write'], [target('filesystem:write', 'path')]),
  contract('file:mkdir', ['filesystem:write'], [target('filesystem:write', 'path')]),
  contract('file:delete', ['filesystem:delete'], [target('filesystem:delete', 'path')]),
  contract('file:move', ['filesystem:write'], [target('filesystem:write', 'source', 'target')]),
  contract('file:copy', ['filesystem:read', 'filesystem:write'], [
    target('filesystem:read', 'source'),
    target('filesystem:write', 'target'),
  ]),
  contract('resource:read', ['resources:read'], [target('resources:read', 'uri')]),
  contract('resource:write', ['resources:write'], [target('resources:write', 'uri')]),
  contract('resource:open', ['resources:read'], [target('resources:read', 'resource.uri')]),
  contract('resource:list-handlers', []),
  contract('document:create', ['resources:write'], [target('resources:write', 'parent')]),
  contract('document:open', ['resources:read'], [target('resources:read', 'source')]),
  contract('document:read', ['resources:read']),
  contract('document:write', ['resources:write']),
  contract('document:save', ['resources:write']),
  contract('document:export', ['resources:read', 'filesystem:write'], [
    target('filesystem:write', 'target'),
  ]),
  contract('window:create', ['window:control']),
  contract('window:list', ['window:control']),
  contract('window:focus', ['window:control'], [target('window:control', 'windowId')]),
  contract('window:close', ['window:control'], [target('window:control', 'windowId')]),
  contract('window:resize', ['window:control'], [target('window:control', 'windowId')]),
  contract('window:move', ['window:control'], [target('window:control', 'windowId')]),
  contract('window:setTitle', ['window:control'], [target('window:control', 'windowId')]),
  contract('window:setState', ['window:control'], [target('window:control', 'windowId')]),
  contract('menu:set', ['menu:manage']),
  contract('tray:set', ['tray:manage']),
  contract('shortcut:register', ['shortcut:manage']),
  contract('shortcut:unregister', ['shortcut:manage']),
  contract('system:info', ['system:read']),
  contract('power:query', ['power:read']),
  contract('power:prevent-sleep', ['power:manage']),
  contract('transfer:download', ['transfer:manage', 'filesystem:write', 'network:http'], [
    target('filesystem:write', 'target'),
    target('network:http', 'url'),
  ]),
  contract('transfer:cancel', ['transfer:manage', 'filesystem:write', 'network:http']),
  contract('notification:send', ['notifications:send']),
  contract('clipboard:read', ['clipboard:access']),
  contract('clipboard:write', ['clipboard:access']),
  contract('dialog:open', ['dialogs:use']),
  contract('dialog:save', ['dialogs:use']),
  contract('shell:openExternal', ['shell:external'], [target('shell:external', 'url')]),
  contract('http:request', ['network:http'], [target('network:http', 'url')]),
  contract('config:get', ['config:read'], [target('config:read', 'namespace')]),
  contract('config:snapshot', ['config:read'], [target('config:read', 'namespace')]),
  contract('config:set', ['config:write'], [target('config:write', 'namespace')]),
  contract('config:reset', ['config:write'], [target('config:write', 'namespace')]),
  contract('credential:get', ['credential:manage']),
  contract('credential:set', ['credential:manage']),
  contract('credential:delete', ['credential:manage']),
  contract('event:publish', ['events:publish']),
  contract('command:register', ['command:write']),
  contract('command:unregister', ['command:write']),
  contract('command:list', ['command:read']),
  contract('command:get', ['command:read']),
  contract('command:invoke', ['command:execute']),
  contract('cli:task-active', [], [], true),
  contract('cli:task-get', [], [], true),
  contract('cli:task-progress', [], [], true),
  contract('cli:task-complete', [], [], true),
  contract('cli:task-fail', [], [], true),
];

const CONTRACT_BY_ID: ReadonlyMap<string, IBuiltinCapabilityContract> = new Map(
  BUILTIN_CAPABILITIES.map((entry) => [entry.id, entry]),
);

export function findBuiltinCapability(id: string): IBuiltinCapabilityContract | undefined {
  return CONTRACT_BY_ID.get(id);
}

export function isBuiltinCapability(id: string): boolean {
  return CONTRACT_BY_ID.has(id);
}

/** 内置能力 ID 集合。 */
export const BUILTIN_CAPABILITY_IDS: ReadonlySet<string> = new Set(CONTRACT_BY_ID.keys());
