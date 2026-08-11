import { describe, expect, it } from "vitest";
import { basecardDefinition } from "../../src/index";
import {
  normalizeBasecardConfig,
  validateBasecardConfig,
} from "../../src/schema/card-config";
import { analyzeHyperlinkUrl, validateHyperlinkUrl } from "../../src/shared/utils";

describe("basecard schema", () => {
  it("exports the formal basecard definition contract", () => {
    expect(basecardDefinition.pluginId).toBe("chips.basecard.hyperlink");
    expect(basecardDefinition.cardType).toBe("base.hyperlink");
    expect(basecardDefinition.displayName).toBe("超链接基础卡片");
    expect(basecardDefinition.aliases).toContain("HyperlinkCard");
    expect(basecardDefinition.previewPointerEvents).toBe("shielded");
    expect(basecardDefinition.collectResourcePaths({})).toEqual([]);
    expect(basecardDefinition.createInitialConfig("base-1")).toMatchObject({
      card_type: "HyperlinkCard",
    });
  });

  it("fills default locale and theme during normalization", () => {
    const normalized = normalizeBasecardConfig({
      card_type: "HyperlinkCard",
      anchor_text: "  Chips  ",
      url: "  https://example.com/docs  ",
      description: "  Docs  ",
      icon_url: "  https://example.com/favicon.png  ",
    });

    expect(normalized).toMatchObject({
      card_type: "HyperlinkCard",
      anchor_text: "Chips",
      url: "https://example.com/docs",
      description: "  Docs  ",
      icon_url: "https://example.com/favicon.png",
      open_mode: "external-browser",
      display_density: "comfortable",
      show_security_hint: true,
      locale: "zh-CN",
      theme: "",
    });
  });

  it("preserves description trailing whitespace and newlines during normalization", () => {
    const normalized = normalizeBasecardConfig({
      card_type: "HyperlinkCard",
      anchor_text: "Chips",
      url: "https://example.com",
      description: "  First line\nSecond line  \n",
    });

    expect(normalized.description).toBe("  First line\nSecond line  \n");
  });

  it("validates only http and https links", () => {
    expect(validateHyperlinkUrl("https://example.com")).toBe(true);
    expect(validateHyperlinkUrl("http://example.com/path")).toBe(true);
    expect(validateHyperlinkUrl("javascript:alert(1)")).toBe(false);
    expect(validateHyperlinkUrl("file:///tmp/demo.html")).toBe(false);
    expect(validateHyperlinkUrl("example.com")).toBe(false);
  });

  it("classifies security status and blocks credential URLs", () => {
    expect(analyzeHyperlinkUrl("https://example.com").reason).toBe("secure");
    expect(analyzeHyperlinkUrl("http://example.com").reason).toBe("insecure-http");
    expect(analyzeHyperlinkUrl("https://user:pass@example.com").reason).toBe("credentials-blocked");

    const result = validateBasecardConfig(
      normalizeBasecardConfig({
        card_type: "HyperlinkCard",
        anchor_text: "Credential link",
        url: "https://user:pass@example.com",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.url).toBe("hyperlink.validation.urlCredentialsBlocked");
  });

  it("rejects empty anchor text and missing links", () => {
    const result = validateBasecardConfig(
      normalizeBasecardConfig({
        card_type: "HyperlinkCard",
        anchor_text: "",
        url: "",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.anchor_text).toBe("hyperlink.validation.anchorRequired");
    expect(result.errors.url).toBe("hyperlink.validation.urlRequired");
  });

  it("rejects unsupported URL schemes", () => {
    const result = validateBasecardConfig(
      normalizeBasecardConfig({
        card_type: "HyperlinkCard",
        anchor_text: "Bad link",
        url: "ftp://example.com/file",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.url).toBe("hyperlink.validation.urlInvalid");
  });

  it("rejects invalid optional icon URLs", () => {
    const result = validateBasecardConfig(
      normalizeBasecardConfig({
        card_type: "HyperlinkCard",
        anchor_text: "Chips",
        url: "https://example.com",
        icon_url: "file:///tmp/icon.png",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.icon_url).toBe("hyperlink.validation.iconUrlInvalid");
  });
});
