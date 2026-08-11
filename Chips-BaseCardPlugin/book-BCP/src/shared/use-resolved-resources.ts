import { useEffect, useMemo, useState } from "react";
import { normalizeRelativeCardResourcePath, resolveResourceUrlWithRetry } from "./utils";

export function useResolvedResourceMap(
  resourcePaths: string[],
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void,
): Map<string, string> {
  const [resolved, setResolved] = useState<Map<string, string>>(new Map());
  const resourceKey = resourcePaths.join("\n");
  const normalizedPaths = useMemo(() => (
    Array.from(new Set(resourcePaths
      .map((path) => normalizeRelativeCardResourcePath(path))
      .filter((path): path is string => Boolean(path))))
  ), [resourceKey]);

  useEffect(() => {
    let cancelled = false;
    const resolvedPaths: string[] = [];
    const next = new Map<string, string>();

    async function resolveAll() {
      if (!resolveResourceUrl) {
        return;
      }

      for (const resourcePath of normalizedPaths) {
        if (cancelled) {
          return;
        }

        let resolvedUrl: string;
        try {
          resolvedUrl = await resolveResourceUrlWithRetry(resolveResourceUrl, resourcePath);
        } catch {
          continue;
        }

        next.set(resourcePath, resolvedUrl);
        if (cancelled) {
          void releaseResourceUrl?.(resourcePath);
        } else {
          resolvedPaths.push(resourcePath);
        }
      }

      if (!cancelled) {
        setResolved(next);
      }
    }

    void resolveAll();

    return () => {
      cancelled = true;
      if (releaseResourceUrl) {
        for (const resourcePath of resolvedPaths) {
          void releaseResourceUrl(resourcePath);
        }
      }
    };
  }, [normalizedPaths, releaseResourceUrl, resolveResourceUrl]);

  return resolved;
}
