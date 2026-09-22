/**
 * 权限审计条目解析：《08.08 链路四：审计》§8.2 权威形状（工单046 段一）。
 *
 * 抽取两类事实并归一：
 * - §8.2 TypeScript 代码块的声明（`IPermissionAuditEntry` 与
 *   `PermissionAuditAction` / `PermissionAuditSource` / `PermissionDenyReason`
 *   三个词表别名），走与角色接口同一套语法树归一（`ts-declarations`）；
 * - §8.2「字段」说明表的字段名清单（行内代码 token，按行序展平）——
 *   表与代码块的逐字段互证由检查侧完成（词表 ↔ 声明一一闭合）。
 */

import { findSection, findTable, fencedCodeBlocks, inlineCodeTokens } from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import { PERMISSION_AUDIT_ENTRY_SOURCE } from './sources.js';
import { normalizeCodeBlock, type NormalizedDeclaration } from './ts-declarations.js';

/** §8.2 锁定面涉及的四个权威声明名（条目形状 + 三张词表别名）。 */
export const AUDIT_ENTRY_DECLARATION_NAMES: readonly string[] = [
  'IPermissionAuditEntry',
  'PermissionAuditAction',
  'PermissionAuditSource',
  'PermissionDenyReason',
];

export interface DocAuditEntryModel {
  /** 声明名 → 归一声明（代码块侧）。 */
  readonly declarations: ReadonlyMap<string, NormalizedDeclaration>;
  /** 字段说明表按行序展平的字段名清单（词表侧）。 */
  readonly fieldNames: readonly string[];
  readonly ref: DocRef;
}

export function parseAuditEntryModel(reader: DocReader): DocAuditEntryModel {
  const text = reader.read(PERMISSION_AUDIT_ENTRY_SOURCE.file);
  const body = findSection(
    text,
    PERMISSION_AUDIT_ENTRY_SOURCE.level,
    PERMISSION_AUDIT_ENTRY_SOURCE.heading
  );
  if (body === null) {
    throw new Error(
      `未找到审计条目字段章节：${PERMISSION_AUDIT_ENTRY_SOURCE.file} §${PERMISSION_AUDIT_ENTRY_SOURCE.heading}`
    );
  }
  const blocks = fencedCodeBlocks(body, ['typescript', 'ts']);
  if (blocks.length === 0) {
    throw new Error(
      `审计条目字段章节缺少 TypeScript 代码块：${PERMISSION_AUDIT_ENTRY_SOURCE.file} §${PERMISSION_AUDIT_ENTRY_SOURCE.heading}`
    );
  }
  const declarations = new Map<string, NormalizedDeclaration>();
  for (const block of blocks) {
    for (const declaration of normalizeCodeBlock(block.content).declarations) {
      const previous = declarations.get(declaration.name);
      if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(declaration)) {
        throw new Error(
          `§8.2 出现同名不同形的声明（单一事实源破坏）：${declaration.name}（${PERMISSION_AUDIT_ENTRY_SOURCE.file}）`
        );
      }
      if (previous === undefined) {
        declarations.set(declaration.name, declaration);
      }
    }
  }
  for (const name of AUDIT_ENTRY_DECLARATION_NAMES) {
    if (!declarations.has(name)) {
      throw new Error(`§8.2 代码块缺少权威声明：${name}（${PERMISSION_AUDIT_ENTRY_SOURCE.file}）`);
    }
  }
  const table = findTable(body, '字段');
  if (table === null) {
    throw new Error(
      `审计条目字段章节缺少「字段」说明表：${PERMISSION_AUDIT_ENTRY_SOURCE.file} §${PERMISSION_AUDIT_ENTRY_SOURCE.heading}`
    );
  }
  const fieldNames = table.rows.flatMap((row) => inlineCodeTokens(row[0] ?? ''));
  if (fieldNames.length === 0) {
    throw new Error(
      `「字段」说明表未解析出任何字段名：${PERMISSION_AUDIT_ENTRY_SOURCE.file} §${PERMISSION_AUDIT_ENTRY_SOURCE.heading}`
    );
  }
  return {
    declarations,
    fieldNames,
    ref: {
      file: PERMISSION_AUDIT_ENTRY_SOURCE.file,
      section: PERMISSION_AUDIT_ENTRY_SOURCE.section ?? PERMISSION_AUDIT_ENTRY_SOURCE.heading,
    },
  };
}
