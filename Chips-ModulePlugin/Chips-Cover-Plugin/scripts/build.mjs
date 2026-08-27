import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const distDir = path.join(projectRoot, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await build({
  absWorkingDir: projectRoot,
  entryPoints: ["./src/index.ts"],
  outfile: "./dist/index.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
  sourcemap: false,
  logLevel: "info",
});
