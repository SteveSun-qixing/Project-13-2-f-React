import fs from "node:fs/promises";
import path from "node:path";

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const deepMerge = (base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];
    if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    result[key] = value;
  }
  return result;
};

const buildComponentLayer = async (tokensDir: string): Promise<Record<string, unknown>> => {
  const compDir = path.join(tokensDir, "comp");
  const entries = await fs.readdir(compDir);

  let merged: Record<string, unknown> = {};

  for (const name of entries.sort()) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const fullPath = path.join(compDir, name);
    const parsed = await readJson<Record<string, unknown>>(fullPath);
    merged = deepMerge(merged, parsed);
  }

  return merged;
};

const main = async (): Promise<void> => {
  const projectRoot = process.cwd();
  const tokensDir = path.join(projectRoot, "tokens");

  const ref = await readJson<Record<string, unknown>>(path.join(tokensDir, "ref.json"));
  const sys = await readJson<Record<string, unknown>>(path.join(tokensDir, "sys.json"));
  const motion = await readJson<Record<string, unknown>>(path.join(tokensDir, "motion.json"));
  const layout = await readJson<Record<string, unknown>>(path.join(tokensDir, "layout.json"));
  const comp = await buildComponentLayer(tokensDir);

  const themeTokens = { ref, sys, comp, motion, layout };

  const distDir = path.join(projectRoot, "dist");
  await fs.mkdir(distDir, { recursive: true });
  const outputPath = path.join(distDir, "tokens.json");
  await fs.writeFile(outputPath, JSON.stringify(themeTokens, null, 2), "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Theme tokens written to ${outputPath}`);
};

void main();
