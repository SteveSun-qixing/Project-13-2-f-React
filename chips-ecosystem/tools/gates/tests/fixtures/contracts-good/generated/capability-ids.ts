// 能力 ID 常量（R19 内置能力，夹具）
// 此文件由夹具模拟 contract-gen 生成物，禁止手写修改。

export const Capability = {
  FILE_READ: 'file:read',
  FILE_COPY: 'file:copy',
  WINDOW_SET_TITLE: 'window:setTitle',
  CLI_TASK_GET: 'cli:task-get',
} as const;

export type CapabilityId = (typeof Capability)[keyof typeof Capability];

export const CAPABILITY_IDS = [
  'file:read',
  'file:copy',
  'window:setTitle',
  'cli:task-get',
] as const satisfies readonly CapabilityId[];
