import { findNameCollisions } from './naming.js';
import {
  CAPABILITY_ID_PATTERN,
  ERROR_CODE_PATTERN,
  EVENT_ID_PATTERN,
  PERMISSION_ID_PATTERN,
  type ParsedContract,
} from './parse.js';
import type { ValidationIssue } from './types.js';

function duplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated];
}

/** 全部门禁校验规则；返回问题列表，空列表表示通过。 */
export function validateContract(contract: ParsedContract): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const capabilityIds = contract.capabilities.map((entry) => entry.id);
  const permissionIds = contract.permissions.map((entry) => entry.id);
  const eventIds = contract.events.map((entry) => entry.id);
  const errorCodes = contract.errorCodes.map((entry) => entry.code);

  for (const id of capabilityIds) {
    if (!CAPABILITY_ID_PATTERN.test(id)) {
      issues.push({ rule: 'id-capability', message: `能力 ID 不符合文法：${id}` });
    }
  }
  for (const id of permissionIds) {
    if (!PERMISSION_ID_PATTERN.test(id)) {
      issues.push({ rule: 'id-permission', message: `权限 ID 不符合基础文法：${id}` });
    }
  }
  for (const id of eventIds) {
    if (!EVENT_ID_PATTERN.test(id)) {
      issues.push({ rule: 'id-event', message: `事件 ID 不符合文法：${id}` });
    }
  }
  for (const code of errorCodes) {
    if (!ERROR_CODE_PATTERN.test(code)) {
      issues.push({ rule: 'id-error', message: `错误码不符合文法：${code}` });
    }
  }

  for (const id of duplicates(capabilityIds)) {
    issues.push({ rule: 'unique-capability', message: `能力 ID 重复：${id}` });
  }
  for (const id of duplicates(permissionIds)) {
    issues.push({ rule: 'unique-permission', message: `权限 ID 重复：${id}` });
  }
  for (const id of duplicates(eventIds)) {
    issues.push({ rule: 'unique-event', message: `事件 ID 重复：${id}` });
  }
  for (const code of duplicates(errorCodes)) {
    issues.push({ rule: 'unique-error', message: `错误码重复：${code}` });
  }

  const capabilitySet = new Set(capabilityIds);
  const permissionSet = new Set(permissionIds);
  for (const id of capabilityIds) {
    if (permissionSet.has(id)) {
      issues.push({ rule: 'namespace-isolation', message: `能力 ID 与权限 ID 冲突（R3）：${id}` });
    }
  }
  const eventSet = new Set(eventIds);
  for (const id of capabilityIds) {
    if (eventSet.has(id)) {
      issues.push({ rule: 'namespace-isolation', message: `能力 ID 与事件 ID 冲突：${id}` });
    }
  }
  for (const id of permissionIds) {
    if (eventSet.has(id)) {
      issues.push({ rule: 'namespace-isolation', message: `权限 ID 与事件 ID 冲突：${id}` });
    }
  }

  for (const entry of contract.capabilities) {
    for (const permission of entry.permissions) {
      if (!permissionSet.has(permission)) {
        issues.push({
          rule: 'capability-permission-known',
          message: `能力 ${entry.id} 引用了词表外的权限：${permission}`,
        });
      }
    }
  }

  for (const id of contract.referenceCapabilities) {
    if (!capabilitySet.has(id)) {
      issues.push({
        rule: 'permission-mapping-capability-known',
        message: `权限映射核对表引用了 R19 总表外的能力：${id}`,
      });
    }
  }

  const vocabulary = new Set(contract.facts.permissionVocabulary);
  for (const id of permissionIds) {
    if (!vocabulary.has(id)) {
      issues.push({
        rule: 'permission-vocabulary',
        message: `权限 ${id} 未被内置域词表覆盖`,
      });
    }
  }

  if (contract.capabilities.length !== contract.facts.capabilityCount) {
    issues.push({
      rule: 'capability-count',
      message: `能力数与文档声明不一致：解析 ${contract.capabilities.length}，声明 ${contract.facts.capabilityCount}`,
    });
  }

  const reserved = new Map(contract.facts.reservedDomains.map((entry) => [entry.domain, entry]));
  const actualByDomain = new Map<string, number>();
  for (const event of contract.events) {
    actualByDomain.set(event.domain, (actualByDomain.get(event.domain) ?? 0) + 1);
    const declaration = reserved.get(event.domain);
    if (declaration === undefined) {
      issues.push({
        rule: 'event-domain-reserved',
        message: `事件 ${event.id} 的域不在平台保留域表中`,
      });
    } else if (declaration.declaredCount === null) {
      issues.push({
        rule: 'event-domain-public',
        message: `事件 ${event.id} 属于不公开域：${event.domain}`,
      });
    }
  }
  for (const declaration of contract.facts.reservedDomains) {
    if (declaration.declaredCount === null) {
      continue;
    }
    const actual = actualByDomain.get(declaration.domain) ?? 0;
    if (actual !== declaration.declaredCount) {
      issues.push({
        rule: 'event-count',
        message: `事件域 ${declaration.domain} 数量与文档声明不一致：解析 ${actual}，声明 ${declaration.declaredCount}`,
      });
    }
  }

  for (const collision of findNameCollisions(capabilityIds)) {
    issues.push({
      rule: 'name-capability',
      message: `能力常量名冲突：${collision.name} ← ${collision.ids.join(', ')}`,
    });
  }
  for (const collision of findNameCollisions(permissionIds)) {
    issues.push({
      rule: 'name-permission',
      message: `权限常量名冲突：${collision.name} ← ${collision.ids.join(', ')}`,
    });
  }
  for (const collision of findNameCollisions(eventIds)) {
    issues.push({
      rule: 'name-event',
      message: `事件常量名冲突：${collision.name} ← ${collision.ids.join(', ')}`,
    });
  }

  return issues;
}
