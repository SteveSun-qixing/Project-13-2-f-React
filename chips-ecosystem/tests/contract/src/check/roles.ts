/**
 * 角色接口一致性检查（G8「插件角色接口」行的文档侧部分）。
 *
 * - 每个角色必须声明入口接口，且入口接口必须出现在 SDK「插件角色」类型行；
 * - 同一角色内不得出现同名但内容不同的声明（单一事实源）；
 * - 角色文档声明的「均从 @chips/sdk 主入口导出」名单必须由该角色的声明覆盖。
 *
 * 声明形状的稳定性由 `snapshots/role-interfaces.json` 快照保证（见 tests/roles.test.ts）。
 */

import type { DocRoleModel } from '../docs/roles.js';
import type { SdkExportModel } from '../docs/sdk.js';
import { ROLE_ENTRY_INTERFACES } from '../docs/sources.js';
import { sortViolations, violation, type ContractViolation } from '../violations.js';

export interface RoleCheckInput {
  readonly docs: DocRoleModel;
  readonly sdk: SdkExportModel;
}

export function checkRoles(input: RoleCheckInput): ContractViolation[] {
  const { docs, sdk } = input;
  const violations: ContractViolation[] = [];
  const roleCategory = sdk.types.find((entry) => entry.category.includes('插件角色'));
  const sdkRoleTypes = new Set(roleCategory?.names ?? []);

  for (const role of docs.roles) {
    const entry = ROLE_ENTRY_INTERFACES[role.role];
    const declarationsByName = new Map<string, string>();
    for (const declaration of role.declarations) {
      const serialized = JSON.stringify(declaration.declaration);
      const previous = declarationsByName.get(declaration.declaration.name);
      if (previous !== undefined && previous !== serialized) {
        violations.push(
          violation(
            'CONTRACT_ROLE_DECLARATION_CONFLICT',
            `${role.role}:${declaration.declaration.name}`,
            '同一角色内存在同名但内容不同的声明（单一事实源破坏）',
            { expected: previous, actual: serialized }
          )
        );
      }
      if (previous === undefined) {
        declarationsByName.set(declaration.declaration.name, serialized);
      }
    }

    if (!declarationsByName.has(entry)) {
      violations.push(
        violation(
          'CONTRACT_ROLE_ENTRY_MISSING',
          `${role.role}:${entry}`,
          '角色文档未声明入口接口',
          {
            expected: `声明 ${entry}`,
            actual: '缺失',
          }
        )
      );
    }
    if (!sdkRoleTypes.has(entry)) {
      violations.push(
        violation(
          'CONTRACT_SDK_ROLE_ENTRY_MISSING',
          `${role.role}:${entry}`,
          'SDK 导出清单的「插件角色」行缺少该角色入口接口',
          { expected: `类型列表包含 ${entry}`, actual: '缺失' }
        )
      );
    }

    for (const claim of docs.claims) {
      if (claim.role !== role.role) {
        continue;
      }
      for (const name of claim.names) {
        if (!declarationsByName.has(name)) {
          violations.push(
            violation(
              'CONTRACT_ROLE_CLAIM_UNDEFINED',
              `${role.role}:${name}`,
              '角色文档声明导出的类型在该角色接口文档中未定义',
              { expected: '角色文档包含该声明', actual: '缺失' }
            )
          );
        }
      }
    }
  }

  return sortViolations(violations);
}
