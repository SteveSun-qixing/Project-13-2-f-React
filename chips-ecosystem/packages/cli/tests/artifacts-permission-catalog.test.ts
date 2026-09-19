/**
 * 权限词表与权限申请校验（清单校验模块的「权限表」半边）。
 *
 * 事实源：[插件清单规范] §6.2 权限登记表（manifest 申请侧视图）、§6.3.3–§6.3.5 限定值文法；
 * 命令域权限见 [命令系统契约] §3.1；拒绝错误码取 [权限系统设计] §9.1 错误码总表
 * （`PERMISSION_UNKNOWN` / `PERMISSION_INVALID` / `PERMISSION_ROLE_NOT_ALLOWED`，
 * 与 `@chips/sdk` 生成契约 `ERROR_CODES` 同源，本文件不自造错误码）。
 *
 * 断言面向文档契约：错误码、`details.stage = 'manifest'` 与 `details.pointer`、
 * 以及归一后的权限申请串返回值。
 */

import { describe, expect, it } from 'vitest';

import type { CliPluginRole } from '../src/client/types.js';
import {
  allPluginRoles,
  createDocumentedPermissionCatalog,
  splitPermissionRequest,
  validatePermissionRequest,
  type IPermissionCatalog,
  type IPermissionRule,
} from '../src/artifacts/permission-catalog.js';
import { ChipsError } from '../src/errors.js';

const POINTER = 'permissions[0]';

/** 执行一次校验并断言错误码、指针与阶段。 */
function expectRejection(run: () => unknown, code: string): ChipsError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    const normalized = error as ChipsError;
    expect(normalized.code).toBe(code);
    const details = normalized.details as { pointer?: string; stage?: string };
    expect(details.pointer).toBe(POINTER);
    expect(details.stage).toBe('manifest');
    return normalized;
  }
  throw new Error(`期望抛出 ${code}`);
}

/** 以内置登记表校验一条权限申请，返回归一后的权限申请串。 */
function check(request: string, role: CliPluginRole = 'service'): string {
  return validatePermissionRequest({
    request,
    role,
    catalog: createDocumentedPermissionCatalog(),
    pointer: POINTER,
  });
}

/** 以内置登记表校验一条权限申请，用于断言拒绝路径。 */
function reject(request: string, role: CliPluginRole = 'service'): ChipsError {
  return expectRejection(() => check(request, role), 'PERMISSION_UNKNOWN');
}

describe('splitPermissionRequest', () => {
  it('切分权限 ID 与限定值：以第三个冒号为界（§6.3.1）', () => {
    expect(splitPermissionRequest('filesystem:read')).toEqual({ base: 'filesystem:read' });
    expect(splitPermissionRequest('resources:write')).toEqual({ base: 'resources:write' });
    expect(splitPermissionRequest('filesystem:read:${userDocuments}')).toEqual({
      base: 'filesystem:read',
      qualifier: '${userDocuments}',
    });
    expect(splitPermissionRequest('config:read:')).toEqual({ base: 'config:read', qualifier: '' });
  });

  it('限定值内部的冒号整体保留（端口/路径型限定值）', () => {
    expect(splitPermissionRequest('network:http:example.com:8080')).toEqual({
      base: 'network:http',
      qualifier: 'example.com:8080',
    });
    expect(splitPermissionRequest('network:http:*.example.com:8080/a:b')).toEqual({
      base: 'network:http',
      qualifier: '*.example.com:8080/a:b',
    });
  });

  it('域名/作用域带连字符与数字时合法（§6.2 词表文法）', () => {
    expect(splitPermissionRequest('card-theme:read:dark')).toEqual({
      base: 'card-theme:read',
      qualifier: 'dark',
    });
    expect(splitPermissionRequest('shell2:external2')).toEqual({ base: 'shell2:external2' });
  });

  it('段数与词法文法非法一律返回 undefined', () => {
    expect(splitPermissionRequest('')).toBeUndefined();
    expect(splitPermissionRequest('filesystemread')).toBeUndefined();
    expect(splitPermissionRequest('filesystem read')).toBeUndefined();
    expect(splitPermissionRequest(':read')).toBeUndefined();
    expect(splitPermissionRequest('filesystem:')).toBeUndefined();
  });

  it('通配段与词法越界返回 undefined（禁止通配申请，§6.3.2）', () => {
    expect(splitPermissionRequest('*:*')).toBeUndefined();
    expect(splitPermissionRequest('*:read')).toBeUndefined();
    expect(splitPermissionRequest('filesystem:*')).toBeUndefined();
    expect(splitPermissionRequest('FileSystem:read')).toBeUndefined();
    expect(splitPermissionRequest('filesystem:Read')).toBeUndefined();
    expect(splitPermissionRequest('1filesystem:read')).toBeUndefined();
    expect(splitPermissionRequest('filesystem:read!')).toBeUndefined();
    expect(splitPermissionRequest('-file:read')).toBeUndefined();
  });
});

