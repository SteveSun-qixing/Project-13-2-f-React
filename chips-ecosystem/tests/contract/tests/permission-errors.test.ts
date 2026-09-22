/**
 * 权限拒绝码三方一致性用例（工单013 防漂移门禁）。
 *
 * 正例：真实装载「§9.1 文档清单 ↔ @chips/bridge PERMISSION_ERROR_CODES ↔ SDK 生成契约 ERROR_CODES」，
 * 断言 `PERMISSION_*` 域逐项一致、§9.1 全表进生成契约、无缺项无多余项。
 * 负例：内存注入漂移（不写回任何真实文件），逐方向断言对应偏差码必被检出，
 * 证明未来任一事实源漂移即红。
 */

import { describe, it } from 'vitest';

import type { BridgeCodeModel } from '../src/code/bridge.js';
import type { SdkGeneratedCodeModel } from '../src/code/sdk.js';
import { checkPermissionErrorCodes } from '../src/check/permission-errors.js';
import {
  loadDeviatedDocModels,
  removeLineContainingIgnoringSpacing,
  replaceOnceIgnoringSpacing,
} from '../src/fixtures/deviations.js';
import { PERMISSION_ERROR_SOURCE } from '../src/docs/sources.js';
import { assertNoViolations, formatViolations, type ContractViolation } from '../src/violations.js';
import { bridgeCode, docs, sdkCode } from './helpers.js';

function expectViolation(
  violations: readonly ContractViolation[],
  code: string,
  subjectIncludes?: string
): void {
  const matched = violations.filter(
    (item) =>
      item.code === code &&
      (subjectIncludes === undefined || item.subject.includes(subjectIncludes))
  );
  if (matched.length === 0) {
    throw new Error(
      `注入偏差未被检出：预期 ${code}${subjectIncludes === undefined ? '' : `（subject 含 ${subjectIncludes}）`}\n实际偏差：\n${formatViolations(violations)}`
    );
  }
}

function withBridgeCodes(model: BridgeCodeModel, codes: readonly string[]): BridgeCodeModel {
  return { ...model, errors: { ...model.errors, permissionRegistration: codes } };
}

function withSdkCodes(codes: readonly string[]): SdkGeneratedCodeModel {
  return { errorCodes: codes };
}

describe('权限拒绝码三方一致性（工单013）', () => {
  it('§9.1 文档清单 ↔ Bridge 常量表 ↔ SDK 生成契约逐项一致', () => {
    assertNoViolations(
      checkPermissionErrorCodes({
        docs: docs().errors,
        code: bridgeCode(),
        sdk: sdkCode(),
      })
    );
  });

  it('Bridge 常量表缺少 §9.1 权限拒绝码 → 报 BRIDGE_MISSING', () => {
    const drifted = withBridgeCodes(
      bridgeCode(),
      bridgeCode().errors.permissionRegistration.filter(
        (code) => code !== 'PERMISSION_ROLE_NOT_ALLOWED'
      )
    );
    expectViolation(
      checkPermissionErrorCodes({ docs: docs().errors, code: drifted, sdk: sdkCode() }),
      'CONTRACT_PERMISSION_CODE_BRIDGE_MISSING',
      'PERMISSION_ROLE_NOT_ALLOWED'
    );
  });

  it('Bridge 常量表自造 §9.1 域外权限码 → 报 BRIDGE_EXTRA', () => {
    const drifted = withBridgeCodes(bridgeCode(), [
      ...bridgeCode().errors.permissionRegistration,
      'PERMISSION_FUTURE_CODE',
    ]);
    expectViolation(
      checkPermissionErrorCodes({ docs: docs().errors, code: drifted, sdk: sdkCode() }),
      'CONTRACT_PERMISSION_CODE_BRIDGE_EXTRA',
      'PERMISSION_FUTURE_CODE'
    );
  });

  it('SDK 生成契约缺少 §9.1 权限拒绝码 → 报 SDK_MISSING', () => {
    const drifted = withSdkCodes(
      sdkCode().errorCodes.filter((code) => code !== 'PERMISSION_INVALID')
    );
    expectViolation(
      checkPermissionErrorCodes({ docs: docs().errors, code: bridgeCode(), sdk: drifted }),
      'CONTRACT_PERMISSION_CODE_SDK_MISSING',
      'PERMISSION_INVALID'
    );
  });

  it('SDK 生成契约多出 §9.1 域外 PERMISSION_* 码 → 报 SDK_EXTRA', () => {
    const drifted = withSdkCodes([...sdkCode().errorCodes, 'PERMISSION_GHOST']);
    expectViolation(
      checkPermissionErrorCodes({ docs: docs().errors, code: bridgeCode(), sdk: drifted }),
      'CONTRACT_PERMISSION_CODE_SDK_EXTRA',
      'PERMISSION_GHOST'
    );
  });

  it('§9.1 文档删除一行拒绝码 → Bridge 与 SDK 双侧报实现侧多余项', () => {
    const deviatedDocs = loadDeviatedDocModels([
      {
        file: PERMISSION_ERROR_SOURCE.file,
        description: '删除 §9.1 的 PERMISSION_INVALID 登记行',
        // 含空格表格行锚改空格不敏感匹配（#168 解耦，工单046 同根因判例）：
        // 锚与 prettier 列宽填充形解耦，改名/删行/单元格缺失照样不命中并抛错。
        mutate: (text) =>
          removeLineContainingIgnoringSpacing(text, '| `PERMISSION_INVALID` | 安装校验'),
      },
    ]);
    const violations = checkPermissionErrorCodes({
      docs: deviatedDocs.errors,
      code: bridgeCode(),
      sdk: sdkCode(),
    });
    expectViolation(violations, 'CONTRACT_PERMISSION_CODE_BRIDGE_EXTRA', 'PERMISSION_INVALID');
    expectViolation(violations, 'CONTRACT_PERMISSION_CODE_SDK_EXTRA', 'PERMISSION_INVALID');
  });

  it('§9.1 文档新增一行拒绝码 → 三方同步报缺（文档先行漂移亦即红）', () => {
    const anchor =
      '| `PERMISSION_ROLE_NOT_ALLOWED` | 安装校验 | 插件角色不允许申请该权限 | false |';
    const deviatedDocs = loadDeviatedDocModels([
      {
        file: PERMISSION_ERROR_SOURCE.file,
        description: '§9.1 追加 PERMISSION_FUTURE_CODE 登记行',
        // 整行锚同上走空格不敏感匹配（#168 解耦）。
        mutate: (text) =>
          replaceOnceIgnoringSpacing(
            text,
            anchor,
            `${anchor}\n| \`PERMISSION_FUTURE_CODE\` | 安装校验 | 未来新增拒绝码（漂移注入） | false |`
          ),
      },
    ]);
    const violations = checkPermissionErrorCodes({
      docs: deviatedDocs.errors,
      code: bridgeCode(),
      sdk: sdkCode(),
    });
    expectViolation(
      violations,
      'CONTRACT_PERMISSION_CODE_BRIDGE_MISSING',
      'PERMISSION_FUTURE_CODE'
    );
    expectViolation(violations, 'CONTRACT_PERMISSION_CODE_SDK_MISSING', 'PERMISSION_FUTURE_CODE');
    expectViolation(
      violations,
      'CONTRACT_PERMISSION_CODE_DOC_UNGENERATED',
      'PERMISSION_FUTURE_CODE'
    );
  });
});
