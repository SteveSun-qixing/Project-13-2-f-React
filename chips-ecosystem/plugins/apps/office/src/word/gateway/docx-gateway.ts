/**
 * docx 字节级网关（OOXML WordprocessingML 读写出入口；jszip 容器面已登记依赖）。
 *
 * 旧仓 word 域经 vendor docx-engine 承载 docx 解析（冻结不迁，RA-04 逐子包处置）；
 * 本网关按 sheet 域 xlsx-gateway 同形制自研：正则级 WordprocessingML 解析/序列化 +
 * jszip 容器装配，Buffer 进 Buffer 出（零 Node IO，文件编排归会话保存链）。
 *
 * 承载面（与真实最小 docx 夹具同规）：
 * - 段落系：pStyle 直通、jc 对齐、numPr 编号（numbering.xml numFmt 折叠种别）、
 *   run 级 b/i/strike/u/rFonts(等宽→code)/rStyle(Hyperlink)、w:hyperlink（rels 外链解析）、
 *   w:t 转义文本 / w:tab / w:br、空段保位；
 * - 表格：tblGrid 列宽、tblHeader 表头行、单元格段落与对齐；
 * - 节设置：pgSz / pgMar（twips）。
 * 未承载面（读入按空白样式直通保真，不猜语义）：图片/文本框/脚注尾注/批注/校订/域。
 */

import JSZip from 'jszip'

import type {
  WordAlignment,
  WordBlock,
  WordDocument,
  WordListItemBlock,
  WordMarkKind,
  WordRun,
  WordSection,
  WordTableCell,
  WordTableRow,
} from '../domain/document-model'
import { alignmentFromJc, headingLevelFromStyleId, jcFromAlignment, listKindFromNumFmt } from '../domain/style-mapping'

/** 夹具与写出包共用的固定 zip 时间戳（确定性序列化，字节级可复现）。 */
const PACKAGE_DATE = new Date(Date.UTC(2026, 9, 1, 0, 0, 0))

/** 文档主命名空间前缀（WordprocessingML 主 namespace 绑定 w）。 */
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** 关系命名空间前缀（Office 关系绑定 r）。 */
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** XML 文本转义。 */
function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** XML 属性转义。 */
function escapeXmlAttribute(text: string): string {
  return escapeXmlText(text).replace(/"/g, '&quot;');
}

/** 读取元素首个属性值（未命中返回 null）。 */
function readAttr(xml: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(xml);
  return match ? decodeXmlEntities(match[1] ?? '') : null;
}

/** 解码 XML 实体（属性/文本公共面）。 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 顶部级段落/表格 XML 片段。 */
interface BodyFragment {
  readonly kind: 'paragraph' | 'table';
  readonly xml: string;
}

/**
 * 正文块扫描器：按文档序抽取顶层 w:p / w:tbl 片段（表格整体消费，内部段落不重复出块）。
 * 标签边界严判：`<w:p` 与 `<w:pPr`/`<w:pgSz` 等同前缀元素、`<w:tbl` 与 `<w:tblPr` 等区分。
 */
function scanBodyFragments(bodyXml: string): BodyFragment[] {
  const fragments: BodyFragment[] = [];
  let cursor = 0;
  while (cursor < bodyXml.length) {
    const paragraphIndex = indexOfTag(bodyXml, cursor, 'w:p');
    const tableIndex = indexOfTag(bodyXml, cursor, 'w:tbl');
    if (paragraphIndex === -1 && tableIndex === -1) {
      break;
    }
    if (tableIndex !== -1 && (paragraphIndex === -1 || tableIndex < paragraphIndex)) {
      const end = findMatchingTableEnd(bodyXml, tableIndex);
      if (end === -1) {
        break;
      }
      fragments.push({ kind: 'table', xml: bodyXml.slice(tableIndex, end) });
      cursor = end;
      continue;
    }
    const start = paragraphIndex;
    const tagEnd = bodyXml.indexOf('>', start);
    if (tagEnd === -1) {
      break;
    }
    const openTag = bodyXml.slice(start, tagEnd + 1);
    if (openTag.endsWith('/>')) {
      fragments.push({ kind: 'paragraph', xml: openTag });
      cursor = tagEnd + 1;
      continue;
    }
    const close = bodyXml.indexOf('</w:p>', tagEnd);
    if (close === -1) {
      break;
    }
    fragments.push({ kind: 'paragraph', xml: bodyXml.slice(start, close + '</w:p>'.length) });
    cursor = close + '</w:p>'.length;
  }
  return fragments;
}

/** 标签名边界检索：命中 `<tag` 且后随空白、`>` 或自闭合 `/` 的首处（无命中返回 -1）。 */
function indexOfTag(xml: string, from: number, tag: string): number {
  let index = xml.indexOf(`<${tag}`, from);
  while (index !== -1) {
    const next = xml.charAt(index + 1 + tag.length);
    if (next === '' || /\s/.test(next) || next === '>' || next === '/') {
      return index;
    }
    index = xml.indexOf(`<${tag}`, index + 1);
  }
  return -1;
}

/** 表格闭合定位（嵌套表格深度计数；未闭合返回 -1）。 */
function findMatchingTableEnd(xml: string, start: number): number {
  const token = /<w:tbl[\s>]|<\/w:tbl>/g;
  token.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(xml)) !== null) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      return match.index + match[0].length;
    }
  }
  return -1;
}

