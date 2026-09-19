/**
 * 契约常量引用路径门禁：`src/generated/*` 与 SDK 导出面的一致性。
 *
 * 口径：
 * - `src/generated/*` 由 `tools/contract-gen` 从文档库权威表生成，包内不手写、不维护第二份清单
 *   （02-SDK-API规范 §11 约束 5）；本文件只做「生成物内部自洽 + 生成物到 SDK 导出面的引用路径」
 *   两段校验，文档库权威表与本表逐项一致由 `pnpm gates:contracts`（G8）负责。
 * - 能力 ID 文法按 `tools/contract-gen` 与 `@chips/bridge` 的同一口径：domain 全小写，
 *   `action` 允许驼峰（如 `window:setTitle`）；该口径与 04-能力契约规范 §3.1 的冲突由工单 003 跟踪。
 * - 错误码文法取 04-能力契约规范 §11.1：`<DOMAIN>_<REASON>`，全大写下划线。
 * - 事件 ID 文法与保留域取 05-事件契约规范 §2.1、§2.2。
 * - 权限 ID 的 domain/scope 取 08-权限系统设计 §3.2，`command` 域取 13-命令系统契约 §6.1。
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as sdk from '../src/index.js';
import * as generated from '../src/generated/index.js';
import {
  CAPABILITY_IDS,
  Capability,
  type CapabilityId,
} from '../src/generated/capability-ids.js';
import { CAPABILITY_PERMISSIONS } from '../src/generated/capability-permissions.js';
import { ERROR_CODES, type ErrorCode } from '../src/generated/error-codes.js';
import { EVENT_IDS, StandardEvent, type EventId } from '../src/generated/event-ids.js';
import { PERMISSION_IDS, Permission, type PermissionId } from '../src/generated/permission-ids.js';

/** 能力 ID 文法（domain 全小写，action 允许驼峰，target 可选）。 */
const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*(:[a-z0-9][a-z0-9.-]*)?$/u;

/** 权限 ID 文法：`domain:scope`，可选 qualifier 段（04-能力契约规范 §3.1）。 */
const PERMISSION_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*(:[^:\s]+)?$/u;

/** 事件 ID 文法：两段、单个冒号（05-事件契约规范 §2.1 校验正则）。 */
const EVENT_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/u;

/** 错误码文法：`<DOMAIN>_<REASON>`，全大写下划线（04-能力契约规范 §11.1）。 */
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u;

/** 08-权限系统设计 §3.2 内置域与其 scope 取值。 */
const BUILT_IN_PERMISSION_SCOPES: Readonly<Record<string, readonly string[]>> = {
  filesystem: ['read', 'write', 'delete'],
  network: ['http'],
  window: ['control'],
  menu: ['manage'],
  tray: ['manage'],
  shortcut: ['manage'],
  system: ['read'],
  power: ['read', 'manage'],
  transfer: ['manage'],
  notifications: ['send'],
  clipboard: ['access'],
  dialogs: ['use'],
  shell: ['external'],
  resources: ['read', 'write'],
  config: ['read', 'write'],
  credential: ['manage'],
  events: ['publish'],
  // 命令域的 read / write / execute 由 13-命令系统契约 §6.1 登记
  command: ['read', 'write', 'execute'],
};

/** 04-能力契约规范 §3.2 平台语义域，外加 §7.16、§7.17 登记的命令与 CLI 任务域。 */
const CAPABILITY_DOMAINS: readonly string[] = [
  'file',
  'resource',
  'document',
  'window',
  'menu',
  'tray',
  'shortcut',
  'system',
  'power',
  'transfer',
  'notification',
  'clipboard',
  'dialog',
  'shell',
  'http',
  'config',
  'credential',
  'event',
  'command',
  'cli',
];

/** 05-事件契约规范 §2.2 保留域与逐域事件数（`internal` 域不公开，故不在内）。 */
const RESERVED_EVENT_COUNTS: Readonly<Record<string, number>> = {
  plugin: 7,
  document: 4,
  file: 1,
  resource: 2,
  config: 1,
  security: 1,
  permission: 2,
  window: 3,
  app: 3,
  sync: 6,
  command: 4,
  tray: 1,
  shortcut: 1,
  transfer: 3,
};

