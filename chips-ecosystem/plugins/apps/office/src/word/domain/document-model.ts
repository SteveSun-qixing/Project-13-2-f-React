/**
 * word 域文档模型（旧仓 Chips-Office word editor 文档层语义迁移，重构形制）。
 *
 * 旧实现经 vendor docx-engine 的 Block/Run 模型承载（冻结不迁，RA-04 逐子包处置）；
 * 本模型按同层语义收口为薯片办公自有域模型：段落系（标题/正文/列表项）、表格与
 * 节设置，run 级字符标记与超链接。段落样式 ID 全程保真直通（styleId 不丢弃），
 * 样式语义判读归 ./style-mapping，编辑表示归 ./markdown-mapping。
 *
 * 编址纪律：块编址 = 数组下标（零自造 ID）；模型不含任何 Host/引擎触达，纯数据与纯函数。
 */

/** run 级字符标记种别（与 ECMA-376 迁移语义一一对应）。 */
export type WordMarkKind = 'bold' | 'italic' | 'strike' | 'underline' | 'code';

/** 文本 run：文本 + 字符标记 + 超链接目标（null = 非链接 run）。 */
export interface WordRun {
  readonly text: string;
  readonly marks: readonly WordMarkKind[];
  readonly href: string | null;
}

/** 段落对齐（w:jc 语义；null = 未显式设置）。 */
export type WordAlignment = 'left' | 'center' | 'right' | 'both' | null;

/** 列表种别（numbering.xml numFmt 语义折叠）。 */
export type WordListKind = 'bullet' | 'ordered';

/** 列表项编号信息（numId 项定义 + 层级）。 */
export interface WordListInfo {
  readonly kind: WordListKind;
  readonly numId: number;
  readonly level: number;
}

/** 段落系块公共形状：样式 ID 保真直通 + 段落对齐。 */
interface WordParagraphBase {
  readonly styleId: string | null;
  readonly alignment: WordAlignment;
}

/** 标题块（级别 1~6，pStyle HeadingN / outlineLvl 语义）。 */
export interface WordHeadingBlock extends WordParagraphBase {
  readonly kind: 'heading';
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly runs: readonly WordRun[];
}

/** 正文段块（Quote / HTMLPreformatted / ListParagraph / 自定义样式等经 styleId 保真）。 */
export interface WordParagraphBlock extends WordParagraphBase {
  readonly kind: 'paragraph';
  readonly runs: readonly WordRun[];
}

/** 列表项块（项目符号 / 编号列表，编号信息显式承载）。 */
export interface WordListItemBlock extends WordParagraphBase {
  readonly kind: 'listItem';
  readonly list: WordListInfo;
  readonly runs: readonly WordRun[];
}

/** 表格单元格：段落序列 + 单元格级对齐由段落自持。 */
export interface WordTableCell {
  readonly alignment: WordAlignment;
  readonly runs: readonly WordRun[];
}

/** 表格行：单元格序列 + 表头行标记（w:tblHeader 语义）。 */
export interface WordTableRow {
  readonly header: boolean;
  readonly cells: readonly WordTableCell[];
}

/** 表格块：行序列 + 列宽（twips；null = 未显式声明）。 */
export interface WordTableBlock {
  readonly kind: 'table';
  readonly rows: readonly WordTableRow[];
  readonly columnWidthsTwips: readonly number[] | null;
}

/** 文档正文块联合。 */
export type WordBlock =
  | WordHeadingBlock
  | WordParagraphBlock
  | WordListItemBlock
  | WordTableBlock;

/** 节设置（w:sectPr 页面几何，twips）。 */
export interface WordSection {
  readonly pageWidthTwips: number;
  readonly pageHeightTwips: number;
  readonly marginTopTwips: number;
  readonly marginRightTwips: number;
  readonly marginBottomTwips: number;
  readonly marginLeftTwips: number;
}

/** word 文档：正文块序列 + 节设置（null = 文档未声明节）。 */
export interface WordDocument {
  readonly blocks: readonly WordBlock[];
  readonly section: WordSection | null;
}

/** 空文档工厂：单空段落正文（与旧仓 blocksToPmDoc 空正文补位语义同源）。 */
export function createEmptyWordDocument(): WordDocument {
  return {
    blocks: [{ kind: 'paragraph', styleId: null, alignment: null, runs: [] }],
    section: null,
  };
}

/** 抽取块的纯文本（段落系拼 run 文本；表格按单元格序拼接）。 */
export function blockText(block: WordBlock): string {
  if (block.kind === 'table') {
    return block.rows
      .map((row) => row.cells.map((cell) => cell.runs.map((cellRun) => cellRun.text).join('')).join(''))
      .join('');
  }
  return block.runs.map((blockRun) => blockRun.text).join('');
}

/** 抽取文档正文纯文本（段落系与表格文本按块序以换行连接）。 */
export function documentPlainText(document: WordDocument): string {
  return document.blocks
    .map((block) => blockText(block))
    .filter((text) => text.length > 0)
    .join('\n');
}
