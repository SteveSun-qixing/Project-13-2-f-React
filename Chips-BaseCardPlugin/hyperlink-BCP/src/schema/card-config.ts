import {
  analyzeHyperlinkUrl,
  isNonEmptyString,
  normalizeHyperlinkUrl,
  validateHyperlinkUrl,
} from "../shared/utils";

export type HyperlinkOpenMode = "external-browser" | "resource-router";
export type HyperlinkDisplayDensity = "compact" | "comfortable" | "spacious";

export interface BasecardConfig {
  card_type: "HyperlinkCard";
  theme?: string;
  locale?: string;
  anchor_text: string;
  url: string;
  description: string;
  icon_url: string;
  open_mode: HyperlinkOpenMode;
  display_density: HyperlinkDisplayDensity;
  show_security_hint: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const defaultBasecardConfig: BasecardConfig = {
  card_type: "HyperlinkCard",
  theme: "",
  locale: "zh-CN",
  anchor_text: "",
  url: "",
  description: "",
  icon_url: "",
  open_mode: "external-browser",
  display_density: "comfortable",
  show_security_hint: true,
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function asRawString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeOpenMode(value: unknown): HyperlinkOpenMode {
  return value === "resource-router" || value === "external-browser"
    ? value
    : defaultBasecardConfig.open_mode;
}

function normalizeDisplayDensity(value: unknown): HyperlinkDisplayDensity {
  return value === "compact" || value === "comfortable" || value === "spacious"
    ? value
    : defaultBasecardConfig.display_density;
}

export function normalizeBasecardConfig(
  input: Partial<BasecardConfig> | Record<string, unknown> | null | undefined
): BasecardConfig {
  const record = (input ?? {}) as Record<string, unknown>;
  const rawUrl = asString(record.url) ?? defaultBasecardConfig.url;
  const rawIconUrl = asString(record.icon_url) ?? defaultBasecardConfig.icon_url;

  return {
    card_type: "HyperlinkCard",
    theme: asString(record.theme) ?? defaultBasecardConfig.theme,
    locale: asString(record.locale) ?? defaultBasecardConfig.locale,
    anchor_text: asString(record.anchor_text) ?? defaultBasecardConfig.anchor_text,
    url: normalizeHyperlinkUrl(rawUrl),
    description: asRawString(record.description) ?? defaultBasecardConfig.description,
    icon_url: rawIconUrl ? normalizeHyperlinkUrl(rawIconUrl) : defaultBasecardConfig.icon_url,
    open_mode: normalizeOpenMode(record.open_mode),
    display_density: normalizeDisplayDensity(record.display_density),
    show_security_hint: asBoolean(record.show_security_hint) ?? defaultBasecardConfig.show_security_hint,
  };
}

export function validateBasecardConfig(config: BasecardConfig): ConfigValidationResult {
  const errors: Record<string, string> = {};

  if (config.card_type !== "HyperlinkCard") {
    errors.card_type = "hyperlink.validation.cardType";
  }

  if (!isNonEmptyString(config.anchor_text)) {
    errors.anchor_text = "hyperlink.validation.anchorRequired";
  }

  if (!isNonEmptyString(config.url)) {
    errors.url = "hyperlink.validation.urlRequired";
  } else if (!validateHyperlinkUrl(config.url)) {
    const analysis = analyzeHyperlinkUrl(config.url);
    errors.url =
      analysis.reason === "credentials-blocked"
        ? "hyperlink.validation.urlCredentialsBlocked"
        : "hyperlink.validation.urlInvalid";
  }

  if (isNonEmptyString(config.icon_url) && !validateHyperlinkUrl(config.icon_url)) {
    errors.icon_url = "hyperlink.validation.iconUrlInvalid";
  }

  if (config.open_mode !== "external-browser" && config.open_mode !== "resource-router") {
    errors.open_mode = "hyperlink.validation.openMode";
  }

  if (
    config.display_density !== "compact" &&
    config.display_density !== "comfortable" &&
    config.display_density !== "spacious"
  ) {
    errors.display_density = "hyperlink.validation.displayDensity";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
