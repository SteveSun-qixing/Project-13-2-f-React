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
  it("creates default map config", () => {
    const config = createDefaultLayoutConfig();
    expect(config.props.mapSource).toEqual({
      mode: "image",
      projection: "linear-bounds",
      bounds: {
        west: -180,
        south: -85,
        east: 180,
        north: 85,
      },
    });
    expect(config.props.defaultView).toEqual({
      latitude: 0,
      longitude: 0,
      zoom: 1,
    });
    expect(config.props.markerStyle).toBe("dot-title");
    expect(config.props.showCoverOnSelect).toBe(true);
    expect(config.props.entries).toEqual({});
    expect(config.assetRefs).toEqual([]);
  });

  it("normalizes map source, entries, top region and asset refs", () => {
    const config = normalizeLayoutConfig({
      props: {
        mapSource: {
          mode: "image",
          projection: "web-mercator",
          assetPath: "assets/layouts/map/base-map/tokyo.png",
          bounds: {
            west: "139.5",
            south: "35.5",
            east: "139.9",
            north: "35.9",
          },
        },
        defaultView: {
          latitude: "35.6812",
          longitude: "139.7671",
          zoom: 2,
        },
        markerStyle: "pin-title",
        showCoverOnSelect: false,
        entries: {
          "entry-1": {
            latitude: "35.6812",
            longitude: "139.7671",
            labelOverride: " 东京站 ",
          },
          "entry-2": {
            latitude: "bad",
            longitude: 139,
          },
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/map/top-region/header.png",
        },
      },
      assetRefs: ["assets/layouts/map/stale.png"],
    });

    expect(config.props.mapSource.projection).toBe("linear-bounds");
    expect(config.props.entries["entry-1"]).toEqual({
      latitude: 35.6812,
      longitude: 139.7671,
      labelOverride: "东京站",
    });
    expect(config.props.entries["entry-2"]).toBeUndefined();
    expect(config.assetRefs).toEqual([
      "assets/layouts/map/base-map/tokyo.png",
      "assets/layouts/map/top-region/header.png",
    ]);
  });

  it("keeps host-map as reserved non-asset config", () => {
    const config = normalizeLayoutConfig({
      props: {
        mapSource: {
          mode: "host-map",
          projection: "web-mercator",
          assetPath: "assets/layouts/map/base-map/unused.png",
          bounds: {
            west: -180,
            south: -80,
            east: 180,
            north: 80,
          },
        },
      },
    });

    expect(config.props.mapSource.mode).toBe("host-map");
    expect(config.props.mapSource.projection).toBe("web-mercator");
    expect(config.assetRefs).toEqual([]);
  });

  it("rejects unsafe box asset paths", () => {
    const unsafePaths = [
      "/tmp/map.png",
      "../map.png",
      "assets/../map.png",
      "file:///tmp/map.png",
      "blob:map",
      "data:image/png;base64,abc",
      "https://example.com/map.png",
      "assets/layouts/map.png?token=1",
      "assets/layouts/map.png#preview",
      "assets\\layouts\\map.png",
      " assets/layouts/map.png",
    ];

    expect(isSafeBoxAssetPath("assets/layouts/map/base-map/map.webp")).toBe(true);
    for (const path of unsafePaths) {
      expect(isSafeBoxAssetPath(path)).toBe(false);
    }
  });

  it("validates coordinates and bounds", () => {
    const result = validateLayoutConfig(normalizeLayoutConfig({
      schemaVersion: "1.0.0",
      props: {
        mapSource: {
          mode: "image",
          projection: "linear-bounds",
          bounds: {
            west: 140,
            south: 40,
            east: 139,
            north: 35,
          },
        },
        defaultView: {
          latitude: 91,
          longitude: 181,
          zoom: 1,
        },
        entries: {
          "entry-1": {
            latitude: -91,
            longitude: 200,
          },
        },
      },
    }));

    expect(result.valid).toBe(false);
    expect(result.errors["props.mapSource.bounds"]).toBeTruthy();
    expect(result.errors["props.defaultView.latitude"]).toBeTruthy();
    expect(result.errors["props.defaultView.longitude"]).toBeTruthy();
    expect(result.errors["props.entries.entry-1.latitude"]).toBeTruthy();
    expect(result.errors["props.entries.entry-1.longitude"]).toBeTruthy();
  });

  it("layoutDefinition validation rejects unsafe raw asset refs and map source assets", async () => {
    const result = layoutDefinition.validateConfig({
      schemaVersion: "1.0.0",
      props: {
        mapSource: {
          mode: "image",
          projection: "linear-bounds",
          assetPath: "assets/layouts/map/base-map/map.png?token=1",
          bounds: {
            west: -180,
            south: -85,
            east: 180,
            north: 85,
          },
        },
      },
      assetRefs: ["assets/layouts/map/base-map/map.png?token=1"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors["props.mapSource.assetPath"]).toBeTruthy();
    expect(result.errors["assetRefs[0]"]).toBeTruthy();
  });

  it("validates the default config", () => {
    const result = validateLayoutConfigInput(createDefaultLayoutConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