describe('createDocumentedPermissionCatalog', () => {
  it('角色全集按四角色序提供', () => {
    expect(allPluginRoles()).toEqual(['app', 'basecard', 'boxlayout', 'service']);
  });

  it('内置表逐条对应 [插件清单规范] §6.2，且 ID 均过文法', () => {
    const catalog = createDocumentedPermissionCatalog();
    expect(catalog.rules).toHaveLength(25);
    const ids = catalog.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of catalog.rules) {
      expect(['required', 'optional', 'forbidden']).toContain(rule.qualifier);
      expect(rule.roles === 'all' || rule.roles.length > 0).toBe(true);
      expect(splitPermissionRequest(rule.id)).toEqual({ base: rule.id });
    }
  });

  it('关键行的限定值要求与角色适用面（§6.2 申请侧视图）', () => {
    const catalog = createDocumentedPermissionCatalog();
    expect(catalog.find('filesystem:read')).toEqual({
      id: 'filesystem:read',
      qualifier: 'required',
      roles: 'all',
    });
    expect(catalog.find('window:control')?.roles).toEqual(['app']);
    expect(catalog.find('window:control')?.qualifier).toBe('optional');
    expect(catalog.find('shell:external')).toMatchObject({ qualifier: 'required', roles: ['app'] });
    expect(catalog.find('menu:manage')).toMatchObject({ qualifier: 'forbidden', roles: ['app'] });
    expect(catalog.find('system:read')).toMatchObject({ qualifier: 'forbidden', roles: 'all' });
    expect(catalog.find('notifications:send')?.qualifier).toBe('forbidden');
    expect(catalog.find('command:write')?.roles).toEqual(['app']);
    expect(catalog.find('command:read')?.qualifier).toBe('forbidden');
    expect(catalog.find('command:execute')?.roles).toBe('all');
    expect(catalog.find('card:read')).toBeUndefined();
    expect(catalog.find('filesystem')).toBeUndefined();
  });

  it('未提供的登记表字段不下发，缺省即只按文法校验', () => {
    const plain = createDocumentedPermissionCatalog();
    expect('cardTypeIds' in plain).toBe(false);
    expect('layoutTypeIds' in plain).toBe(false);
    expect('capabilityIds' in plain).toBe(false);

    const injected = createDocumentedPermissionCatalog({
      cardTypeIds: ['base.richtext'],
      capabilityIds: ['clock:now'],
    });
    expect(injected.cardTypeIds).toEqual(['base.richtext']);
    expect(injected.capabilityIds).toEqual(['clock:now']);
    expect('layoutTypeIds' in injected).toBe(false);
  });
});

