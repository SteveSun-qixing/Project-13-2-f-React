import { describe, expect, it } from "vitest";
import {
  createDefaultLayoutConfig,
  isSafeBoxAssetPath,
  normalizeLayoutConfig,
  validateLayoutConfig,
  validateLayoutConfigInput,
} from "../../src/schema/layout-config";

describe("layout-config", () => {
  it("creates default config", () => {
    const config = createDefaultLayoutConfig();
    expect(config.props.sortMode).toBe("manual");
    expect(config.props.columnMode).toBe("auto");
    expect(config.props.gap).toBe("regular");
    expect(config.props.titleMode).toBe("below-cover");
    expect(config.props.showSummary).toBe(true);
    expect(config.props.pageSize).toBe(120);
    expect(config.props.background).toEqual({ mode: "none" });
    expect(config.props.topRegion).toEqual({ mode: "none" });
    expect(config.assetRefs).toEqual([]);
  });

  it("normalizes invalid values into bounded config", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "invalid",
        columnMode: "invalid",
        gap: "invalid",
        titleMode: "invalid",
        showSummary: "yes",
        pageSize: 999,
        background: {
          mode: "image",
          assetPath: "/tmp/background.png",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/masonry/top.webp",
        },
      },
      assetRefs: ["assets/layouts/masonry/legacy.webp", "", 1],
    });
    expect(config.props.sortMode).toBe("manual");
    expect(config.props.columnMode).toBe("auto");
    expect(config.props.gap).toBe("regular");
    expect(config.props.titleMode).toBe("below-cover");
    expect(config.props.showSummary).toBe(true);
    expect(config.props.pageSize).toBe(240);
    expect(config.props.background).toEqual({ mode: "image" });
    expect(config.props.topRegion).toEqual({
      mode: "image",
      assetPath: "assets/layouts/masonry/top.webp",
    });
    expect(config.assetRefs).toEqual(["assets/layouts/masonry/top.webp"]);
  });

  it("keeps assetRefs synchronized with safe frame region assets", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "manual",
        columnMode: "compact",
        gap: "spacious",
        titleMode: "overlay",
        showSummary: false,
        pageSize: 20,
        background: {
          mode: "image",
          assetPath: "assets/layouts/masonry/background.webp",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/masonry/background.webp",
        },
      },
      assetRefs: [
        "assets/layouts/masonry/stale.webp",
        "assets/layouts/masonry/background.webp?token=1",
      ],
    });

    expect(config.assetRefs).toEqual(["assets/layouts/masonry/background.webp"]);
  });

  it("rejects unsafe box asset paths", () => {
    const unsafePaths = [
      "/tmp/background.png",
      "../background.png",
      "assets/../background.png",
      "assets/layouts/../../background.png",
      "file:///tmp/background.png",
      "blob:background",
      "data:image/png;base64,abc",
      "https://example.com/background.png",
      "assets/layouts/background.png?token=1",
      "assets/layouts/background.png#preview",
      "assets\\layouts\\background.png",
      "assets/file://background.png",
      "assets/layouts//background.png",
      " assets/layouts/background.png",
    ];

    expect(isSafeBoxAssetPath("assets/layouts/masonry/background.webp")).toBe(true);
    for (const path of unsafePaths) {
      expect(isSafeBoxAssetPath(path)).toBe(false);
    }
  });

  it("validates config", () => {
    const result = validateLayoutConfig(createDefaultLayoutConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("validates image regions and assetRefs", () => {
    const result = validateLayoutConfig(normalizeLayoutConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        columnMode: "auto",
        gap: "regular",
        titleMode: "below-cover",
        showSummary: true,
        pageSize: 120,
        background: {
          mode: "image",
        },
        topRegion: {
          mode: "html",
          html: "",
        },
      },
      assetRefs: ["assets/layouts/masonry/background.webp?token=1"],
    }));

    expect(result.valid).toBe(false);
    expect(result.errors["props.background.assetPath"]).toBeTruthy();
    expect(result.errors["props.topRegion.html"]).toBeTruthy();
  });

  it("layoutDefinition validation rejects unsafe raw assetRefs", () => {
    const result = validateLayoutConfigInput({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        columnMode: "auto",
        gap: "regular",
        titleMode: "below-cover",
        showSummary: true,
        pageSize: 120,
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
      assetRefs: ["assets/layouts/masonry/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("exported layoutDefinition validation rejects unsafe raw assetRefs", async () => {
    const { layoutDefinition } = await import("../../src/index");
    const result = layoutDefinition.validateConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        columnMode: "auto",
        gap: "regular",
        titleMode: "below-cover",
        showSummary: true,
        pageSize: 120,
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
      assetRefs: ["assets/layouts/masonry/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  }, 15_000);
});
