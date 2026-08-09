import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/providers/I18nProvider", () => ({
  useI18n() {
    return {
      t(key: string) {
        return key;
      },
    };
  },
}));

describe("SectionStateBoundary", () => {
  it("renders children when there is no loading or error state", async () => {
    const { SectionStateBoundary } = await import("../../src/shared/ui/SectionStateBoundary");
    const markup = renderToStaticMarkup(
      <SectionStateBoundary loading={false} error={null} loadingLabel="loading">
        <div>content</div>
      </SectionStateBoundary>,
    );

    expect(markup).toContain("content");
    expect(markup).not.toContain("ant-spin");
  });

  it("renders a loading state with the section loading label", async () => {
    const { SectionStateBoundary } = await import("../../src/shared/ui/SectionStateBoundary");
    const markup = renderToStaticMarkup(
      <SectionStateBoundary loading error={null} loadingLabel="正在加载列表">
        <div>content</div>
      </SectionStateBoundary>,
    );

    expect(markup).toContain("ant-spin");
    expect(markup).toContain("正在加载列表");
    expect(markup).not.toContain("content");
  });

  it("renders an error result with retry when an error exists", async () => {
    const { SectionStateBoundary } = await import("../../src/shared/ui/SectionStateBoundary");
    const markup = renderToStaticMarkup(
      <SectionStateBoundary
        loading={false}
        error={{ code: "PLUGIN_LIST_FAILED", message: "读取失败", retryable: true }}
        loadingLabel="loading"
        onRetry={() => undefined}
      >
        <div>content</div>
      </SectionStateBoundary>,
    );

    expect(markup).toContain("读取失败");
    expect(markup).toContain("PLUGIN_LIST_FAILED");
    expect(markup).toContain("settingsPanel.app.retry");
    expect(markup).not.toContain("content");
  });
});
