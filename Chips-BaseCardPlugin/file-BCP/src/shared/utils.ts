export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function cloneConfig<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function sanitizeImportedFileName(fileName: string, fallbackStem: string): string {
  const sanitized = fileName
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim() ?? "";

  return sanitized || fallbackStem;
}

export function normalizeRelativeCardResourcePath(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  const normalized = value.replace(/\\/g, "/").trim().replace(/^\.?\//, "");
  if (!normalized) {
    return undefined;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    return undefined;
  }

  return segments.join("/");
}

export function resolveFileName(resourcePath: string | undefined): string {
  const normalized = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "";
}

export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, "");
}

export function resolveFileExtension(fileName: string): string {
  const match = /\.([^.]+)$/u.exec(resolveFileName(fileName));
  return match?.[1]?.toLowerCase() ?? "";
}

export async function resolveResourceUrlWithRetry(
  resolveResourceUrl: ((resourcePath: string) => Promise<string>) | undefined,
  resourcePath: string,
): Promise<string> {
  if (!resolveResourceUrl) {
    return "";
  }

  const retryDelaysMs = [24, 72, 160, 320, 640];
  let firstError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await resolveResourceUrl(resourcePath);
    } catch (error) {
      firstError ??= error;
      if (attempt === retryDelaysMs.length) {
        throw firstError;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
    }
  }

  throw firstError;
}


export function deriveFileStem(resourcePath: string | undefined): string {
  const fileName = resolveFileName(resourcePath);
  if (!fileName) {
    return "";
  }

  return stripFileExtension(fileName);
}

export function formatExtensionBadge(fileExtension: string): string {
  const normalized = fileExtension.trim().toLowerCase().replace(/^\./u, "");
  if (!normalized) {
    return "";
  }

  return normalized.slice(0, 4).toUpperCase();
}
