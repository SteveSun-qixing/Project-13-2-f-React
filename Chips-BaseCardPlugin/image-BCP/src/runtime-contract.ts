import type { BasecardConfig } from "./schema/card-config";
import {
  defaultBasecardConfig,
  normalizeBasecardConfig as normalizeImageConfig,
  validateBasecardConfig as validateImageConfig,
} from "./schema/card-config";
import { getInternalResourcePaths } from "./shared/utils";

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

export function getBasecardDescriptor(): BasecardRuntimeDescriptor {
  return {
    cardType: "base.image",
    displayName: "图片基础卡片",
    commitDebounceMs: 260,
  };
}

export function createInitialBasecardConfig(_baseCardId: string): BasecardConfig {
  return normalizeBasecardConfig(defaultBasecardConfig, _baseCardId);
}

export function normalizeBasecardConfig(
  input: Partial<BasecardConfig> & Record<string, unknown>,
  _baseCardId: string,
): BasecardConfig {
  return normalizeImageConfig(input);
}

export function validateBasecardConfig(config: BasecardConfig): BasecardValidationResult {
  const result = validateImageConfig(config);
  const issues = Object.entries(result.errors).map(([path, message]) => ({
    path,
    message,
    code: `IMAGE_${path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase() || "INVALID"}`,
  }));

  return {
    valid: result.valid,
    issues,
  };
}

export function collectReferencedResources(config: BasecardConfig): string[] {
  return [...new Set(getInternalResourcePaths(config))].sort((left, right) => left.localeCompare(right));
}