/** OOXML 布尔属性判读（w:val="false|0|off" 为假，缺省为真）。 */
function isFlagOn(elementXml: string, flag: string): boolean {
  const match = new RegExp(`<w:${flag}(\\s[^>]*)?/>`).exec(elementXml);
  if (!match) {
    return false;
  }
  const raw = match[1];
  if (raw === undefined) {
    return true;
  }
  const val = /w:val="([^"]*)"/.exec(raw)?.[1];
  return !(val === 'false' || val === '0' || val === 'off');
}

/** run 的 rPr 片段抽取（无 rPr 返回空串）。 */
function readRunProperties(runXml: string): string {
  return /<w:rPr(?:\s[^>]*)?>([\s\S]*?)<\/w:rPr>/.exec(runXml)?.[1] ?? '';
}

/** 等宽字体判定（rFonts ascii/hAnsi 面向 Courier/Consolas/Mono 系）。 */
function isMonoFontFace(rPr: string): boolean {
  const fonts = readAttr(rPr, 'w:ascii') ?? readAttr(rPr, 'w:hAnsi');
  return fonts !== null && /courier|consolas|mono/i.test(fonts);
}

/** 标记追加入栈（同一标记去重，write→read 双通道来源不叠加）。 */
function pushMark(marks: WordMarkKind[], mark: WordMarkKind): void {
  if (!marks.includes(mark)) {
    marks.push(mark);
  }
}

/** run XML → 域 run（文本收集 tab/br，标记判读，超链接由外层注入）。 */
function parseRun(runXml: string, href: string | null): WordRun {
  const rPr = readRunProperties(runXml);
  const marks: WordMarkKind[] = [];
  if (isFlagOn(rPr, 'b')) {
    pushMark(marks, 'bold');
  }
  if (isFlagOn(rPr, 'i')) {
    pushMark(marks, 'italic');
  }
  if (isFlagOn(rPr, 'strike')) {
    pushMark(marks, 'strike');
  }
  if (/<w:u(?:\s[^>]*)?\/>/.test(rPr) && !/<w:u[^>]*w:val="(?:none|false|0)"/.test(rPr)) {
    pushMark(marks, 'underline');
  }
  if (/<w:rStyle(?:\s[^>]*)?\/>/.test(rPr) && readAttr(rPr, 'w:val') === 'Hyperlink') {
    pushMark(marks, 'underline');
  }
  if (isMonoFontFace(rPr)) {
    pushMark(marks, 'code');
  }
  let text = '';
  for (const textMatch of runXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
    text += decodeXmlEntities(textMatch[1] ?? '');
  }
  if (/<w:tab(?:\s[^>]*)?\/>/.test(runXml)) {
    text += '\t';
  }
  if (/<w:br(?:\s[^>]*)?\/>/.test(runXml)) {
    text += '\n';
  }
  return { text, marks, href };
}

