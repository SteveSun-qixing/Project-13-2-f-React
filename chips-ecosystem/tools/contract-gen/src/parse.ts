import {
  MarkdownError,
  cellAt,
  columnIndex,
  findSection,
  findTable,
  headingTokens,
  inlineCodeSpans,
  parseTables,
  quotedUpperTokens,
} from './markdown.js';
import type {
  CapabilityEntry,
  CapabilityTableSelector,
  ContractSources,
  DeclaredFacts,
  DocReader,
  ErrorCodeEntry,
  EventEntry,
  PermissionEntry,
  PermissionVocabTable,
  ReservedEventDomain,
  SourceRef,
  TableSelector,
} from './types.js';

export const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*$/;
export const PERMISSION_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
export const EVENT_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

const PERMISSION_BASE_PATTERN = /^([a-z][a-z0-9-]*:[a-z][a-z0-9-]*)/;

export class ContractParseError extends Error {
  readonly file: string;
  readonly section: string;

  constructor(file: string, section: string, message: string) {
    super(`${file} §${section}：${message}`);
    this.name = 'ContractParseError';
    this.file = file;
    this.section = section;
  }
}

function readSection(
  reader: DocReader,
  selector: { readonly file: string; readonly headingLevel: 2 | 3 | 4; readonly heading: string }
): string {
  const text = reader.read(selector.file);
  const body = findSection(text, selector.headingLevel, selector.heading);
  if (body === null) {
    throw new ContractParseError(selector.file, selector.heading, '未找到章节');
  }
  return body;
}

function readTable(reader: DocReader, selector: TableSelector): ReturnType<typeof findTable> {
  const body = readSection(reader, selector);
  const tables = parseTables(body);
  if (tables.length === 0) {
    throw new ContractParseError(selector.file, selector.heading, '章节内没有表格');
  }
  return findTable(tables, selector.headerAnchor);
}

/** 从内联码提取权限基础形式（`config:read:<namespace>` → `config:read`）。 */
function toPermissionBase(token: string): string | null {
  const match = PERMISSION_BASE_PATTERN.exec(token);
  if (match === null || match[1] === undefined) {
    return null;
  }
  return match[1];
}

export function parseCapabilities(
  reader: DocReader,
  selector: CapabilityTableSelector
): readonly CapabilityEntry[] {
  const table = readTable(reader, selector);
  const capabilityColumn = columnIndex(table, selector.capabilityColumnHeader);
  const permissionColumn = columnIndex(table, selector.permissionColumnHeader);
  const entries: CapabilityEntry[] = [];
  const seen = new Set<string>();
  for (const row of table.rows) {
    const capabilityCell = cellAt(row, capabilityColumn);
    const permissionCell = cellAt(row, permissionColumn);
    const ids = inlineCodeSpans(capabilityCell).filter((token) =>
      CAPABILITY_ID_PATTERN.test(token)
    );
    if (ids.length === 0) {
      throw new ContractParseError(
        selector.file,
        selector.heading,
        `能力列未解析出能力 ID：${capabilityCell}`
      );
    }
    const permissions = [
      ...new Set(
        inlineCodeSpans(permissionCell)
          .map((token) => toPermissionBase(token))
          .filter((token): token is string => token !== null && PERMISSION_ID_PATTERN.test(token))
      ),
    ];
    for (const id of ids) {
      if (seen.has(id)) {
        throw new ContractParseError(selector.file, selector.heading, `能力 ID 重复：${id}`);
      }
      seen.add(id);
      entries.push({ id, permissions });
    }
  }
  return entries;
}

export function parseDeclaredCapabilityCount(
  reader: DocReader,
  file: string,
  pattern: RegExp
): number {
  const text = reader.read(file);
  const match = pattern.exec(text);
  if (match === null || match[1] === undefined) {
    throw new ContractParseError(file, '能力计数声明', `未匹配到计数声明：${String(pattern)}`);
  }
  return Number.parseInt(match[1], 10);
}

