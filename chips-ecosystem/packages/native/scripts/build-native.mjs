#!/usr/bin/env node
/**
 * 构建 chips-native.node：cargo 产出平台原生产物后复制到宿主 native 目录。
 *
 * 用法：node scripts/build-native.mjs [--debug]
 *
 * 产物落位：`packages/host/native/chips-native.node`
 * （《代码组织规范》§7.1 写 `packages/host-electron/native/`；现行工作区
 * 目录为 `packages/host`，差异已由 W1-HOST 登记，构建脚本按现行目录落位）。
 *
 * 产物不入库（`.gitignore` 覆盖 `*.node`）。
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { copyNative } from './copy-native.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');

const debug = process.argv.includes('--debug');
const profileArgs = debug ? [] : ['--release'];

const result = spawnSync('cargo', ['build', '-p', 'chips-native', ...profileArgs], {
  cwd: workspaceRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[build-native] 无法启动 cargo：${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('[build-native] cargo 构建失败');
  process.exit(result.status ?? 1);
}

copyNative({ debug, workspaceRoot });
console.warn(`[build-native] 完成：${debug ? 'debug' : 'release'} 产物已复制`);
