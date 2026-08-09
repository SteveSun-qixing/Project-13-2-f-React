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
  });
});

