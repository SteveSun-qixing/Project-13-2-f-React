function isAbsoluteUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value.trim());
}

export function normalizeEpubPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').trim();
  if (!normalized) {
    return '';
  }

  const segments: string[] = [];
  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join('/');
}

export function dirnameEpubPath(value: string): string {
  const normalized = normalizeEpubPath(value);
  const slashIndex = normalized.lastIndexOf('/');
  if (slashIndex < 0) {
    return '';
  }
  return normalized.slice(0, slashIndex);
}

export function resolveEpubPathFromDirectory(baseDirectoryPath: string, nextPath: string): string {
  const trimmed = nextPath.trim();
  if (!trimmed) {
    return normalizeEpubPath(baseDirectoryPath);
  }

  if (isAbsoluteUrl(trimmed)) {
    return trimmed;
  }

  const normalizedDirectory = normalizeEpubPath(baseDirectoryPath);
  const combined = trimmed.startsWith('/')
    ? trimmed.slice(1)
    : normalizedDirectory
      ? `${normalizedDirectory}/${trimmed}`
      : trimmed;

  return normalizeEpubPath(combined);
}

export function splitEpubHref(href: string): { path: string; fragment?: string | undefined } {
  const trimmed = href.trim();
  if (!trimmed) {
    return { path: '' };
  }

  const hashIndex = trimmed.indexOf('#');
  if (hashIndex < 0) {
    return { path: trimmed };
  }

  const path = trimmed.slice(0, hashIndex);
  const fragment = trimmed.slice(hashIndex + 1).trim();

  return {
    path,
    fragment: fragment || undefined,
  };
}

export function resolveEpubPath(basePath: string, nextPath: string): string {
  const trimmed = nextPath.trim();
  if (!trimmed) {
    return normalizeEpubPath(basePath);
  }

  if (isAbsoluteUrl(trimmed)) {
    return trimmed;
  }

  return resolveEpubPathFromDirectory(dirnameEpubPath(basePath), trimmed);
}

export function resolveEpubHref(
  basePath: string,
  href: string
): { path: string; fragment?: string | undefined } {
  const { path, fragment } = splitEpubHref(href);

  return {
    path: path ? resolveEpubPath(basePath, path) : normalizeEpubPath(basePath),
    fragment,
  };
}

export function joinEpubHref(path: string, fragment?: string): string {
  const normalizedPath = normalizeEpubPath(path);
  return fragment ? `${normalizedPath}#${fragment}` : normalizedPath;
}

export function isExternalHref(href: string): boolean {
  const trimmed = href.trim().toLowerCase();
  return (
    trimmed.startsWith('http:') ||
    trimmed.startsWith('https:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  );
}
