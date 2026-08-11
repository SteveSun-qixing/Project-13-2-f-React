import React, { useEffect, useState } from "react";
import type { BasecardConfig } from "../schema/card-config";

const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SUPPORTED_URL_PROTOCOLS = new Set(["http:", "https:"]);

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function cloneConfig<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function generateStableId(prefix: string, length = 10): string {
  let id = "";
  for (let index = 0; index < length; index += 1) {
    id += BASE62_ALPHABET[Math.floor(Math.random() * BASE62_ALPHABET.length)];
  }
  return `${prefix}-${id}`;
}

export function normalizeRelativeCardResourcePath(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  const trimmed = value.trim();
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("~") ||
    /[\u0000-\u001f]/.test(trimmed) ||
    /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed) ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return undefined;
  }

  const normalized = trimmed.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("?") || normalized.includes("#")) {
    return undefined;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    return undefined;
  }

  return segments.join("/");
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

export function inferVideoMimeType(resourcePath: string): string | undefined {
  const lower = resolveFileName(resourcePath).toLowerCase();

  if (lower.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (lower.endsWith(".webm")) {
    return "video/webm";
  }
  if (lower.endsWith(".mov")) {
    return "video/quicktime";
  }
  if (lower.endsWith(".m4v")) {
    return "video/x-m4v";
  }
  if (lower.endsWith(".ogv") || lower.endsWith(".ogg")) {
    return "video/ogg";
  }

  return undefined;
}

export function inferSubtitleMimeType(resourcePath: string): string | undefined {
  const lower = resolveFileName(resourcePath).toLowerCase();

  if (lower.endsWith(".vtt")) {
    return "text/vtt";
  }
  if (lower.endsWith(".srt")) {
    return "application/x-subrip";
  }
  if (lower.endsWith(".ass") || lower.endsWith(".ssa")) {
    return "text/plain";
  }

  return undefined;
}

export function collectInternalResourcePaths(config: BasecardConfig): string[] {
  const paths = new Set<string>();

  [
    config.video_file,
    config.cover_image,
    ...config.subtitles.map((subtitle) => subtitle.file_path),
  ].forEach((resourcePath) => {
    const normalized = normalizeRelativeCardResourcePath(resourcePath);
    if (normalized) {
      paths.add(normalized);
    }
  });

  return Array.from(paths);
}

export function dedupeResourcePaths(resourcePaths: string[]): string[] {
  return Array.from(new Set(
    resourcePaths
      .map((resourcePath) => normalizeRelativeCardResourcePath(resourcePath))
      .filter((resourcePath): resourcePath is string => Boolean(resourcePath)),
  ));
}

export function deriveDisplayTitle(config: BasecardConfig): string {
  if (isNonEmptyString(config.video_title)) {
    return config.video_title.trim();
  }

  const fileName = resolveFileName(config.video_file);
  if (fileName) {
    return stripFileExtension(fileName);
  }

  return "";
}

export function deriveMetaLine(config: BasecardConfig): string {
  return [config.creator.trim(), config.publish_time.trim()]
    .filter((value) => value.length > 0)
    .join(" · ");
}

export async function resolveResourceUrlWithRetry(
  resolveResourceUrl: ((resourcePath: string) => Promise<string>) | undefined,
  resourcePath: string,
): Promise<string> {
  if (!resolveResourceUrl) {
    return "";
  }

  try {
    return await resolveResourceUrl(resourcePath);
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 16));
    return resolveResourceUrl(resourcePath).catch(() => {
      throw firstError;
    });
  }
}

export function getImmediateResourceUrl(
  resourcePath: string,
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
): string {
  const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalizedPath) {
    return "";
  }

  return resolveResourceUrl ? "" : normalizedPath;
}

export function isSupportedImportUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return SUPPORTED_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function useResolvedResourceUrl(
  resourcePath: string,
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void,
): string {
  const [resolvedUrl, setResolvedUrl] = useState(() => getImmediateResourceUrl(resourcePath, resolveResourceUrl));

  useEffect(() => {
    let cancelled = false;
    const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);

    if (!normalizedPath) {
      setResolvedUrl("");
      return undefined;
    }

    if (!resolveResourceUrl) {
      setResolvedUrl(normalizedPath);
      return undefined;
    }

    setResolvedUrl("");

    void resolveResourceUrlWithRetry(resolveResourceUrl, normalizedPath)
      .then((nextUrl) => {
        if (!cancelled) {
          setResolvedUrl(nextUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUrl("");
        }
      });

    return () => {
      cancelled = true;
      void Promise.resolve(releaseResourceUrl?.(normalizedPath)).catch(() => undefined);
    };
  }, [releaseResourceUrl, resolveResourceUrl, resourcePath]);

  return resolvedUrl;
}
