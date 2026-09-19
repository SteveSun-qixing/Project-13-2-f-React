import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PERMISSION_IDS,
  BUILTIN_PERMISSIONS,
  findPermissionDefinition,
  isKnownBasePermission,
  matchesBasePermission,
  parsePermissionId,
} from './permissions.js';

describe('parsePermissionId', () => {
  it('解析基础形式（2 段）与限定形式（3 段）', () => {
    expect(parsePermissionId('filesystem:read')).toEqual({ domain: 'filesystem', scope: 'read' });
    expect(parsePermissionId('filesystem:read:${userDocuments}/chips')).toEqual({
      domain: 'filesystem',
      scope: 'read',
      qualifier: '${userDocuments}/chips',
    });
  });

  it('按前两个冒号切分，限定值保留其余冒号（如网络端口）', () => {
    expect(parsePermissionId('network:http:example.com:8443')).toEqual({
      domain: 'network',
      scope: 'http',
      qualifier: 'example.com:8443',
    });
  });

  it('拒绝非法语法：缺冒号、空段、大写、空白、空限定值', () => {
    expect(parsePermissionId('filesystem')).toBeUndefined();
    expect(parsePermissionId(':read')).toBeUndefined();
    expect(parsePermissionId('filesystem:')).toBeUndefined();
    expect(parsePermissionId('filesystem:read:')).toBeUndefined();
    expect(parsePermissionId('FileSystem:read')).toBeUndefined();
    expect(parsePermissionId('file system:read')).toBeUndefined();
    expect(parsePermissionId('filesystem:read:*')).toEqual({
      domain: 'filesystem',
      scope: 'read',
      qualifier: '*',
    });
  });
});

describe('权限词表', () => {
  it('内置权限为 25 项且 ID 唯一、域内作用域合法', () => {
    expect(BUILTIN_PERMISSIONS).toHaveLength(25);
    expect(new Set(BUILTIN_PERMISSIONS.map((item) => item.id)).size).toBe(25);
    for (const definition of BUILTIN_PERMISSIONS) {
      expect(parsePermissionId(definition.id)).toEqual({
        domain: definition.domain,
        scope: definition.scope,
      });
    }
  });

  it('包含命令域与网络域权限', () => {
    expect(BUILTIN_PERMISSION_IDS.has('command:execute')).toBe(true);
    expect(BUILTIN_PERMISSION_IDS.has('network:http')).toBe(true);
    expect(BUILTIN_PERMISSION_IDS.has('events:publish')).toBe(true);
  });

  it('限定值要求取值与文档一致', () => {
    expect(findPermissionDefinition('filesystem:read')?.qualifier).toBe('required');
    expect(findPermissionDefinition('resources:read')?.qualifier).toBe('optional');
    expect(findPermissionDefinition('menu:manage')?.qualifier).toBe('forbidden');
    expect(findPermissionDefinition('unknown:x')).toBeUndefined();
    expect(isKnownBasePermission('filesystem:read')).toBe(true);
    expect(isKnownBasePermission('filesystem:exec')).toBe(false);
    expect(isKnownBasePermission('filesystem:read:${userHome}')).toBe(false);
  });
});

describe('matchesBasePermission', () => {
  const granted = new Set(['filesystem:read', 'resources:*']);

  it('精确匹配与 `domain:*` 通配匹配', () => {
    expect(matchesBasePermission('filesystem:read', granted)).toBe(true);
    expect(matchesBasePermission('resources:write', granted)).toBe(true);
    expect(matchesBasePermission('filesystem:write', granted)).toBe(false);
  });

  it('无冒号的输入不匹配任何通配', () => {
    expect(matchesBasePermission('filesystem', granted)).toBe(false);
  });
});