/** 关系表：rId → 外链目标。 */
function parseExternalRelationships(relsXml: string): Map<string, string> {
  const targets = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const xml = match[0];
    const id = readAttr(xml, 'Id');
    if (id !== null && /TargetMode="External"/.test(xml)) {
      targets.set(id, readAttr(xml, 'Target') ?? '');
    }
  }
  return targets;
}

/** 段落 XML → 段落形状（样式/对齐/编号/runs）。 */
interface ParsedParagraph {
  readonly styleId: string | null;
  readonly alignment: WordAlignment;
  readonly numId: number | null;
  readonly level: number;
  readonly runs: readonly WordRun[];
}

/** 段落 XML 判读（rels 供超链接解析）。 */
function parseParagraph(paragraphXml: string, relationships: Map<string, string>): ParsedParagraph {
  const pPr = /<w:pPr(?:\s[^>]*)?>([\s\S]*?)<\/w:pPr>/.exec(paragraphXml)?.[1] ?? '';
  const styleId = readAttr(/<w:pStyle(?:\s[^>]*)?\/>/.exec(pPr)?.[0] ?? '', 'w:val');
  const alignment = alignmentFromJc(readAttr(/<w:jc(?:\s[^>]*)?\/>/.exec(pPr)?.[0] ?? '', 'w:val'));
  const numPrXml = /<w:numPr(?:\s[^>]*)?>([\s\S]*?)<\/w:numPr>/.exec(pPr)?.[1] ?? '';
  const numIdRaw = readAttr(/<w:numId(?:\s[^>]*)?\/>/.exec(numPrXml)?.[0] ?? '', 'w:val');
  const levelRaw = readAttr(/<w:ilvl(?:\s[^>]*)?\/>/.exec(numPrXml)?.[0] ?? '', 'w:val');
  const numId = numIdRaw === null || numIdRaw === '0' ? null : Number(numIdRaw);

  const runs: WordRun[] = [];
  let cursor = 0;
  const hyperlink = /<w:hyperlink(?:\s[^>]*)?>[\s\S]*?<\/w:hyperlink>/g;
  hyperlink.lastIndex = 0;
  let hyperlinkMatch: RegExpExecArray | null;
  while ((hyperlinkMatch = hyperlink.exec(paragraphXml)) !== null) {
    emitPlainRuns(runs, paragraphXml.slice(cursor, hyperlinkMatch.index));
    const hyperlinkXml = hyperlinkMatch[0];
    const relationshipId = readAttr(hyperlinkXml, 'r:id');
    const href = relationshipId !== null ? (relationships.get(relationshipId) ?? null) : null;
    for (const runMatch of hyperlinkXml.matchAll(/<w:r\b[^>]*(?:\/>|>[\s\S]*?<\/w:r>)/g)) {
      runs.push(parseRun(runMatch[0], href));
    }
    cursor = hyperlinkMatch.index + hyperlinkXml.length;
  }
  emitPlainRuns(runs, paragraphXml.slice(cursor));
  return {
    styleId,
    alignment,
    numId,
    level: levelRaw === null ? 0 : Number(levelRaw),
    runs,
  };
}

/** 非超链接区段的普通 run 收集。 */
function emitPlainRuns(runs: WordRun[], segment: string): void {
  for (const runMatch of segment.matchAll(/<w:r\b[^>]*(?:\/>|>[\s\S]*?<\/w:r>)/g)) {
    runs.push(parseRun(runMatch[0], null));
  }
}

