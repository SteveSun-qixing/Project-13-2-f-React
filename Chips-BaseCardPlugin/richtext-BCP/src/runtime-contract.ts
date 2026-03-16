import type { BasecardConfig } from "./schema/card-config";
import { defaultBasecardConfig } from "./schema/card-config";
import { sanitizeRichTextHtml } from "./shared/utils";

export interface BasecardValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface BasecardValidationResult {
  valid: boolean;
  issues: BasecardValidationIssue[];
}

export interface BasecardRuntimeDescriptor {
  cardType: string;
  displayName: string;
  commitDebounceMs?: number;
}

const EMPTY_RICH_TEXT_BODY = "<p></p>";
const RELATIVE_RESOURCE_PROTOCOL_PATTERN = /^(https?:|file:|blob:|data:|mailto:|tel:|#)/i;

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function sanitizeRichtextHtmlForRuntime(html: string): string {
  if (typeof document !== "undefined") {
    return sanitizeRichTextHtml(html);
  }

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function normalizeRichtextBody(input: Partial<BasecardConfig> & Record<string, unknown>): string {
  const rawBody =
    typeof input.body === "string"
      ? input.body
      : typeof input.content_text === "string"
        ? input.content_text
        : EMPTY_RICH_TEXT_BODY;

  const sanitized = sanitizeRichtextHtmlForRuntime(rawBody);
  return sanitized.trim().length > 0 ? sanitized : EMPTY_RICH_TEXT_BODY;
}

function hasMeaningfulRichtextContent(body: string): boolean {
  const sanitized = sanitizeRichtextHtmlForRuntime(body);
  const plainText = sanitized
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();

  if (plainText.length > 0) {
    return true;
  }

  return /<(img|hr|table|ul|ol|blockquote|pre)\b/i.test(sanitized);
}

function normalizeResourcePath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || RELATIVE_RESOURCE_PROTOCOL_PATTERN.test(trimmed)) {
    return null;
  }

  const [pathname, suffix = ""] = trimmed.split(/([?#].*)/, 2);
  const normalized = pathname
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");

  if (!normalized || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
    return null;
  }

  return `${normalized}${suffix}`;
}

export function getBasecardDescriptor(): BasecardRuntimeDescriptor {
  return {
    cardType: "base.richtext",
    displayName: "富文本基础卡片",
    commitDebounceMs: 260,
  };
}

export function createInitialBasecardConfig(baseCardId: string): BasecardConfig {
  return normalizeBasecardConfig(
    {
      ...defaultBasecardConfig,
      body: EMPTY_RICH_TEXT_BODY,
    },
    baseCardId,
  );
}

export function normalizeBasecardConfig(
  input: Partial<BasecardConfig> & Record<string, unknown>,
  baseCardId: string,
): BasecardConfig {
  return {
    ...defaultBasecardConfig,
    id: baseCardId,
    body: normalizeRichtextBody(input),
    locale: asNonEmptyString(input.locale) ?? defaultBasecardConfig.locale ?? "zh-CN",
  };
}

export function validateBasecardConfig(config: BasecardConfig): BasecardValidationResult {
  const body = typeof config.body === "string" ? config.body : EMPTY_RICH_TEXT_BODY;
  const valid = hasMeaningfulRichtextContent(body);

  return {
    valid,
    issues: valid
      ? []
      : [
          {
            path: "body",
            message: "正文内容不能为空",
            code: "RICH_TEXT_BODY_REQUIRED",
          },
        ],
  };
}

export function collectReferencedResources(config: BasecardConfig): string[] {
  const body = typeof config.body === "string" ? config.body : "";
  if (!body.trim()) {
    return [];
  }

  if (typeof document === "undefined") {
    const matches = Array.from(body.matchAll(/<(img|a)\b[^>]+(?:src|href)=["']([^"']+)["']/gi));
    const resources = matches
      .map((match) => normalizeResourcePath(match[2] ?? ""))
      .filter((value): value is string => Boolean(value));
    return [...new Set(resources)].sort((left, right) => left.localeCompare(right));
  }

  const template = document.createElement("template");
  template.innerHTML = sanitizeRichtextHtmlForRuntime(body);
  const resources = new Set<string>();

  for (const element of Array.from(template.content.querySelectorAll("img[src], a[href]"))) {
    const attributeName = element.tagName.toLowerCase() === "img" ? "src" : "href";
    const rawValue = element.getAttribute(attributeName);
    if (!rawValue) {
      continue;
    }
    const normalized = normalizeResourcePath(rawValue);
    if (normalized) {
      resources.add(normalized);
    }
  }

  return [...resources].sort((left, right) => left.localeCompare(right));
}
