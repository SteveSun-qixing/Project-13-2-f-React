/**
 * 书源维度的配置相对键编码：书源 ID 十六进制编码隔离（书签与阅读位置共用同一约定，
 * 自旧仓 hooks 逐字迁移，键前缀按新命名空间约定收敛为相对键段）。
 */

/** 书源维度的配置键段：`<前缀>.<十六进制编码的书源 ID>`。 */
export function encodeBookSourceKey(prefix: string, sourceId: string): string {
  const encoded = Array.from(new TextEncoder().encode(sourceId))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}.${encoded}`;
}
