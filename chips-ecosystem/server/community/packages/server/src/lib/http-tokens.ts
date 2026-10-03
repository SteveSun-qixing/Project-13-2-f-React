import { createHash, randomUUID } from 'node:crypto';

/**
 * 令牌有效期与时长解析。
 */

const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/** 解析 `15m` / `30d` 形态的有效期为秒；非法格式返回缺省值。 */
export function parseExpiresInToSeconds(expiresIn: string, fallbackSeconds: number): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  if (match === null) {
    return fallbackSeconds;
  }
  const amount = Number.parseInt(match[1] ?? '', 10);
  const unit = UNIT_SECONDS[match[2] ?? ''];
  if (!Number.isFinite(amount) || unit === undefined) {
    return fallbackSeconds;
  }
  return amount * unit;
}

/** X-Request-Id 合法性：32–128 个可见 ASCII 字符（契约 §2.4）。 */
export function isValidRequestId(value: string): boolean {
  return /^[\x21-\x7E]{32,128}$/.test(value);
}

/** 服务端生成 32 字符请求追踪标识。 */
export function generateRequestId(): string {
  return (randomUUID() + randomUUID()).replaceAll('-', '').slice(0, 32);
}

/** 幂等键合法性：8–128 个可见 ASCII 字符（契约 §6.2）。 */
export function isValidIdempotencyKey(value: string): boolean {
  return /^[\x21-\x7E]{8,128}$/.test(value);
}

/** 稳定 ETag（强校验值，双引号包裹）。 */
export function strongETag(body: string): string {
  return `"${createHash('sha256').update(body).digest('hex')}"`;
}