describe('validatePermissionRequest：登记表与角色', () => {
  it('权限 ID 文法非法时先于登记表查询拒绝（PERMISSION_UNKNOWN）', () => {
    expect(reject('filesystemread').message).toBe('权限 ID 非法：filesystemread');
    expect(reject('*:*').message).toBe('权限 ID 非法：*:*');
    expect(reject('FileSystem:read').message).toBe('权限 ID 非法：FileSystem:read');
    expect(reject('filesystem:read!').message).toBe('权限 ID 非法：filesystem:read!');
  });

  it('未登记的权限 ID 拒绝，含词法合法但未入表的 ID（§6.3.2）', () => {
    expect(reject('nope:read').message).toBe('未登记的权限 ID：nope:read');
    expect(reject('file:read').message).toBe('未登记的权限 ID：file:read');
    expect(reject('file:system:read').message).toBe('未登记的权限 ID：file:system:read');
    expect(reject('filesystem:delete2').message).toBe('未登记的权限 ID：filesystem:delete2');
  });

  it('仅限 app 的权限对其他角色返回 PERMISSION_ROLE_NOT_ALLOWED（§6.2）', () => {
    for (const role of ['service', 'basecard', 'boxlayout'] as const) {
      const error = expectRejection(
        () => check('window:control', role),
        'PERMISSION_ROLE_NOT_ALLOWED'
      );
      expect(error.message).toBe(`${role} 角色不得申请权限：window:control`);
    }
    expectRejection(
      () => check('shell:external:https://example.com', 'service'),
      'PERMISSION_ROLE_NOT_ALLOWED'
    );
    expectRejection(() => check('menu:manage', 'basecard'), 'PERMISSION_ROLE_NOT_ALLOWED');
    expectRejection(() => check('command:write:x/y', 'boxlayout'), 'PERMISSION_ROLE_NOT_ALLOWED');
    expect(check('window:control', 'app')).toBe('window:control');
  });

  it('app 专属权限按角色放行、跨域权限全角色放行', () => {
    expect(check('shell:external:https://example.com', 'app')).toBe(
      'shell:external:https://example.com'
    );
    expect(check('system:read', 'boxlayout')).toBe('system:read');
    expect(check('power:manage', 'app')).toBe('power:manage');
  });
});

describe('validatePermissionRequest：限定值要求', () => {
  it('要求限定值的权限缺失限定值时拒绝（§6.3.3）', () => {
    for (const request of ['filesystem:read', 'filesystem:write', 'network:http', 'config:read']) {
      const error = expectRejection(() => check(request), 'PERMISSION_INVALID');
      expect(error.message).toBe(`权限 ${request} 必须携带限定值`);
    }
    expectRejection(() => check('shell:external', 'app'), 'PERMISSION_INVALID');
  });

  it('空限定值等同于缺失（尾部冒号形态）', () => {
    expectRejection(() => check('filesystem:read:'), 'PERMISSION_INVALID');
    expectRejection(() => check('config:read:'), 'PERMISSION_INVALID');
  });

  it('禁止限定值的权限携带任何限定值时拒绝（§6.3.4）', () => {
    const error = expectRejection(() => check('menu:manage:anything', 'app'), 'PERMISSION_INVALID');
    expect(error.message).toBe('权限 menu:manage 禁止携带限定值');
    expectRejection(() => check('system:read:x'), 'PERMISSION_INVALID');
    expectRejection(() => check('clipboard:access:'), 'PERMISSION_INVALID');
    expectRejection(() => check('events:publish:platform'), 'PERMISSION_INVALID');
    expectRejection(() => check('command:execute:viewer.open', 'app'), 'PERMISSION_INVALID');
  });

  it('可选限定值缺省时通过（§6.3.3 optional）', () => {
    expect(check('resources:read')).toBe('resources:read');
    expect(check('window:control', 'app')).toBe('window:control');
    expect(check('resources:write')).toBe('resources:write');
  });
});

