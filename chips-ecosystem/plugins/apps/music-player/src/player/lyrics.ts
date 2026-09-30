/**
 * LRC 歌词解析（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-MusicPlayer/src/utils/lyrics.ts`（覆盖矩阵「歌词解析与布局」行，
 * 判迁移：LRC 时间轴/元信息/纯文本降级纯函数，测试随迁并改用真实夹具文件）。
 * 逐行保真迁移，仅导入与文案口径适配。
 */

export interface LyricsMetadata {
  artist?: string;
  title?: string;
  album?: string;
  by?: string;
}

export interface LyricsLine {
  id: string;
  timeMs: number | null;
  text: string;
}

export interface LyricsDocument {
  mode: 'timed' | 'plain' | 'empty';
  source: 'companion' | 'embedded' | 'none';
  lines: LyricsLine[];
  metadata: LyricsMetadata;
  rawText: string;
  offsetMs: number;
}

const TEXT_DECODERS = ['utf-8', 'utf-16le', 'gbk', 'big5', 'shift_jis'] as const;

export function createEmptyLyricsDocument(source: LyricsDocument['source'] = 'none'): LyricsDocument {
  return {
    mode: 'empty',
    source,
    lines: [],
    metadata: {},
    rawText: '',
    offsetMs: 0,
  };
}

function normalizeFractionToMilliseconds(rawFraction: string | undefined): number {
  if (!rawFraction) {
    return 0;
  }

  if (rawFraction.length === 3) {
    return Number.parseInt(rawFraction, 10);
  }

  if (rawFraction.length === 2) {
    return Number.parseInt(rawFraction, 10) * 10;
  }

  return Number.parseInt(rawFraction.padEnd(3, '0'), 10);
}

export function decodeTextWithFallback(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  for (const encoding of TEXT_DECODERS) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      // 换下一候选编码继续尝试
    }
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function parseLyricsText(
  input: string,
  source: LyricsDocument['source'] = 'companion',
): LyricsDocument {
  const rawText = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!rawText) {
    return createEmptyLyricsDocument(source);
  }

  const metadata: LyricsMetadata = {};
  let offsetMs = 0;
  const timedLines: Array<{ timeMs: number; text: string }> = [];
  const plainLines: string[] = [];

  for (const rawLine of rawText.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const timestamps = Array.from(line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g));
    if (timestamps.length > 0) {
      const text = line.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
      if (!text) {
        continue;
      }

      for (const match of timestamps) {
        const minutes = Number.parseInt(match[1] ?? '0', 10);
        const seconds = Number.parseInt(match[2] ?? '0', 10);
        const milliseconds = normalizeFractionToMilliseconds(match[3]);
        timedLines.push({
          timeMs: minutes * 60_000 + seconds * 1_000 + milliseconds,
          text,
        });
      }
      continue;
    }

    const metadataMatch = line.match(/^\[([a-zA-Z]+):(.*)\]$/);
    if (metadataMatch) {
      const key = metadataMatch[1]?.trim().toLowerCase();
      const value = metadataMatch[2]?.trim();
      if (!value) {
        continue;
      }

      switch (key) {
        case 'ar':
          metadata.artist = value;
          break;
        case 'ti':
          metadata.title = value;
          break;
        case 'al':
          metadata.album = value;
          break;
        case 'by':
          metadata.by = value;
          break;
        case 'offset':
          offsetMs = Number.parseInt(value, 10) || 0;
          break;
        default:
          break;
      }
      continue;
    }

    plainLines.push(line);
  }

  if (timedLines.length > 0) {
    const lines = timedLines
      .map((line, index) => ({
        id: `timed-${index}`,
        timeMs: Math.max(0, line.timeMs + offsetMs),
        text: line.text,
      }))
      .sort((left, right) => (left.timeMs ?? 0) - (right.timeMs ?? 0));

    return {
      mode: 'timed',
      source,
      lines,
      metadata,
      rawText,
      offsetMs,
    };
  }

  if (plainLines.length > 0) {
    return {
      mode: 'plain',
      source,
      lines: plainLines.map((text, index) => ({
        id: `plain-${index}`,
        timeMs: null,
        text,
      })),
      metadata,
      rawText,
      offsetMs,
    };
  }

  return createEmptyLyricsDocument(source);
}

export function findActiveLyricIndex(lines: readonly LyricsLine[], currentTimeMs: number): number {
  if (!Number.isFinite(currentTimeMs) || lines.length === 0) {
    return -1;
  }

  let low = 0;
  let high = lines.length - 1;
  let result = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = lines[middle];
    const timeMs = candidate?.timeMs ?? null;

    if (timeMs === null || timeMs > currentTimeMs) {
      high = middle - 1;
      continue;
    }

    result = middle;
    low = middle + 1;
  }

  return result;
}

export function resolveActiveLyricProgress(
  lines: readonly LyricsLine[],
  currentTimeMs: number,
  activeIndex: number,
): number {
  if (!Number.isFinite(currentTimeMs) || activeIndex < 0 || activeIndex >= lines.length) {
    return 0;
  }

  const activeLineTime = lines[activeIndex]?.timeMs;
  if (typeof activeLineTime !== 'number' || !Number.isFinite(activeLineTime)) {
    return 0;
  }

  for (let index = activeIndex + 1; index < lines.length; index += 1) {
    const nextLineTime = lines[index]?.timeMs;
    if (typeof nextLineTime !== 'number' || !Number.isFinite(nextLineTime)) {
      continue;
    }

    if (nextLineTime <= activeLineTime) {
      continue;
    }

    const progress = (currentTimeMs - activeLineTime) / (nextLineTime - activeLineTime);
    return Math.min(1, Math.max(0, progress));
  }

  return currentTimeMs >= activeLineTime ? 1 : 0;
}
