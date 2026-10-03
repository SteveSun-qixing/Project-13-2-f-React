/**
 * Word 口径字数统计（旧仓 Chips-Office word/renderer/word-count.ts 逐字迁移 + 文档装配）。
 *
 * Word 的字数口径：Words = 亚洲字符逐字计数（含标点） + 非亚洲词（空白/标点分隔）。
 * 对话框同时分报两项加数 —— 中文用户关心亚洲字符数。
 */

import type { WordDocument } from './document-model';
import { documentPlainText } from './document-model';

// Han (incl. radicals/compat/ext-B+), kana, hangul, bopomofo, CJK symbols
// and punctuation (U+3001 up: the ideographic space stays whitespace),
// fullwidth forms
const ASIAN_RE =
  /[ᄀ-ᇿ⺀-⿟、-〿぀-ヿ㄀-ㄯ㄰-㆏㇀-ㇿ㐀-䶿一-鿿가-힯豈-﫿！-｠￠-￦]|[\uD840-\uD87F][\uDC00-\uDFFF]/g

const NON_ASIAN_WORD_RE = /[A-Za-z0-9À-ɏ]+(?:['-][A-Za-z0-9À-ɏ]+)*/g

export function asianCharCount(text: string): number {
  return (text.match(ASIAN_RE) ?? []).length
}

export function nonAsianWordCount(text: string): number {
  return (text.match(NON_ASIAN_WORD_RE) ?? []).length
}

/** Word's Words figure: asian chars + non-asian words */
export function countWords(text: string): number {
  return asianCharCount(text) + nonAsianWordCount(text)
}

/** 文档统计结果：Word 口径字数与 Unicode 码点字符数。 */
export interface WordDocumentStatistics {
  readonly words: number;
  readonly characters: number;
}

/** 从文档正文纯文本出数（状态栏字数统计的唯一口径）。 */
export function countDocumentStatistics(document: WordDocument): WordDocumentStatistics {
  const plainText = documentPlainText(document);
  return {
    words: countWords(plainText),
    characters: Array.from(plainText).length,
  };
}
