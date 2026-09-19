/**
 * SDK 导出面解析：`@chips/sdk` 包入口（02.02 §2.1）与主入口导出清单（§2.2）。
 *
 * 导出清单是文档声明的事实源；角色接口文档的导出声明必须落在本清单内
 * （见 `check/roles.ts` 的交叉核对），快照锁定清单本身。
 */

import { collapse, findSection, findTable, inlineCodeTokens, stripMarkdownInline } from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import { SDK_EXPORT_SOURCE, SDK_PACKAGE_ENTRY_SOURCE } from './sources.js';

export interface SdkPackageEntry {
  readonly entry: string;
  readonly purpose: string;
  readonly stage: string;
}

export interface SdkValueExport {
  readonly name: string;
  readonly kind: string;
  readonly purpose: string;
}

export interface SdkTypeExport {
  readonly category: string;
  /** 具体类型名（不含通配）。 */
  readonly names: readonly string[];
  /** 通配模式（如 `I*Input`）。 */
  readonly patterns: readonly string[];
}

export interface SdkExportModel {
  readonly entries: readonly SdkPackageEntry[];
  readonly values: readonly SdkValueExport[];
  readonly types: readonly SdkTypeExport[];
  /** `@chips/sdk/testing` 的导出名。 */
  readonly testing: readonly string[];
  readonly ref: DocRef;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TYPE_IDENTIFIER = /^[A-Z][A-Za-z0-9]*$/;
const TESTING_EXPORTS = /`@chips\/sdk\/testing` 的导出为：(.+?)；/s;

function parseEntries(reader: DocReader): readonly SdkPackageEntry[] {
  const text = reader.read(SDK_PACKAGE_ENTRY_SOURCE.file);
  const body = findSection(text, SDK_PACKAGE_ENTRY_SOURCE.level, SDK_PACKAGE_ENTRY_SOURCE.heading);
  if (body === null) {
    throw new Error(`未找到 SDK 包入口章节：${SDK_PACKAGE_ENTRY_SOURCE.file} §${SDK_PACKAGE_ENTRY_SOURCE.heading}`);
  }
  const table = findTable(body, '入口');
  if (table === null) {
    throw new Error(`SDK 包入口章节缺少「入口」表：${SDK_PACKAGE_ENTRY_SOURCE.file}`);
  }
  return table.rows.map((row) => ({
    entry: inlineCodeTokens(row[0] ?? '')[0] ?? '',
    purpose: collapse(row[1] ?? ''),
    stage: collapse(row[2] ?? ''),
  }));
}

function parseExportTables(reader: DocReader): {
  values: readonly SdkValueExport[];
  types: readonly SdkTypeExport[];
} {
  const text = reader.read(SDK_EXPORT_SOURCE.file);
  const body = findSection(text, SDK_EXPORT_SOURCE.level, SDK_EXPORT_SOURCE.heading);
  if (body === null) {
    throw new Error(`未找到 SDK 导出清单章节：${SDK_EXPORT_SOURCE.file} §${SDK_EXPORT_SOURCE.heading}`);
  }
  const values: SdkValueExport[] = [];
  const valueTable = findTable(body, '种类');
  if (valueTable === null) {
    throw new Error(`SDK 导出清单缺少值导出表：${SDK_EXPORT_SOURCE.file} §${SDK_EXPORT_SOURCE.heading}`);
  }
  for (const row of valueTable.rows) {
    const name = inlineCodeTokens(row[0] ?? '')[0];
    if (name === undefined) {
      throw new Error(`值导出行未解析出名称：${row[0] ?? ''}`);
    }
    values.push({ name, kind: collapse(row[1] ?? ''), purpose: collapse(row[2] ?? '') });
  }
  const types: SdkTypeExport[] = [];
  const typeTable = findTable(body, '分类');
  if (typeTable === null) {
    throw new Error(`SDK 导出清单缺少类型导出表：${SDK_EXPORT_SOURCE.file} §${SDK_EXPORT_SOURCE.heading}`);
  }
  for (const row of typeTable.rows) {
    const tokens = inlineCodeTokens(row[1] ?? '');
    const names: string[] = [];
    const patterns: string[] = [];
    for (const token of tokens) {
      if (token.includes('*')) {
        patterns.push(token);
        continue;
      }
      if (TYPE_IDENTIFIER.test(token)) {
        names.push(token);
      }
    }
    types.push({
      category: stripMarkdownInline(row[0] ?? ''),
      names: [...new Set(names)].sort((left, right) => left.localeCompare(right)),
      patterns: [...new Set(patterns)].sort((left, right) => left.localeCompare(right)),
    });
  }
  return { values, types };
}

function parseTestingExports(reader: DocReader): readonly string[] {
  const text = reader.read(SDK_EXPORT_SOURCE.file);
  const match = TESTING_EXPORTS.exec(text);
  if (match === null || match[1] === undefined) {
    throw new Error(`未找到 @chips/sdk/testing 导出声明：${SDK_EXPORT_SOURCE.file}`);
  }
  return inlineCodeTokens(match[1]).filter((token) => IDENTIFIER.test(token));
}

export function parseSdkExportModel(reader: DocReader): SdkExportModel {
  const { values, types } = parseExportTables(reader);
  return {
    entries: parseEntries(reader),
    values,
    types,
    testing: parseTestingExports(reader),
    ref: { file: SDK_EXPORT_SOURCE.file, section: SDK_EXPORT_SOURCE.heading },
  };
}

/** 全部具体类型名（跨分类去重升序）。 */
export function sdkConcreteTypeNames(model: SdkExportModel): readonly string[] {
  return [...new Set(model.types.flatMap((entry) => entry.names))].sort((left, right) =>
    left.localeCompare(right),
  );
}

/** 类型名是否被导出：具体名命中，或命中任一通配模式。 */
export function isTypeExported(model: SdkExportModel, name: string): boolean {
  if (sdkConcreteTypeNames(model).includes(name)) {
    return true;
  }
  return model.types.some((entry) =>
    entry.patterns.some((pattern) => new RegExp(`^${pattern.split('*').join('[A-Za-z0-9]*')}$`).test(name)),
  );
}
