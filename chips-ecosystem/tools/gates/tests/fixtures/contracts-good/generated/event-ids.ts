// 标准事件 ID 常量（夹具）
// 此文件由夹具模拟 contract-gen 生成物，禁止手写修改。

export const StandardEvent = {
  PLUGIN_INSTALLED: 'plugin:installed',
  CONFIG_CHANGED: 'config:changed',
} as const;

export type EventId = (typeof StandardEvent)[keyof typeof StandardEvent];

export const EVENT_IDS = [
  'plugin:installed',
  'config:changed',
] as const satisfies readonly EventId[];