/** numbering.xml 判读：numId → 层级格式表。 */
function parseNumberingFormats(numberingXml: string): Map<number, Map<number, string>> {
  const formats = new Map<number, Map<number, string>>();
  const abstracts = new Map<string, Map<number, string>>();
  for (const match of numberingXml.matchAll(/<w:abstractNum\b[^>]*>[\s\S]*?<\/w:abstractNum>/g)) {
    const abstractXml = match[0];
    const abstractId = readAttr(/<w:abstractNum\b[^>]*>/.exec(abstractXml)?.[0] ?? '', 'w:abstractNumId');
    if (abstractId === null) {
      continue;
    }
    const levels = new Map<number, string>();
    for (const lvlMatch of abstractXml.matchAll(/<w:lvl\b[^>]*>[\s\S]*?<\/w:lvl>/g)) {
      const lvlXml = lvlMatch[0];
      const ilvl = Number(readAttr(/<w:lvl\b[^>]*>/.exec(lvlXml)?.[0] ?? '', 'w:ilvl') ?? '0');
      const numFmt = readAttr(/<w:numFmt(?:\s[^>]*)?\/>/.exec(lvlXml)?.[0] ?? '', 'w:val');
      if (numFmt !== null) {
        levels.set(ilvl, numFmt);
      }
    }
    abstracts.set(abstractId, levels);
  }
  for (const match of numberingXml.matchAll(/<w:num\b[^>]*>[\s\S]*?<\/w:num>/g)) {
    const numXml = match[0];
    const numId = Number(readAttr(/<w:num\b[^>]*>/.exec(numXml)?.[0] ?? '', 'w:numId') ?? 'NaN');
    const abstractId = readAttr(/<w:abstractNumId(?:\s[^>]*)?\/>/.exec(numXml)?.[0] ?? '', 'w:val');
    if (Number.isFinite(numId) && abstractId !== null) {
      const levels = abstracts.get(abstractId);
      if (levels !== undefined) {
        formats.set(numId, levels);
      }
    }
  }
  return formats;
}

/** 单元格 XML → 域单元格（首段落判读）。 */
function parseTableCell(cellXml: string, relationships: Map<string, string>): WordTableCell {
  const fragment = scanBodyFragments(cellXml).find((item) => item.kind === 'paragraph');
  const paragraph = fragment !== undefined ? parseParagraph(fragment.xml, relationships) : null;
  return {
    alignment: paragraph?.alignment ?? null,
    runs: paragraph?.runs ?? [],
  };
}

/** 表格 XML → 域表格块（tblGrid 列宽 + 行序 + 表头行）。 */
function parseTable(tableXml: string, relationships: Map<string, string>): WordBlock {
  const gridTexts = [...tableXml.matchAll(/<w:gridCol(?:\s[^>]*)?\/>/g)].map((gridMatch) =>
    Number(readAttr(gridMatch[0], 'w:w') ?? '0'),
  );
  const rows: WordTableRow[] = [];
  for (const rowMatch of tableXml.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)) {
    const rowXml = rowMatch[0];
    const cells: WordTableCell[] = [];
    for (const cellMatch of rowXml.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)) {
      cells.push(parseTableCell(cellMatch[0], relationships));
    }
    rows.push({ header: /<w:tblHeader(?:\s[^>]*)?\/>/.test(rowXml), cells });
  }
  return {
    kind: 'table',
    rows,
    columnWidthsTwips: gridTexts.every((width) => Number.isFinite(width) && width > 0) ? gridTexts : null,
  };
}

/** 节设置判读（sectPr 的 pgSz/pgMar）。 */
function parseSection(sectionXml: string): WordSection | null {
  const pageSize = /<w:pgSz(?:\s[^>]*)?\/>/.exec(sectionXml)?.[0];
  const pageMargin = /<w:pgMar(?:\s[^>]*)?\/>/.exec(sectionXml)?.[0];
  if (pageSize === undefined || pageMargin === undefined) {
    return null;
  }
  const width = Number(readAttr(pageSize, 'w:w'));
  const height = Number(readAttr(pageSize, 'w:h'));
  const top = Number(readAttr(pageMargin, 'w:top'));
  const right = Number(readAttr(pageMargin, 'w:right'));
  const bottom = Number(readAttr(pageMargin, 'w:bottom'));
  const left = Number(readAttr(pageMargin, 'w:left'));
  if ([width, height, top, right, bottom, left].some((value) => !Number.isFinite(value))) {
    return null;
  }
  return {
    pageWidthTwips: width,
    pageHeightTwips: height,
    marginTopTwips: top,
    marginRightTwips: right,
    marginBottomTwips: bottom,
    marginLeftTwips: left,
  };
}

