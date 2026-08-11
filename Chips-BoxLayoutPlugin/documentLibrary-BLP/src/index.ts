import type { IconDescriptor } from "chips-sdk";
import { mountLayoutEditor } from "./editor/runtime";
import { mountLayoutView } from "./view/runtime";
import {
  createDefaultLayoutConfig,
  normalizeLayoutConfig,
  validateLayoutConfig,
  validateLayoutConfigInput,
} from "./schema/layout-config";
import type { LayoutConfig } from "./schema/layout-config";
import type {
  BoxEntryCoverView,
  BoxEntryDocumentView,
  BoxEntryPage,
  BoxEntryQuery,
  BoxEntrySnapshot,
  BoxLayoutRuntime,
  BoxSessionInfo,
  ResolvedRuntimeResource,
} from "./shared/types";

export type {
  BoxEntryCoverView,
  BoxEntryDocumentView,
  BoxEntryPage,
  BoxEntryQuery,
  BoxEntrySnapshot,
  BoxLayoutRuntime,
  BoxSessionInfo,
  LayoutConfig,
  ResolvedRuntimeResource,
};

export interface BoxLayoutRenderContext {
  container: HTMLElement;
  sessionId: string;
  box: BoxSessionInfo;
  initialView: BoxEntryPage;
  config: Record<string, unknown>;
  runtime: BoxLayoutRuntime;
  locale?: string;
}

export interface BoxLayoutEditorContext {
  container: HTMLElement;
  entries: BoxEntrySnapshot[];
  initialConfig: Record<string, unknown>;
  onChange(next: Record<string, unknown>): void;
  readBoxAsset?(assetPath: string): Promise<ResolvedRuntimeResource>;
  importBoxAsset?(input: { file: File; preferredPath?: string }): Promise<{ assetPath: string }>;
  deleteBoxAsset?(assetPath: string): Promise<void>;
  locale?: string;
}

export interface BoxLayoutDefinition {
  pluginId: string;
  layoutType: string;
  displayName: string;
  icon?: IconDescriptor;
  createDefaultConfig(): Record<string, unknown>;
  normalizeConfig(input: Record<string, unknown>): Record<string, unknown>;
  validateConfig(config: Record<string, unknown>): {
    valid: boolean;
    errors: Record<string, string>;
  };
  getInitialQuery?(config: Record<string, unknown>): BoxEntryQuery | undefined;
  renderView(ctx: BoxLayoutRenderContext): (() => void) | void;
  renderEditor?(ctx: BoxLayoutEditorContext): (() => void) | void;
}

export const layoutDefinition: BoxLayoutDefinition = {
  pluginId: "chips.layout.documentlibrary.blp",
  layoutType: "chips.layout.documentlibrary.blp",
  displayName: "文档库布局插件",
  icon: {
    name: "menu_book",
    decorative: true,
  },
  createDefaultConfig() {
    return createDefaultLayoutConfig() as unknown as Record<string, unknown>;
  },
  normalizeConfig(input) {
    return normalizeLayoutConfig(input) as unknown as Record<string, unknown>;
  },
  validateConfig(config) {
    return validateLayoutConfigInput(config);
  },
  getInitialQuery() {
    return {
      limit: 240,
    };
  },
  renderView(ctx) {
    return mountLayoutView({
      container: ctx.container,
      initialView: ctx.initialView,
      config: normalizeLayoutConfig(ctx.config),
      runtime: ctx.runtime,
    });
  },
  renderEditor(ctx) {
    return mountLayoutEditor({
      container: ctx.container,
      entries: ctx.entries,
      initialConfig: normalizeLayoutConfig(ctx.initialConfig),
      readBoxAsset: ctx.readBoxAsset,
      importBoxAsset: ctx.importBoxAsset,
      deleteBoxAsset: ctx.deleteBoxAsset,
      onChange(next) {
        ctx.onChange(next as unknown as Record<string, unknown>);
      },
    });
  },
};
