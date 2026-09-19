// 能力 → 权限映射（夹具，故意缺键、多键、权限数组重复与词表外权限）

export const CAPABILITY_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  'file:read': ['filesystem:read', 'filesystem:read'],
  'file:copy': ['filesystem:read'],
  'window:setTitle': ['window:ghost'],
  'file:ghost': [],
  'filesystem:read': [],
};
