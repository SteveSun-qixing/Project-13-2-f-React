import { describe, expect, it } from "vitest";
import {
  createDefaultLayoutConfig,
  isSafeBoxAssetPath,
  normalizeLayoutConfig,
  validateLayoutConfig,
  validateLayoutConfigInput,
} from "../../src/schema/layout-config";
import { layoutDefinition } from "../../src/index";

describe("layout-config", () => {
  it("creates default config", () => {
    const config = createDefaultLayoutConfig();
    expect(config.props.sortMode).toBe("manual");
    expect(config.props.randomSeed).toBe("chips-cardstack");
    expect(config.props.stackDepth).toBe(4);
    expect(config.props.cardSize).toBe("regular");
    expect(config.props.spreadRotationDeg).toBe(5);
    expect(config.props.swipeThreshold).toBe(120);
    expect(config.props.reviewLoop).toBe("stop-at-end");
    expect(config.props.background).toEqual({ mode: "none" });
    expect(config.props.topRegion).toEqual({ mode: "none" });
    expect(config.assetRefs).toEqual([]);
  });

  it("normalizes invalid values into bounded config", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "invalid",
        randomSeed: "",
        stackDepth: 100,
        cardSize: "tiny",
        spreadRotationDeg: -10,
        swipeThreshold: 999,
        reviewLoop: "forever",
        background: {
          mode: "image",
          assetPath: "/tmp/background.png",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/grid/top.webp",
        },
      },
      assetRefs: ["assets/layouts/grid/legacy.webp", "", 1],
    });
    expect(config.props.sortMode).toBe("manual");
    expect(config.props.randomSeed).toBe("chips-cardstack");
    expect(config.props.stackDepth).toBe(8);
    expect(config.props.cardSize).toBe("regular");
    expect(config.props.spreadRotationDeg).toBe(0);
    expect(config.props.swipeThreshold).toBe(260);
    expect(config.props.reviewLoop).toBe("stop-at-end");
    expect(config.props.background).toEqual({ mode: "image" });
    expect(config.props.topRegion).toEqual({
      mode: "image",
      assetPath: "assets/layouts/grid/top.webp",
    });
    expect(config.assetRefs).toEqual(["assets/layouts/grid/top.webp"]);
  });

  it("keeps assetRefs synchronized with safe frame region assets", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "manual",
        background: {
          mode: "image",
          assetPath: "assets/layouts/grid/background.webp",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/grid/background.webp",
        },
      },
      assetRefs: [
        "assets/layouts/grid/stale.webp",
        "assets/layouts/grid/background.webp?token=1",
      ],
    });

    expect(config.assetRefs).toEqual(["assets/layouts/grid/background.webp"]);
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

    expect(isSafeBoxAssetPath("assets/layouts/grid/background.webp")).toBe(true);
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
        background: {
          mode: "image",
        },
        topRegion: {
          mode: "html",
          html: "",
        },
      },
      assetRefs: ["assets/layouts/grid/background.webp?token=1"],
    }));

    expect(result.valid).toBe(false);
    expect(result.errors["props.background.assetPath"]).toBeTruthy();
    expect(result.errors["props.topRegion.html"]).toBeTruthy();
  });

  it("validates bounded card stack fields", () => {
    const config = createDefaultLayoutConfig();
    config.props.randomSeed = "";
    config.props.stackDepth = 1;
    config.props.cardSize = "huge" as typeof config.props.cardSize;
    config.props.spreadRotationDeg = 24;
    config.props.swipeThreshold = 10;
    config.props.reviewLoop = "again" as typeof config.props.reviewLoop;
    const result = validateLayoutConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors["props.randomSeed"]).toBeTruthy();
    expect(result.errors["props.stackDepth"]).toBeTruthy();
    expect(result.errors["props.cardSize"]).toBeTruthy();
    expect(result.errors["props.spreadRotationDeg"]).toBeTruthy();
    expect(result.errors["props.swipeThreshold"]).toBeTruthy();
    expect(result.errors["props.reviewLoop"]).toBeTruthy();
  });

  it("layoutDefinition validation rejects unsafe raw assetRefs", () => {
    const result = validateLayoutConfigInput({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        randomSeed: "seed",
        stackDepth: 4,
        cardSize: "regular",
        spreadRotationDeg: 5,
        swipeThreshold: 120,
        reviewLoop: "stop-at-end",
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
      assetRefs: ["assets/layouts/grid/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("exported layoutDefinition validation rejects unsafe raw assetRefs", async () => {
    const result = layoutDefinition.validateConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        randomSeed: "seed",
        stackDepth: 4,
        cardSize: "regular",
        spreadRotationDeg: 5,
        swipeThreshold: 120,
        reviewLoop: "stop-at-end",
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
      assetRefs: ["assets/layouts/grid/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });
});
