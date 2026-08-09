import { describe, expect, it } from "vitest";
import {
  createDefaultLayoutConfig,
  isSafeBoxAssetPath,
  normalizeLayoutConfig,
  validateLayoutConfig,
  validateLayoutConfigInput,
} from "../../src/schema/layout-config";

describe("layout-config", () => {
  it("creates cover flow defaults", () => {
    const config = createDefaultLayoutConfig();
    expect(config.props).toMatchObject({
      sortMode: "manual",
      coverSize: "regular",
      sideAngleDeg: 58,
      centerScale: 1.18,
      spacing: "regular",
      showReflection: true,
      wheelSensitivity: "medium",
      background: { mode: "none" },
      topRegion: { mode: "none" },
    });
    expect(config.assetRefs).toEqual([]);
  });

  it("normalizes invalid values into bounded cover flow config", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "invalid",
        coverSize: "huge",
        sideAngleDeg: 120,
        centerScale: 3,
        spacing: "loose",
        showReflection: "yes",
        wheelSensitivity: "extreme",
        background: {
          mode: "image",
          assetPath: "/tmp/background.png",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.coverflow.blp/top.webp",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.coverflow.blp/legacy.webp", "", 1],
    });

    expect(config.props.sortMode).toBe("manual");
    expect(config.props.coverSize).toBe("regular");
    expect(config.props.sideAngleDeg).toBe(75);
    expect(config.props.centerScale).toBe(1.5);
    expect(config.props.spacing).toBe("regular");
    expect(config.props.showReflection).toBe(true);
    expect(config.props.wheelSensitivity).toBe("medium");
    expect(config.props.background).toEqual({ mode: "image" });
    expect(config.props.topRegion).toEqual({
      mode: "image",
      assetPath: "assets/layouts/chips.layout.coverflow.blp/top.webp",
    });
    expect(config.assetRefs).toEqual(["assets/layouts/chips.layout.coverflow.blp/top.webp"]);
  });

  it("keeps assetRefs synchronized with safe frame region assets", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "manual",
        coverSize: "compact",
        sideAngleDeg: 42,
        centerScale: 1.1,
        spacing: "tight",
        showReflection: false,
        wheelSensitivity: "high",
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.coverflow.blp/background.webp",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.coverflow.blp/background.webp",
        },
      },
      assetRefs: [
        "assets/layouts/chips.layout.coverflow.blp/stale.webp",
        "assets/layouts/chips.layout.coverflow.blp/background.webp?token=1",
      ],
    });

    expect(config.assetRefs).toEqual(["assets/layouts/chips.layout.coverflow.blp/background.webp"]);
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

    expect(isSafeBoxAssetPath("assets/layouts/chips.layout.coverflow.blp/background.webp")).toBe(true);
    for (const path of unsafePaths) {
      expect(isSafeBoxAssetPath(path)).toBe(false);
    }
  });

  it("validates config", () => {
    const result = validateLayoutConfig(createDefaultLayoutConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("validates bounded numbers, image regions and assetRefs", () => {
    const config = createDefaultLayoutConfig();
    config.props.sideAngleDeg = 90;
    config.props.centerScale = 0.5;
    config.props.background = { mode: "image" };
    config.props.topRegion = { mode: "html", html: "" };
    config.assetRefs = ["assets/layouts/chips.layout.coverflow.blp/background.webp?token=1"];

    const result = validateLayoutConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors["props.sideAngleDeg"]).toBeTruthy();
    expect(result.errors["props.centerScale"]).toBeTruthy();
    expect(result.errors["props.background.assetPath"]).toBeTruthy();
    expect(result.errors["props.topRegion.html"]).toBeTruthy();
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("validateLayoutConfigInput rejects unsafe raw assetRefs", () => {
    const result = validateLayoutConfigInput({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        coverSize: "regular",
        sideAngleDeg: 58,
        centerScale: 1.18,
        spacing: "regular",
        showReflection: true,
        wheelSensitivity: "medium",
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.coverflow.blp/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("validateLayoutConfigInput accepts normalized safe cover flow config", () => {
    const result = validateLayoutConfigInput(createDefaultLayoutConfig());
    expect(result.valid).toBe(true);
  });
});
