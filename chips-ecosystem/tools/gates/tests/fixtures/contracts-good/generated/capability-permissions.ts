// 能力 → 所需权限映射（R19 §6.2，夹具）
// 此文件由夹具模拟 contract-gen 生成物，禁止手写修改。

import type { CapabilityId } from './capability-ids.js';
import type { PermissionId } from './permission-ids.js';

export const CAPABILITY_PERMISSIONS: Readonly<Record<CapabilityId, readonly PermissionId[]>> = {
  'file:read': ['filesystem:read'],
  'file:copy': ['filesystem:read', 'filesystem:write'],
  'window:setTitle': ['window:control'],
  'cli:task-get': [],
};
