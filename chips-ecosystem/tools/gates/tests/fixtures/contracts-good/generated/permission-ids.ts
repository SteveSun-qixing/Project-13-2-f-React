// 权限 ID 常量（内置权限词表，夹具）
// 此文件由夹具模拟 contract-gen 生成物，禁止手写修改。

export const Permission = {
  FILESYSTEM_READ: 'filesystem:read',
  FILESYSTEM_WRITE: 'filesystem:write',
  WINDOW_CONTROL: 'window:control',
} as const;

export type PermissionId = (typeof Permission)[keyof typeof Permission];

export const PERMISSION_IDS = [
  'filesystem:read',
  'filesystem:write',
  'window:control',
] as const satisfies readonly PermissionId[];
