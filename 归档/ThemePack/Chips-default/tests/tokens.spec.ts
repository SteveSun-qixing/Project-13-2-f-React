import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface ThemeTokenLayers {
  ref: Record<string, unknown>;
  sys: Record<string, unknown>;
  comp: Record<string, unknown>;
  motion: Record<string, unknown>;
  layout: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

describe("theme tokens", () => {
  it("produces five-layer tokens structure", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const tokensPath = path.join(projectRoot, "dist", "tokens.json");
    const raw = await fs.readFile(tokensPath, "utf-8");
    const parsed = JSON.parse(raw) as ThemeTokenLayers;

    expect(isRecord(parsed.ref)).toBe(true);
    expect(isRecord(parsed.sys)).toBe(true);
    expect(isRecord(parsed.comp)).toBe(true);
    expect(isRecord(parsed.motion)).toBe(true);
    expect(isRecord(parsed.layout)).toBe(true);
    expect(parsed.comp.chips?.comp?.text?.root?.color?.default).toBeDefined();
    expect(parsed.comp.chips?.comp?.label?.["required-indicator"]?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.icon?.root?.opsz).toBeDefined();
    expect(parsed.comp.chips?.comp?.icon?.root?.["color-accent"]).toBeDefined();
    expect(parsed.comp.chips?.comp?.icon?.root?.["wght-strong"]).toBeDefined();
    expect(parsed.comp.chips?.comp?.icon?.root?.["grad-muted"]).toBeDefined();
    expect(parsed.comp.chips?.comp?.["icon-button"]?.root?.size).toBeDefined();
    expect(parsed.comp.chips?.comp?.["icon-button"]?.icon?.color?.hover).toBeDefined();
    expect(parsed.comp.chips?.comp?.["toggle-button"]?.root?.surface?.pressed).toBeDefined();
    expect(parsed.comp.chips?.comp?.badge?.root?.surface?.warning).toBeDefined();
    expect(parsed.comp.chips?.comp?.tag?.close?.color?.hover).toBeDefined();
    expect(parsed.comp.chips?.comp?.avatar?.fallback?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.spinner?.motion?.duration).toBeDefined();
    expect(parsed.comp.chips?.comp?.progress?.range?.surface?.indeterminate).toBeDefined();
    expect(parsed.comp.chips?.comp?.progress?.range?.motion?.duration).toBeDefined();
    expect(parsed.comp.chips?.comp?.["text-field"]?.root?.border?.error).toBeDefined();
    expect(parsed.comp.chips?.comp?.["text-area"]?.control?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.["search-field"]?.clear?.color?.hover).toBeDefined();
    expect(parsed.comp.chips?.comp?.["secure-field"]?.toggle?.color?.idle).toBeDefined();
    expect(parsed.comp.chips?.comp?.["segmented-control"]?.item?.surface?.selected).toBeDefined();
    expect(parsed.comp.chips?.comp?.select?.content?.surface).toBeDefined();
    expect(parsed.comp.chips?.comp?.select?.option?.surface?.highlighted).toBeDefined();
    expect(parsed.comp.chips?.comp?.menu?.group?.label?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.menu?.separator?.thickness).toBeDefined();
    expect(parsed.comp.chips?.comp?.["menu-bar"]?.item?.icon?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.["context-menu"]?.item?.icon?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.["combo-box"]?.option?.surface?.highlighted).toBeDefined();
    expect(parsed.comp.chips?.comp?.["number-input"]?.root?.border?.error).toBeDefined();
    expect(parsed.comp.chips?.comp?.stepper?.increment?.surface?.active).toBeDefined();
    expect(parsed.comp.chips?.comp?.slider?.thumb?.surface?.active).toBeDefined();
    expect(parsed.comp.chips?.comp?.["date-picker"]?.cell?.surface?.selected).toBeDefined();
    expect(parsed.comp.chips?.comp?.["time-picker"]?.option?.surface?.selected).toBeDefined();
    expect(parsed.comp.chips?.comp?.image?.fallback?.surface).toBeDefined();
    expect(parsed.comp.chips?.comp?.media?.control?.surface?.idle).toBeDefined();
    expect(parsed.comp.chips?.comp?.["error-state"]?.details?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.dialog?.header?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.dialog?.body?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.dialog?.footer?.gap).toBeDefined();
    expect(parsed.comp.chips?.comp?.dialog?.actions?.gap).toBeDefined();
    expect(parsed.comp.chips?.comp?.dialog?.title).toBeUndefined();
    expect(parsed.comp.chips?.comp?.form?.control?.border?.error).toBeDefined();
    expect(parsed.comp.chips?.comp?.form?.hint?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.["data-grid"]?.toolbar?.surface).toBeDefined();
    expect(parsed.comp.chips?.comp?.["data-grid"]?.header?.sort?.color).toBeDefined();
    expect(parsed.comp.chips?.comp?.["data-grid"]?.pagination?.gap).toBeDefined();
    expect(parsed.comp.chips?.comp?.skeleton?.item?.motion?.duration).toBeDefined();
    expect(parsed.comp.chips?.comp?.["loading-boundary"]?.skeleton?.motion?.duration).toBeDefined();
    expect(parsed.comp.chips?.comp?.["navigation-split-view"]?.sidebar?.surface).toBeDefined();
    expect(parsed.comp.chips?.comp?.["navigation-split-view"]?.detail?.surface).toBeDefined();
    expect(parsed.comp.chips?.comp?.["navigation-split-view"]?.divider?.color).toBeDefined();
    expect(parsed.motion.chips?.motion?.overlay?.["enter-duration"]).toBeDefined();
    expect(parsed.motion.chips?.motion?.menu?.distance).toBeDefined();
    expect(parsed.motion.chips?.motion?.reduced?.duration).toBe("0ms");
  });
});
