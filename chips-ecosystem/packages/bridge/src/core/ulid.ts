/**
 * ULID 供给设施（08-权限系统设计 §8.2 `id` 字段，工单046 段一）。
 *
 * 权威与裁定：
 * - 《08.08》§8.2：审计记录 `id` 为 ULID（26 位 Crockford Base32，48 位毫秒时间戳 +
 *   80 位随机段，字典序单调）；
 * - 工单046 段一主智能体裁定：**独立 TS 设施、自制实现、零新依赖**——不引入 npm `ulid`
 *   包，不穿 Rust 依赖边（cordis `ulid.rs` `pub(crate)` 不出 crate，RFC §2.1 E11 在册）；
 * - 本模块是生态 TS 侧唯一 ULID 供给点（`@chips/bridge` 协议包公共设施位），
 *   审计条目组装、后续写入器波次与消费方面均从此取 id，禁止第二实现。
 *
 * @remarks
 * - **单调性保证**：同一生成器实例内，同毫秒连续取值时随机段按大端 +1 递增
 *   （字典序严格递增）；80 位随机段溢出时时间戳字段 +1 并进位到新随机段，
 *   永不回退；时钟回拨按已发放的最大时间戳钳制（生成序列不因宿主校时而倒退）。
 * - **跨日翻卷**：时间戳前进（含跨日界）时随机段重新取熵，字典序仍严格递增；
 *   48 位毫秒时间戳按 ULID 规范编码，日期切换无需任何特殊处理。
 * - 随机源缺省 `crypto.getRandomValues`（与 `client/request-id.ts` 同源设施），
 *   测试可注入确定性时钟与随机源。
 */

/** Crockford Base32 字母表（ULID 规范，不含 I/L/O/U）。 */
const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID 文本长度（26 字符 = 128 位）。 */
export const ULID_LENGTH = 26;

/** ULID 文本校验正则（大小写不敏感的 Crockford Base32，26 位）。 */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/** 时间戳段字符数（48 位 = 10 个 5 位组）。 */
const TIMESTAMP_CHARS = 10;

/** 随机段字节数（80 位）。 */
const RANDOM_BYTES = 10;

/** 判断字符串是否为合法 ULID 文本。 */
export function isUlid(value: string): boolean {
  return value.length === ULID_LENGTH && ULID_PATTERN.test(value);
}

/** 解码 ULID 前 10 位时间戳段为 Unix epoch 毫秒（锁测与后续按日归档校验用）。 */
export function decodeUlidTimestamp(ulid: string): number {
  let timestamp = 0;
  for (let index = 0; index < TIMESTAMP_CHARS; index += 1) {
    const digit = ULID_ENCODING.indexOf(ulid[index]?.toUpperCase() ?? '');
    if (digit === -1) {
      throw new Error(`ULID 含非 Crockford Base32 字符：${ulid[index] ?? ''}`);
    }
    timestamp = timestamp * 32 + digit;
  }
  return timestamp;
}

function encodeTimestamp(timestamp: number): string {
  let remaining = timestamp;
  const chars = new Array<string>(TIMESTAMP_CHARS);
  for (let index = TIMESTAMP_CHARS - 1; index >= 0; index -= 1) {
    chars[index] = ULID_ENCODING[remaining % 32] as string;
    remaining = Math.floor(remaining / 32);
  }
  if (remaining > 0) {
    throw new Error(`ULID 时间戳超出 48 位编码上限：${timestamp}`);
  }
  return chars.join('');
}

function encodeRandom(bytes: Uint8Array): string {
  // 10 字节 = 80 位 → 16 个 5 位组，大端序逐组取位。
  const chars = new Array<string>(16);
  for (let group = 0; group < 16; group += 1) {
    const bitOffset = group * 5;
    let value = 0;
    for (let bit = 0; bit < 5; bit += 1) {
      const sourceBit = bitOffset + bit;
      const byte = bytes[Math.floor(sourceBit / 8)] ?? 0;
      const isSet = (byte & (1 << (7 - (sourceBit % 8)))) !== 0;
      value = value * 2 + (isSet ? 1 : 0);
    }
    chars[group] = ULID_ENCODING[value] as string;
  }
  return chars.join('');
}

/** 随机段大端 +1；溢出（全 1 进位）返回 `false` 交由调用方进位时间戳。 */
function incrementRandom(bytes: Uint8Array): boolean {
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    const next = ((bytes[index] ?? 0) + 1) & 0xff;
    bytes[index] = next;
    if (next !== 0) {
      return true;
    }
  }
  return false;
}

/** 生成器选项（测试注入面）。 */
export interface IUlidGeneratorOptions {
  /** 当前时间（Unix 毫秒）；缺省 `Date.now`。 */
  readonly now?: () => number;
  /** 随机源填充器；缺省 `crypto.getRandomValues`。 */
  readonly fillRandom?: (bytes: Uint8Array) => void;
}

/** ULID 生成器：单次取值严格大于同实例上一次取值。 */
export interface IUlidGenerator {
  /** 取下一个 ULID（同实例字典序严格单调）。 */
  next(): string;
}

function defaultFill(bytes: Uint8Array): void {
  globalThis.crypto.getRandomValues(bytes);
}

/**
 * 创建单调 ULID 生成器。
 *
 * @param options 时钟与随机源注入面（缺省 `Date.now` + Web Crypto）。
 */
export function createUlidGenerator(options: IUlidGeneratorOptions = {}): IUlidGenerator {
  const now = options.now ?? Date.now;
  const fill = options.fillRandom ?? defaultFill;
  let lastTimestamp = -1;
  let lastRandom: Uint8Array | null = null;

  const freshRandom = (): Uint8Array => {
    const bytes = new Uint8Array(RANDOM_BYTES);
    fill(bytes);
    return bytes;
  };

  return {
    next(): string {
      let timestamp = Math.max(now(), lastTimestamp);
      let random: Uint8Array;
      if (timestamp === lastTimestamp && lastRandom !== null) {
        // 同毫秒：随机段大端 +1 保严格递增；溢出则进位时间戳并重新取熵。
        const carried = incrementRandom(lastRandom);
        if (carried) {
          random = lastRandom;
        } else {
          timestamp += 1;
          random = freshRandom();
        }
      } else {
        random = freshRandom();
      }
      lastTimestamp = timestamp;
      lastRandom = random;
      return encodeTimestamp(timestamp) + encodeRandom(random);
    },
  };
}
