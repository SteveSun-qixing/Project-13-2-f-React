import { createError } from '../../../src/shared/errors';

/**
 * file.compare / file.versionDiff / file.preview 的纯计算实现。
 *
 * 全部为确定性字节/文本运算，不依赖进程与文件系统；I/O 由服务装配层完成。
 */

export type CompareAlgorithm = 'hash' | 'binary' | 'semantic';

export interface CompareDiffBlock {
  type: 'add' | 'remove' | 'modify';
  leftRange?: { start: number; end: number };
  rightRange?: { start: number; end: number };
  leftContent?: string;
  rightContent?: string;
}

export interface FileCompareResult {
  identical: boolean;
  diffs: CompareDiffBlock[];
  stats: { additions: number; deletions: number; modifications: number };
}

const MAX_BINARY_DIFF_BLOCKS = 512;

/** 字节级对比：将连续差异折叠为块（上限 MAX_BINARY_DIFF_BLOCKS）。 */
export const compareBinary = (left: Uint8Array, right: Uint8Array): FileCompareResult => {
  const diffs: CompareDiffBlock[] = [];
  let identical = true;
  const max = Math.max(left.length, right.length);
  let cursor = 0;
  while (cursor < max) {
    if (cursor < left.length && cursor < right.length && left[cursor] === right[cursor]) {
      cursor += 1;
      continue;
    }
    identical = false;
    const start = cursor;
    while (cursor < max) {
      if (cursor >= left.length || cursor >= right.length) {
        cursor += 1;
        continue;
      }
      if (left[cursor] === right[cursor]) {
        break;
      }
      cursor += 1;
    }
    if (diffs.length < MAX_BINARY_DIFF_BLOCKS) {
      diffs.push({
        type: start >= right.length ? 'remove' : start >= left.length ? 'add' : 'modify',
        leftRange: { start, end: Math.min(cursor, left.length) },
        rightRange: { start, end: Math.min(cursor, right.length) },
      });
    }
  }
  return {
    identical,
    diffs,
    stats: {
      additions: diffs.filter((diff) => diff.type === 'add').length,
      deletions: diffs.filter((diff) => diff.type === 'remove').length,
      modifications: diffs.filter((diff) => diff.type === 'modify').length,
    },
  };
};

const normalizeLine = (line: string, ignoreWhitespace: boolean, ignoreCase: boolean): string => {
  let value = line;
  if (ignoreWhitespace) {
    value = value.replace(/\s+/g, ' ').trim();
  }
  if (ignoreCase) {
    value = value.toLowerCase();
  }
  return value;
};

/** 经典 LCS 行级差异（文本语义对比），用于 file.compare(semantic) 与 versionDiff。 */
export const diffLines = (
  leftLines: string[],
  rightLines: string[],
  options: { ignoreWhitespace: boolean; ignoreCase: boolean } = { ignoreWhitespace: false, ignoreCase: false },
): CompareDiffBlock[] => {
  const left = leftLines.map((line) => normalizeLine(line, options.ignoreWhitespace, options.ignoreCase));
  const right = rightLines.map((line) => normalizeLine(line, options.ignoreWhitespace, options.ignoreCase));
  const rows = left.length;
  const columns = right.length;
  // LCS 表按 32 位行数上限保护；超限退化为逐行 modify 汇总，避免 O(n·m) 爆内存。
  if (rows * columns > 4_000_000) {
    return [{
      type: 'modify',
      leftRange: { start: 0, end: rows },
      rightRange: { start: 0, end: columns },
    }];
  }
  const lcs: number[][] = [];
  for (let row = 0; row <= rows; row += 1) {
    lcs.push(new Array<number>(columns + 1).fill(0));
  }
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      lcs[row][column] = left[row] === right[column]
        ? lcs[row + 1][column + 1] + 1
        : Math.max(lcs[row + 1][column], lcs[row][column + 1]);
    }
  }
  const diffs: CompareDiffBlock[] = [];
  let row = 0;
  let column = 0;
  const pushDiff = (
    type: CompareDiffBlock['type'],
    leftStart: number, leftEnd: number,
    rightStart: number, rightEnd: number,
  ) => {
    const leftContent = leftLines.slice(leftStart, leftEnd).join('\n');
    const rightContent = rightLines.slice(rightStart, rightEnd).join('\n');
    diffs.push({
      type,
      ...(leftEnd > leftStart ? { leftRange: { start: leftStart, end: leftEnd } } : {}),
      ...(rightEnd > rightStart ? { rightRange: { start: rightStart, end: rightEnd } } : {}),
      ...(leftEnd > leftStart ? { leftContent } : {}),
      ...(rightEnd > rightStart ? { rightContent } : {}),
    });
  };
  // 标准 LCS 回溯：遇到公共行则前进；否则沿 LCS 值较大的方向推进，收束为连续差异块。
  while (row < rows && column < columns) {
    if (left[row] === right[column]) {
      row += 1;
      column += 1;
      continue;
    }
    const leftStart = row;
    const rightStart = column;
    while (row < rows && column < columns && left[row] !== right[column]) {
      if (lcs[row + 1][column] >= lcs[row][column + 1]) {
        row += 1;
      } else {
        column += 1;
      }
    }
    const leftEnd = row;
    const rightEnd = column;
    if (leftEnd > leftStart && rightEnd > rightStart) {
      pushDiff('modify', leftStart, leftEnd, rightStart, rightEnd);
    } else if (leftEnd > leftStart) {
      pushDiff('remove', leftStart, leftEnd, rightStart, rightStart);
    } else {
      pushDiff('add', leftStart, leftStart, rightStart, rightEnd);
    }
  }
  if (row < rows) {
    pushDiff('remove', row, rows, column, column);
  }
  if (column < columns) {
    pushDiff('add', row, row, column, columns);
  }
  return diffs;
};

