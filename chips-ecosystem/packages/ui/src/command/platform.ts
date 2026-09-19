/**
 * 运行平台判定（用于快捷键归一化与展示格式）。
 *
 * 跨端差异由平台壳吸收（架构原则 R6）；共享层只区分 macOS 与其他平台两种展示口径，
 * 不按平台名分支业务逻辑。
 */

/** 平台种类：macOS / 其他（Windows、Linux）。 */
export type PlatformKind = 'mac' | 'other';

/**
 * 判定当前运行平台。
 *
 * @returns `mac` 或 `other`；无 `navigator` 的运行环境按 `other` 收口
 */
export function detectPlatform(): PlatformKind {
  if (typeof navigator === 'undefined') {
    return 'other';
  }
  const platform = typeof navigator.platform === 'string' ? navigator.platform : '';
  if (/mac|iphone|ipad|ipod/i.test(platform)) {
    return 'mac';
  }
  const userAgent = typeof navigator.userAgent === 'string' ? navigator.userAgent : '';
  return /macintosh|mac os x/i.test(userAgent) ? 'mac' : 'other';
}
