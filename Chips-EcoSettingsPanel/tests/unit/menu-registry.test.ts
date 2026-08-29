import { describe, expect, it } from "vitest";
import { APP_ID } from "../../src/app/App";
import { MENU_REGISTRY } from "../../src/app/menu-registry";
import { sceneDefinitions } from "../../src/app/scene-registry";
import { appConfig } from "../../config/app-config";

describe("menu registry", () => {
  it("keeps menu entries sorted by order and registered exactly once", () => {
    expect(MENU_REGISTRY.map((entry) => entry.id)).toEqual([
      "app-plugins",
      "card-plugins",
      "layout-plugins",
      "module-plugins",
      "file-open",
      "preview-quality",
      "component-gallery",
    ]);
    expect(new Set(MENU_REGISTRY.map((entry) => entry.id)).size).toBe(MENU_REGISTRY.length);
  });

  it("syncs scene definitions with the menu registry", () => {
    expect(sceneDefinitions.map((scene) => scene.id)).toEqual(MENU_REGISTRY.map((entry) => entry.id));
    for (const scene of sceneDefinitions) {
      expect(scene.title.length).toBeGreaterThan(0);
      expect(scene.summary.length).toBeGreaterThan(0);
      expect(["插件", "开发者"]).toContain(scene.category);
    }
  });

  it("keeps the exported app identifier aligned with app config", () => {
    expect(APP_ID).toBe(appConfig.appId);
  });
});