/** docx 字节 → 域文档（缺失 document 部件即抛错，调用面归一为导入失败）。 */
export async function readWordDocument(bytes: Buffer | Uint8Array): Promise<WordDocument> {
  const zip = await JSZip.loadAsync(bytes);
  const documentFile = zip.file('word/document.xml');
  if (documentFile === null) {
    throw new Error('docx 缺少 word/document.xml 部件');
  }
  const documentXml = await documentFile.async('text');
  const bodyMatch = /<w:body(?:\s[^>]*)?>([\s\S]*)<\/w:body>/.exec(documentXml);
  if (!bodyMatch) {
    throw new Error('docx 缺少 w:body 正文容器');
  }
  const bodyXml = bodyMatch[1] ?? '';

  const relsFile = zip.file('word/_rels/document.xml.rels');
  const relationships = parseExternalRelationships(relsFile !== null ? await relsFile.async('text') : '');
  const numberingFile = zip.file('word/numbering.xml');
  const numberingFormats = parseNumberingFormats(
    numberingFile !== null ? await numberingFile.async('text') : '',
  );

  const blocks: WordBlock[] = [];
  for (const fragment of scanBodyFragments(bodyXml)) {
    if (fragment.kind === 'table') {
      blocks.push(parseTable(fragment.xml, relationships));
      continue;
    }
    const paragraph = parseParagraph(fragment.xml, relationships);
    if (paragraph.numId !== null) {
      const kind = listKindFromNumFmt(numberingFormats.get(paragraph.numId)?.get(paragraph.level) ?? 'bullet');
      blocks.push({
        kind: 'listItem',
        styleId: paragraph.styleId,
        alignment: paragraph.alignment,
        list: { kind, numId: paragraph.numId, level: paragraph.level },
        runs: paragraph.runs,
      });
      continue;
    }
    const headingLevel = headingLevelFromStyleId(paragraph.styleId);
    if (headingLevel !== null) {
      blocks.push({
        kind: 'heading',
        level: headingLevel,
        styleId: paragraph.styleId,
        alignment: paragraph.alignment,
        runs: paragraph.runs,
      });
      continue;
    }
    blocks.push({
      kind: 'paragraph',
      styleId: paragraph.styleId,
      alignment: paragraph.alignment,
      runs: paragraph.runs,
    });
  }

  const sectionMatch = /<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>|<w:sectPr(?:\s[^>]*)?\/>/.exec(bodyXml);
  return {
    blocks: blocks.length > 0 ? blocks : [{ kind: 'paragraph', styleId: null, alignment: null, runs: [] }],
    section: sectionMatch ? parseSection(sectionMatch[0]) : null,
  };
}

// ── 写出侧 ───────────────────────────────────────────────────────────────────

/** 域 run → w:r XML（超链接 run 由段落层包 w:hyperlink；此处产出 run 本体）。 */
function runToXml(run: WordRun): string {
  const properties: string[] = [];
  if (run.href !== null) {
    properties.push('<w:rStyle w:val="Hyperlink"/>');
  }
  if (run.marks.includes('bold')) {
    properties.push('<w:b/>');
  }
  if (run.marks.includes('italic')) {
    properties.push('<w:i/>');
  }
  if (run.marks.includes('strike')) {
    properties.push('<w:strike/>');
  }
  if (run.marks.includes('underline')) {
    properties.push('<w:u w:val="single"/>');
  }
  if (run.marks.includes('code')) {
    properties.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>');
  }
  const rPr = properties.length > 0 ? `<w:rPr>${properties.join('')}</w:rPr>` : '';
  const text = escapeXmlText(run.text);
  return `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

/** 段落属性（pStyle/jc/numPr 按需）。 */
function paragraphPropertiesXml(styleId: string | null, alignment: WordAlignment, listItem: WordListItemBlock | null): string {
  const properties: string[] = [];
  if (styleId !== null) {
    properties.push(`<w:pStyle w:val="${escapeXmlAttribute(styleId)}"/>`);
  }
  if (listItem !== null) {
    properties.push(
      `<w:numPr><w:ilvl w:val="${listItem.list.level}"/><w:numId w:val="${listItem.list.numId}"/></w:numPr>`,
    );
  }
  const jc = jcFromAlignment(alignment);
  if (jc !== null) {
    properties.push(`<w:jc w:val="${jc}"/>`);
  }
  return properties.length > 0 ? `<w:pPr>${properties.join('')}</w:pPr>` : '';
}

/** run 序列 → 段落内容 XML（超链接 run 归组包 w:hyperlink，rId 由关系分配器给出）。 */
function runsToXml(runs: readonly WordRun[], assignRelationship: (href: string) => string): string {
  let xml = '';
  let index = 0;
  while (index < runs.length) {
    const run = runs[index];
    if (run === undefined) {
      break;
    }
    if (run.href === null) {
      xml += runToXml(run);
      index += 1;
      continue;
    }
    let groupEnd = index;
    while (groupEnd < runs.length && runs[groupEnd]?.href === run.href) {
      groupEnd += 1;
    }
    const groupRuns = runs.slice(index, groupEnd).map((linkedRun) => runToXml(linkedRun));
    xml += `<w:hyperlink r:id="${assignRelationship(run.href)}">${groupRuns.join('')}</w:hyperlink>`;
    index = groupEnd;
  }
  return xml;
}

/** 单元格 → w:tc XML。 */
function cellToXml(cell: WordTableCell, columnWidthTwips: number, assignRelationship: (href: string) => string): string {
  const paragraphXml = `<w:p>${paragraphPropertiesXml(null, cell.alignment, null)}${runsToXml(cell.runs, assignRelationship)}</w:p>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${columnWidthTwips}" w:type="dxa"/></w:tcPr>${paragraphXml}</w:tc>`;
}