/** `src/generated/index.ts` 应聚合的全部常量名。 */
const GENERATED_BARREL_NAMES = [
  'CAPABILITY_IDS',
  'CAPABILITY_PERMISSIONS',
  'Capability',
  'ERROR_CODES',
  'EVENT_IDS',
  'Permission',
  'PERMISSION_IDS',
  'StandardEvent',
] as const;

/** 取 ID 的 domain 段。 */
function domainOf(id: string): string {
  const separator = id.indexOf(':');
  expect(separator, id).toBeGreaterThan(-1);
  return id.slice(0, separator);
}

/** 取错误码的 `<DOMAIN>` 段。 */
function errorDomainOf(code: string): string {
  return code.split('_')[0] ?? '';
}

/** 统计各 domain 的出现次数，按首次出现顺序保留分组。 */
function groupOrder(ids: readonly string[]): string[] {
  const groups: string[] = [];
  for (const id of ids) {
    const domain = domainOf(id);
    if (groups[groups.length - 1] !== domain) {
      groups.push(domain);
    }
  }
  return groups;
}

/** 按 domain 计数。 */
function countByDomain(ids: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const domain = domainOf(id);
    counts[domain] = (counts[domain] ?? 0) + 1;
  }
  return counts;
}

/** 递归收集目录下的全部文件路径。 */
function collectFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...collectFiles(full));
      continue;
    }
    if (entry.name.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found.sort();
}

/**
 * `src/generated/` 之外随包发布的源码（排除测试文件）。
 *
 * @returns 路径与文件内容
 */
function shippedNonGeneratedSources(): readonly { readonly path: string; readonly text: string }[] {
  const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
  return collectFiles(srcDir)
    .filter((path) => !path.endsWith('.test.ts'))
    .filter((path) => !path.startsWith(`${srcDir}generated/`))
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }));
}

describe('契约常量生成物的聚合导出（src/generated/index.ts）', () => {
  it('汇总入口导出全部五件套常量，且无默认导出', () => {
    const exported = Object.keys(generated).sort();
    expect(exported).toEqual([...GENERATED_BARREL_NAMES].sort());
    expect('default' in generated).toBe(false);
  });

  it('逐模块导入与汇总入口指向同一份常量', () => {
    expect(generated['Capability']).toBe(Capability);
    expect(generated['CAPABILITY_IDS']).toBe(CAPABILITY_IDS);
    expect(generated['StandardEvent']).toBe(StandardEvent);
    expect(generated['EVENT_IDS']).toBe(EVENT_IDS);
    expect(generated['Permission']).toBe(Permission);
    expect(generated['PERMISSION_IDS']).toBe(PERMISSION_IDS);
    expect(generated['ERROR_CODES']).toBe(ERROR_CODES);
    expect(generated['CAPABILITY_PERMISSIONS']).toBe(CAPABILITY_PERMISSIONS);
  });

  it('SDK 主入口不导出任何契约常量值（§2.2、§11 约束 4）', () => {
    const entry = sdk as Record<string, unknown>;
    for (const name of GENERATED_BARREL_NAMES) {
      expect(entry[name], name).toBeUndefined();
    }
  });
});

