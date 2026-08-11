import { afterEach, describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { openHyperlinkResource } from "../../src/render/view";
import { analyzeHyperlinkUrl } from "../../src/shared/utils";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(patch: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "HyperlinkCard",
    anchor_text: "Chips",
    url: "https://example.com/docs",
    description: "Documentation",
    icon_url: "",
    open_mode: "external-browser",
    display_density: "comfortable",
    show_security_hint: true,
    locale: "zh-CN",
    theme: "",
    ...patch,
  };
}

describe("mountBasecardView", () => {
  const originalChips = (window as Window & { chips?: unknown }).chips;

  afterEach(() => {
    (window as Window & { chips?: unknown }).chips = originalChips;
  });

  it("renders an accessible hyperlink button and opens through resource intent", () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    const config = createConfig();

    const dispose = mountBasecardView({
      container,
      config,
      openResource,
    });
    const buttonEl = container.querySelector("button") as HTMLButtonElement | null;

    expect(buttonEl?.textContent).toContain("Chips");
    expect(buttonEl?.textContent).toContain("Documentation");
    expect(buttonEl?.textContent).toContain("example.com");
    expect(buttonEl?.textContent).toContain("安全链接");
    buttonEl?.click();
    expect(openResource).toHaveBeenCalledWith({
      resourceId: "https://example.com/docs",
      mimeType: "text/html",
      title: "Chips",
      fileName: "example.com",
      payload: {
        kind: "chips.hyperlink-card",
        version: "1.0.0",
        cardType: "base.hyperlink",
        openMode: "external-browser",
        displayDensity: "comfortable",
        sourceUrl: "https://example.com/docs",
        securityLevel: "secure",
        securityReason: "secure",
      },
    });

    dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("renders a disabled strip when the link is not valid", () => {
    const container = document.createElement("div");
    const config = createConfig({
      anchor_text: "Bad link",
      url: "javascript:alert(1)",
    });

    const dispose = mountBasecardView({
      container,
      config,
    });
    const activeButton = container.querySelector("button");
    const disabledEl = container.querySelector("[aria-disabled='true']");

    expect(activeButton).toBeNull();
    expect(disabledEl?.textContent).toContain("Bad link");
    expect(disabledEl?.textContent).toContain("已阻止");

    dispose();
  });

  it("preserves description trailing whitespace and newlines", () => {
    const container = document.createElement("div");
    const config = createConfig({
      description: "  First line\nSecond line\n",
    });

    const dispose = mountBasecardView({
      container,
      config,
    });

    const descriptionEl = container.querySelector(".chips-hyperlink-card__description");
    expect(descriptionEl?.textContent).toBe("  First line\nSecond line\n");

    dispose();
  });

  it("falls back to the glyph when the icon image fails to load", async () => {
    const container = document.createElement("div");
    const config = createConfig({
      icon_url: "https://example.com/favicon.png",
    });

    const dispose = mountBasecardView({
      container,
      config,
    });

    const img = container.querySelector("img.chips-hyperlink-card__icon-image") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");

    img?.dispatchEvent(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector("img.chips-hyperlink-card__icon-image")).toBeNull();
    expect(container.querySelector(".chips-hyperlink-card__icon-fallback")?.textContent).toBe("↗");

    dispose();
  });

  it("does not call legacy transfer or platform bridges when openResource is absent", () => {
    const invoke = vi.fn();
    (window as unknown as { chips?: unknown }).chips = { invoke };

    openHyperlinkResource({
      config: createConfig(),
      analysis: analyzeHyperlinkUrl("https://example.com/docs"),
      title: "Chips",
    });

    expect(invoke).not.toHaveBeenCalled();
  });

  it("marks http links as warning but still emits a resource-open intent", () => {
    const openResource = vi.fn();
    const config = createConfig({
      url: "http://example.com/docs",
      show_security_hint: true,
    });

    const dispose = mountBasecardView({
      container: document.createElement("div"),
      config,
      openResource,
    });

    const analysis = analyzeHyperlinkUrl(config.url);
    openHyperlinkResource({
      openResource,
      config,
      analysis,
      title: "Chips",
    });

    expect(openResource).toHaveBeenLastCalledWith(expect.objectContaining({
      resourceId: "http://example.com/docs",
      payload: expect.objectContaining({
        securityLevel: "warning",
        securityReason: "insecure-http",
      }),
    }));

    dispose();
  });
});
