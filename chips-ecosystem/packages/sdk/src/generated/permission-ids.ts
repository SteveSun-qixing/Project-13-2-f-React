// 权限 ID 常量（内置权限词表）
// 此文件由 chips-ecosystem/tools/contract-gen 生成，禁止手写修改。
// 事实源（薯片生态文档库）：
//   - 01-架构设计/01-子系统设计/08.04-08-权限系统设计-四、内置权限清单与映射.md §4.1 内置权限清单总表
//   - 01-架构设计/01-子系统设计/08.03-08-权限系统设计-三、权限 ID 体系.md §3.2 内置域
//   - 05-接口与契约/13.06-13-命令系统契约-六、权限与审计.md §6.1 权限
// 重新生成：pnpm --filter @chips/contract-gen run generate

export const Permission = {
  FILESYSTEM_READ: 'filesystem:read',
  FILESYSTEM_WRITE: 'filesystem:write',
  FILESYSTEM_DELETE: 'filesystem:delete',
  RESOURCES_READ: 'resources:read',
  RESOURCES_WRITE: 'resources:write',
  WINDOW_CONTROL: 'window:control',
  MENU_MANAGE: 'menu:manage',
  TRAY_MANAGE: 'tray:manage',
  SHORTCUT_MANAGE: 'shortcut:manage',
  SYSTEM_READ: 'system:read',
  POWER_READ: 'power:read',
  POWER_MANAGE: 'power:manage',
  TRANSFER_MANAGE: 'transfer:manage',
  NOTIFICATIONS_SEND: 'notifications:send',
  CLIPBOARD_ACCESS: 'clipboard:access',
  DIALOGS_USE: 'dialogs:use',
  SHELL_EXTERNAL: 'shell:external',
  NETWORK_HTTP: 'network:http',
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',
  CREDENTIAL_MANAGE: 'credential:manage',
  EVENTS_PUBLISH: 'events:publish',
  COMMAND_READ: 'command:read',
  COMMAND_WRITE: 'command:write',
  COMMAND_EXECUTE: 'command:execute',
} as const;

export type PermissionId = (typeof Permission)[keyof typeof Permission];

export const PERMISSION_IDS = [
  'filesystem:read',
  'filesystem:write',
  'filesystem:delete',
  'resources:read',
  'resources:write',
  'window:control',
  'menu:manage',
  'tray:manage',
  'shortcut:manage',
  'system:read',
  'power:read',
  'power:manage',
  'transfer:manage',
  'notifications:send',
  'clipboard:access',
  'dialogs:use',
  'shell:external',
  'network:http',
  'config:read',
  'config:write',
  'credential:manage',
  'events:publish',
  'command:read',
  'command:write',
  'command:execute',
] as const satisfies readonly PermissionId[];