describe('能力 ID 清单（04-能力契约规范 §3.1、§3.2、§6.2）', () => {
  it('Capability 枚举值与 CAPABILITY_IDS 是同一无重复的集合', () => {
    const fromMap = Object.values(Capability);
    expect(fromMap).toHaveLength(CAPABILITY_IDS.length);
    expect(new Set(fromMap).size).toBe(fromMap.length);
    expect(new Set(CAPABILITY_IDS).size).toBe(CAPABILITY_IDS.length);
    for (const id of CAPABILITY_IDS) {
      expect(fromMap, id).toContain(id);
    }
  });

  it('全部能力 ID 文法合法且段数不超过三', () => {
    for (const id of CAPABILITY_IDS) {
      expect(id, id).toMatch(CAPABILITY_ID_PATTERN);
      const segments = id.split(':');
      expect(segments.length, id).toBeGreaterThanOrEqual(2);
      expect(segments.length, id).toBeLessThanOrEqual(3);
      expect(id, id).not.toMatch(/[_\s]/u);
    }
  });

  it('能力域只使用平台登记的语义域，并按域连续分组登记', () => {
    const groups = groupOrder(CAPABILITY_IDS);
    for (const domain of groups) {
      expect(CAPABILITY_DOMAINS, domain).toContain(domain);
    }
    expect(new Set(groups).size).toBe(groups.length);
    expect(groups).toEqual([...CAPABILITY_DOMAINS]);
  });

  it('能力 ID 与权限 ID 是两个互斥命名空间（R3）', () => {
    const permissions = new Set<string>(PERMISSION_IDS);
    for (const id of CAPABILITY_IDS) {
      expect(permissions.has(id), id).toBe(false);
    }
    for (const permission of PERMISSION_IDS) {
      expect(CAPABILITY_IDS).not.toContain(permission);
    }
  });
});

describe('权限映射（04-能力契约规范 §6.2）', () => {
  it('映射键集合与能力清单完全一致，无遗漏也无多余', () => {
    const keys = Object.keys(CAPABILITY_PERMISSIONS);
    expect(keys).toHaveLength(CAPABILITY_IDS.length);
    expect([...keys].sort()).toEqual([...CAPABILITY_IDS].sort());
  });

  it('映射值全部落在权限词表内', () => {
    const vocabulary = new Set<string>(PERMISSION_IDS);
    for (const [capabilityId, required] of Object.entries(CAPABILITY_PERMISSIONS)) {
      expect(new Set(required).size, capabilityId).toBe(required.length);
      for (const permission of required) {
        expect(vocabulary.has(permission), `${capabilityId} -> ${permission}`).toBe(true);
      }
    }
  });

  it('免权限能力恰为处理器列举与五项 CLI 任务能力（§6.2 表内「无」）', () => {
    const empty = Object.entries(CAPABILITY_PERMISSIONS)
      .filter(([, required]) => required.length === 0)
      .map(([id]) => id)
      .sort();
    expect(empty).toEqual([
      'cli:task-active',
      'cli:task-complete',
      'cli:task-fail',
      'cli:task-get',
      'cli:task-progress',
      'resource:list-handlers',
    ]);
  });
});

describe('权限 ID 清单（08-权限系统设计 §3.2、13-命令系统契约 §6.1）', () => {
  it('Permission 枚举值与 PERMISSION_IDS 是同一无重复的集合', () => {
    const fromMap = Object.values(Permission);
    expect(fromMap).toHaveLength(PERMISSION_IDS.length);
    expect(new Set(fromMap).size).toBe(fromMap.length);
    for (const id of PERMISSION_IDS) {
      expect(fromMap, id).toContain(id);
    }
  });

  it('每个权限都是登记域内的合法 scope，且域连续分组', () => {
    for (const id of PERMISSION_IDS) {
      expect(id, id).toMatch(PERMISSION_ID_PATTERN);
      const [domain, scope, qualifier] = id.split(':');
      expect(BUILT_IN_PERMISSION_SCOPES[domain ?? ''], id).toBeDefined();
      expect(BUILT_IN_PERMISSION_SCOPES[domain ?? ''] ?? []).toContain(scope);
      expect(qualifier, id).toBeUndefined();
    }
    const groups = groupOrder(PERMISSION_IDS);
    expect(new Set(groups).size).toBe(groups.length);
    expect(groups.sort()).toEqual(Object.keys(BUILT_IN_PERMISSION_SCOPES).sort());
  });

  it('每个内置权限都被至少一个能力引用', () => {
    const referenced = new Set(Object.values(CAPABILITY_PERMISSIONS).flat());
    expect([...referenced].sort()).toEqual([...PERMISSION_IDS].sort());
  });
});

