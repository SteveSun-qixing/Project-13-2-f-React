#!/usr/bin/env node
/**
 * 复制已构建的平台原生产物为 `packages/host/native/chips-native.node`。
 *
 * 用法：node scripts/copy-native.mjs [--debug]
 *
 * 仅复制；构建由 `scripts/build-native.mjs` 负责。产物缺失时以明确
 * 错误退出（提示先执行 `pnpm --filter @chips/native run build`）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');

/** 平台 cdylib 名称。 */
const LIBRARY_NAMES = {
  darwin: 'libchips_native.dylib',
  linux: 'libchips_native.so',
  win32: 'chips_native.dll',
};

/**
 * 复制原生模块产物。
 * @param {{ debug?: boolean; workspaceRoot?: string }} [options]
 */
export function copyNative(options = {}) {
  const debug = options.debug ?? process.argv.includes('--debug');
  const root = options.workspaceRoot ?? workspaceRoot;
  const targetDir = process.env.CARGO_TARGET_DIR
    ? path.resolve(process.env.CARGO_TARGET_DIR)
    : path.join(root, 'target');
  const profile = debug ? 'debug' : 'release';
  const libraryName = LIBRARY_NAMES[process.platform];

  if (!libraryName) {
    console.error(`[copy-native] 不支持的平台：${process.platform}`);
    process.exit(1);
  }

  const artifact = path.join(targetDir, profile, libraryName);
  if (!fs.existsSync(artifact)) {
    console.error(
      `[copy-native] 产物不存在：${path.relative(root, artifact)}\n` +
        '请先执行 `pnpm --filter @chips/native run build`。'
    );
    process.exit(1);
  }

  const destinationDir = path.join(root, 'packages', 'host', 'native');
  fs.mkdirSync(destinationDir, { recursive: true });
  const destination = path.join(destinationDir, 'chips-native.node');
  fs.copyFileSync(artifact, destination);

  const { size } = fs.statSync(destination);
  if (size === 0) {
    console.error('[copy-native] 复制结果为空文件');
    process.exit(1);
  }
  console.warn(`[copy-native] ${path.relative(root, destination)}（${size} 字节）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  copyNative();
}
