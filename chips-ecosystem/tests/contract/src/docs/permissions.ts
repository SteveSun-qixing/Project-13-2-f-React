/**
 * 权限词表解析：内置权限清单总表（01-架构设计/01-子系统设计/08.04 §4.1）。
 *
 * 权限词表是能力→权限映射的取值域；与 Bridge 的 `BUILTIN_PERMISSIONS` 逐项比对。
 */

import { findSection, findTable, inlineCodeTokens } from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import { PERMISSION_ID_PATTERN } from './capabilities.js';
import { PERMISSION_SOURCE } from './sources.js';

export interface DocPermissionModel {
  /** 基础权限 ID，去重升序。 */
  readonly ids: readonly string[];
  readonly ref: DocRef;
}

export function parsePermissionModel(reader: DocReader): DocPermissionModel {
  const text = reader.read(PERMISSION_SOURCE.file);
  const body = findSection(text, PERMISSION_SOURCE.level, PERMISSION_SOURCE.heading);
  if (body === null) {
    throw new Error(`未找到权限清单章节：${PERMISSION_SOURCE.file} §${PERMISSION_SOURCE.heading}`);
  }
  const table = findTable(body, '权限 ID');
  if (table === null) {
    throw new Error(`权限清单章节缺少「权限 ID」表：${PERMISSION_SOURCE.file} §${PERMISSION_SOURCE.heading}`);
  }
  const ids = new Set<string>();
  for (const row of table.rows) {
    const tokens = inlineCodeTokens(row[0] ?? '').filter((token) => PERMISSION_ID_PATTERN.test(token));
    if (tokens.length === 0) {
      throw new Error(
        `权限清单行未解析出权限 ID：${row[0] ?? ''}（${PERMISSION_SOURCE.file} §${PERMISSION_SOURCE.heading}）`,
      );
    }
    for (const token of tokens) {
      ids.add(token);
    }
  }
  return {
    ids: [...ids].sort((left, right) => left.localeCompare(right)),
    ref: { file: PERMISSION_SOURCE.file, section: PERMISSION_SOURCE.heading },
  };
}
