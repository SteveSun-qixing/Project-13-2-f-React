// 能力 ID 常量（夹具，故意含重复、非法文法与多余 ID）

export const CAPABILITY_IDS = [
  'file:read',
  'file:read',
  'bad',
  'file:ghost',
  'filesystem:read',
] as const satisfies readonly string[];
