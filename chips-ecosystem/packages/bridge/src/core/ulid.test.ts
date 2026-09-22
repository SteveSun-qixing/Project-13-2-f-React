/**
 * ULID 供给设施锁测（工单046 段一：单调性与跨日翻卷，立项书段一验收判据）。
 */

import { describe, expect, it } from 'vitest';
import { createUlidGenerator, decodeUlidTimestamp, isUlid, ULID_LENGTH } from './ulid.js';

/** 确定性时钟 + 固定取熵注入面。 */
function createFakeEnv(initialMs: number): {
  advance: (deltaMs: number) => void;
  set: (ms: number) => void;
  next: () => string;
} {
  let currentMs = initialMs;
  let entropySeed = 0;
  const generator = createUlidGenerator({
    now: () => currentMs,
    fillRandom: (bytes) => {
      entropySeed += 1;
      bytes.fill(entropySeed & 0xff);
    },
  });
  return {
    advance: (deltaMs: number) => {
      currentMs += deltaMs;
    },
    set: (ms: number) => {
      currentMs = ms;
    },
    next: () => generator.next(),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('createUlidGenerator 形状', () => {
  it('产出 26 位 Crockford Base32 且可解码回时间戳', () => {
    const env = createFakeEnv(1_758_283_231_482);
    const id = env.next();
    expect(id).toHaveLength(ULID_LENGTH);
    expect(isUlid(id)).toBe(true);
    expect(decodeUlidTimestamp(id)).toBe(1_758_283_231_482);
  });

  it('缺省随机源（Web Crypto）路径可用且严格递增', () => {
    const generator = createUlidGenerator();
    const first = generator.next();
    const second = generator.next();
    expect(isUlid(first)).toBe(true);
    expect(isUlid(second)).toBe(true);
    expect(second > first).toBe(true);
  });
});

describe('createUlidGenerator 单调性（同毫秒递增）', () => {
  it('同毫秒连续取值字典序严格递增、时间戳段不变', () => {
    const env = createFakeEnv(1_758_283_231_482);
    const ids = [env.next(), env.next(), env.next(), env.next()];
    for (const id of ids) {
      expect(decodeUlidTimestamp(id)).toBe(1_758_283_231_482);
    }
    for (let index = 1; index < ids.length; index += 1) {
      expect((ids[index] as string) > (ids[index - 1] as string)).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('80 位随机段溢出时进位时间戳且保持严格递增', () => {
    const currentMs = 1_000;
    const generator = createUlidGenerator({
      now: () => currentMs,
      // 预置随机段逼近全 1：首次取熵为 FF..FE，第二次 +1 到 FF..FF，第三次溢出进位。
      fillRandom: (bytes) => {
        bytes.fill(0xff);
        bytes[bytes.length - 1] = 0xfe;
      },
    });
    const first = generator.next();
    const second = generator.next(); // 同毫秒 +1 → 全 FF
    const third = generator.next(); // 溢出 → 时间戳进位 + 新随机段
    expect(decodeUlidTimestamp(second)).toBe(currentMs);
    expect(decodeUlidTimestamp(third)).toBe(currentMs + 1);
    expect(second > first).toBe(true);
    expect(third > second).toBe(true);
    expect(isUlid(third)).toBe(true);
  });

  it('时钟回拨钳制：不产出早于已发放最大时间戳的 id', () => {
    const env = createFakeEnv(2_000_000);
    const before = env.next();
    env.set(1_000); // 宿主校时回拨
    const after = env.next();
    expect(decodeUlidTimestamp(after)).toBe(2_000_000);
    expect(after > before).toBe(true);
  });
});

describe('createUlidGenerator 跨日翻卷', () => {
  it('时钟前进跨日界：新时间戳、重新取熵、字典序保持递增', () => {
    const env = createFakeEnv(1_758_283_231_482);
    const dayOne = env.next();
    env.advance(DAY_MS); // 翻卷到次日
    const dayTwo = env.next();
    expect(decodeUlidTimestamp(dayTwo) - decodeUlidTimestamp(dayOne)).toBe(DAY_MS);
    expect(dayTwo > dayOne).toBe(true);
    // 时间戳段不同（前 10 字符），随机段重新取熵（固定种子递增消耗）。
    expect(dayTwo.slice(0, 10) > dayOne.slice(0, 10)).toBe(true);
  });

  it('跨日界后同毫秒再连续取值仍保持单调', () => {
    const env = createFakeEnv(1_758_283_231_482);
    env.next();
    env.advance(DAY_MS * 3 + 1);
    const ids = [env.next(), env.next(), env.next()];
    for (let index = 1; index < ids.length; index += 1) {
      expect((ids[index] as string) > (ids[index - 1] as string)).toBe(true);
    }
    expect(decodeUlidTimestamp(ids[0] as string)).toBe(1_758_283_231_482 + DAY_MS * 3 + 1);
  });
});

describe('isUlid / decodeUlidTimestamp', () => {
  it('拒绝非法长度与非法字母表字符', () => {
    expect(isUlid('short')).toBe(false);
    expect(isUlid('0'.repeat(ULID_LENGTH))).toBe(true);
    expect(isUlid('I'.repeat(ULID_LENGTH))).toBe(false); // I/L/O/U 不在 Crockford 字母表
    expect(isUlid('L'.repeat(ULID_LENGTH))).toBe(false);
    expect(isUlid('O'.repeat(ULID_LENGTH))).toBe(false);
    expect(isUlid('U'.repeat(ULID_LENGTH))).toBe(false);
  });

  it('非 Base32 字符解码抛错（fail-fast，不做静默容错）', () => {
    expect(() => decodeUlidTimestamp('U'.repeat(ULID_LENGTH))).toThrow(/Crockford/);
  });
});
