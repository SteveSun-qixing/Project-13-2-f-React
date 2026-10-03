/**
 * 前台展示工具（`lib/` 路由与工具，《14 设计》§2.2）：
 * 错误消息取用、作品磁贴封面比例排版与占位首字。
 */

import type { CSSProperties } from 'react';

import { CommunityApiError } from '../api/errors';

/** 取面向用户的简体中文错误消息：社区错误信封的 `message` 一律简体中文（契约 §7.2）。 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CommunityApiError && error.message.trim().length > 0) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

/** 标题首字：封面缺失时磁贴占位展示。 */
export function getInitial(label: string | null | undefined): string {
  const first = label?.trim()?.[0];
  return first ? first.toUpperCase() : '?';
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** 解析 `coverRatio`（`3:4` / `3/4` / 正数），非法或缺省回退 3:4。 */
export function parseCoverRatio(value: string | null | undefined): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return 3 / 4;
  }
  const separator = trimmed.includes(':') ? ':' : trimmed.includes('/') ? '/' : null;
  if (!separator) {
    return parsePositiveNumber(trimmed) ?? 3 / 4;
  }
  const [rawWidth, rawHeight] = trimmed.split(separator, 2);
  const width = rawWidth === undefined ? null : parsePositiveNumber(rawWidth);
  const height = rawHeight === undefined ? null : parsePositiveNumber(rawHeight);
  if (!width || !height) {
    return 3 / 4;
  }
  return width / height;
}

/** 磁贴封面排版变量：按封面比例约束磁贴占位面积。 */
export function getWorkCoverStyle(coverRatio: string | null | undefined): CSSProperties {
  const ratio = parseCoverRatio(coverRatio);
  const isLandscape = ratio >= 1;
  const widthFactor = isLandscape ? 1 : ratio;
  const heightFactor = isLandscape ? 1 / ratio : 1;
  return {
    '--ccw-work-width-factor': widthFactor.toFixed(6),
    '--ccw-work-height-factor': heightFactor.toFixed(6),
  } as CSSProperties;
}
