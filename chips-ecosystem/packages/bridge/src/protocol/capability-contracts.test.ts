import { describe, expect, it } from 'vitest';
import {
  BUILTIN_CAPABILITIES,
  BUILTIN_CAPABILITY_IDS,
  findBuiltinCapability,
  isBuiltinCapability,
  PLATFORM_CAPABILITY_OWNER,
} from './capability-contracts.js';
import { BUILTIN_PERMISSION_IDS, isKnownBasePermission, parsePermissionId } from './permissions.js';

describe('内置能力登记表（R19 全表）', () => {
  it('登记 60 项且 ID 唯一、文法合法', () => {
    expect(BUILTIN_CAPABILITIES).toHaveLength(60);
    expect(new Set(BUILTIN_CAPABILITIES.map((item) => item.id)).size).toBe(60);
    // 与 tools/contract-gen 同一口径：domain 全小写，action 允许驼峰（如 window:setTitle）。
    const pattern = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*(:[a-z0-9][a-z0-9.-]*)?$/;
    for (const contract of BUILTIN_CAPABILITIES) {
      expect(contract.id).toMatch(pattern);
    }
  });

  it('能力 ID 与权限 ID 分属两个命名空间（R3）', () => {
    for (const contract of BUILTIN_CAPABILITIES) {
      expect(isKnownBasePermission(contract.id)).toBe(false);
    }
    for (const permission of BUILTIN_PERMISSION_IDS) {
      expect(BUILTIN_CAPABILITY_IDS.has(permission)).toBe(false);
    }
    expect(parsePermissionId('window:control')).toBeDefined();
  });

  it('能力只声明权限词表内的基础权限，且 target 规则引用自身声明的权限', () => {
    for (const contract of BUILTIN_CAPABILITIES) {
      for (const permission of contract.permissions) {
        expect(isKnownBasePermission(permission)).toBe(true);
      }
      for (const rule of contract.targets) {
        expect(contract.permissions).toContain(rule.permission);
        expect(rule.targetFields.length).toBeGreaterThan(0);
      }
    }
  });

  it('登记表覆盖文件、窗口、命令与 CLI 任务等能力族', () => {
    for (const id of [
      'file:read',
      'resource:open',
      'document:export',
      'window:setTitle',
      'http:request',
      'event:publish',
      'command:invoke',
      'cli:task-progress',
    ]) {
      expect(isBuiltinCapability(id)).toBe(true);
      expect(BUILTIN_CAPABILITY_IDS.has(id)).toBe(true);
    }
    expect(isBuiltinCapability('image:resize')).toBe(false);
    expect(isBuiltinCapability('converter:convertTiffToPng')).toBe(false);
  });

  it('CLI 任务能力为空权限并标记归属校验型', () => {
    for (const id of [
      'cli:task-active',
      'cli:task-get',
      'cli:task-progress',
      'cli:task-complete',
      'cli:task-fail',
    ]) {
      const contract = findBuiltinCapability(id);
      expect(contract?.permissions).toEqual([]);
      expect(contract?.ownerBound).toBe(true);
    }
  });

  it('无权限能力与普通能力的 target 规则区分正确', () => {
    expect(findBuiltinCapability('resource:list-handlers')?.permissions).toEqual([]);
    expect(findBuiltinCapability('resource:list-handlers')?.ownerBound).toBeUndefined();
    expect(findBuiltinCapability('file:copy')?.targets).toEqual([
      { permission: 'filesystem:read', targetFields: ['source'] },
      { permission: 'filesystem:write', targetFields: ['target'] },
    ]);
    expect(findBuiltinCapability('document:export')?.targets).toEqual([
      { permission: 'filesystem:write', targetFields: ['target'] },
    ]);
  });

  it('平台提供方标识为宿主可覆盖常量', () => {
    expect(PLATFORM_CAPABILITY_OWNER).toBe('chips.platform');
  });
});
