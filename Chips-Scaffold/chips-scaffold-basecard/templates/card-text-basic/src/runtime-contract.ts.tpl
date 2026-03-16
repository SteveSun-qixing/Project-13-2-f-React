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

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function getBasecardDescriptor(): BasecardRuntimeDescriptor {
  return {
    cardType: "{{ CARD_TYPE }}",
    displayName: "{{ DISPLAY_NAME }}",
    commitDebounceMs: 260,
  };
}

export function createInitialBasecardConfig(baseCardId: string): BasecardConfig {
  return normalizeBasecardConfig(
    {
      ...defaultBasecardConfig,
      title: "未命名标题",
      body: "请输入内容",
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
    title: asNonEmptyString(input.title) ?? "未命名标题",
    body: asNonEmptyString(input.body) ?? "请输入内容",
    locale: asNonEmptyString(input.locale) ?? defaultBasecardConfig.locale ?? "zh-CN",
  };
}

export function validateBasecardConfig(config: BasecardConfig): BasecardValidationResult {
  const issues: BasecardValidationIssue[] = [];

  if (!isNonEmptyString(config.title)) {
    issues.push({
      path: "title",
      message: "标题不能为空。",
      code: "BASECARD_TITLE_REQUIRED",
    });
  }

  if (!isNonEmptyString(config.body)) {
    issues.push({
      path: "body",
      message: "内容不能为空。",
      code: "BASECARD_BODY_REQUIRED",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function collectReferencedResources(_config: BasecardConfig): string[] {
  return [];
}
