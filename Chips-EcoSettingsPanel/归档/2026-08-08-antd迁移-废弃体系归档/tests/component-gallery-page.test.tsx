import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/providers/I18nProvider", () => ({
  useI18n() {
    return {
      t(key: string, params?: Record<string, string | number>) {
        if (!params) {
          return key;
        }
        return `${key}:${JSON.stringify(params)}`;
      },
    };
  },
}));

vi.mock("../../src/app/providers/RuntimeProvider", () => ({
  useRuntimeContext() {
    return {
      currentTheme: null,
    };
  },
}));

describe("ComponentGalleryPage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders a flat gallery for every formal component preview", async () => {
    const { ComponentGalleryPage } = await import("../../src/features/component-gallery/ComponentGalleryPage");
    const { getComponentGroups } = await import("../../src/features/component-gallery/registry");
    const markup = renderToStaticMarkup(<ComponentGalleryPage />);
    const componentCount = getComponentGroups().flatMap((group) => group.items).length;

    expect(markup).toContain("settings-page-stack");
    expect(markup).toContain("settings-card-grid");
    expect(markup).toContain("settings-card-grid--showcase");
    expect(markup.match(/settings-card-grid__item/g)?.length).toBe(componentCount);
    expect(markup).not.toContain("settings-page-section");
    expect(markup).not.toContain("settings-card-description");
    expect(markup).not.toContain("gallery-parts");
    expect(markup).not.toContain("settingsPanel.gallery.groups.foundation");
    expect(markup).not.toContain("settingsPanel.gallery.groups.systemUx");
    expect(markup).not.toContain("settingsPanel.gallery.preview.panelHeader.subtitle");
    expect(markup).not.toContain("gallery-page");
    expect(markup).not.toContain("gallery-bento-grid");
    expect(markup).not.toContain("settings-card-grid--bento");
    expect(markup).not.toContain("settingsPanel.gallery.subtitle");
    expect(markup).not.toContain("#FFFFFF");
    expect(markup).not.toContain("#0A6CFF");
  });
});
