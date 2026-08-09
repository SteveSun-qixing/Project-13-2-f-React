import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIEW_QUALITY_ENTRIES } from "../../src/features/preview-quality/view-model";

vi.mock("../../src/app/providers/I18nProvider", () => ({
  useI18n() {
    return {
      t(key: string) {
        return key;
      },
    };
  },
}));

describe("PreviewQualityPage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders formal chipsdev-r preview, contract, and quality report entries", async () => {
    const { PreviewQualityPage } = await import("../../src/features/preview-quality/PreviewQualityPage");
    const markup = renderToStaticMarkup(<PreviewQualityPage />);

    expect(PREVIEW_QUALITY_ENTRIES).toHaveLength(10);
    expect(markup).toContain("settingsPanel.previewQuality.title");
    expect(markup).not.toContain("settingsPanel.previewQuality.subtitle");
    expect(markup).toContain("settings-section");
    expect(markup).toContain("settings-row");
    expect(markup).toContain("preview-quality-command");
    expect(markup).not.toContain("settings-summary-panel");
    expect(markup).not.toContain("settings-card-grid");
    expect(markup).not.toContain("preview-quality-page");
    expect(markup).not.toContain("preview-quality-grid");
    expect(markup).toContain("chipsdev-r preview --target app");
    expect(markup).toContain("chipsdev-r component gallery");
    expect(markup).toContain("chipsdev-r theme inspect");
    expect(markup).toContain("chipsdev-r quality gate");
    expect(markup).toContain("chipsdev-r diagnostics");
    expect(markup).not.toContain("ThemePack/");
    expect(markup).not.toContain("Chips-ComponentLibrary/packages/theme-contracts");
  });
});
