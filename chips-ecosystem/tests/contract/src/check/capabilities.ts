/**
 * 能力表 ↔ Bridge 注册表一致性检查（G8「能力契约」行）。
 *
 * 文档侧：R19 内置能力与权限总表 + 权限清单总表；
 * 实现侧：`@chips/bridge` 的 `BUILTIN_CAPABILITIES` 与 `BUILTIN_PERMISSIONS`。
 *
 * 判定：ID 集合逐项一致、权限映射逐项一致、计数声明一致、命名空间隔离（R3）、
 * 实现侧不得引用未登记权限（红线 11）。
 */

import type { BridgeCodeModel } from '../code/bridge.js';
import type { DocCapabilityModel } from '../docs/capabilities.js';
import { CAPABILITY_ID_PATTERN, PERMISSION_ID_PATTERN } from '../docs/capabilities.js';
import type { DocPermissionModel } from '../docs/permissions.js';
import { diffSets, sortViolations, violation, type ContractViolation } from '../violations.js';

export interface CapabilityCheckInput {
  readonly docs: DocCapabilityModel;
  readonly docPermissions: DocPermissionModel;
  readonly code: BridgeCodeModel;
}

export function checkCapabilities(input: CapabilityCheckInput): ContractViolation[] {
  const { docs, docPermissions, code } = input;
  const violations: ContractViolation[] = [];

  if (docs.capabilities.length !== docs.declaredCount) {
    violations.push(
      violation(
        'CONTRACT_CAPABILITY_COUNT',
        docs.ref.file,
        '能力总表解析数量与文档声明的计数不一致',
        {
          expected: String(docs.declaredCount),
          actual: String(docs.capabilities.length),
        },
      ),
    );
  }

  const docCapabilityIds = docs.capabilities.map((capability) => capability.id);
  const codeCapabilityIds = code.capabilities.map((capability) => capability.id);
  const capabilityDiff = diffSets(docCapabilityIds, codeCapabilityIds);
  for (const id of capabilityDiff.missing) {
    violations.push(
      violation('CONTRACT_CAPABILITY_MISSING', id, '文档登记的内置能力未出现在 Bridge 注册表', {
        expected: 'Bridge BUILTIN_CAPABILITIES 包含该 ID',
        actual: '缺失',
      }),
    );
  }
  for (const id of capabilityDiff.extra) {
    violations.push(
      violation('CONTRACT_CAPABILITY_EXTRA', id, 'Bridge 注册表登记了文档未登记的能力（禁止自造能力 ID）', {
        expected: 'R19 总表包含该 ID',
        actual: '未登记',
      }),
    );
  }

  const codeCapabilityById = new Map(code.capabilities.map((capability) => [capability.id, capability]));
  const docCapabilityById = new Map(docs.capabilities.map((capability) => [capability.id, capability]));
  for (const [id, docCapability] of docCapabilityById) {
    const codeCapability = codeCapabilityById.get(id);
    if (codeCapability === undefined) {
      continue;
    }
    const expected = JSON.stringify(docCapability.permissions);
    const actual = JSON.stringify(codeCapability.permissions);
    if (expected !== actual) {
      violations.push(
        violation('CONTRACT_CAPABILITY_PERMISSIONS', id, '能力→权限映射与 R19 总表不一致', {
          expected,
          actual,
        }),
      );
    }
  }

  const docPermissionIds = docPermissions.ids;
  const codePermissionSet = new Set(code.permissionIds);
  for (const capability of code.capabilities) {
    if (!CAPABILITY_ID_PATTERN.test(capability.id)) {
      violations.push(
        violation('CONTRACT_CAPABILITY_ID_GRAMMAR', capability.id, 'Bridge 能力 ID 文法非法', {
          expected: '^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*$',
        }),
      );
    }
    for (const permission of capability.permissions) {
      if (!codePermissionSet.has(permission)) {
        violations.push(
          violation(
            'CONTRACT_CAPABILITY_PERMISSION_UNKNOWN',
            `${capability.id} → ${permission}`,
            '能力声明的权限不在 Bridge 权限词表内',
          ),
        );
      }
    }
    for (const target of capability.targets) {
      if (!capability.permissions.includes(target.permission)) {
        violations.push(
          violation(
            'CONTRACT_CAPABILITY_TARGET_PERMISSION',
            `${capability.id} → ${target.permission}`,
            '限定值匹配目标引用了能力未声明的权限',
          ),
        );
      }
    }
  }

  const permissionDiff = diffSets(docPermissionIds, code.permissionIds);
  for (const id of permissionDiff.missing) {
    violations.push(
      violation('CONTRACT_PERMISSION_MISSING', id, '文档登记的权限未出现在 Bridge 权限词表', {
        expected: 'BUILTIN_PERMISSIONS 包含该 ID',
        actual: '缺失',
      }),
    );
  }
  for (const id of permissionDiff.extra) {
    violations.push(
      violation('CONTRACT_PERMISSION_EXTRA', id, 'Bridge 权限词表登记了文档未登记的权限（禁止自造权限 ID）', {
        expected: '权限清单总表包含该 ID',
        actual: '未登记',
      }),
    );
  }

  const docPermissionSet = new Set(docPermissionIds);
  for (const capability of code.capabilities) {
    for (const permission of capability.permissions) {
      if (!docPermissionSet.has(permission) && PERMISSION_ID_PATTERN.test(permission)) {
        violations.push(
          violation(
            'CONTRACT_PERMISSION_UNREGISTERED',
            `${capability.id} → ${permission}`,
            '能力声明的权限未在权限清单总表登记',
          ),
        );
      }
    }
  }
  for (const capability of docs.capabilities) {
    for (const permission of capability.permissions) {
      if (!docPermissionSet.has(permission)) {
        violations.push(
          violation(
            'CONTRACT_DOC_PERMISSION_UNREGISTERED',
            `${capability.id} → ${permission}`,
            'R19 总表引用了权限清单总表之外的权限',
          ),
        );
      }
    }
  }

  for (const id of codeCapabilityIds) {
    if (docPermissionSet.has(id)) {
      violations.push(
        violation('CONTRACT_NAMESPACE_OVERLAP', id, '能力 ID 与权限 ID 重叠（违反 R3 命名空间隔离）'),
      );
    }
  }
  for (const id of docCapabilityIds) {
    if (docPermissionSet.has(id)) {
      violations.push(
        violation('CONTRACT_NAMESPACE_OVERLAP', id, '文档能力 ID 与权限 ID 重叠（违反 R3 命名空间隔离）'),
      );
    }
  }

  return sortViolations(violations);
}
