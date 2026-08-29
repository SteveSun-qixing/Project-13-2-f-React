import { describe, it, expect, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";
import { FILE_CATEGORY_COVER_URLS } from "../../src/shared/default-covers";

async function waitForEffects(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function buildConfig(overrides: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "base.file",
    theme: "",
    file_file: "docs/report.pdf",
    file_name: "report",
    file_extension: "pdf",
    cover_image: "",
    ...overrides,
  };
}

describe("mountBasecardView", () => {
  it("renders file name, extension badge and category default cover", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();

    const dispose = mountBasecardView({
      container,
      config: buildConfig(),
      openResource,
    });
    await waitForEffects();

    expect(container.querySelector('[data-chips-file-card-view-root="true"]')).toBeTruthy();
    expect(container.querySelector(".chips-file-card__name")?.textContent).toBe("report");
    expect(container.querySelector(".chips-file-card__extension")?.textContent).toBe("PDF");

    const coverImage = container.querySelector<HTMLImageElement>(
      ".chips-file-card__cover-image",
    );
    expect(coverImage?.getAttribute("src")).toBe(FILE_CATEGORY_COVER_URLS.document);

    const openButton = container.querySelector<HTMLButtonElement>(
      ".chips-file-card__surface-button",
    );
    expect(openButton).toBeTruthy();
    openButton?.click();
    expect(openResource).toHaveBeenCalledWith({
      resourceId: "docs/report.pdf",
      mimeType: "application/pdf",
      title: "report",
      fileName: "report.pdf",
    });

    dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("falls back to the extension badge icon for unknown file types", async () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: buildConfig({
        file_file: "assets/blob.xyz123",
        file_name: "blob",
        file_extension: "xyz123",
      }),
    });
    await waitForEffects();

    expect(container.querySelector(".chips-file-card__cover-image")).toBeNull();
    const fallback = container.querySelector<SVGElement>(
      ".chips-file-card__cover-fallback",
    );
    expect(fallback?.querySelector("text")?.textContent).toBe("XYZ1");
    expect(container.querySelector(".chips-file-card__extension")?.textContent).toBe("XYZ1");

    dispose();
  });

  it("resolves the custom cover through the host resource bridge", async () => {
    const container = document.createElement("div");
    const resolveResourceUrl = vi.fn(
      async (resourcePath: string) => `blob:card/${resourcePath}`,
    );
    const releaseResourceUrl = vi.fn();

    const dispose = mountBasecardView({
      container,
      config: buildConfig({ cover_image: "assets/cover.png" }),
      resolveResourceUrl,
      releaseResourceUrl,
      openResource: vi.fn(),
    });
    await waitForEffects();

    expect(resolveResourceUrl).toHaveBeenCalledWith("assets/cover.png");
    const coverImage = container.querySelector<HTMLImageElement>(
      ".chips-file-card__cover-image",
    );
    expect(coverImage?.getAttribute("src")).toBe("blob:card/assets/cover.png");

    dispose();
    expect(releaseResourceUrl).toHaveBeenCalledWith("assets/cover.png");
  });

  it("renders the static surface and empty state without a file", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();

    const dispose = mountBasecardView({
      container,
      config: buildConfig({
        file_file: "",
        file_name: "",
        file_extension: "",
      }),
      openResource,
    });
    await waitForEffects();

    expect(container.querySelector(".chips-file-card__surface-button")).toBeNull();
    expect(container.querySelector(".chips-file-card__empty")).toBeTruthy();
    expect(container.querySelector(".chips-file-card__empty-title")?.textContent).toBe("未命名文件");

    dispose();
    expect(openResource).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });

  it("renders a static surface when the host cannot open resources", async () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: buildConfig(),
    });
    await waitForEffects();

    expect(container.querySelector(".chips-file-card__surface-button")).toBeNull();
    expect(container.querySelector(".chips-file-card__surface")).toBeTruthy();

    dispose();
  });

  it("cleans the previous React root before repeated mount", () => {
    const container = document.createElement("div");

    const firstDispose = mountBasecardView({
      container,
      config: buildConfig({ file_name: "first" }),
    });
    const secondDispose = mountBasecardView({
      container,
      config: buildConfig({ file_name: "second" }),
    });

    firstDispose();
    expect(container.querySelectorAll("[data-chips-file-card-view-root]")).toHaveLength(1);
    expect(container.querySelector(".chips-file-card__name")?.textContent).toBe("second");

    secondDispose();
    expect(container.childElementCount).toBe(0);
  });
});