export function parsePermissionCatalog(
  reader: DocReader,
  selector: TableSelector & { readonly permissionColumnHeader: string }
): readonly string[] {
  const table = readTable(reader, selector);
  const column = columnIndex(table, selector.permissionColumnHeader);
  const permissions: string[] = [];
  const seen = new Set<string>();
  for (const row of table.rows) {
    const token = cellAt(row, column).trim();
    const match = /^`([^`]+)`$/.exec(token);
    if (match === null || match[1] === undefined || !PERMISSION_ID_PATTERN.test(match[1])) {
      throw new ContractParseError(selector.file, selector.heading, `权限列格式非法：${token}`);
    }
    if (seen.has(match[1])) {
      throw new ContractParseError(selector.file, selector.heading, `权限 ID 重复：${match[1]}`);
    }
    seen.add(match[1]);
    permissions.push(match[1]);
  }
  return permissions;
}

export function parsePermissionVocabulary(
  reader: DocReader,
  selector: PermissionVocabTable
): readonly string[] {
  const table = readTable(reader, selector.table);
  if (selector.kind === 'permission-id') {
    const column = columnIndex(table, selector.table.permissionColumnHeader);
    const ids: string[] = [];
    for (const row of table.rows) {
      const match = /^`([^`]+)`$/.exec(cellAt(row, column).trim());
      if (match === null || match[1] === undefined || !PERMISSION_ID_PATTERN.test(match[1])) {
        throw new ContractParseError(
          selector.table.file,
          selector.table.heading,
          `权限列格式非法：${cellAt(row, column)}`
        );
      }
      ids.push(match[1]);
    }
    return ids;
  }
  const domainColumn = columnIndex(table, selector.table.domainColumnHeader);
  const scopeColumn = columnIndex(table, selector.table.scopeColumnHeader);
  const ids: string[] = [];
  for (const row of table.rows) {
    const domainCell = cellAt(row, domainColumn);
    const scopeCell = cellAt(row, scopeColumn);
    const domainMatch = /^`([a-z][a-z0-9-]*)`$/.exec(domainCell.trim());
    if (domainMatch === null || domainMatch[1] === undefined) {
      throw new ContractParseError(
        selector.table.file,
        selector.table.heading,
        `domain 格式非法：${domainCell}`
      );
    }
    const scopes = inlineCodeSpans(scopeCell).filter((token) => /^[a-z][a-z0-9-]*$/.test(token));
    if (scopes.length === 0) {
      throw new ContractParseError(
        selector.table.file,
        selector.table.heading,
        `scope 为空：${domainCell}`
      );
    }
    for (const scope of scopes) {
      ids.push(`${domainMatch[1]}:${scope}`);
    }
  }
  return ids;
}

/** 反向核对：§4.3 表中引用的能力 ID 必须存在于 R19 总表。 */
export function parseCapabilityReferences(
  reader: DocReader,
  selector: CapabilityTableSelector
): readonly string[] {
  const table = readTable(reader, selector);
  const column = columnIndex(table, selector.capabilityColumnHeader);
  const ids: string[] = [];
  for (const row of table.rows) {
    for (const token of inlineCodeSpans(cellAt(row, column))) {
      if (CAPABILITY_ID_PATTERN.test(token)) {
        ids.push(token);
      }
    }
  }
  return ids;
}

export function parseReservedEventDomains(
  reader: DocReader,
  selector: TableSelector
): readonly ReservedEventDomain[] {
  const table = readTable(reader, selector);
  const domainColumn = 0;
  const countColumn = table.header.length - 1;
  const domains: ReservedEventDomain[] = [];
  for (const row of table.rows) {
    const domainMatch = /^`([a-z][a-z0-9-]*)`$/.exec(cellAt(row, domainColumn).trim());
    if (domainMatch === null || domainMatch[1] === undefined) {
      throw new ContractParseError(
        selector.file,
        selector.heading,
        `保留域格式非法：${cellAt(row, domainColumn)}`
      );
    }
    const countMatch = /(\d+)\s*个/.exec(cellAt(row, countColumn));
    domains.push({
      domain: domainMatch[1],
      declaredCount: countMatch === null ? null : Number.parseInt(countMatch[1] ?? '0', 10),
    });
  }
  return domains;
}

