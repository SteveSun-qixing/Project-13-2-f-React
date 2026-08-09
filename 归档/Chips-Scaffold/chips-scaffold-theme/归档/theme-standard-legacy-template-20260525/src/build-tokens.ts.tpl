import fs from "node:fs/promises";
import path from "node:path";

interface ComponentTokensFile {
  component: string;
  tokens: Record<string, unknown>;
}

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const fileIfExists = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    return await readJson<T>(filePath);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
};

const deepMerge = (base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];
    if (current && typeof current === "object" && !Array.isArray(current) && typeof value === "object" && !Array.isArray(value)) {
      result[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    result[key] = value;
  }
  return result;
};

const buildComponentLayer = async (tokensDir: string): Promise<Record<string, unknown>> => {
  const componentsDir = path.join(tokensDir, "components");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(componentsDir);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const root: Record<string, unknown> = {};
  const chips = (root["chips"] = (root["chips"] as Record<string, unknown>) || {});
  const chipsComp = ((chips as Record<string, unknown>)["comp"] =
    ((chips as Record<string, unknown>)["comp"] as Record<string, unknown>) || {});

  for (const name of entries) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const fullPath = path.join(componentsDir, name);
    const parsed = await readJson<ComponentTokensFile>(fullPath);
    const componentName = parsed.component;
    if (!componentName || typeof componentName !== "string") {
      continue;
    }
    (chipsComp as Record<string, unknown>)[componentName] = parsed.tokens ?? {};
  }

  return root;
};

const main = async (): Promise<void> => {
  const projectRoot = process.cwd();
  const tokensDir = path.join(projectRoot, "tokens");

  const globalTokens = await fileIfExists<Record<string, unknown>>(
    path.join(tokensDir, "global.json"),
    {}
  );
  const semanticTokens = await fileIfExists<Record<string, unknown>>(
    path.join(tokensDir, "semantic.json"),
    {}
  );
  const typographyTokens = await fileIfExists<Record<string, unknown>>(
    path.join(tokensDir, "typography.json"),
    {}
  );
  const motionTokens = await fileIfExists<Record<string, unknown>>(
    path.join(tokensDir, "motion.json"),
    {}
  );
  const layoutTokens = await fileIfExists<Record<string, unknown>>(
    path.join(tokensDir, "layout.json"),
    {}
  );
  const compLayer = await buildComponentLayer(tokensDir);

  const ref = deepMerge(globalTokens, typographyTokens);
  const sys = semanticTokens;
  const comp = compLayer;
  const motion = motionTokens;
  const layout = layoutTokens;

  const themeTokens = { ref, sys, comp, motion, layout };

  const distDir = path.join(projectRoot, "dist");
  await fs.mkdir(distDir, { recursive: true });
  const outputPath = path.join(distDir, "tokens.json");
  await fs.writeFile(outputPath, JSON.stringify(themeTokens, null, 2), "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Theme tokens written to ${outputPath}`);
};

void main();

