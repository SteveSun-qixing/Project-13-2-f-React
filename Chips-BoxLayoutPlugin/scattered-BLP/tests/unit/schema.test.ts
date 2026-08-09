import { describe, expect, it } from "vitest";
import {
  createDefaultLayoutConfig,
  isSafeBoxAssetPath,
  normalizeLayoutConfig,
  validateLayoutConfig,
  validateLayoutConfigInput,
} from "../../src/schema/layout-config";
import { createScatterPlacements, orderScatteredEntries } from "../../src/shared/scatter";
import type { BoxEntrySnapshot } from "../../src/shared/types";

function createEntry(entryId: string, title: string): BoxEntrySnapshot {
  return {
    entryId,
    url: `file:///tmp/${entryId}.card`,
    enabled: true,
    snapshot: {
      title,
    },
  };
}

describe("layout-config", () => {
  it("creates default scattered config", () => {
    const config = createDefaultLayoutConfig();
    expect(config.props.sortMode).toBe("manual");
    expect(config.props.randomSeed).toBe("scattered");
    expect(config.props.visibleFakeCount).toBe(9);
    expect(config.props.cycleIntervalMs).toBe(8000);
    expect(config.props.cardSize).toBe("regular");
    expect(config.props.spread).toBe("loose");
    expect(config.props.motion).toBe("auto");
    expect(config.props.background).toEqual({ mode: "none" });
    expect(config.props.topRegion).toEqual({ mode: "none" });
    expect(config.assetRefs).toEqual([]);
  });

  it("normalizes invalid values into bounded scattered config", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "invalid",
        randomSeed: "  my seed  ",
        visibleFakeCount: 99,
        cycleIntervalMs: 1,
        cardSize: "tiny",
        spread: "huge",
        motion: "fast",
        background: {
          mode: "image",
          assetPath: "/tmp/background.png",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.scattered.blp/top.webp",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.scattered.blp/legacy.webp", "", 1],
    });
    expect(config.props.sortMode).toBe("manual");
    expect(config.props.randomSeed).toBe("my-seed");
    expect(config.props.visibleFakeCount).toBe(18);
    expect(config.props.cycleIntervalMs).toBe(3000);
    expect(config.props.cardSize).toBe("regular");
    expect(config.props.spread).toBe("loose");
    expect(config.props.motion).toBe("auto");
    expect(config.props.background).toEqual({ mode: "image" });
    expect(config.props.topRegion).toEqual({
      mode: "image",
      assetPath: "assets/layouts/chips.layout.scattered.blp/top.webp",
    });
    expect(config.assetRefs).toEqual(["assets/layouts/chips.layout.scattered.blp/top.webp"]);
  });

  it("keeps assetRefs synchronized with safe frame region assets", () => {
    const config = normalizeLayoutConfig({
      props: {
        sortMode: "random",
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.scattered.blp/background.webp",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.scattered.blp/background.webp",
        },
      },
      assetRefs: [
        "assets/layouts/chips.layout.scattered.blp/stale.webp",
        "assets/layouts/chips.layout.scattered.blp/background.webp?token=1",
      ],
    });

    expect(config.assetRefs).toEqual(["assets/layouts/chips.layout.scattered.blp/background.webp"]);
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

    expect(isSafeBoxAssetPath("assets/layouts/chips.layout.scattered.blp/background.webp")).toBe(true);
    for (const path of unsafePaths) {
      expect(isSafeBoxAssetPath(path)).toBe(false);
    }
  });

  it("validates config", () => {
    const result = validateLayoutConfig(createDefaultLayoutConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("validates image regions, numeric bounds and assetRefs", () => {
    const config = createDefaultLayoutConfig();
    const result = validateLayoutConfig({
      ...config,
      props: {
        ...config.props,
        visibleFakeCount: 40,
        cycleIntervalMs: 500,
        background: {
          mode: "image",
        },
        topRegion: {
          mode: "html",
          html: "",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.scattered.blp/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["props.visibleFakeCount"]).toBeTruthy();
    expect(result.errors["props.cycleIntervalMs"]).toBeTruthy();
    expect(result.errors["props.background.assetPath"]).toBeTruthy();
    expect(result.errors["props.topRegion.html"]).toBeTruthy();
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("layoutDefinition validation rejects unsafe raw assetRefs", () => {
    const result = validateLayoutConfigInput({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
      assetRefs: ["assets/layouts/chips.layout.scattered.blp/background.webp?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("creates stable scatter placements and random order from seed", () => {
    expect(createScatterPlacements(4, "seed-a", "loose")).toEqual(createScatterPlacements(4, "seed-a", "loose"));
    expect(createScatterPlacements(4, "seed-a", "loose")).not.toEqual(createScatterPlacements(4, "seed-b", "loose"));

    const entries = [
      createEntry("entry-c", "Gamma"),
      createEntry("entry-a", "Alpha"),
      createEntry("entry-b", "Beta"),
    ];
    expect(orderScatteredEntries(entries, "name", "seed").map((entry) => entry.entryId))
      .toEqual(["entry-a", "entry-b", "entry-c"]);
    expect(orderScatteredEntries(entries, "random", "seed"))
      .toEqual(orderScatteredEntries(entries, "random", "seed"));
  });
});
