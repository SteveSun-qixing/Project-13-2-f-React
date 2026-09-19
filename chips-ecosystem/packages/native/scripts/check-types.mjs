#!/usr/bin/env node
/**
 * JS 侧类型检查：以 `tests/typecheck/` 夹具消费 `types/chips-native.d.ts`
 * 的全部导入面（含 `@ts-expect-error` 负例），运行 `tsc --noEmit`。
 *
 * 退出码：0 通过；1 失败。
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');

const candidates = [
  path.join(workspaceRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  path.join(workspaceRoot, 'node_modules', '.bin', 'tsc'),
];
const tsc = candidates.find((candidate) => fs.existsSync(candidate));

if (!tsc) {
  console.error('[check-types] 找不到 typescript（请先在 chips-ecosystem 执行 pnpm install）');
  process.exit(1);
}

const project = path.join(packageRoot, 'tests', 'typecheck', 'tsconfig.json');
const result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', project], {
  cwd: packageRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[check-types] 无法启动 tsc：${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('[check-types] 失败：类型检查未通过');
  process.exit(result.status ?? 1);
}
console.warn('[check-types] 通过：全部导出面与负例类型检查通过');
