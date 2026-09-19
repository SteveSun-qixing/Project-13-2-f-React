/**
 * 错误码表解析：按 {@link ERROR_SOURCES} 清单读取各权威章节的错误码登记表。
 *
 * 章节内含错误码登记表（表头含「错误码 / code」列）时，登记表即该来源的权威码集，
 * 正文散句引用的他域错误码不进入来源域；无此类表时按整节正文提取。
 * 同一错误码可被多处引用（如 `BRIDGE_TIMEOUT` 出现在 Bridge 表与能力调用表），
 * 注册表按「来源」保留分域视图，另给出全库去重并集用于「不得自造错误码」检查。
 */

import {
  collapse,
  findSection,
  findTable,
  inlineCodeTokens,
  parseTables,
  stripMarkdownInline,
} from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import { ERROR_SOURCES, type ErrorSourceSelector } from './sources.js';

export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

export interface DocErrorDomain {
  readonly source: ErrorSourceSelector;
  /** 该来源登记的错误码，去重升序。 */
  readonly codes: readonly string[];
}

export interface DocErrorRegistry {
  readonly domains: readonly DocErrorDomain[];
  /** 全库去重升序并集。 */
  readonly all: readonly string[];
}

const QUOTED_UPPER_PATTERN = /"([A-Z][A-Z0-9_]+)"/g;

function isErrorCodeCell(text: string): boolean {
  const token = text.trim();
  return !token.includes('*') && ERROR_CODE_PATTERN.test(token);
}

function codesFromCells(cells: Iterable<string>): Set<string> {
  const codes = new Set<string>();
  for (const cell of cells) {
    for (const token of inlineCodeTokens(cell)) {
      if (isErrorCodeCell(token)) {
        codes.add(token);
      }
    }
  }
  return codes;
}

/** 表头是否声明错误码列（「错误码」「code」等写法，与各分册表头兼容）。 */
function isErrorCodeTable(header: readonly string[]): boolean {
  return header.some((cell) => {
    const normalized = stripMarkdownInline(cell);
    return normalized.includes('错误码') || normalized.toLowerCase() === 'code';
  });
}

function codesFromQuotedText(body: string): Set<string> {
  const codes = new Set<string>();
  QUOTED_UPPER_PATTERN.lastIndex = 0;
  let match = QUOTED_UPPER_PATTERN.exec(body);
  while (match !== null) {
    const token = match[1] ?? '';
    if (isErrorCodeCell(token)) {
      codes.add(token);
    }
    match = QUOTED_UPPER_PATTERN.exec(body);
  }
  return codes;
}

function extractErrorCodes(body: string): string[] {
  const tableCodes = new Set<string>();
  for (const table of parseTables(body)) {
    if (isErrorCodeTable(table.header)) {
      for (const row of table.rows) {
        for (const code of codesFromCells(row).keys()) {
          tableCodes.add(code);
        }
      }
    }
  }
  if (tableCodes.size > 0) {
    return [...tableCodes].sort((left, right) => left.localeCompare(right));
  }
  // 无错误码登记表的章节（如 04-能力契约规范 §8.6 的分域列表）：按正文提取。
  const codes = codesFromCells([body]);
  for (const code of codesFromQuotedText(body)) {
    codes.add(code);
  }
  return [...codes].sort((left, right) => left.localeCompare(right));
}

function sourceRef(source: ErrorSourceSelector): DocRef {
  return { file: source.file, section: source.section ?? source.heading };
}

export function parseErrorRegistry(reader: DocReader): DocErrorRegistry {
  const domains: DocErrorDomain[] = [];
  const all = new Set<string>();
  for (const source of ERROR_SOURCES) {
    const text = reader.read(source.file);
    const body = findSection(text, source.level, source.heading);
    if (body === null) {
      throw new Error(`未找到错误码章节：${source.file} §${source.heading}`);
    }
    const codes = extractErrorCodes(body);
    if (codes.length === 0) {
      throw new Error(`错误码章节未解析出任何错误码：${source.file} §${source.heading}`);
    }
    for (const code of codes) {
      all.add(code);
    }
    domains.push({ source, codes });
  }
  return {
    domains,
    all: [...all].sort((left, right) => left.localeCompare(right)),
  };
}

/**
 * 解析错误码表的 `retryable` 列；只对含该列的来源有效。
 * 取值支持 `true` / `false` 与 `是` / `否` 两种文档写法。
 */
export function parseErrorRetryable(
  reader: DocReader,
  source: ErrorSourceSelector
): ReadonlyMap<string, boolean> {
  const text = reader.read(source.file);
  const body = findSection(text, source.level, source.heading);
  if (body === null) {
    throw new Error(`未找到错误码章节：${source.file} §${source.heading}`);
  }
  const table = findTable(body, '错误码') ?? findTable(body, 'code');
  if (table === null) {
    throw new Error(`错误码章节缺少「错误码 / code」表：${source.file} §${source.heading}`);
  }
  const retryableIndex = table.header.findIndex((cell) => collapse(cell) === 'retryable');
  if (retryableIndex < 0) {
    throw new Error(`错误码表缺少「retryable」列：${source.file} §${source.heading}`);
  }
  const result = new Map<string, boolean>();
  for (const row of table.rows) {
    const code = inlineCodeTokens(row[0] ?? '')[0];
    if (code === undefined || !ERROR_CODE_PATTERN.test(code)) {
      continue;
    }
    const cell = collapse(row[retryableIndex] ?? '');
    if (cell.includes('true') || cell.startsWith('是')) {
      result.set(code, true);
    } else if (cell.includes('false') || cell.startsWith('否')) {
      result.set(code, false);
    }
  }
  return result;
}

/** 按来源取错误码集合；来源不存在时抛错（来源清单即契约，禁止静默缺省）。 */
export function domainCodes(
  registry: DocErrorRegistry,
  source: ErrorSourceSelector
): readonly string[] {
  const domain = registry.domains.find(
    (entry) => entry.source.file === source.file && entry.source.heading === source.heading
  );
  if (domain === undefined) {
    throw new Error(`错误码注册表缺少来源：${source.file} §${source.heading}`);
  }
  return domain.codes;
}

export { sourceRef as errorSourceRef };
