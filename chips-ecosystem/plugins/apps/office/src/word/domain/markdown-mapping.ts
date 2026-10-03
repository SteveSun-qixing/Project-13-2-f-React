/**
 * word 域 Markdown 编辑表示映射（域模型 ↔ Markdown 源文）。
 *
 * 编辑面统一 Milkdown（用户裁决 2026-10-01 第 3 项；清单 §2.14 同源边界第 1 条）：
 * 编辑态以 Markdown 源文为唯一编辑表示，本模块承担 域模型 → Markdown（装载基线）
 * 与 Markdown → 域模型（编辑回流再入域模型）的双向映射，形态与 Milkdown 的
 * commonmark + GFM 方言同源（`*` 列表、GFM 表格、双波浪删除线、内联 HTML 保真）。
 *
 * 保真边界（映射侧显式收口，编辑器外直连网关的往返不受影响）：
 * - GFM 无正文段对齐面：居中/右对齐段经内联 HTML 形态 `<p style="text-align: …">`
 *   承载（Milkdown 内建 html schema 原文保真），左对齐/两端对齐为默认形态不标注；
 * - GFM 无标题样式细分：Title 文档标题段映射为一级标题（回读按 Heading1 落样式）；
 * - Markdown 无编号定义面：列表 numId 经往返归一为列表组序号（种别/层级/文本保真）。
 */

import type {
  WordAlignment,
  WordBlock,
  WordDocument,
  WordListKind,
  WordMarkKind,
  WordRun,
} from './document-model';
import { createEmptyWordDocument, type WordTableCell } from './document-model';
import {
  alignmentFromJc,
  CODE_STYLE_ID,
  headingStyleIdFromLevel,
  LIST_STYLE_ID,
  QUOTE_STYLE_ID,
  semanticStyleFromStyleId,
} from './style-mapping';

/** Markdown 特殊字符转义（含行首义与容器义的最小封闭集，反斜杠最先；表格竖线随行）。 */
const MARKDOWN_ESCAPE_RE = /[\\`*_[\]<>~#|]/g;

/** 正文段对齐的编辑表示形态（GFM 无正文对齐面的内联 HTML 承载）。 */
const ALIGNED_PARAGRAPH_RE = /^<p style="text-align: (center|right)">(.*)<\/p>$/;

/** 转义 Markdown 特殊字符。 */
function escapeMarkdownText(text: string): string {
  return text.replace(MARKDOWN_ESCAPE_RE, (char) => `\\${char}`);
}

/** 还原 Markdown 转义（与转义集对偶）。 */
function unescapeMarkdownText(text: string): string {
  return text.replace(/\\([\\`*_[\]<>~#|])/g, '$1');
}

/** 转义表格单元格文本（竖线会破坏 GFM 单元格结构；与全集转义对偶，独立成函数保形）。 */
function escapeTableCellText(text: string): string {
  return escapeMarkdownText(text);
}

/** run 序列 → 行内 Markdown（链接/行内代码优先承载，标记嵌套序：粗体 > 斜体 > 删除线）。 */
function runsToInlineMarkdown(runs: readonly WordRun[], cellContext: boolean): string {
  let markdown = '';
  for (const wordRun of runs) {
    // 行内代码为字面承载（code span 内转义序列不还原，与 Milkdown/remark 出料同源）。
    if (wordRun.href === null && wordRun.marks.includes('code')) {
      markdown += `\`${wordRun.text}\``;
      continue;
    }
    const text = cellContext ? escapeTableCellText(wordRun.text) : escapeMarkdownText(wordRun.text);
    let marked = text;
    if (wordRun.marks.includes('strike')) {
      marked = `~~${marked}~~`;
    }
    if (wordRun.marks.includes('italic')) {
      marked = `*${marked}*`;
    }
    if (wordRun.marks.includes('bold')) {
      marked = `**${marked}**`;
    }
    if (wordRun.href !== null) {
      markdown += `[${marked}](${wordRun.href})`;
    } else if (wordRun.marks.includes('underline')) {
      markdown += `<u>${marked}</u>`;
    } else {
      markdown += marked;
    }
  }
  return markdown;
}

/** 行内标记解析结果累积器。 */
interface InlineParseState {
  readonly runs: WordRun[];
}

