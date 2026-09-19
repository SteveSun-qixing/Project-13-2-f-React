/**
 * SDK 导出面检查：包入口与主入口导出清单的语法、唯一性与最小完整性。
 *
 * 导出面形状由 `snapshots/sdk-exports.json` 快照保证；本检查负责：
 * - 三个公开入口恰为 `@chips/sdk`、`@chips/sdk/testing`、`@chips/sdk/scaffold`；
 * - 值导出与 testing 导出为合法标识符且无重复；
 * - 同一类型分类内具体类型名无重复；
 * - 角色入口接口出现在「插件角色」行（与 `check/roles.ts` 互补，此处做冗余防护）。
 */

import type { SdkExportModel } from '../docs/sdk.js';
import { ROLE_ENTRY_INTERFACES } from '../docs/sources.js';
import { sortViolations, violation, type ContractViolation } from '../violations.js';

export interface SdkCheckInput {
  readonly sdk: SdkExportModel;
}

const EXPECTED_ENTRIES: readonly string[] = [
  '@chips/sdk',
  '@chips/sdk/testing',
  '@chips/sdk/scaffold',
];
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function checkSdkExports(input: SdkCheckInput): ContractViolation[] {
  const { sdk } = input;
  const violations: ContractViolation[] = [];
  const entryNames = sdk.entries.map((entry) => entry.entry);
  const expectedSorted = [...EXPECTED_ENTRIES].sort();
  const actualSorted = [...entryNames].sort();
  if (JSON.stringify(expectedSorted) !== JSON.stringify(actualSorted)) {
    violations.push(
      violation('CONTRACT_SDK_ENTRY_SET', sdk.ref.file, 'SDK 公开入口集合与规范不一致', {
        expected: expectedSorted.join(', '),
        actual: actualSorted.join(', '),
      })
    );
  }

  const valueNames = new Set<string>();
  for (const value of sdk.values) {
    if (!IDENTIFIER.test(value.name)) {
      violations.push(
        violation('CONTRACT_SDK_VALUE_NAME', value.name, 'SDK 值导出名称不是合法标识符')
      );
    }
    if (valueNames.has(value.name)) {
      violations.push(
        violation('CONTRACT_SDK_VALUE_DUPLICATE', value.name, 'SDK 值导出清单存在重复名称')
      );
    }
    valueNames.add(value.name);
  }

  for (const typeEntry of sdk.types) {
    const seen = new Set<string>();
    for (const name of typeEntry.names) {
      if (!IDENTIFIER.test(name)) {
        violations.push(
          violation(
            'CONTRACT_SDK_TYPE_NAME',
            `${typeEntry.category}:${name}`,
            'SDK 类型导出名称不是合法标识符'
          )
        );
      }
      if (seen.has(name)) {
        violations.push(
          violation(
            'CONTRACT_SDK_TYPE_DUPLICATE',
            `${typeEntry.category}:${name}`,
            '同一类型分类内存在重复类型名'
          )
        );
      }
      seen.add(name);
    }
  }

  const testingSeen = new Set<string>();
  for (const name of sdk.testing) {
    if (!IDENTIFIER.test(name)) {
      violations.push(
        violation('CONTRACT_SDK_TESTING_NAME', name, '@chips/sdk/testing 导出名称不是合法标识符')
      );
    }
    if (testingSeen.has(name)) {
      violations.push(
        violation('CONTRACT_SDK_TESTING_DUPLICATE', name, '@chips/sdk/testing 导出清单存在重复名称')
      );
    }
    testingSeen.add(name);
  }

  const roleTypes = new Set(
    sdk.types.find((entry) => entry.category.includes('插件角色'))?.names ?? []
  );
  for (const entry of Object.values(ROLE_ENTRY_INTERFACES)) {
    if (!roleTypes.has(entry)) {
      violations.push(
        violation('CONTRACT_SDK_ROLE_ENTRY_MISSING', entry, 'SDK 导出清单缺少角色入口接口', {
          expected: '「插件角色」行包含该类型',
          actual: '缺失',
        })
      );
    }
  }

  return sortViolations(violations);
}
