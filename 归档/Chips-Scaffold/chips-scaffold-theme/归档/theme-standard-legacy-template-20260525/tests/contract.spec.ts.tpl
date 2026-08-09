import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_THEME_TOKENS } from "../src/validate-theme";

interface ThemeTokenLayers {
  ref: Record<string, unknown>;
  sys: Record<string, unknown>;
  comp: Record<string, unknown>;
  motion: Record<string, unknown>;
  layout: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const flattenLayer = (layer: Record<string, unknown>): Record<string, unknown> => {
  const flat: Record<string, unknown> = {};
  const walk = (node: unknown, pathParts: string[]): void => {
    if (!isRecord(node)) {
      const key = pathParts.join(".");
      flat[key] = node;
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      walk(v, [...pathParts, k]);
    }
  };
  walk(layer, []);
  return flat;
};

describe("theme contract", () => {
  it("provides required tokens for the formal runtime surface", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const tokensPath = path.join(projectRoot, "dist", "tokens.json");
    const raw = await fs.readFile(tokensPath, "utf-8");
    const parsed = JSON.parse(raw) as ThemeTokenLayers;

    const variables = {
      ...flattenLayer(parsed.ref),
      ...flattenLayer(parsed.sys),
      ...flattenLayer(parsed.comp),
      ...flattenLayer(parsed.motion),
      ...flattenLayer(parsed.layout),
    };

    for (const tokenKey of REQUIRED_THEME_TOKENS) {
      expect(tokenKey in variables).toBe(true);
    }
  });
});
