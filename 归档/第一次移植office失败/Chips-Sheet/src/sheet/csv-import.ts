/**
 * CSV → 内部模型 / xlsx 的导入链路（移植自 GenOffice
 * apps/sheets/src/gateway/csv-import.ts，Apache-2.0）。
 * 仅承载值：形如纯数字的单元格转为数值，其余保持文本（前导零不丢）。
 * Excel 在中文 Windows 上以 GB18030、日文系统上以 Shift_JIS 写出 CSV，
 * 因此解码不能只按 UTF-8 处理。
 */

const DELIMITERS = [",", ";", "\t"] as const;

const LEGACY_CHARSETS = ["gb18030", "shift_jis", "big5", "euc-kr", "windows-1252"] as const;

function decode(bytes: Uint8Array, charset: string, fatal = false): string | null {
  try {
    return new TextDecoder(charset, { fatal }).decode(bytes);
  } catch {
    return null;
  }
}

/** 解码合理度评分：CJK/ASCII 加分，替换符与控制字符减分 */
function score(text: string): number {
  let value = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (character === "�") {
      value -= 20;
    } else if (code < 0x20 && character !== "\n" && character !== "\r" && character !== "\t") {
      value -= 10;
    } else if (code < 0x7f) {
      value += 1;
    } else if (code >= 0xff61 && code <= 0xff9f) {
      // 半角片假名是双字节文本被误读为 Shift_JIS 的特征，真实表格里几乎不会出现
      value -= 2;
    } else if (
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      value += 2;
    }
  }
  return value;
}

/**
 * 解码 CSV 字节：BOM → 严格 UTF-8 → Excel 使用的遗留字符集。
 * `preferred`（来自界面语言）用于打破 GBK 与 Shift_JIS 的平分局面。
 */
export function decodeCsvBuffer(bytes: Uint8Array, preferred?: string): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decode(bytes.subarray(3), "utf-8") ?? "";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decode(bytes.subarray(2), "utf-16le") ?? "";
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decode(bytes.subarray(2), "utf-16be") ?? "";
  }

  const utf8 = decode(bytes, "utf-8", true);
  if (utf8 !== null) {
    return utf8;
  }

  let best = decode(bytes, "utf-8") ?? "";
  let bestScore = score(best);
  const candidates = preferred ? [preferred, ...LEGACY_CHARSETS] : [...LEGACY_CHARSETS];
  for (const charset of candidates) {
    const candidate = decode(bytes, charset);
    if (candidate === null) {
      continue;
    }
    const candidateScore = score(candidate);
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

/** 统计前几行引号外的分隔符出现次数并取最多者；平分时偏向逗号 */
export function sniffDelimiter(text: string): string {
  const sample = text
    .slice(0, 64 * 1024)
    .split(/\r?\n/)
    .slice(0, 20);
  const counts = new Map<string, number>(DELIMITERS.map((delimiter) => [delimiter, 0]));
  for (const line of sample) {
    let quoted = false;
    for (const character of line) {
      if (character === '"') {
        quoted = !quoted;
      } else if (!quoted && counts.has(character)) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }
  }
  let best: string = DELIMITERS[0];
  let bestCount = -1;
  for (const delimiter of DELIMITERS) {
    const count = counts.get(delimiter) ?? 0;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string, delimiter = sniffDelimiter(input)): string[][] {
  const text = input.startsWith("﻿") ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field === "") {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 末尾换行会多出一个空行——去掉它
  while (rows.length > 0 && rows[rows.length - 1]?.every((cell) => cell === "")) {
    rows.pop();
  }
  return rows;
}

/** 只接受纯十进制数；前导零（"007"）保持文本，编码与电话号码不受影响 */
export function isNumericCell(value: string): boolean {
  if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(value)) {
    return false;
  }
  return Number.isFinite(Number(value));
}
