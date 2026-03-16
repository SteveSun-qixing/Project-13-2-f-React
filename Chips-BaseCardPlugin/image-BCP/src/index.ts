import type { BasecardConfig } from "./schema/card-config";
import { mountBasecardView } from "./render/runtime";
import { mountBasecardEditor } from "./editor/runtime";
import {
  collectReferencedResources,
  createInitialBasecardConfig,
  getBasecardDescriptor,
  normalizeBasecardConfig,
  validateBasecardConfig,
} from "./runtime-contract";

export interface BasecardImportedResource {
  path: string;
  url?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

export interface BasecardResourceImportRequest {
  file: File;
  preferredPath?: string;
}

export interface BasecardRenderContext {
  container: HTMLElement;
  config: BasecardConfig;
  themeCssText?: string;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
}

export interface BasecardValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface BasecardValidationResult {
  valid: boolean;
  issues: BasecardValidationIssue[];
}

export interface BasecardEditorContext {
  container: HTMLElement;
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (input: BasecardResourceImportRequest) => Promise<BasecardImportedResource | { path: string }>;
  deleteResource?: (resourcePath: string) => Promise<void>;
}

export function renderBasecardView(ctx: BasecardRenderContext): () => void {
  return mountBasecardView(ctx);
}

export function renderBasecardEditor(ctx: BasecardEditorContext): () => void {
  return mountBasecardEditor(ctx);
}

export {
  collectReferencedResources,
  createInitialBasecardConfig,
  getBasecardDescriptor,
  normalizeBasecardConfig,
  validateBasecardConfig,
};
