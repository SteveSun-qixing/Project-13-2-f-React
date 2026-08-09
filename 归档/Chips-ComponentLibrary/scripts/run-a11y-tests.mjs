import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tests = [
  path.join(root, "packages/a11y/tests/index.test.mjs"),
  path.join(root, "packages/components/tests/a11y-stage9.test.mjs"),
  path.join(root, "packages/components/tests/keyboard-a11y.test.mjs")
];

const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
