// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAtmosphereColors, clearAtmosphereColors } from "../../src/utils/atmosphere-theme";
import { resolveControlAccentPalette, type RGBColor } from "../../src/utils/color";

const TEST_COLORS: readonly RGBColor[] = [
  [232, 232, 232],
  [197, 197, 199],
  [255, 255, 255],
  [150, 150, 150],
];

function toRgba(color: RGBColor, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

const ATMOSPHERE_VARIABLE_NAMES = [
  "--color1",
  "--color2",
  "--color3",
  "--color4",
  "--color1-rgba",
  "--color2-rgba",
  "--color3-rgba",
  "--color4-rgba",
  "--control-accent-base",
  "--control-accent-strong",
  "--control-accent-rim",
  "--control-accent-glow",
  "--control-accent-foreground",
];

afterEach(() => {
  clearAtmosphereColors();
  if (typeof document !== "undefined") {
    for (const name of ATMOSPHERE_VARIABLE_NAMES) {
      document.body.style.removeProperty(name);
    }
  }
  vi.unstubAllGlobals();
});

describe("atmosphere theme variables", () => {
  it("applies atmosphere colors to body style color and accent variables", () => {
    applyAtmosphereColors(TEST_COLORS);

    const style = document.body.style;
    const palette = resolveControlAccentPalette(TEST_COLORS);

    TEST_COLORS.forEach((color, index) => {
      expect(style.getPropertyValue(`--color${index + 1}`)).toBe(toRgba(color, 0.8));
      expect(style.getPropertyValue(`--color${index + 1}-rgba`)).toBe(toRgba(color, 0.3));
    });

    expect(style.getPropertyValue("--control-accent-base")).toBe(toRgba(palette.base, 0.84));
    expect(style.getPropertyValue("--control-accent-strong")).toBe(toRgba(palette.strong, 0.98));
    expect(style.getPropertyValue("--control-accent-rim")).toBe(toRgba(palette.rim, 0.94));
    expect(style.getPropertyValue("--control-accent-glow")).toBe(toRgba(palette.glow, 0.56));
    expect(style.getPropertyValue("--control-accent-foreground")).toBe(toRgba(palette.foreground, 0.98));
  });

  it("clearing restores previously set variable values", () => {
    document.body.style.setProperty("--color1", "rgba(1,2,3,0.5)");
    document.body.style.setProperty("--control-accent-base", "rgba(9,8,7,0.4)");

    applyAtmosphereColors(TEST_COLORS);
    clearAtmosphereColors();

    expect(document.body.style.getPropertyValue("--color1")).toBe("rgba(1,2,3,0.5)");
    expect(document.body.style.getPropertyValue("--control-accent-base")).toBe("rgba(9,8,7,0.4)");
  });

  it("clearing removes variables that were not set before applying", () => {
    applyAtmosphereColors(TEST_COLORS);
    clearAtmosphereColors();

    for (const name of ATMOSPHERE_VARIABLE_NAMES) {
      expect(document.body.style.getPropertyValue(name)).toBe("");
    }
  });

  it("keeps the original baseline when applied repeatedly, restoring it on clear", () => {
    document.body.style.setProperty("--color2", "pink");

    applyAtmosphereColors(TEST_COLORS);
    applyAtmosphereColors([[10, 20, 30], [40, 50, 60], [70, 80, 90], [100, 110, 120]]);
    clearAtmosphereColors();

    expect(document.body.style.getPropertyValue("--color2")).toBe("pink");
  });

  it("clearing without applying is a no-op", () => {
    document.body.style.setProperty("--color1", "rgba(1,2,3,0.5)");

    clearAtmosphereColors();

    expect(document.body.style.getPropertyValue("--color1")).toBe("rgba(1,2,3,0.5)");
  });

  it("applies accent variables from an empty palette without throwing", () => {
    applyAtmosphereColors([]);

    expect(document.body.style.getPropertyValue("--control-accent-base")).toBe(
      toRgba(resolveControlAccentPalette([]).base, 0.84),
    );
    expect(document.body.style.getPropertyValue("--color1")).toBe("");
  });

  it("is a safe no-op without a document", () => {
    vi.stubGlobal("document", undefined);

    expect(() => applyAtmosphereColors(TEST_COLORS)).not.toThrow();
    expect(() => clearAtmosphereColors()).not.toThrow();
  });
});
