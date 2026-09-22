/**
 * 权限审计条目一致性检查（工单046 段一：条目面单一事实源，三方逐字锁测）。
 *
 * 判定链：《08.08》§8.2 权威形状 ↔ `@chips/bridge` 协议层声明 ↔ SDK 转发锚点。
 * - 代码块 ↔ 说明表：§8.2 内声明字段与「字段」表词表按名逐一对闭合（同名同序）；
 * - §8.2 ↔ bridge：四个权威声明在协议层一一存在，接口成员数、名、可选性、
 *   类型文本逐字一致（`readonly` 为实现侧纪律，比对前统一剥离）；
 * - bridge ↔ sdk：SDK 治理类型面只做 `@chips/bridge` 锚定转发，禁本地再声明；
 * - 异型扫清：bridge/sdk/host 源码文本禁再现已收口异型 `IPermissionAuditRecord`
 *   （禁三型并存账的机械闸）。
 */

import type { BridgePermissionCodeModel, SdkPermissionAnchorModel } from '../code/audit-entry.js';
import { FORBIDDEN_AUDIT_RECORD_SHAPE } from '../code/audit-entry.js';
import { docRefLabel } from '../docs/reader.js';
import { AUDIT_ENTRY_DECLARATION_NAMES, type DocAuditEntryModel } from '../docs/audit-entry.js';
import type { NormalizedDeclaration } from '../docs/ts-declarations.js';
import { sortViolations, violation, type ContractViolation } from '../violations.js';

export interface AuditEntryCheckInput {
  readonly docs: DocAuditEntryModel;
  readonly bridge: BridgePermissionCodeModel;
  readonly sdk: SdkPermissionAnchorModel;
  /** 异型名命中的实现侧文件展示路径清单（由 `findForbiddenShapeHits` 扫描供给）。 */
  readonly forbiddenShapeHits: readonly string[];
}

/** 归一声明 → 可比对指纹（接口：成员指纹序列表；别名：类型文本）。 */
function declarationFingerprint(declaration: NormalizedDeclaration): string {
  if (declaration.kind === 'type') {
    return `type ${declaration.name} = ${declaration.text}`;
  }
  const members = declaration.members.map((member) => {
    const withoutReadonly = member.signature.replace(/^readonly\s+/, '');
    return `  ${withoutReadonly}`;
  });
  return [`interface ${declaration.name} {`, ...members, '}'].join('\n');
}

export function checkAuditEntry(input: AuditEntryCheckInput): ContractViolation[] {
  const { docs, bridge, sdk, forbiddenShapeHits } = input;
  const violations: ContractViolation[] = [];
  const docRef = docRefLabel(docs.ref);

  // 一、§8.2 代码块 ↔ 字段说明表：词表与声明成员同名同序、一一闭合。
  const entry = docs.declarations.get('IPermissionAuditEntry');
  if (entry === undefined || entry.kind !== 'interface') {
    violations.push(
      violation(
        'CONTRACT_AUDIT_ENTRY_DOC_SHAPE_MISSING',
        docRef,
        '§8.2 代码块未给出 IPermissionAuditEntry 接口声明',
        {
          expected: 'interface IPermissionAuditEntry',
          actual: '缺失',
        }
      )
    );
    return sortViolations(violations);
  }
  const memberNames = entry.members.map((member) => member.name);
  const tableFieldNames = docs.fieldNames;
  const seenTableFields = new Set<string>();
  for (const field of tableFieldNames) {
    if (seenTableFields.has(field)) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_TABLE_DUPLICATE',
          `${docRef}:${field}`,
          '字段说明表同一字段重复登记',
          {
            expected: '唯一',
            actual: '重复',
          }
        )
      );
      continue;
    }
    seenTableFields.add(field);
    if (!memberNames.includes(field)) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_TABLE_EXTRA',
          `${docRef}:${field}`,
          '字段说明表登记的字段未在 §8.2 代码块声明中出现',
          {
            expected: '代码块包含该字段',
            actual: '缺失',
          }
        )
      );
    }
  }
  for (const name of memberNames) {
    if (!seenTableFields.has(name)) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_TABLE_MISSING',
          `${docRef}:${name}`,
          '§8.2 代码块声明字段未进入字段说明表',
          {
            expected: '说明表包含该字段',
            actual: '缺失',
          }
        )
      );
    }
  }
  for (let index = 0; index < Math.min(memberNames.length, tableFieldNames.length); index += 1) {
    if (memberNames[index] !== tableFieldNames[index]) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_TABLE_ORDER',
          `${docRef}#${index}`,
          '字段说明表与代码块成员顺序不一致',
          {
            expected: String(tableFieldNames[index]),
            actual: String(memberNames[index]),
          }
        )
      );
    }
  }

  // 二、§8.2 ↔ bridge 协议层：四个权威声明逐字一致。
  for (const name of AUDIT_ENTRY_DECLARATION_NAMES) {
    const docDeclaration = docs.declarations.get(name);
    const codeDeclaration = bridge.declarations.get(name);
    if (docDeclaration === undefined) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_DOC_SHAPE_MISSING',
          `${docRef}:${name}`,
          '§8.2 代码块缺少权威声明',
          {
            expected: name,
            actual: '缺失',
          }
        )
      );
      continue;
    }
    if (codeDeclaration === undefined) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_BRIDGE_MISSING',
          name,
          'bridge 协议层缺少 §8.2 权威声明（单一事实源未落地）',
          {
            expected: docRef,
            actual: '缺失',
          }
        )
      );
      continue;
    }
    const docFingerprint = declarationFingerprint(docDeclaration);
    const codeFingerprint = declarationFingerprint(codeDeclaration);
    if (docFingerprint !== codeFingerprint) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_BRIDGE_DRIFT',
          name,
          'bridge 协议层声明与 §8.2 权威形状不一致（逐字段漂移）',
          {
            expected: docFingerprint,
            actual: codeFingerprint,
          }
        )
      );
    }
  }

  // 三、bridge ↔ sdk：SDK 只做锚定转发，禁本地再声明。
  for (const name of AUDIT_ENTRY_DECLARATION_NAMES) {
    if (sdk.locallyDeclared.has(name)) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_SDK_RESHAPED',
          `sdk:${name}`,
          'SDK 治理类型面本地再声明权威形状（手抄面回潮，禁三型并存）',
          {
            expected: `import type 自 @chips/bridge 转发`,
            actual: '本地声明',
          }
        )
      );
      continue;
    }
    if (!sdk.importedFromBridge.has(name) || !sdk.reexported.has(name)) {
      violations.push(
        violation(
          'CONTRACT_AUDIT_ENTRY_SDK_UNANCHORED',
          `sdk:${name}`,
          'SDK 治理类型面未从 @chips/bridge 权威锚定转发',
          {
            expected: 'import type + export 转发',
            actual: sdk.importedFromBridge.has(name) ? '引入未导出' : '未引入',
          }
        )
      );
    }
  }

  // 四、异型扫清：收口的 `IPermissionAuditRecord` 禁在任何实现侧源码再现。
  for (const file of forbiddenShapeHits) {
    violations.push(
      violation(
        'CONTRACT_AUDIT_ENTRY_FORBIDDEN_SHAPE',
        file,
        `实现侧源码再现异型 ${FORBIDDEN_AUDIT_RECORD_SHAPE}（禁三型并存账破坏）`,
        {
          expected: '零命中',
          actual: '命中',
        }
      )
    );
  }

  return sortViolations(violations);
}
