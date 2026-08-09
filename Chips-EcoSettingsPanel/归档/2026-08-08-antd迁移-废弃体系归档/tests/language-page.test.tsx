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

vi.mock("../../src/features/languages/useLanguageGovernance", () => ({
  useLanguageGovernance() {
    return {
      languages: [
        {
          locale: "zh-CN",
          displayName: "Chinese",
          nativeName: "中文",
          current: true,
        },
      ],
      loading: false,
      error: null,
      activeLocale: null,
      switchLocale: async () => undefined,
      refresh: async () => undefined,
      feedback: [],
      dismissFeedback: () => undefined,
    };
  },
}));

describe("LanguagePage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders languages in a formal list with detail action", async () => {
    const { LanguagePage } = await import("../../src/features/languages/LanguagePage");
    const markup = renderToStaticMarkup(<LanguagePage />);

    expect(markup).toContain("data-scope=\"data-grid\"");
    expect(markup).toContain("settings-governance-list");
    expect(markup).toContain("settings-record-list");
    expect(markup).toContain("settingsPanel.common.details");
    expect(markup).toContain("zh-CN");
    expect(markup).not.toContain('data-scope="dialog"');
  }, 15000);
});
