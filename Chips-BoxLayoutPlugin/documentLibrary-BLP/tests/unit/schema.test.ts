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
    expect(config.props.treeNodes).toEqual([]);
    expect(config.props.sidebarWidth).toBe("regular");
    expect(config.props.showSummary).toBe(true);
    expect(config.props.background).toEqual({ mode: "none" });
    expect(config.props.topRegion).toEqual({ mode: "none" });
    expect(config.assetRefs).toEqual([]);
  });

  it("normalizes invalid values into bounded config", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "invalid",
        treeNodes: [
          {
            id: "chapter-1",
            entryId: "entry-1",
            titleOverride: "  Chapter 1  ",
            collapsed: true,
            children: [
              {
                entryId: "entry-2",
                collapsed: false,
              },
            ],
          },
        ],
        sidebarWidth: "giant",
        showSummary: false,
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
    expect(config.props.treeNodes).toEqual([
      {
        id: "chapter-1",
        entryId: "entry-1",
        titleOverride: "Chapter 1",
        presentation: "content",
        collapsed: true,
        children: [
          {
            id: "chapter-1-1",
            entryId: "entry-2",
            presentation: "content",
            collapsed: false,
            children: [],
          },
        ],
      },
    ]);
    expect(config.props.sidebarWidth).toBe("regular");
    expect(config.props.showSummary).toBe(false);
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

  it("layoutDefinition validation rejects unsafe raw assetRefs", () => {
    const result = validateLayoutConfigInput({
      schemaVersion: "1.0.0",
      props: {
          sortMode: "manual",
          treeNodes: [],
          sidebarWidth: "regular",
          showSummary: true,
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
          treeNodes: [],
          sidebarWidth: "regular",
          showSummary: true,
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
