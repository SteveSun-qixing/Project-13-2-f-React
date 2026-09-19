/**
 * 能力表解析：R19 内置能力与权限总表（05-接口与契约/04.06 §6.2）。
 *
 * 解析产物是「能力 ID → 基础权限 ID 集合」的唯一文档侧模型；
 * 与 Bridge 的 `BUILTIN_CAPABILITIES` 登记表逐项比对（见 `check/capabilities.ts`）。
 */

import { findSection, findTable, inlineCodeTokens } from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import { CAPABILITY_SOURCE } from './sources.js';

export const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*$/;
export const PERMISSION_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

const DECLARED_COUNT_PATTERN = /本表的\s*(\d+)\s*项计数/;

export interface DocCapability {
  readonly id: string;
  /** 基础权限 ID，去重升序。 */
  readonly permissions: readonly string[];
}

export interface DocCapabilityModel {
  readonly capabilities: readonly DocCapability[];
  /** 文档正文声明的内置能力计数。 */
  readonly declaredCount: number;
  readonly ref: DocRef;
}

/** `config:read:<namespace>` / `network:http[:<domain>]` → 基础权限 ID。 */
export function toBasePermission(token: string): string | null {
  const match = /^([a-z][a-z0-9-]*:[a-z][a-z0-9-]*)(?:[[:(].*)?$/.exec(token);
  if (match === null || match[1] === undefined || !PERMISSION_ID_PATTERN.test(match[1])) {
    return null;
  }
  return match[1];
}

export function parseCapabilityModel(reader: DocReader): DocCapabilityModel {
  const text = reader.read(CAPABILITY_SOURCE.file);
  const body = findSection(text, CAPABILITY_SOURCE.level, CAPABILITY_SOURCE.heading);
  if (body === null) {
    throw new Error(`未找到能力总表章节：${CAPABILITY_SOURCE.file} §${CAPABILITY_SOURCE.heading}`);
  }
  const countMatch = DECLARED_COUNT_PATTERN.exec(body);
  if (countMatch === null || countMatch[1] === undefined) {
    throw new Error(
      `能力总表章节缺少计数声明（"本表的 N 项计数"）：${CAPABILITY_SOURCE.file} §${CAPABILITY_SOURCE.heading}`
    );
  }
  const table = findTable(body, '能力 ID');
  if (table === null) {
    throw new Error(
      `能力总表章节缺少「能力 ID」表：${CAPABILITY_SOURCE.file} §${CAPABILITY_SOURCE.heading}`
    );
  }
  const capabilities: DocCapability[] = [];
  const seen = new Set<string>();
  for (const row of table.rows) {
    const capabilityCell = row[0] ?? '';
    const ids = inlineCodeTokens(capabilityCell).filter((token) =>
      CAPABILITY_ID_PATTERN.test(token)
    );
    if (ids.length === 0) {
      throw new Error(
        `能力总表行未解析出能力 ID：${capabilityCell}（${CAPABILITY_SOURCE.file} §${CAPABILITY_SOURCE.heading}）`
      );
    }
    const permissionCell = row[1] ?? '';
    const permissions = [
      ...new Set(
        inlineCodeTokens(permissionCell)
          .map((token) => toBasePermission(token))
          .filter((token): token is string => token !== null)
      ),
    ].sort((left, right) => left.localeCompare(right));
    for (const id of ids) {
      if (seen.has(id)) {
        throw new Error(
          `能力总表出现重复能力 ID：${id}（${CAPABILITY_SOURCE.file} §${CAPABILITY_SOURCE.heading}）`
        );
      }
      seen.add(id);
      capabilities.push({ id, permissions });
    }
  }
  return {
    capabilities,
    declaredCount: Number.parseInt(countMatch[1], 10),
    ref: { file: CAPABILITY_SOURCE.file, section: CAPABILITY_SOURCE.heading },
  };
}