describe('validatePermissionRequest：限定值文法（§6.3.5）', () => {
  it('filesystem 限定值为 ${...} 根占位 + 包内相对段', () => {
    expect(check('filesystem:read:${userDocuments}')).toBe('filesystem:read:${userDocuments}');
    expect(check('filesystem:write:${userDocuments}/Cards/**')).toBe(
      'filesystem:write:${userDocuments}/Cards/**'
    );
    expectRejection(() => check('filesystem:read:/etc/passwd'), 'PERMISSION_INVALID');
    expectRejection(() => check('filesystem:read:userDocuments'), 'PERMISSION_INVALID');
    expectRejection(() => check('filesystem:read:${user Documents}'), 'PERMISSION_INVALID');
    expectRejection(() => check('filesystem:read:${1user}'), 'PERMISSION_INVALID');
    expectRejection(() => check('filesystem:read:${userDocuments}/a b'), 'PERMISSION_INVALID');
  });

  it('network 限定值为域名（可通配前缀）与可选端口', () => {
    expect(check('network:http:example.com')).toBe('network:http:example.com');
    expect(check('network:http:*.example.com')).toBe('network:http:*.example.com');
    expect(check('network:http:example.com:8080')).toBe('network:http:example.com:8080');
    expect(check('network:http:a-b.example.co.uk:1')).toBe('network:http:a-b.example.co.uk:1');
    expectRejection(() => check('network:http:EXAMPLE.com'), 'PERMISSION_INVALID');
    expectRejection(() => check('network:http:example..com'), 'PERMISSION_INVALID');
    expectRejection(() => check('network:http:.example.com'), 'PERMISSION_INVALID');
    expectRejection(() => check('network:http:example.com:'), 'PERMISSION_INVALID');
  });

  it('shell 限定值必须是 http(s) URI', () => {
    expect(check('shell:external:https://example.com/bin', 'app')).toBe(
      'shell:external:https://example.com/bin'
    );
    expect(check('shell:external:http://example.com', 'app')).toBe(
      'shell:external:http://example.com'
    );
    expectRejection(() => check('shell:external:example.com', 'app'), 'PERMISSION_INVALID');
    expectRejection(() => check('shell:external:ftp://example.com', 'app'), 'PERMISSION_INVALID');
  });

  it('window 限定值为窗口标识或通配', () => {
    expect(check('window:control:main', 'app')).toBe('window:control:main');
    expect(check('window:control:main-editor', 'app')).toBe('window:control:main-editor');
    expect(check('window:control:*', 'app')).toBe('window:control:*');
    expect(check('window:control:2', 'app')).toBe('window:control:2');
    const leadingHyphen = expectRejection(
      () => check('window:control:-main', 'app'),
      'PERMISSION_INVALID'
    );
    expect(leadingHyphen.message).toBe('权限 window:control 的限定值非法：-main');
    expectRejection(() => check('window:control:win_1', 'app'), 'PERMISSION_INVALID');
    expectRejection(() => check('window:control:win 1', 'app'), 'PERMISSION_INVALID');
    expectRejection(() => check('window:control:win:1', 'app'), 'PERMISSION_INVALID');
  });

  it('resources 限定值是作用域名，允许尾随通配但不允许独立通配', () => {
    expect(check('resources:read:cards')).toBe('resources:read:cards');
    expect(check('resources:write:cards-v2')).toBe('resources:write:cards-v2');
    expect(check('resources:read:cards*')).toBe('resources:read:cards*');
    expectRejection(() => check('resources:read:*'), 'PERMISSION_INVALID');
    expectRejection(() => check('resources:read:Cards'), 'PERMISSION_INVALID');
    expectRejection(() => check('resources:read:c*ards'), 'PERMISSION_INVALID');
    expectRejection(() => check('resources:read:2cards'), 'PERMISSION_INVALID');
  });

  it('config 限定值只允许 platform 或 plugins. 前缀命名空间', () => {
    expect(check('config:read:platform')).toBe('config:read:platform');
    expect(check('config:write:plugins.core')).toBe('config:write:plugins.core');
    expect(check('config:read:plugins.chips.official.viewer')).toBe(
      'config:read:plugins.chips.official.viewer'
    );
    expectRejection(() => check('config:read:plugins'), 'PERMISSION_INVALID');
    expectRejection(() => check('config:read:plugins.'), 'PERMISSION_INVALID');
    expectRejection(() => check('config:read:other'), 'PERMISSION_INVALID');
    expectRejection(() => check('config:read:Platform'), 'PERMISSION_INVALID');
  });

  it('未列举域名的限定值按「非空即可」兜底（登记表端口注入）', () => {
    const rule: IPermissionRule = { id: 'card-theme:read', qualifier: 'optional', roles: 'all' };
    const catalog: IPermissionCatalog = {
      rules: [rule],
      find: (base: string): IPermissionRule | undefined => (base === rule.id ? rule : undefined),
    };
    const run = (request: string): string =>
      validatePermissionRequest({ request, role: 'service', catalog, pointer: POINTER });
    expect(run('card-theme:read')).toBe('card-theme:read');
    expect(run('card-theme:read:dark')).toBe('card-theme:read:dark');
    expectRejection(() => run('card-theme:read:'), 'PERMISSION_INVALID');
    expectRejection(() => run('card-theme:write'), 'PERMISSION_UNKNOWN');
  });
});