/** 向累积器追加一段纯文本 run（相邻同标记合并，保持 run 粒度与编辑面一致）。 */
function appendRun(state: InlineParseState, text: string, marks: readonly WordMarkKind[], href: string | null): void {
  if (text.length === 0) {
    return;
  }
  const last = state.runs[state.runs.length - 1];
  if (
    last !== undefined &&
    last.href === href &&
    last.marks.length === marks.length &&
    last.marks.every((mark, index) => marks[index] === mark)
  ) {
    state.runs[state.runs.length - 1] = { text: last.text + text, marks: last.marks, href: last.href };
    return;
  }
  state.runs.push({ text, marks: [...marks], href });
}

/** 强调标记层级（解析优先序：粗体+斜体 > 粗体 > 斜体 > 删除线）。 */
function emphasisRuns(state: InlineParseState, segment: string, marks: readonly WordMarkKind[], href: string | null): void {
  const composite = /\*\*\*([^*]+)\*\*\*/;
  const bold = /\*\*([^*]+)\*\*/;
  const italic = /\*([^*]+)\*/;
  const strike = /~~([^~]+)~~/;
  let match: RegExpExecArray | null;
  if ((match = composite.exec(segment)) !== null) {
    emphasisRuns(state, segment.slice(0, match.index), marks, href);
    emphasisRuns(state, match[1] ?? '', [...marks, 'bold', 'italic'], href);
    emphasisRuns(state, segment.slice(match.index + match[0].length), marks, href);
    return;
  }
  if ((match = bold.exec(segment)) !== null) {
    emphasisRuns(state, segment.slice(0, match.index), marks, href);
    emphasisRuns(state, match[1] ?? '', [...marks, 'bold'], href);
    emphasisRuns(state, segment.slice(match.index + match[0].length), marks, href);
    return;
  }
  if ((match = italic.exec(segment)) !== null) {
    emphasisRuns(state, segment.slice(0, match.index), marks, href);
    emphasisRuns(state, match[1] ?? '', [...marks, 'italic'], href);
    emphasisRuns(state, segment.slice(match.index + match[0].length), marks, href);
    return;
  }
  if ((match = strike.exec(segment)) !== null) {
    emphasisRuns(state, segment.slice(0, match.index), marks, href);
    emphasisRuns(state, match[1] ?? '', [...marks, 'strike'], href);
    emphasisRuns(state, segment.slice(match.index + match[0].length), marks, href);
    return;
  }
  appendRun(state, unescapeMarkdownText(segment), marks, href);
}

