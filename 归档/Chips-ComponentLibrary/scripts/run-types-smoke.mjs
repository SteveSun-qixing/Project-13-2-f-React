import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");
const projectPath = path.join(root, "tests", "types", "tsconfig.json");

const result = spawnSync(process.execPath, [tscPath, "--project", projectPath], {
  cwd: root,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
