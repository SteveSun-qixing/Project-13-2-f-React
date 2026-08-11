import type { BasecardConfig, ImageItem, LayoutOptions, LayoutType } from "../schema/card-config";

const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/tiff",
] as const;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function generateImageId(length = 10): string {
  let id = "";
  for (let index = 0; index < length; index += 1) {
    id += BASE62_ALPHABET[Math.floor(Math.random() * BASE62_ALPHABET.length)];
  }
  return id;
}

export function cloneConfig<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function sanitizeImportedFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const sanitized = trimmed
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim() ?? "";

  return sanitized.length > 0 ? sanitized : "image";
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

export function validateImageUrl(value: string): boolean {
  if (!isNonEmptyString(value)) {
    return false;
  }

  if (/^data:image\//i.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateImageFormat(mimeType: string, acceptedFormats = ACCEPTED_IMAGE_MIME_TYPES): boolean {
  return acceptedFormats.includes(mimeType as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number]);
}

export function isTiffImageFile(file: File): boolean {
  const lowerName = file.name.trim().toLowerCase();
  return file.type === "image/tiff" || lowerName.endsWith(".tif") || lowerName.endsWith(".tiff");
}

export function toPngOutputPath(resourcePath: string): string {
  const normalizedPath = normalizeRelativeCardResourcePath(resourcePath) ?? "image";
  if (/\.(tif|tiff)$/i.test(normalizedPath)) {
    return normalizedPath.replace(/\.(tif|tiff)$/i, ".png");
  }

  if (/\.[^/.]+$/.test(normalizedPath)) {
    return normalizedPath.replace(/\.[^/.]+$/, ".png");
  }

  return `${normalizedPath}.png`;
}

export function getEffectiveLayoutType(config: BasecardConfig): LayoutType {
  if (config.images.length <= 1) {
    return "single";
  }

  return config.layout_type === "single" ? "grid" : config.layout_type;
}

export function getInternalResourcePaths(config: BasecardConfig): string[] {
  const paths = new Set<string>();
  for (const image of config.images) {
    if (image.source === "file") {
      const resourcePath = normalizeRelativeCardResourcePath(image.file_path);
      if (resourcePath) {
        paths.add(resourcePath);
      }
    }
  }
  return Array.from(paths);
}

export function countInternalResourcePaths(images: ImageItem[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const image of images) {
    if (image.source !== "file") {
      continue;
    }

    const resourcePath = normalizeRelativeCardResourcePath(image.file_path);
    if (!resourcePath) {
      continue;
    }

    counts.set(resourcePath, (counts.get(resourcePath) ?? 0) + 1);
  }

  return counts;
}

export function getRemovedInternalResourcePaths(previous: BasecardConfig, next: BasecardConfig): string[] {
  const previousCounts = countInternalResourcePaths(previous.images);
  const nextCounts = countInternalResourcePaths(next.images);
  const removed: string[] = [];

  for (const [resourcePath, count] of previousCounts.entries()) {
    const nextCount = nextCounts.get(resourcePath) ?? 0;
    if (count > 0 && nextCount === 0) {
      removed.push(resourcePath);
    }
  }

  return removed;
}

export function getImageDisplaySource(
  image: ImageItem,
  resolvedFileUrls: Map<string, string>,
): string {
  if (image.source === "url") {
    return image.url ?? "";
  }

  const resourcePath = normalizeRelativeCardResourcePath(image.file_path);
  if (!resourcePath) {
    return "";
  }

  return resolvedFileUrls.get(resourcePath) ?? "";
}

export function getSpacingMetrics(layoutOptions?: LayoutOptions): {
  spacingMode: "none" | "comfortable";
  gap: number;
  radius: number;
} {
  const spacingMode = layoutOptions?.spacing_mode === "none" ? "none" : "comfortable";

  return spacingMode === "none"
    ? {
        spacingMode,
        gap: 0,
        radius: 0,
      }
    : {
        spacingMode,
        gap: 10,
        radius: 12,
      };
}