describe('标准事件清单（05-事件契约规范 §2.1、§2.2）', () => {
  it('StandardEvent 枚举值与 EVENT_IDS 是同一无重复的集合', () => {
    const fromMap = Object.values(StandardEvent);
    expect(fromMap).toHaveLength(EVENT_IDS.length);
    expect(new Set(fromMap).size).toBe(fromMap.length);
    for (const id of EVENT_IDS) {
      expect(fromMap, id).toContain(id);
    }
  });

  it('事件 ID 只含一个冒号、全小写且不出现内核内部域', () => {
    for (const id of EVENT_IDS) {
      expect(id, id).toMatch(EVENT_ID_PATTERN);
      expect(id.split(':')).toHaveLength(2);
    }
    expect(EVENT_IDS).not.toContain('internal:dispatch-failed');
    for (const id of EVENT_IDS) {
      expect(domainOf(id)).not.toBe('internal');
    }
  });

  it('逐保留域事件数与 §2.2 清单一致', () => {
    expect(countByDomain(EVENT_IDS)).toEqual(RESERVED_EVENT_COUNTS);
    expect(groupOrder(EVENT_IDS).sort()).toEqual(Object.keys(RESERVED_EVENT_COUNTS).sort());
  });
});

describe('错误码清单（04-能力契约规范 §11.1）', () => {
  it('清单无重复且全部符合 <DOMAIN>_<REASON> 全大写文法', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    for (const code of ERROR_CODES) {
      expect(code, code).toMatch(ERROR_CODE_PATTERN);
      expect(code, code).not.toMatch(/[a-z]/u);
    }
  });

  it('按错误域连续分组登记，同一域不出现两段清单', () => {
    const groups: string[] = [];
    for (const code of ERROR_CODES) {
      const domain = errorDomainOf(code);
      if (groups[groups.length - 1] !== domain) {
        groups.push(domain);
      }
    }
    expect(groups).toHaveLength(new Set(ERROR_CODES.map(errorDomainOf)).size);
    expect(groups).toContain('BRIDGE');
    expect(groups).toContain('RESOURCE');
  });

  it('平台错误码清单不收录 SDK 自身错误码（§6.3）', () => {
    for (const code of ['SDK_BRIDGE_UNAVAILABLE', 'SDK_UNKNOWN_ERROR', 'SDK_INVALID_SCAFFOLD_OPTIONS']) {
      expect(ERROR_CODES).not.toContain(code);
    }
  });
});

describe('契约常量到 SDK 导出面的引用路径', () => {
  it('主入口的 CapabilityId 与生成物同源，可直接用于调用点', () => {
    const declaredIds: readonly CapabilityId[] = CAPABILITY_IDS;
    const typedEntry = (id: CapabilityId): CapabilityId => id;
    expect(typedEntry(Capability.FILE_READ)).toBe('file:read');
    expect(typedEntry(Capability.DOCUMENT_OPEN)).toBe('document:open');
    expect(declaredIds).toContain(typedEntry(Capability.HTTP_REQUEST));
    // 权限映射在 `noUncheckedIndexedAccess` 下按可缺失取值：先确认非空，再作为 PermissionId 消费
    const mappedPermission = CAPABILITY_PERMISSIONS[Capability.FILE_READ][0];
    if (mappedPermission === undefined) {
      throw new Error('file:read 的权限映射为空，引用路径断言失效');
    }
    const permissionId: PermissionId = mappedPermission;
    expect(permissionId).toBe('filesystem:read');
    const errorCode: ErrorCode = 'BRIDGE_CAPABILITY_NOT_FOUND';
    expect(ERROR_CODES).toContain(errorCode);
    const eventId: EventId = 'document:changed';
    expect(EVENT_IDS).toContain(eventId);
  });

  it('随包源码里出现的契约 ID 全部落在生成物登记表内', () => {
    const registry = new Set<string>([...CAPABILITY_IDS, ...PERMISSION_IDS, ...EVENT_IDS]);
    const pattern = /\b([a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*)\b/gu;
    const referenced = new Set<string>();
    for (const { text } of shippedNonGeneratedSources()) {
      for (const match of text.matchAll(pattern)) {
        referenced.add(match[1] ?? '');
      }
    }
    expect(referenced.size).toBeGreaterThan(10);
    for (const id of referenced) {
      expect(registry.has(id), id).toBe(true);
    }
  });
});