/** 行内 Markdown → run 序列（链接 → 行内代码 → 下划线 HTML → 强调 → 还原转义）。 */
function parseInlineMarkdown(inline: string): WordRun[] {
  const state: InlineParseState = { runs: [] };
  const link = /\[([^\]]+)\]\(([^)]+)\)/;
  const codeSpan = /`([^`]+)`/;
  const underlineHtml = /<u>([^<]*)<\/u>/;
  let rest = inline;
  while (rest.length > 0) {
    const linkMatch = link.exec(rest);
    const codeMatch = codeSpan.exec(rest);
    const underlineMatch = underlineHtml.exec(rest);
    const candidates = [linkMatch, codeMatch, underlineMatch].filter(
      (candidate): candidate is RegExpExecArray => candidate !== null,
    );
    if (candidates.length === 0) {
      emphasisRuns(state, rest, [], null);
      break;
    }
    const first = candidates.reduce((acc, candidate) => (candidate.index < acc.index ? candidate : acc));
    emphasisRuns(state, rest.slice(0, first.index), [], null);
    if (first === linkMatch) {
      emphasisRuns(state, first[1] ?? '', ['underline'], first[2] ?? '');
    } else if (first === codeMatch) {
      appendRun(state, first[1] ?? '', ['code'], null);
    } else {
      emphasisRuns(state, first[1] ?? '', ['underline'], null);
    }
    rest = rest.slice(first.index + first[0].length);
  }
  return state.runs;
}

/** 表格单元格 → GFM 单元格文本。 */
function cellToMarkdown(cell: WordTableCell): string {
  return runsToInlineMarkdown(cell.runs, true);
}

/** GFM 分隔行单元（`:---` / `---:` / ` --- `）。 */
function tableDelimiterCell(alignment: WordAlignment): string {
  if (alignment === 'left') {
    return ':---';
  }
  if (alignment === 'right') {
    return '---:';
  }
  if (alignment === 'center') {
    return ':---:';
  }
  return '---';
}

/** 列表项前缀（层级缩进两个空格；有序组内序号由组计数器给出）。 */
function listItemPrefix(kind: WordListKind, level: number, ordinal: number): string {
  const indent = '  '.repeat(level);
  return kind === 'bullet' ? `${indent}- ` : `${indent}${ordinal}. `;
}

/** 域模型 → Markdown 源文（Milkdown 装载基线；末尾无换行）。 */
export function documentToMarkdown(document: WordDocument): string {
  const lines: string[] = [];
  let codeRun: string[] = [];
  const flushCodeRun = (): void => {
    if (codeRun.length > 0) {
      lines.push(['```', ...codeRun, '```'].join('\n'));
      codeRun = [];
    }
  };
  type ListGroup = { kind: WordListKind; items: string[] };
  let listGroup: ListGroup | null = null;
  const flushListGroup = (): void => {
    if (listGroup !== null) {
      lines.push(listGroup.items.join('\n'));
      listGroup = null;
    }
  };

  for (const block of document.blocks) {
    if (block.kind === 'paragraph' && block.styleId === CODE_STYLE_ID) {
      flushListGroup();
      // 围栏代码为字面承载（fenced code 内转义序列不还原），按原文直出。
      codeRun.push(block.runs.map((codeRunText) => codeRunText.text).join(''));
      continue;
    }
    flushCodeRun();
    if (block.kind === 'heading') {
      flushListGroup();
      lines.push(`${'#'.repeat(block.level)} ${runsToInlineMarkdown(block.runs, false)}`);
      continue;
    }
    if (block.kind === 'listItem') {
      const group = listGroup;
      if (group === null || group.kind !== block.list.kind) {
        flushListGroup();
        listGroup = { kind: block.list.kind, items: [] };
      }
      const current = listGroup;
      if (current !== null) {
        const ordinal = current.kind === 'ordered' ? current.items.length + 1 : 0;
        current.items.push(
          `${listItemPrefix(block.list.kind, block.list.level, ordinal)}${runsToInlineMarkdown(block.runs, false)}`,
        );
      }
      continue;
    }
    flushListGroup();
    if (block.kind === 'table') {
      const firstRow = block.rows[0];
      if (firstRow === undefined) {
        continue;
      }
      const renderRow = (cells: readonly WordTableCell[]): string =>
        `| ${cells.map(cellToMarkdown).join(' | ')} |`;
      const headerLines = [renderRow(firstRow.cells)];
      if (firstRow.header) {
        headerLines.push(`| ${firstRow.cells.map((cell) => tableDelimiterCell(cell.alignment)).join(' | ')} |`);
      } else {
        headerLines.push(`| ${firstRow.cells.map(() => tableDelimiterCell(null)).join(' | ')} |`);
      }
      lines.push([...headerLines, ...block.rows.slice(1).map((row) => renderRow(row.cells))].join('\n'));
      continue;
    }
    // 正文段：文档标题样式按一级标题承载（GFM 无标题样式细分，收窄口径见头注）；
    // 引用样式按块引用行承载；显式居中/右对齐经内联 HTML 形态承载。
    const inline = runsToInlineMarkdown(block.runs, false);
    if (block.styleId !== null && semanticStyleFromStyleId(block.styleId) === 'title') {
      lines.push(`# ${inline}`);
      continue;
    }
    if (block.styleId === QUOTE_STYLE_ID) {
      lines.push(`> ${inline}`);
      continue;
    }
    if ((block.alignment === 'center' || block.alignment === 'right') && block.styleId !== CODE_STYLE_ID) {
      lines.push(`<p style="text-align: ${block.alignment}">${inline}</p>`);
      continue;
    }
    lines.push(inline);
  }
  flushCodeRun();
  flushListGroup();
  return lines.join('\n\n').replace(/\n+$/g, '');
}

