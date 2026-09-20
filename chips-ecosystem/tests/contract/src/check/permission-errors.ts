/**
 * 权限拒绝码三方一致性判定（工单013：文档/常量表/生成契约防漂移）。
 *
 * 三份事实源（G8 口径，契约判定唯一归属本包）：
 * - 文档权威：《08-权限系统设计》§9.1 错误码总表（`PERMISSION_ERROR_SOURCE`）；
 * - 运行时常量：`@chips/bridge` 的 `PERMISSION_ERROR_CODES`（经 `src/code/bridge.ts` 装载）；
 * - 生成契约：`@chips/sdk` 的 `ERROR_CODES`（经 `src/code/sdk.ts` 装载，`tools/contract-gen` 生成）。
 *
 * 判定规则：
 * 1. §9.1 的 `PERMISSION_*` 域（前缀 `PERMISSION_` 的裸权限拒绝码）与 Bridge 常量表逐项一致，
 *    无缺项、无多余项；
 * 2. §9.1 的 `PERMISSION_*` 域与 SDK 生成契约的 `PERMISSION_*` 域逐项一致；
 *    （规则 1 + 2 传递锁定三方互等）
 * 3. §9.1 全表每一码（含 `BRIDGE_` / `RESOURCE_` / `PLUGIN_` / `RENDER_` 前缀的跨层拒绝码）
 *    必须被生成契约收录，文档新增码未进生成契约即漂移；
 * 4. Bridge 常量表与生成契约的 `PERMISSION_*` 域内不得出现重复码。
 */

import type { BridgeCodeModel } from '../code/bridge.js';
import type { SdkGeneratedCodeModel } from '../code/sdk.js';
import { domainCodes, type DocErrorRegistry } from '../docs/errors.js';
import { PERMISSION_ERROR_SOURCE } from '../docs/sources.js';
import { diffSets, sortViolations, violation, type ContractViolation } from '../violations.js';

/** 权限拒绝域错误码前缀（§9.1 中无前缀层名的裸权限码）。 */
const PERMISSION_DOMAIN_PREFIX = 'PERMISSION_';

export interface PermissionErrorCheckInput {
  readonly docs: DocErrorRegistry;
  readonly code: BridgeCodeModel;
  readonly sdk: SdkGeneratedCodeModel;
}

function inDomain(codes: readonly string[]): string[] {
  return codes.filter((code) => code.startsWith(PERMISSION_DOMAIN_PREFIX));
}

function checkDuplicates(
  violations: ContractViolation[],
  label: string,
  codes: readonly string[]
): void {
  const seen = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) {
      violations.push(
        violation(
          'CONTRACT_PERMISSION_CODE_DUPLICATE',
          `${label}:${code}`,
          '权限拒绝码登记表存在重复错误码'
        )
      );
    }
    seen.add(code);
  }
}

export function checkPermissionErrorCodes(input: PermissionErrorCheckInput): ContractViolation[] {
  const { docs, code, sdk } = input;
  const violations: ContractViolation[] = [];

  const docAll = domainCodes(docs, PERMISSION_ERROR_SOURCE);
  const docDomain = inDomain(docAll);
  const bridgeCodes = code.errors.permissionRegistration;
  const sdkDomain = inDomain(sdk.errorCodes);

  checkDuplicates(violations, 'Bridge 权限常量表', bridgeCodes);
  checkDuplicates(violations, 'SDK 生成契约权限域', sdkDomain);

  const bridgeDiff = diffSets(docDomain, bridgeCodes);
  for (const codeValue of bridgeDiff.missing) {
    violations.push(
      violation(
        'CONTRACT_PERMISSION_CODE_BRIDGE_MISSING',
        `Bridge 权限常量表:${codeValue}`,
        '§9.1 权限拒绝码未登记进 @chips/bridge 的 PERMISSION_ERROR_CODES 运行时常量表',
        { expected: 'Bridge 常量表收录该码', actual: '缺失' }
      )
    );
  }
  for (const codeValue of bridgeDiff.extra) {
    violations.push(
      violation(
        'CONTRACT_PERMISSION_CODE_BRIDGE_EXTRA',
        `Bridge 权限常量表:${codeValue}`,
        'Bridge 常量表登记了 §9.1 权限拒绝域之外的错误码（禁止自造或错位登记）',
        { expected: '§9.1 PERMISSION_* 域收录该码', actual: '未登记' }
      )
    );
  }

  const sdkDiff = diffSets(docDomain, sdkDomain);
  for (const codeValue of sdkDiff.missing) {
    violations.push(
      violation(
        'CONTRACT_PERMISSION_CODE_SDK_MISSING',
        `SDK 生成契约:${codeValue}`,
        '§9.1 权限拒绝码未进入 SDK 生成契约（需经 tools/contract-gen 正式管线再生成）',
        { expected: '生成契约收录该码', actual: '缺失' }
      )
    );
  }
  for (const codeValue of sdkDiff.extra) {
    violations.push(
      violation(
        'CONTRACT_PERMISSION_CODE_SDK_EXTRA',
        `SDK 生成契约:${codeValue}`,
        'SDK 生成契约含 §9.1 权限拒绝域之外的 PERMISSION_* 错误码（三方漂移）',
        { expected: '§9.1 PERMISSION_* 域收录该码', actual: '多余' }
      )
    );
  }

  const sdkAll = new Set(sdk.errorCodes);
  for (const codeValue of docAll) {
    if (!sdkAll.has(codeValue)) {
      violations.push(
        violation(
          'CONTRACT_PERMISSION_CODE_DOC_UNGENERATED',
          `§9.1 错误码总表:${codeValue}`,
          '§9.1 拒绝错误码未被 SDK 生成契约收录（文档↔生成物漂移）',
          { expected: '生成契约收录该码', actual: '缺失' }
        )
      );
    }
  }

  return sortViolations(violations);
}
