/** Markdown 结构化解析：章节、表格、内联码。 */

export interface MarkdownTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export class MarkdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownError';
  }
}

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const TABLE_SEPARATOR_CELL = /^:?-{1,}:?$/;

/** 找标题包含 `heading` 且层级等于 `level` 的章节；返回标题行之后到下一个同级或更高级标题之前的正文。 */
export function findSection(text: string, level: number, heading: string): string | null {
  const lines = text.split('\n');
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const match = HEADING_PATTERN.exec(lines[index] ?? '');
    if (match === null) {
      continue;
    }
    const depth = match[1]?.length ?? 0;
    const title = match[2] ?? '';
    if (start < 0) {
      if (depth === level && title.includes(heading)) {
        start = index + 1;
      }
      continue;
    }
    if (depth <= level) {
      return lines.slice(start, index).join('\n');
    }
  }
  return start < 0 ? null : lines.slice(start).join('\n');
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\||\|$/g, '');
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '\\' && trimmed[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isSeparatorRow(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => cell === '' || TABLE_SEPARATOR_CELL.test(cell));
}

/** 解析正文中的全部表格（连续 `|` 行构成一张表）。 */
export function parseTables(body: string): MarkdownTable[] {
  const lines = body.split('\n');
  const tables: MarkdownTable[] = [];
  let run: string[] = [];
  const flush = (): void => {
    if (run.length >= 2) {
      const header = splitTableRow(run[0] ?? '');
      const dataRows = run.slice(1).filter((line) => !isSeparatorRow(splitTableRow(line)));
      tables.push({ header, rows: dataRows.map((line) => splitTableRow(line)) });
    }
    run = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      run.push(line);
    } else {
      flush();
    }
  }
  flush();
  return tables;
}

/** 找表头中含 `headerAnchor` 的表格。 */
export function findTable(tables: readonly MarkdownTable[], headerAnchor: string): MarkdownTable {
  const table = tables.find((candidate) =>
    candidate.header.some((cell) => cell.includes(headerAnchor))
  );
  if (table === undefined) {
    throw new MarkdownError(`未找到表头包含「${headerAnchor}」的表格`);
  }
  return table;
}

export function columnIndex(table: MarkdownTable, header: string): number {
  const index = table.header.findIndex((cell) => cell.includes(header));
  if (index < 0) {
    throw new MarkdownError(`表头缺少列「${header}」（现有：${table.header.join(' / ')}）`);
  }
  return index;
}

export function cellAt(row: readonly string[], index: number): string {
  return row[index] ?? '';
}

/** 提取行内反引号码。 */
export function inlineCodeSpans(text: string): string[] {
  const spans: string[] = [];
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    if (match[1] !== undefined) {
      spans.push(match[1]);
    }
  }
  return spans;
}

/** 提取双引号包裹的全大写标识（用于 Rust/JSON 代码块中的错误码）。 */
export function quotedUpperTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(/"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/g)) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    }
  }
  return tokens;
}

/** 扫描 `#### <eventId>` 标题。 */
export function headingTokens(text: string, level: number): string[] {
  const tokens: string[] = [];
  for (const line of text.split('\n')) {
    const match = HEADING_PATTERN.exec(line);
    if (match === null) {
      continue;
    }
    if ((match[1]?.length ?? 0) === level && match[2] !== undefined) {
      tokens.push(match[2].trim());
    }
  }
  return tokens;
}
