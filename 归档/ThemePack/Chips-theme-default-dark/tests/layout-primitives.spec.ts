import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LAYOUT_SCOPES = [
  "view",
  "box",
  "stack",
  "inline",
  "grid",
  "section",
  "scroll-view",
  "spacer",
  "divider",
  "split-view"
] as const;

const getPrimitiveCssBlock = (css: string): string => {
  const end = css.indexOf("/* Tabs */");
  return end >= 0 ? css.slice(0, end) : css;
};

describe("layout primitive theme styles", () => {
  it("covers all task014 layout scopes through tokenized selectors", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const layoutCss = await fs.readFile(path.join(projectRoot, "styles", "components", "layout-containers.css"), "utf-8");
    const primitiveCss = getPrimitiveCssBlock(layoutCss);

    for (const scope of LAYOUT_SCOPES) {
    expect(primitiveCss).toContain(`[data-scope="${scope}"]`);
    }

    expect(primitiveCss).toContain('[data-scope="navigation-split-view"]');
    expect(primitiveCss).toContain("var(--chips-layout-focus-outline-width");
    expect(primitiveCss).toContain("var(--chips-layout-focus-outline-offset");
    expect(primitiveCss).toContain("var(--chips-layout-size-grid-min-item");
    expect(primitiveCss).toContain("var(--chips-layout-size-split-primary-min");
    expect(primitiveCss).toContain("var(--chips-layout-size-split-secondary-min");
    expect(primitiveCss).not.toMatch(/outline:\s*1px/);
    expect(primitiveCss).not.toMatch(/outline-offset:\s*2px/);
    expect(primitiveCss).not.toMatch(/minmax\((160|180|220)px/);
  });

  it("declares the shared layout token layer used by primitives", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const raw = await fs.readFile(path.join(projectRoot, "tokens", "layout.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const layout = parsed.chips.layout;

    expect(layout.density).toMatchObject({ compact: "32cpx", comfortable: "40cpx", spacious: "48cpx" });
    expect(layout.gap).toMatchObject({ sm: "8cpx", md: "12cpx", xl: "24cpx" });
    expect(layout.size).toMatchObject({
      "grid-min-item": "160cpx",
      "split-primary-min": "180cpx",
      "split-secondary-min": "220cpx",
      "navigation-primary-min": "160cpx"
    });
    expect(layout.focus).toMatchObject({ "outline-width": "1px", "outline-offset": "2px" });
  });

});