/** 表格 → w:tbl XML（列宽缺省按首行规模取夹具标称列宽）。 */
function tableToXml(block: WordBlock, assignRelationship: (href: string) => string): string {
  if (block.kind !== 'table') {
    throw new Error('表格序列化入参须为表格块');
  }
  const columnCount = Math.max(1, ...block.rows.map((row) => row.cells.length));
  const widths =
    block.columnWidthsTwips !== null && block.columnWidthsTwips.length === columnCount
      ? block.columnWidthsTwips
      : Array.from({ length: columnCount }, () => 4680);
  const borders =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:color="auto"/>`)
      .join('') +
    '</w:tblBorders>';
  const grid = `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>`;
  const rows = block.rows
    .map((row) => {
      const rowProperties = row.header ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
      const cells = row.cells
        .map((cell, cellIndex) => cellToXml(cell, widths[cellIndex] ?? 4680, assignRelationship))
        .join('');
      return `<w:tr>${rowProperties}${cells}</w:tr>`;
    })
    .join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>${grid}${rows}</w:tbl>`;
}

/** 域文档 → document.xml 正文块 XML 序列（关系分配器收集外链）。 */
function blocksToXml(
  document: WordDocument,
  assignRelationship: (href: string) => string,
): string {
  return document.blocks
    .map((block) => {
      if (block.kind === 'table') {
        return tableToXml(block, assignRelationship);
      }
      const listItem = block.kind === 'listItem' ? block : null;
      const properties = paragraphPropertiesXml(block.styleId, block.alignment, listItem);
      const content = runsToXml(block.runs, assignRelationship);
      if (properties.length === 0 && content.length === 0) {
        return '<w:p/>';
      }
      return `<w:p>${properties}${content}</w:p>`;
    })
    .join('');
}

/** 节设置 XML（缺省 A4 + 夹具标称页边距，保证无节文档的可交换性）。 */
function sectionToXml(section: WordSection | null): string {
  const resolved =
    section ??
    {
      pageWidthTwips: 11906,
      pageHeightTwips: 16838,
      marginTopTwips: 1440,
      marginRightTwips: 1800,
      marginBottomTwips: 1440,
      marginLeftTwips: 1800,
    };
  return (
    '<w:sectPr>' +
    `<w:pgSz w:w="${resolved.pageWidthTwips}" w:h="${resolved.pageHeightTwips}"/>` +
    `<w:pgMar w:top="${resolved.marginTopTwips}" w:right="${resolved.marginRightTwips}" w:bottom="${resolved.marginBottomTwips}" w:left="${resolved.marginLeftTwips}" w:header="851" w:footer="992" w:gutter="0"/>` +
    '</w:sectPr>'
  );
}

