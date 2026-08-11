import type { BasecardConfig } from "../schema/card-config";
import { isRelativeResourcePath, normalizeResourcePath } from "./utils";

export type RichTextOpenResource = (input: {
  resourceId: string;
  mimeType?: string;
  title?: string;
  fileName?: string;
  payload?: Record<string, unknown>;
}) => void;

type ChipsBridgeLike = {
  invoke?: (route: string, input?: Record<string, unknown>) => Promise<unknown>;
};

function detectResourceProtocol(resourceUrl: string): string | null {
  const match = resourceUrl.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/);
  return match?.[1]?.toLowerCase() ?? null;
}

function decodeFileUrlPath(resourceUrl: string): string | null {
  try {
    const url = new URL(resourceUrl);
    if (url.protocol !== "file:") {
      return null;
    }

    if (url.hostname && url.hostname !== "localhost") {
      return `//${url.hostname}${decodeURIComponent(url.pathname)}`;
    }

    const decodedPath = decodeURIComponent(url.pathname);
    if (/^\/[a-zA-Z]:\//.test(decodedPath)) {
      return decodedPath.slice(1);
    }

    return decodedPath;
  } catch {
    return null;
  }
}

async function readTextViaBridge(resourceUrl: string): Promise<string | null> {
  const absolutePath = decodeFileUrlPath(resourceUrl);
  if (!absolutePath) {
    return null;
  }

  const bridge = (globalThis as { window?: { chips?: ChipsBridgeLike }; chips?: ChipsBridgeLike }).window?.chips
    ?? (globalThis as { chips?: ChipsBridgeLike }).chips;
  if (!bridge || typeof bridge.invoke !== "function") {
    return null;
  }

  const result = await bridge.invoke("file.read", {
    path: absolutePath,
    options: { encoding: "utf-8" },
  });
  const content = (result as { content?: unknown } | null)?.content ?? result;
  return typeof content === "string" ? content : null;
}

async function readTextViaFetch(resourceUrl: string, resourcePath: string): Promise<string> {
  const response = await fetch(resourceUrl);
  if (!response.ok) {
    throw new Error(`无法读取 Markdown 资源：${resourcePath}`);
  }

  return await response.text();
}

export async function loadMarkdownFromConfig(
  config: BasecardConfig,
  options?: {
    resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  },
): Promise<string> {
  if (config.content_source === "inline") {
    return config.content_text ?? "";
  }

  const resourcePath = normalizeResourcePath(config.content_file ?? "");
  if (!resourcePath) {
    return "";
  }

  const resolveResourceUrl = options?.resolveResourceUrl;
  const resourceUrl = resolveResourceUrl
    ? await resolveResourceUrl(resourcePath)
    : resourcePath;
  const protocol = detectResourceProtocol(resourceUrl);

  if (protocol === "file") {
    const bridgeText = await readTextViaBridge(resourceUrl);
    if (typeof bridgeText === "string") {
      return bridgeText;
    }

    throw new Error(`无法通过正式文件服务读取 Markdown 资源：${resourcePath}`);
  }

  return readTextViaFetch(resourceUrl, resourcePath);
}

export async function rewriteRelativeResourceUrls(
  container: HTMLElement,
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
  openResource?: RichTextOpenResource,
): Promise<string[]> {
  const tracked = new Set<string>();
  const tasks: Array<Promise<void>> = [];

  for (const element of Array.from(container.querySelectorAll<HTMLElement>("img[src], a[href]"))) {
    const attribute = element.tagName.toLowerCase() === "img" ? "src" : "href";
    const isAnchor = attribute === "href";
    const rawValue = element.getAttribute(attribute) ?? "";
    if (!isRelativeResourcePath(rawValue)) {
      if (isAnchor) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
      continue;
    }

    const resourcePath = normalizeResourcePath(rawValue);
    if (!resourcePath) {
      continue;
    }

    tracked.add(resourcePath);
    if (isAnchor) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
      if (openResource) {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          openResource({
            resourceId: resourcePath,
            fileName: resourcePath.split("/").pop(),
            payload: {
              kind: "chips.richtext-card",
              version: "1.0.0",
              cardType: "base.richtext",
              resourcePath,
            },
          });
        });
      }
    }

    if (resolveResourceUrl) {
      tasks.push(
        resolveResourceUrl(resourcePath)
          .then((resolvedUrl) => {
            element.setAttribute(attribute, resolvedUrl);
          })
          .catch(() => {
            // 保持原始相对路径，交由宿主或 base href 决定最终行为。
          }),
      );
    }
  }

  await Promise.all(tasks);
  return Array.from(tracked);
}