/** Markdown 源文 → 域模型（编辑回流再入域模型；空源文归空文档）。 */
export function markdownToDocument(markdown: string): WordDocument {
  if (markdown.trim().length === 0) {
    return createEmptyWordDocument();
  }
  const blocks: WordBlock[] = [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');

  let codeLines: string[] | null = null;
  type ParsedList = { kind: WordListKind; numId: number };
  let currentList: ParsedList | null = null;
  let numIdCounter = 0;

  const flushCode = (): void => {
    if (codeLines !== null) {
      for (const codeLine of codeLines) {
        blocks.push({ kind: 'paragraph', styleId: CODE_STYLE_ID, alignment: null, runs: [{ text: codeLine, marks: [], href: null }] });
      }
      codeLines = null;
    }
  };
  const endList = (): void => {
    currentList = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fence = /^\s*(```|~~~)/.exec(line);
    if (codeLines !== null) {
      if (fence !== null) {
        flushCode();
      } else {
        codeLines.push(line);
      }
      continue;
    }
    if (fence !== null) {
      endList();
      codeLines = [];
      continue;
    }
    if (line.trim().length === 0) {
      endList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      endList();
      const level = (heading[1]?.length ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({
        kind: 'heading',
        level,
        styleId: headingStyleIdFromLevel(level),
        alignment: null,
        runs: parseInlineMarkdown(heading[2] ?? ''),
      });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote !== null) {
      endList();
      blocks.push({ kind: 'paragraph', styleId: QUOTE_STYLE_ID, alignment: null, runs: parseInlineMarkdown(quote[1] ?? '') });
      continue;
    }
    const listItem = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (listItem !== null) {
      const kind: WordListKind = listItem[2] !== undefined && /\d+\./.test(listItem[2]) ? 'ordered' : 'bullet';
      if (currentList === null || currentList.kind !== kind) {
        numIdCounter += 1;
        currentList = { kind, numId: numIdCounter };
      }
      const level = Math.floor((listItem[1]?.length ?? 0) / 2);
      blocks.push({
        kind: 'listItem',
        styleId: LIST_STYLE_ID,
        alignment: null,
        list: { kind, numId: currentList.numId, level },
        runs: parseInlineMarkdown(listItem[3] ?? ''),
      });
      continue;
    }
    const tableRow = /^\|(.+)\|\s*$/.exec(line);
    if (tableRow !== null) {
      endList();
      const parseCells = (rowLine: string): string[] =>
        rowLine
          .split(/(?<!\\)\|/)
          .map((cell) => cell.trim())
          .filter((cell, cellIndex, all) => !(cell.length === 0 && (cellIndex === 0 || cellIndex === all.length - 1)));
      const delimiter = /^\|[\s:|-]+\|\s*$/.test(line);
      if (delimiter) {
        continue;
      }
      const nextLine = lines[index + 1];
      const hasDelimiter = nextLine !== undefined && /^\|[\s:|-]+\|\s*$/.test(nextLine);
      if (!hasDelimiter) {
        blocks.push({ kind: 'paragraph', styleId: null, alignment: null, runs: parseInlineMarkdown(line) });
        continue;
      }
      const headerTexts = parseCells(tableRow[1] ?? '');
      const delimiterTexts = parseCells(nextLine ?? '');
      const headerCells: WordTableCell[] = headerTexts.map((text, cellIndex) => ({
        alignment: alignmentFromJc(delimiterAlignment(delimiterTexts[cellIndex] ?? '')),
        runs: parseInlineMarkdown(text),
      }));
      const rows = [{ header: true, cells: headerCells }];
      let cursor = index + 2;
      while (cursor < lines.length) {
        const bodyLine = lines[cursor] ?? '';
        const bodyMatch = /^\|(.+)\|\s*$/.exec(bodyLine);
        if (bodyMatch === null || /^\|[\s:|-]+\|\s*$/.test(bodyLine)) {
          break;
        }
        const bodyTexts = parseCells(bodyMatch[1] ?? '');
        rows.push({
          header: false,
          cells: bodyTexts.map((text) => ({ alignment: null, runs: parseInlineMarkdown(text) })),
        });
        cursor += 1;
      }
      blocks.push({ kind: 'table', rows, columnWidthsTwips: null });
      index = cursor - 1;
      continue;
    }
    const aligned = ALIGNED_PARAGRAPH_RE.exec(line);
    if (aligned !== null) {
      endList();
      blocks.push({
        kind: 'paragraph',
        styleId: null,
        alignment: aligned[1] === 'center' ? 'center' : 'right',
        runs: parseInlineMarkdown(aligned[2] ?? ''),
      });
      continue;
    }
    endList();
    blocks.push({ kind: 'paragraph', styleId: null, alignment: null, runs: parseInlineMarkdown(line) });
  }
  flushCode();
  return { blocks, section: null };
}

/** GFM 分隔单元 → w:jc 对齐值（供 alignmentFromJc 判读）。 */
function delimiterAlignment(delimiterCell: string): string | null {
  if (delimiterCell === ':---') {
    return 'left';
  }
  if (delimiterCell === '---:') {
    return 'right';
  }
  if (delimiterCell === ':---:') {
    return 'center';
  }
  return null;
}
