import { describe, expect, it } from 'vitest';

import { emitContract } from '../src/emit.js';
import type { ContractModel } from '../src/types.js';

const model: ContractModel = {
  capabilities: [
    { id: 'file:read', permissions: ['filesystem:read'] },
    { id: 'window:setTitle', permissions: ['window:control'] },
    { id: 'cli:task-get', permissions: [] },
  ],
  permissions: [{ id: 'filesystem:read' }, { id: 'window:control' }],
  events: [{ id: 'plugin:installed', domain: 'plugin' }],
  errorCodes: [{ code: 'BRIDGE_TIMEOUT' }, { code: 'EVENT_ID_INVALID' }],
  facts: { capabilityCount: 3, reservedDomains: [], permissionVocabulary: [] },
  sources: {
    capability: [{ file: 'capability.md', section: '6.2 样例' }],
    permission: [{ file: 'permission.md', section: '4.1 样例' }],
    event: [{ file: 'event.md', section: '4.1 样例' }],
    error: [{ file: 'error.md', section: '八、错误码' }],
  },
};

function file(path: string): string {
  const found = emitContract(model).find((candidate) => candidate.path === path);
  if (found === undefined) {
    throw new Error(`缺少生成文件：${path}`);
  }
  return found.content;
}

describe('emitContract', () => {
  it('生成固定文件清单', () => {
    expect(emitContract(model).map((generated) => generated.path)).toEqual([
      'capability-ids.ts',
      'capability-permissions.ts',
      'error-codes.ts',
      'event-ids.ts',
      'permission-ids.ts',
      'index.ts',
    ]);
  });

  it('capability-ids.ts 输出断言', () => {
    expect(file('capability-ids.ts')).toBe(
      `// 能力 ID 常量（R19 内置能力）
// 此文件由 chips-ecosystem/tools/contract-gen 生成，禁止手写修改。
// 事实源（薯片生态文档库）：
//   - capability.md §6.2 样例
// 重新生成：pnpm --filter @chips/contract-gen run generate

export const Capability = {
  FILE_READ: 'file:read',
  WINDOW_SET_TITLE: 'window:setTitle',
  CLI_TASK_GET: 'cli:task-get',
} as const;

export type CapabilityId = (typeof Capability)[keyof typeof Capability];

export const CAPABILITY_IDS = [
  'file:read',
  'window:setTitle',
  'cli:task-get',
] as const satisfies readonly CapabilityId[];
`
    );
  });

  it('error-codes.ts 输出断言', () => {
    expect(file('error-codes.ts')).toBe(
      `// 错误码常量（ChipsError.code）
// 此文件由 chips-ecosystem/tools/contract-gen 生成，禁止手写修改。
// 事实源（薯片生态文档库）：
//   - error.md §八、错误码
// 重新生成：pnpm --filter @chips/contract-gen run generate

export const ERROR_CODES = [
  'BRIDGE_TIMEOUT',
  'EVENT_ID_INVALID',
] as const satisfies readonly string[];

export type ErrorCode = (typeof ERROR_CODES)[number];
`
    );
  });

  it('capability-permissions.ts 输出断言', () => {
    expect(file('capability-permissions.ts')).toBe(
      `// 能力 → 所需权限映射（R19 §6.2）
// 此文件由 chips-ecosystem/tools/contract-gen 生成，禁止手写修改。
// 事实源（薯片生态文档库）：
//   - capability.md §6.2 样例
// 重新生成：pnpm --filter @chips/contract-gen run generate

import type { CapabilityId } from './capability-ids.js';
import type { PermissionId } from './permission-ids.js';

export const CAPABILITY_PERMISSIONS: Readonly<Record<CapabilityId, readonly PermissionId[]>> = {
  'file:read': ['filesystem:read'],
  'window:setTitle': ['window:control'],
  'cli:task-get': [],
};
`
    );
  });

  it('index.ts 统一导出且无事实源注记', () => {
    const content = file('index.ts');
    expect(content).toContain(`export * from './capability-ids.js';`);
    expect(content).toContain(`export * from './error-codes.js';`);
    expect(content).toContain(`export * from './event-ids.js';`);
    expect(content).toContain(`export * from './permission-ids.js';`);
    expect(content).not.toContain('事实源');
  });

  it('重复渲染字节一致（幂等）', () => {
    expect(emitContract(model)).toEqual(emitContract(model));
  });
});
