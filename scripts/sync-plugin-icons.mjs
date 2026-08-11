import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ICON_TARGETS } from "./icon-targets.mjs";

const ROOT = process.cwd();
const CHIPS_BIN = path.join(ROOT, "node_modules", ".bin", "chips");
const FORMATS = ["png", "ico", "icns"];
const SIZE = 512;

const KIND_DIRS = {
  app: "design-assets/Appicon",
  template: "design-assets/Appicon",
  basecard: "design-assets/Basecardicon",
  layout: "design-assets/Layouticon",
  module: "design-assets/Moduleicon",
  theme: "design-assets/Themeicon",
};

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runIconMakerCli(inputPath, outputDir) {
  const result = spawnSync(
    CHIPS_BIN,
    [
      "iconmaker",
      "generate",
      inputPath,
      "-o",
      outputDir,
      "-f",
      FORMATS.join(","),
      "-s",
      String(SIZE),
      "--json",
    ],
    { encoding: "utf-8", timeout: 120_000 },
  );
  if (result.status !== 0 || result.error) {
    throw new Error(
      `chips iconmaker generate 失败: ${inputPath}\nstdout: ${result.stdout}\nstderr: ${result.stderr}\nerror: ${result.error?.message ?? ""}`,
    );
  }
  const parsed = JSON.parse(result.stdout);
  const task = parsed?.task;
  if (!parsed?.ok || task?.status !== "completed") {
    throw new Error(`chips iconmaker generate 未完成: ${inputPath}\n${result.stdout}`);
  }
  return task.output?.files ?? [];
}

async function syncTarget(target) {
  const kindDir = path.join(ROOT, KIND_DIRS[target.kind]);
  const designSourceInput = path.join(kindDir, `${target.sourceBaseName}.svg`);
  const synced = [];

  if (await exists(designSourceInput)) {
    await runIconMakerCli(designSourceInput, kindDir);
    synced.push(`${kindDir}/${target.sourceBaseName}.png/.ico/.icns`);
  }

  if (target.projectDir && target.projectIconBaseName) {
    const projectIconDir = path.join(ROOT, target.projectDir, "assets", "icons");
    const projectIconInput = path.join(projectIconDir, `${target.projectIconBaseName}.svg`);
    if (await exists(projectIconInput)) {
      await mkdir(projectIconDir, { recursive: true });
      await runIconMakerCli(projectIconInput, projectIconDir);
      synced.push(`${projectIconDir}/${target.projectIconBaseName}.png/.ico/.icns`);
    }
  }

  return synced;
}

async function main() {
  const synced = [];
  let failed = 0;

  for (const target of ICON_TARGETS) {
    try {
      const paths = await syncTarget(target);
      synced.push(`${target.kind}:${target.sourceBaseName} -> ${paths.join(", ")}`);
      console.log(`- ${target.kind}:${target.sourceBaseName} OK`);
    } catch (error) {
      failed += 1;
      console.error(`- ${target.kind}:${target.sourceBaseName} FAILED: ${error.message}`);
    }
  }

  console.log(`Rendered ${synced.length} icon targets (${failed} failed)`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
