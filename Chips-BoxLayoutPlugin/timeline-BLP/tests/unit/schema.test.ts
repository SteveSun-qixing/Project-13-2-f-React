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
  it("creates default timeline config", () => {
    const config = createDefaultLayoutConfig();
    expect(config.props.orientation).toBe("vertical");
    expect(config.props.scaleMode).toBe("equal-points");
    expect(config.props.showCovers).toBe(true);
    expect(config.props.cardDensity).toBe("comfortable");
    expect(config.props.points).toEqual([]);
    expect(config.props.background).toEqual({ mode: "none" });
    expect(config.props.topRegion).toEqual({ mode: "none" });
    expect(config.assetRefs).toEqual([]);
  });

  it("normalizes invalid values into bounded timeline config", () => {
    const config = normalizeLayoutConfig({
      props: {
        orientation: "sideways",
        scaleMode: "distance",
        showCovers: "yes",
        cardDensity: "wide",
        points: [
          {
            id: "release",
            label: " Release ",
            date: "not-a-date",
            entryIds: ["entry-1", "entry-1", "", 2],
            note: " Note ",
          },
          {
            id: "release",
            label: "",
            entryIds: ["entry-2"],
          },
        ],
        background: {
          mode: "image",
          assetPath: "/tmp/background.png",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.timeline.blp/top.webp",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.timeline.blp/legacy.webp", "", 1],
    });

    expect(config.props.orientation).toBe("vertical");
    expect(config.props.scaleMode).toBe("equal-points");
    expect(config.props.showCovers).toBe(true);
    expect(config.props.cardDensity).toBe("comfortable");
    expect(config.props.points).toEqual([
      {
        id: "release",
        label: "Release",
        date: "not-a-date",
        entryIds: ["entry-1"],
        note: "Note",
      },
      {
        id: "release-2",
        label: "Point 2",
        entryIds: ["entry-2"],
      },
    ]);
    expect(config.props.background).toEqual({ mode: "image" });
    expect(config.props.topRegion).toEqual({
      mode: "image",
      assetPath: "assets/layouts/chips.layout.timeline.blp/top.webp",
    });
    expect(config.assetRefs).toEqual(["assets/layouts/chips.layout.timeline.blp/top.webp"]);
  });

  it("keeps assetRefs synchronized with safe frame region assets", () => {
    const config = normalizeLayoutConfig({
      props: {
        orientation: "horizontal",
        scaleMode: "date-distance",
        showCovers: false,
        cardDensity: "compact",
        points: [],
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.timeline.blp/background.webp",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.timeline.blp/background.webp",
        },
      },
      assetRefs: [
        "assets/layouts/chips.layout.timeline.blp/stale.webp",
        "assets/layouts/chips.layout.timeline.blp/background.webp?token=1",
      ],
    });

    expect(config.assetRefs).toEqual(["assets/layouts/chips.layout.timeline.blp/background.webp"]);
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

    expect(isSafeBoxAssetPath("assets/layouts/chips.layout.timeline.blp/background.webp")).toBe(true);
    for (const path of unsafePaths) {
      expect(isSafeBoxAssetPath(path)).toBe(false);
    }
  });

  it("validates config", () => {
    const result = validateLayoutConfig(createDefaultLayoutConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("validates image regions and raw assetRefs", () => {
    const result = validateLayoutConfig(normalizeLayoutConfig({
      schemaVersion: "1.0.0",
      props: {
        orientation: "vertical",
        scaleMode: "equal-points",
        showCovers: true,
        cardDensity: "comfortable",
        points: [],
        background: {
          mode: "image",
        },
        topRegion: {
          mode: "html",
          html: "",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.timeline.blp/background.webp?token=1"],
    }));

    expect(result.valid).toBe(false);
    expect(result.errors["props.background.assetPath"]).toBeTruthy();
    expect(result.errors["props.topRegion.html"]).toBeTruthy();
  });

  it("layoutDefinition validation rejects unsafe raw assetRefs", async () => {
    const result = layoutDefinition.validateConfig({
      schemaVersion: "1.0.0",
      props: {
        orientation: "vertical",
        scaleMode: "equal-points",
        showCovers: true,
        cardDensity: "comfortable",
        points: [],
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.timeline.blp/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("keeps unparseable dates as free text instead of rejecting them", () => {
    const config = normalizeLayoutConfig({
      props: {
        points: [
          {
            id: "phase-1",
            label: "Phase",
            date: "阶段一",
            entryIds: [],
          },
        ],
      },
    });
    const result = validateLayoutConfig(config);
    expect(result.valid).toBe(true);
    expect(config.props.points[0]?.date).toBe("阶段一");
  });
});