export const compareSemantic = (left: Uint8Array, right: Uint8Array, options: {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
}): FileCompareResult => {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const leftLines = decoder.decode(left).split(/\r?\n/);
  const rightLines = decoder.decode(right).split(/\r?\n/);
  const diffs = diffLines(leftLines, rightLines, {
    ignoreWhitespace: options.ignoreWhitespace === true,
    ignoreCase: options.ignoreCase === true,
  });
  return {
    identical: diffs.length === 0,
    diffs,
    stats: {
      additions: diffs.filter((diff) => diff.type === 'add').length,
      deletions: diffs.filter((diff) => diff.type === 'remove').length,
      modifications: diffs.filter((diff) => diff.type === 'modify').length,
    },
  };
};

export interface UnifiedDiffResult {
  diffOutput: string;
  stats: { additions: number; deletions: number };
}

/** Unified 格式输出（@@ -start,count +start,count @@ 头 + 上下文行，逐 hunk）。 */
export const unifiedDiff = (
  leftLines: string[],
  rightLines: string[],
  contextLines = 3,
): UnifiedDiffResult => {
  const diffs = diffLines(leftLines, rightLines);
  const removals = diffs.filter((diff) => diff.type === 'remove').reduce(
    (total, diff) => total + (diff.leftRange ? diff.leftRange.end - diff.leftRange.start : 0), 0);
  const additions = diffs.filter((diff) => diff.type === 'add').reduce(
    (total, diff) => total + (diff.rightRange ? diff.rightRange.end - diff.rightRange.start : 0), 0);
  if (diffs.length === 0) {
    return { diffOutput: '', stats: { additions: 0, deletions: 0 } };
  }
  const lines: string[] = [];
  for (const diff of diffs) {
    const leftStart = diff.leftRange?.start ?? leftLines.length;
    const leftEnd = diff.leftRange?.end ?? leftLines.length;
    const rightStart = diff.rightRange?.start ?? rightLines.length;
    const rightEnd = diff.rightRange?.end ?? rightLines.length;
    const chunkLeftStart = Math.max(0, leftStart - contextLines);
    const chunkLeftEnd = Math.min(leftLines.length, leftEnd + contextLines);
    const chunkRightStart = Math.max(0, rightStart - contextLines);
    const chunkRightEnd = Math.min(rightLines.length, rightEnd + contextLines);
    lines.push(`@@ -${chunkLeftStart + 1},${chunkLeftEnd - chunkLeftStart} +${chunkRightStart + 1},${chunkRightEnd - chunkRightStart} @@`);
    for (let index = chunkLeftStart; index < leftStart; index += 1) {
      lines.push(` ${leftLines[index] ?? ''}`);
    }
    for (let index = leftStart; index < leftEnd; index += 1) {
      lines.push(`-${leftLines[index] ?? ''}`);
    }
    for (let index = rightStart; index < rightEnd; index += 1) {
      lines.push(`+${rightLines[index] ?? ''}`);
    }
    for (let index = rightEnd; index < chunkRightEnd; index += 1) {
      lines.push(` ${rightLines[index] ?? ''}`);
    }
  }
  return { diffOutput: lines.join('\n'), stats: { additions, deletions } };
};

export interface ImageDimensions {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'gif' | 'bmp' | 'webp';
}

/** 读取 PNG/JPEG/GIF/BMP/WebP 的像素尺寸（魔数解析，无第三方依赖）。 */
export const readImageDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: 8 字节签名 + IHDR（宽高在偏移 16/20）
  if (bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20), format: 'png' };
  }
  // GIF: 'GIF8?a' + 小端宽高（偏移 6/8）
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true), format: 'gif' };
  }
  // BMP: 'BM' + 小端宽高（偏移 18/22）
  if (bytes.length >= 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)), format: 'bmp' };
  }
  // WebP: 'RIFF....WEBP' + VP8/VP8L/VP8X
  if (bytes.length >= 30 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
      // VP8 lossy: 26..30 为 14px 起始的宽高（小端 16 位，3 位掩码）
      const width = view.getUint16(26, true) & 0x3fff;
      const height = view.getUint16(28, true) & 0x3fff;
      return { width, height, format: 'webp' };
    }
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c) {
      // VP8L: 21..25 为 14 位宽高位打包
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, format: 'webp' };
    }
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
      // VP8X: 24..30 为 24 位宽高 -1
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height, format: 'webp' };
    }
    return null;
  }
  // JPEG: 扫描 SOFn 段
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
          format: 'jpeg',
        };
      }
      const segmentLength = view.getUint16(offset + 2);
      offset += 2 + segmentLength;
    }
    return null;
  }
  return null;
};

export const requireExistingBytes = (bytes: Uint8Array | null, filePath: string): Uint8Array => {
  if (!bytes) {
    throw createError('FILE_CONTENT_INVALID', `File content is unavailable: ${filePath}`);
  }
  return bytes;
};
