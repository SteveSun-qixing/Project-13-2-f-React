import type { CSSProperties } from 'react';

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let current = value;
  let index = 0;

  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }

  return `${current.toFixed(current >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function getInitial(label?: string | null): string {
  return (label?.trim()?.[0] ?? '?').toUpperCase();
}

export function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseCoverRatio(value?: string | null): number {
  if (!value) {
    return 3 / 4;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 3 / 4;
  }

  const separator = trimmed.includes(':') ? ':' : trimmed.includes('/') ? '/' : null;
  if (!separator) {
    const numeric = parsePositiveNumber(trimmed);
    return numeric ?? 3 / 4;
  }

  const [rawWidth, rawHeight] = trimmed.split(separator, 2);
  const width = parsePositiveNumber(rawWidth);
  const height = parsePositiveNumber(rawHeight);
  if (!width || !height) {
    return 3 / 4;
  }

  return width / height;
}

export function getWorkCoverStyle(coverRatio?: string | null): CSSProperties {
  const ratio = parseCoverRatio(coverRatio);
  const isLandscape = ratio >= 1;
  const widthFactor = isLandscape ? 1 : ratio;
  const heightFactor = isLandscape ? 1 / ratio : 1;

  return {
    '--work-width-factor': widthFactor.toFixed(6),
    '--work-height-factor': heightFactor.toFixed(6),
  } as CSSProperties;
}

export function getAdminHref(): string {
  return import.meta.env.DEV ? 'http://localhost:5174/admin/' : '/admin/';
}

export function getPostAuthPath(
  user: { username: string; role?: string },
  fromPath?: string,
): string {
  if (user.role === 'admin') {
    return '/admin';
  }

  if (
    fromPath &&
    fromPath.startsWith('/') &&
    fromPath !== '/' &&
    fromPath !== '/login' &&
    fromPath !== '/register'
  ) {
    return fromPath;
  }

  return `/@${user.username}`;
}
