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

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleFromBody(html: string): { title: string; body: string } {
  const headingMatch = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!headingMatch) {
    return {
      title: "",
      body: html.trim(),
    };
  }

  const headingHtml = headingMatch[0];
  const title = stripHtmlTags(headingMatch[1] ?? "");
  return {
    title,
    body: html.replace(headingHtml, "").trim(),
  };
}

export function normalizeBasecardConfig(
  ctx: BasecardNormalizeContext
): BasecardConfig {
  const body =
    (typeof ctx.rawConfig.body === "string" && ctx.rawConfig.body) ||
    (typeof ctx.rawConfig.content_text === "string" && ctx.rawConfig.content_text) ||
    "";
  const normalized = extractTitleFromBody(body);

  return {
    id: asString(ctx.rawConfig.id) ?? ctx.nodeId,
    title: asString(ctx.rawConfig.title) ?? normalized.title ?? ctx.nodeId,
    body: normalized.body || body,
    locale: asString(ctx.rawConfig.locale) ?? "zh-CN",
  };
}

export function serializeBasecardConfig(
  ctx: BasecardSerializeContext
): Record<string, unknown> {
  const {
    content_source: _contentSource,
    content_text: _contentText,
    content_file: _contentFile,
    ...rest
  } = ctx.previousRawConfig;

  return {
    ...rest,
    id: ctx.config.id || ctx.nodeId,
    card_type: asString(ctx.previousRawConfig.card_type) ?? ctx.cardType,
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
