import type { BasecardConfig } from "./schema/card-config";
import { mountBasecardView } from "./render/runtime";
import { mountBasecardEditor } from "./editor/runtime";

export interface BasecardRenderContext {
  container: HTMLElement;
  config: BasecardConfig;
  themeCssText?: string;
}

export interface BasecardEditorContext {
  container: HTMLElement;
  initialConfig: BasecardConfig;
  themeCssText?: string;
  onChange: (next: BasecardConfig) => void;
}

export interface BasecardNormalizeContext {
  nodeId: string;
  cardType: string;
  rawConfig: Record<string, unknown>;
  rawContentPath: string;
  cardRoot: string;
}

export interface BasecardSerializeContext {
  nodeId: string;
  cardType: string;
  config: BasecardConfig;
  previousRawConfig: Record<string, unknown>;
  rawContentPath: string;
  cardRoot: string;
}

export function normalizeBasecardConfig(
  ctx: BasecardNormalizeContext,
): BasecardConfig {
  const title =
    typeof ctx.rawConfig.title === "string" && ctx.rawConfig.title.trim().length > 0
      ? ctx.rawConfig.title.trim()
      : ctx.nodeId;
  const body = typeof ctx.rawConfig.body === "string" ? ctx.rawConfig.body : "";
  return {
    id:
      typeof ctx.rawConfig.id === "string" && ctx.rawConfig.id.trim().length > 0
        ? ctx.rawConfig.id.trim()
        : ctx.nodeId,
    title,
    body,
    locale:
      typeof ctx.rawConfig.locale === "string" && ctx.rawConfig.locale.trim().length > 0
        ? ctx.rawConfig.locale.trim()
        : "zh-CN",
  };
}

export function serializeBasecardConfig(
  ctx: BasecardSerializeContext,
): Record<string, unknown> {
  return {
    ...ctx.previousRawConfig,
    id: ctx.config.id || ctx.nodeId,
    card_type:
      typeof ctx.previousRawConfig.card_type === "string" &&
      ctx.previousRawConfig.card_type.trim().length > 0
        ? ctx.previousRawConfig.card_type
        : ctx.cardType,
    title: ctx.config.title,
    body: ctx.config.body,
    locale: ctx.config.locale ?? "zh-CN",
  };
}

export function renderBasecardView(ctx: BasecardRenderContext): () => void {
  return mountBasecardView(ctx);
}

export function renderBasecardEditor(ctx: BasecardEditorContext): () => void {
  return mountBasecardEditor(ctx);
}