/** 收集文档全部外链目标（首次出现序，rId 自 1 起确定性分配）。 */
function collectHyperlinkTargets(document: WordDocument): string[] {
  const targets: string[] = [];
  const visitRuns = (runs: readonly WordRun[]): void => {
    for (const run of runs) {
      if (run.href !== null && !targets.includes(run.href)) {
        targets.push(run.href);
      }
    }
  };
  for (const block of document.blocks) {
    if (block.kind === 'table') {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          visitRuns(cell.runs);
        }
      }
      continue;
    }
    visitRuns(block.runs);
  }
  return targets;
}

/** 文档用到的列表定义（numId 首现序 + 各 numId 实际用到的层级集）。 */
function collectListDefinitions(document: WordDocument): Array<{ numId: number; kind: 'bullet' | 'ordered'; levels: number[] }> {
  const ordered: Array<{ numId: number; kind: 'bullet' | 'ordered'; levels: number[] }> = [];
  const byNumId = new Map<number, { kind: 'bullet' | 'ordered'; levels: number[] }>();
  for (const block of document.blocks) {
    if (block.kind !== 'listItem') {
      continue;
    }
    let entry = byNumId.get(block.list.numId);
    if (entry === undefined) {
      entry = { kind: block.list.kind, levels: [] };
      byNumId.set(block.list.numId, entry);
      ordered.push({ numId: block.list.numId, kind: entry.kind, levels: entry.levels });
    }
    if (!entry.levels.includes(block.list.level)) {
      entry.levels.push(block.list.level);
    }
  }
  for (const entry of ordered) {
    entry.levels.sort((a, b) => a - b);
  }
  return ordered;
}

/** 域文档 → docx 字节（确定性序列化；部件集与真实最小夹具同规）。 */
export async function writeWordDocument(document: WordDocument): Promise<Buffer> {
  const hyperlinkTargets = collectHyperlinkTargets(document);
  const relationshipIds = new Map<string, string>(
    hyperlinkTargets.map((target, index) => [target, `rId${index + 1}`]),
  );
  const assignRelationship = (href: string): string => relationshipIds.get(href) ?? `rId${hyperlinkTargets.length + 1}`;

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}">` +
    '<w:body>' +
    blocksToXml(document, assignRelationship) +
    sectionToXml(document.section) +
    '</w:body></w:document>\n';

  const listDefinitions = collectListDefinitions(document);
  const numberingXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<w:numbering xmlns:w="${W_NS}">` +
    listDefinitions
      .map((definition, abstractIndex) => {
        const levels = definition.levels
          .map((level) =>
            definition.kind === 'bullet'
              ? `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>`
              : `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%${level + 1}."/></w:lvl>`,
          )
          .join('');
        return `<w:abstractNum w:abstractNumId="${abstractIndex + 1}"><w:multiLevelType w:val="hybridMultilevel"/>${levels}</w:abstractNum>`;
      })
      .join('') +
    listDefinitions
      .map((definition, abstractIndex) => `<w:num w:numId="${definition.numId}"><w:abstractNumId w:val="${abstractIndex + 1}"/></w:num>`)
      .join('') +
    '</w:numbering>\n';

  // 样式部件 = 规范最小模板（与真实最小 docx 夹具逐字同规；Word 显示缺省面）。
  const stylesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    `<w:styles xmlns:w="${W_NS}">` +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="宋体" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="22"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="4"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="5"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="22"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="HTMLPreformatted"><w:name w:val="HTML Preformatted"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr></w:style>' +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
    '</w:styles>\n';

  const relsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    hyperlinkTargets
      .map(
        (target, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXmlAttribute(target)}" TargetMode="External"/>`,
      )
      .join('') +
    '</Relationships>\n';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    (listDefinitions.length > 0
      ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
      : '') +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>\n';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>\n';

  const zip = new JSZip();
  const entries: Array<[string, string]> = [
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRels],
    ['word/document.xml', documentXml],
    ['word/_rels/document.xml.rels', relsXml],
  ];
  if (listDefinitions.length > 0) {
    entries.push(['word/numbering.xml', numberingXml]);
  }
  entries.push(['word/styles.xml', stylesXml]);
  for (const [name, content] of entries) {
    zip.file(name, content, { date: PACKAGE_DATE });
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
