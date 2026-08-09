import fs from "node:fs/promises";
import path from "node:path";

interface ThemeTokenLayers {
  ref: Record<string, unknown>;
  sys: Record<string, unknown>;
  comp: Record<string, unknown>;
  motion: Record<string, unknown>;
  layout: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const flattenLayer = (layer: Record<string, unknown>, prefix?: string): Record<string, unknown> => {
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
  walk(layer, prefix ? [prefix] : []);
  return flat;
};

export const REQUIRED_THEME_TOKENS: string[] = [
  "chips.sys.icon.color",
  "chips.sys.icon.size",
  "chips.sys.icon.fill",
  "chips.sys.icon.wght",
  "chips.sys.icon.grad",
  "chips.sys.icon.opsz",
  "chips.comp.button.root.radius",
  "chips.comp.button.root.surface.idle",
  "chips.comp.button.root.surface.hover",
  "chips.comp.button.root.surface.active",
  "chips.comp.button.root.surface.disabled",
  "chips.comp.button.label.color.idle",
  "chips.comp.button.label.color.disabled",
  "chips.comp.button.focus.outline",
  "chips.comp.input.root.radius",
  "chips.comp.input.root.surface.idle",
  "chips.comp.input.root.surface.focus",
  "chips.comp.input.root.border.idle",
  "chips.comp.input.root.border.error",
  "chips.comp.input.value.color",
  "chips.comp.input.placeholder.color"
];

const main = async (): Promise<void> => {
  const projectRoot = process.cwd();
  const tokensPath = path.join(projectRoot, "dist", "tokens.json");

  const raw = await fs.readFile(tokensPath, "utf-8");
  const parsed = JSON.parse(raw) as ThemeTokenLayers;

  if (!isRecord(parsed.ref) || !isRecord(parsed.sys) || !isRecord(parsed.comp)) {
    // eslint-disable-next-line no-console
    console.error("Theme tokens must contain ref/sys/comp layers with object values.");
    process.exitCode = 1;
    return;
  }

  const refFlat = flattenLayer(parsed.ref);
  const sysFlat = flattenLayer(parsed.sys);
  const compFlat = flattenLayer(parsed.comp);
  const motionFlat = flattenLayer(parsed.motion ?? {});
  const layoutFlat = flattenLayer(parsed.layout ?? {});

  const variables: Record<string, unknown> = {
    ...refFlat,
    ...sysFlat,
    ...compFlat,
    ...motionFlat,
    ...layoutFlat
  };

  const missing = REQUIRED_THEME_TOKENS.filter((key) => !(key in variables));

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error("Theme validation failed. Missing component tokens:", missing);
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Theme tokens structure is valid and required component tokens are present.");
};

void main();
