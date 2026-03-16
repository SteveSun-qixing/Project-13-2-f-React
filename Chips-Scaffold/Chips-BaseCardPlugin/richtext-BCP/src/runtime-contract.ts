import type { BasecardConfig } from "./schema/card-config";
import { defaultBasecardConfig } from "./schema/card-config";
import { isNonEmptyString } from "./shared/utils";

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

const RELATIVE_RESOURCE_PROTOCOL_PATTERN = /^(https?:|file:|blob:|data:|mailto:|tel:|#)/i;

function stripMarkup(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function normalizeBody(input: Partial<BasecardConfig> & Record<string, unknown>): string {
  const body = isNonEmptyString(input.body) ? input.body : defaultBasecardConfig.body;
  return body.trim();
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

  if (!normalized || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
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
      id: baseCardId,
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
    title: isNonEmptyString(input.title) ? input.title.trim() : defaultBasecardConfig.title,
    body: normalizeBody(input),
    locale: isNonEmptyString(input.locale) ? input.locale.trim() : defaultBasecardConfig.locale,
  };
}

export function validateBasecardConfig(config: BasecardConfig): BasecardValidationResult {
  const plainText = stripMarkup(typeof config.body === "string" ? config.body : "");
  const valid = plainText.length > 0;

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
  const matches = Array.from(body.matchAll(/<(img|a)\b[^>]+(?:src|href)=["']([^"']+)["']/gi));
  const resources = matches
    .map((match) => normalizeResourcePath(match[2] ?? ""))
    .filter((value): value is string => Boolean(value));
  return [...new Set(resources)].sort((left, right) => left.localeCompare(right));
}
