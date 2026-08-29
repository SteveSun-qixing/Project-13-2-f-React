import type { IconDescriptor } from "chips-sdk";
import type { BasecardConfig } from "./schema/card-config";
import { mountBasecardView } from "./render/runtime";
import { mountBasecardEditor } from "./editor/runtime";
import {
  collectBasecardResourcePaths,
  defaultBasecardConfig,
  normalizeBasecardConfig,
  validateBasecardConfig,
} from "./schema/card-config";

export interface BasecardResourceImportRequest {
  file: File;
  preferredPath?: string;
}

export interface BasecardResourceImportResult {
  path: string;
}

export interface BasecardArchiveImportRequest {
  file: File;
  preferredRootDir?: string;
  entryFile?: string;
}

export interface BasecardArchiveImportResult {
  rootDir: string;
  entryFile?: string;
  resourcePaths: string[];
}

export interface BasecardTiffToPngRequest {
  resourcePath: string;
  outputPath: string;
  overwrite?: boolean;
}

export interface BasecardTiffToPngResult {
  path: string;
  mimeType: "image/png";
  sourceMimeType: "image/tiff";
  width?: number;
  height?: number;
}

export interface BasecardOpenResourceInput {
  resourceId: string;
  mimeType?: string;
  title?: string;
  fileName?: string;
  payload?: Record<string, unknown>;
}

export interface BasecardRenderContext {
  container: HTMLElement;
  config: BasecardConfig;
  themeCssText?: string;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: BasecardOpenResourceInput) => void;
}

export interface BasecardEditorContext {
  container: HTMLElement;
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (input: BasecardResourceImportRequest) => Promise<BasecardResourceImportResult>;
  importArchiveBundle?: (input: BasecardArchiveImportRequest) => Promise<BasecardArchiveImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  convertTiffToPng?: (input: BasecardTiffToPngRequest) => Promise<BasecardTiffToPngResult>;
}

export function renderBasecardView(ctx: BasecardRenderContext): () => void {
  return mountBasecardView(ctx);
}

export function renderBasecardEditor(ctx: BasecardEditorContext): () => void {
  return mountBasecardEditor(ctx);
}

const fileBasecardIcon: IconDescriptor = {
  name: "draft",
  decorative: true,
};

export const basecardDefinition = {
  pluginId: "chips.basecard.file",
  cardType: "base.file",
  displayName: "文件基础卡片",
  description: "在复合卡片中保存任意文件，展示文件名与后缀，并通过统一资源打开链路打开文件。",
  icon: fileBasecardIcon,
  aliases: ["FileCard"],
  commitDebounceMs: 260,
  previewPointerEvents: "shielded",
  createInitialConfig(_baseCardId: string) {
    return normalizeBasecardConfig(
      defaultBasecardConfig as unknown as Record<string, unknown>,
    ) as unknown as Record<string, unknown>;
  },
  normalizeConfig(input: Record<string, unknown>, _baseCardId: string) {
    return normalizeBasecardConfig(input) as unknown as Record<string, unknown>;
  },
  validateConfig(config: Record<string, unknown>) {
    return validateBasecardConfig(
      normalizeBasecardConfig(config),
    );
  },
  collectResourcePaths(config: Record<string, unknown>) {
    return collectBasecardResourcePaths(config);
  },
  renderView(ctx: {
    container: HTMLElement;
    config: Record<string, unknown>;
    themeCssText?: string;
    resolveResourceUrl?: (resourcePath: string) => Promise<string>;
    releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
    openResource?: (input: BasecardOpenResourceInput) => void;
  }) {
    return renderBasecardView({
      container: ctx.container,
      config: normalizeBasecardConfig(ctx.config),
      themeCssText: ctx.themeCssText,
      resolveResourceUrl: ctx.resolveResourceUrl,
      releaseResourceUrl: ctx.releaseResourceUrl,
      openResource: ctx.openResource,
    });
  },
  renderEditor(ctx: {
    container: HTMLElement;
    initialConfig: Record<string, unknown>;
    onChange: (next: Record<string, unknown>) => void;
    resolveResourceUrl?: (resourcePath: string) => Promise<string>;
    releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
    importResource?: (input: BasecardResourceImportRequest) => Promise<BasecardResourceImportResult>;
    importArchiveBundle?: (input: BasecardArchiveImportRequest) => Promise<BasecardArchiveImportResult>;
    deleteResource?: (resourcePath: string) => Promise<void>;
    convertTiffToPng?: (input: BasecardTiffToPngRequest) => Promise<BasecardTiffToPngResult>;
  }) {
    return renderBasecardEditor({
      container: ctx.container,
      initialConfig: normalizeBasecardConfig(ctx.initialConfig),
      onChange(next) {
        ctx.onChange(next as unknown as Record<string, unknown>);
      },
      resolveResourceUrl: ctx.resolveResourceUrl,
      releaseResourceUrl: ctx.releaseResourceUrl,
      importResource: ctx.importResource,
      importArchiveBundle: ctx.importArchiveBundle,
      deleteResource: ctx.deleteResource,
      convertTiffToPng: ctx.convertTiffToPng,
    });
  },
} as const;
