import { describe, expect, it } from "vitest";
import {
  P0_BASE_INTERACTIVE_COMPONENTS,
  P0_DATA_FORM_COMPONENTS,
  STAGE7_DATA_ADVANCED_COMPONENTS,
  STAGE7_WORKBENCH_COMPONENTS,
  STAGE8_SYSTEM_UX_COMPONENTS,
} from "@chips/component-library";
import { getComponentGroups } from "../../src/features/component-gallery/registry";

describe("component gallery registry", () => {
  it("covers every formal component group with a preview registration", () => {
    const groups = getComponentGroups();
    const expectedGroupSizes = [
      P0_BASE_INTERACTIVE_COMPONENTS.length,
      P0_DATA_FORM_COMPONENTS.length,
      STAGE7_DATA_ADVANCED_COMPONENTS.length,
      STAGE7_WORKBENCH_COMPONENTS.length,
      STAGE8_SYSTEM_UX_COMPONENTS.length,
    ];

    expect(groups).toHaveLength(expectedGroupSizes.length);
    expect(groups.map((group) => group.items.length)).toEqual(expectedGroupSizes);
  });

  it("assigns a preview renderer to every registered component", () => {
    for (const group of getComponentGroups()) {
      for (const item of group.items) {
        expect(item.name).toBeTruthy();
        expect(item.scope).toBeTruthy();
        expect(item.parts.length).toBeGreaterThan(0);
        expect(item.summaryKey).toContain("settingsPanel.gallery.components.");
        expect(["hero", "wide", "standard"]).toContain(item.emphasis);
        expect(typeof item.preview).toBe("function");
      }
    }
  });
});
