/**
 * 文档库 Markdown 读取工具：章节定位、表格解析、行内码提取与围栏代码块提取。
 *
 * 只服务契约测试的取数需要：所有解析失败都必须显式抛出（含文件与章节），禁止静默跳过。
 * 代码块内的内容不参与表格解析；表格解析支持 `\|` 转义。
 */

export interface MarkdownHeadingSection {
  readonly heading: string;
  readonly body: string;
  /** 标题所在行（1 起）。 */
  readonly line: number;
}

export interface MarkdownTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface FencedBlock {
  /** 围栏语言标注（可能为空字符串）。 */
  readonly language: string;
  readonly content: string;
  /** 内容首行行号（1 起）。 */
  readonly line: number;
}

const FENCE_PATTERN = /^\s*(```|~~~)/;

/** 折叠文本中的全部空白为单空格并去除首尾空白。 */
export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 去掉 Markdown 行内码反引号与强调标记，用于标题与表格文本归一。 */
export function stripMarkdownInline(text: string): string {
  return collapse(text.replace(/`/g, '').replace(/\*\*/g, ''));
}

export function lineCount(text: string): number {
  return text.split('\n').length;
}

/**
 * 按标题层级切分章节：返回每个 `level` 级标题到下一个「级别不高于 level」的标题之间的正文。
 */
export function splitHeadingSections(text: string, level: 2 | 3 | 4): MarkdownHeadingSection[] {
  const lines = text.split('\n');
  const headingPattern = new RegExp(`^#{${level}}\\s+(.*)$`);
  const boundaryPattern = new RegExp(`^#{1,${level}}\\s+`);
  const sections: MarkdownHeadingSection[] = [];
  let current: { heading: string; start: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (current !== null && boundaryPattern.test(line)) {
      sections.push({
        heading: stripMarkdownInline(current.heading),
        body: lines.slice(current.start, index).join('\n'),
        line: current.start,
      });
      current = null;
    }
    const match = headingPattern.exec(line);
    if (match !== null && current === null) {
      current = { heading: (match[1] ?? '').trim(), start: index + 1 };
    }
  }
  if (current !== null) {
    sections.push({
      heading: stripMarkdownInline(current.heading),
      body: lines.slice(current.start).join('\n'),
      line: current.start,
    });
  }
  return sections;
}

/**
 * 定位 `level` 级、标题（去格式后）以 `headingPrefix` 开头的章节正文；未找到返回 null。
 */
export function findSection(text: string, level: 2 | 3 | 4, headingPrefix: string): string | null {
  const prefix = stripMarkdownInline(headingPrefix);
  for (const section of splitHeadingSections(text, level)) {
    if (section.heading.startsWith(prefix)) {
      return section.body;
    }
  }
  return null;
}

/** 按未转义的 `|` 切分表格行，并还原 `\|` 与 `&#124;`。 */
export function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let buffer = '';
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? '';
    if (char === '\\' && line[index + 1] === '|') {
      buffer += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += char;
  }
  cells.push(buffer.trim());
  if (cells.length > 0 && cells[0] === '') {
    cells.shift();
  }
  if (cells.length > 0 && cells[cells.length - 1] === '') {
    cells.pop();
  }
  return cells.map((cell) => cell.replace(/&#124;/g, '|'));
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) {
    return false;
  }
  return /^\|?[\s:|-]+\|?$/.test(trimmed);
}

/** 解析全部 Markdown 表格（跳过围栏代码块）。 */
export function parseTables(text: string): MarkdownTable[] {
  const lines = text.split('\n');
  const tables: MarkdownTable[] = [];
  let inFence = false;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      index += 1;
      continue;
    }
    if (inFence || !line.trim().startsWith('|')) {
      index += 1;
      continue;
    }
    const next = lines[index + 1] ?? '';
    if (!isSeparatorRow(next)) {
      index += 1;
      continue;
    }
    const header = splitTableRow(line);
    const rows: string[][] = [];
    let cursor = index + 2;
    while (cursor < lines.length) {
      const rowLine = lines[cursor] ?? '';
      if (FENCE_PATTERN.test(rowLine) || !rowLine.trim().startsWith('|')) {
        break;
      }
      if (!isSeparatorRow(rowLine)) {
        rows.push(splitTableRow(rowLine));
      }
      cursor += 1;
    }
    tables.push({ header, rows });
    index = cursor;
  }
  return tables;
}

/** 在章节正文中定位表头包含 `anchor` 的表格；找不到返回 null。 */
export function findTable(text: string, anchor: string): MarkdownTable | null {
  for (const table of parseTables(text)) {
    if (table.header.some((cell) => stripMarkdownInline(cell).includes(anchor))) {
      return table;
    }
  }
  return null;
}

/** 提取全部行内码内容（不含换行）。 */
export function inlineCodeTokens(text: string): string[] {
  const tokens: string[] = [];
  const pattern = /`([^`\n]+)`/g;
  let match = pattern.exec(text);
  while (match !== null) {
    const token = (match[1] ?? '').trim();
    if (token.length > 0) {
      tokens.push(token);
    }
    match = pattern.exec(text);
  }
  return tokens;
}

/** 提取全部围栏代码块；`languages` 给定时只保留对应语言（大小写不敏感）。 */
export function fencedCodeBlocks(text: string, languages?: readonly string[]): FencedBlock[] {
  const lines = text.split('\n');
  const blocks: FencedBlock[] = [];
  const allowed =
    languages === undefined ? null : new Set(languages.map((language) => language.toLowerCase()));
  let open: { fence: string; language: string; line: number; content: string[] } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fenceMatch = /^\s*(```|~~~)\s*([A-Za-z0-9#+-]*)\s*$/.exec(line);
    if (open === null) {
      if (fenceMatch !== null) {
        open = {
          fence: fenceMatch[1] ?? '```',
          language: (fenceMatch[2] ?? '').toLowerCase(),
          line: index + 2,
          content: [],
        };
      }
      continue;
    }
    if (line.trim().startsWith(open.fence)) {
      if (allowed === null || allowed.has(open.language)) {
        blocks.push({ language: open.language, content: open.content.join('\n'), line: open.line });
      }
      open = null;
      continue;
    }
    open.content.push(line);
  }
  if (open !== null) {
    throw new Error(`围栏代码块未闭合（起始行 ${open.line}）`);
  }
  return blocks;
}

/** 按前缀提取「键：值」行；未找到返回 undefined。 */
export function findLabelledLine(text: string, label: string): string | undefined {
  for (const rawLine of text.split('\n')) {
    const line = collapse(rawLine);
    if (line.startsWith(`${label}：`)) {
      return line.slice(label.length + 1).trim();
    }
  }
  return undefined;
}