export function parseEventDeclarations(
  reader: DocReader,
  files: readonly string[]
): readonly EventEntry[] {
  const entries: EventEntry[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const text = reader.read(file);
    for (const token of headingTokens(text, 4)) {
      if (!EVENT_ID_PATTERN.test(token)) {
        throw new ContractParseError(file, '标准事件', `事件声明标题不是合法事件 ID：${token}`);
      }
      if (seen.has(token)) {
        throw new ContractParseError(file, '标准事件', `事件 ID 重复：${token}`);
      }
      seen.add(token);
      entries.push({ id: token, domain: token.slice(0, token.indexOf(':')) });
    }
  }
  return entries;
}

export function parseErrorCodes(
  reader: DocReader,
  selector: { readonly file: string; readonly headingLevel: 2 | 3 | 4; readonly heading: string }
): readonly ErrorCodeEntry[] {
  const body = readSection(reader, selector);
  const tokens = new Set<string>();
  for (const token of [...inlineCodeSpans(body), ...quotedUpperTokens(body)]) {
    if (token.includes('*')) {
      continue;
    }
    if (ERROR_CODE_PATTERN.test(token)) {
      tokens.add(token);
    }
  }
  if (tokens.size === 0) {
    throw new ContractParseError(selector.file, selector.heading, '未解析出任何错误码');
  }
  return [...tokens].sort((left, right) => left.localeCompare(right)).map((code) => ({ code }));
}

export interface ParsedContract {
  readonly capabilities: readonly CapabilityEntry[];
  readonly permissions: readonly PermissionEntry[];
  readonly events: readonly EventEntry[];
  readonly errorCodes: readonly ErrorCodeEntry[];
  readonly facts: DeclaredFacts;
  readonly referenceCapabilities: readonly string[];
  readonly sources: {
    readonly capability: readonly SourceRef[];
    readonly permission: readonly SourceRef[];
    readonly event: readonly SourceRef[];
    readonly error: readonly SourceRef[];
  };
}

function mergeErrorCodes(
  sources: readonly (readonly ErrorCodeEntry[])[]
): readonly ErrorCodeEntry[] {
  const codes = new Set<string>();
  for (const entries of sources) {
    for (const entry of entries) {
      codes.add(entry.code);
    }
  }
  return [...codes].sort((left, right) => left.localeCompare(right)).map((code) => ({ code }));
}

/** 按来源声明读取并解析全部契约。 */
export function parseContract(reader: DocReader, sources: ContractSources): ParsedContract {
  const capabilities = parseCapabilities(reader, sources.capability.table);
  const declaredCapabilityCount = parseDeclaredCapabilityCount(
    reader,
    sources.capability.declaredCountFile,
    sources.capability.declaredCountPattern
  );
  const permissions = parsePermissionCatalog(reader, sources.permission.catalog);
  const vocabulary = sources.permission.vocabulary.flatMap((selector) =>
    parsePermissionVocabulary(reader, selector)
  );
  const permissionVocabulary = [...new Set(vocabulary)];
  const referenceCapabilities = parseCapabilityReferences(
    reader,
    sources.permission.capabilityMappingCheck
  );
  const reservedDomains = parseReservedEventDomains(reader, sources.event.reservedTable);
  const events = parseEventDeclarations(reader, sources.event.declarations);
  const errorCodes = mergeErrorCodes(
    sources.errors.map((selector) => parseErrorCodes(reader, selector))
  );

  return {
    capabilities,
    permissions: permissions.map((id) => ({ id })),
    events,
    errorCodes,
    facts: {
      capabilityCount: declaredCapabilityCount,
      reservedDomains,
      permissionVocabulary,
    },
    referenceCapabilities,
    sources: {
      capability: [
        { file: sources.capability.table.file, section: sources.capability.table.heading },
      ],
      permission: [
        { file: sources.permission.catalog.file, section: sources.permission.catalog.heading },
        ...sources.permission.vocabulary.map((selector) => ({
          file: selector.table.file,
          section: selector.table.heading,
        })),
      ],
      event: [
        { file: sources.event.reservedTable.file, section: sources.event.reservedTable.heading },
        ...sources.event.declarations.map((file) => ({ file, section: '第四节 标准事件' })),
      ],
      error: sources.errors.map((selector) => ({ file: selector.file, section: selector.heading })),
    },
  };
}

export { MarkdownError };
