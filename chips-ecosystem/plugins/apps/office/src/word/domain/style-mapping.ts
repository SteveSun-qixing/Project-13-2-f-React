/**
 * word 域段落样式映射（docx pStyle / jc / numFmt ↔ 域语义判读）。
 *
 * 旧仓 semantics：vendor docx-engine 在解析侧把 pStyle HeadingN / outlineLvl 判读为
 * heading 块与级别、ListParagraph + numPr 判读为列表项（convert.ts blockToPmNode 的
 * 分派键）。本模块把该判读层收口为显式映射表：标题样式 ID 双向、语义样式分类、
 * 对齐值双向与编号格式折叠，供 docx 网关（读取判读 / 写回还原）与 Markdown 编辑
 * 表示映射共用。未知样式 ID 一律保真直通（不丢弃、不猜测语义）。
 */

import type { WordAlignment, WordListKind } from './document-model';

/** 标题样式 ID（Heading1~6，与 Word 内建样式 ID 逐字对应）。 */
export const HEADING_STYLE_IDS: readonly string[] = [
  'Heading1',
  'Heading2',
  'Heading3',
  'Heading4',
  'Heading5',
  'Heading6',
] as const;

/** 文档标题样式 ID（Word 内建 Title）。 */
export const TITLE_STYLE_ID = 'Title';

/** 引用段样式 ID（Word 内建 Quote）。 */
export const QUOTE_STYLE_ID = 'Quote';

/** 代码段样式 ID（Word 内建 HTML Preformatted）。 */
export const CODE_STYLE_ID = 'HTMLPreformatted';

/** 列表段样式 ID（Word 内建 List Paragraph）。 */
export const LIST_STYLE_ID = 'ListParagraph';

/** 超链接字符样式 ID（Word 内建 Hyperlink）。 */
export const HYPERLINK_STYLE_ID = 'Hyperlink';

/** 标题语义种别（Markdown 编辑表示的映射键）。 */
export type WordSemanticStyle = 'title' | 'heading' | 'quote' | 'code' | 'list' | 'normal' | 'other';

/** 样式 ID → 标题级别（1~6；非标题样式返回 null）。`heading N` 为样式名形态。 */
export function headingLevelFromStyleId(styleId: string | null): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (styleId === null) {
    return null;
  }
  const idLevel = HEADING_STYLE_IDS.indexOf(styleId);
  if (idLevel >= 0) {
    return (idLevel + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  }
  const nameMatch = /^heading ([1-6])$/i.exec(styleId);
  return nameMatch ? (Number(nameMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6) : null;
}

/** 标题级别 → 样式 ID（写回侧唯一形态）。 */
export function headingStyleIdFromLevel(level: 1 | 2 | 3 | 4 | 5 | 6): string {
  return `Heading${level}`;
}

/** 判定样式 ID 是否为标题样式。 */
export function isHeadingStyleId(styleId: string | null): boolean {
  return headingLevelFromStyleId(styleId) !== null;
}

/** 样式 ID → 语义种别（unknown 样式直通 `other`；无样式为 `normal`）。 */
export function semanticStyleFromStyleId(styleId: string | null): WordSemanticStyle {
  if (styleId === null) {
    return 'normal';
  }
  if (styleId === TITLE_STYLE_ID) {
    return 'title';
  }
  if (isHeadingStyleId(styleId)) {
    return 'heading';
  }
  if (styleId === QUOTE_STYLE_ID) {
    return 'quote';
  }
  if (styleId === CODE_STYLE_ID) {
    return 'code';
  }
  if (styleId === LIST_STYLE_ID) {
    return 'list';
  }
  if (styleId === 'Normal') {
    return 'normal';
  }
  return 'other';
}

/** w:jc 值 → 域对齐（`justify` 归 `both`，`start` 归 `left`，未知为 null）。 */
export function alignmentFromJc(jc: string | null): WordAlignment {
  switch (jc) {
    case 'left':
    case 'start':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
    case 'end':
      return 'right';
    case 'both':
    case 'justify':
      return 'both';
    default:
      return null;
  }
}

/** 域对齐 → w:jc 值（null = 不写 w:jc）。 */
export function jcFromAlignment(alignment: WordAlignment): string | null {
  switch (alignment) {
    case 'left':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    case 'both':
      return 'both';
    default:
      return null;
  }
}

/** numbering.xml numFmt 值 → 列表种别（`none` 无可见编号随 bullet；其余编号形态折叠为 ordered）。 */
export function listKindFromNumFmt(numFmt: string): WordListKind {
  if (numFmt === 'bullet' || numFmt === 'none') {
    return 'bullet';
  }
  return 'ordered';
}
