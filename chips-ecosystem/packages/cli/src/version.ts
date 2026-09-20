/**
 * CLI 版本读取：从包清单读取 `chips` 版本（唯一事实源为 `package.json`）。
 *
 * 布局契约：构建（`tsconfig.build.json`）以 `src` 为 `rootDir`、`dist` 为 `outDir`，
 * 且本文件位于 `src/` 根、编译产物位于 `dist/` 根——两执行面的目录深度一致，
 * `../package.json` 在 `src/version.ts` 与 `dist/version.js` 下都解析到
 * `packages/cli/package.json`（工单033 缺陷①：此前按 src 布局写 `../../`，
 * 产物面上解析落空恒回退 `0.0.0`，进程级回归锁见
 * `tests/dist-process.test.ts`）。
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** 包清单身份：名称不符即视为解析到了非本包清单，不采信其版本。 */
const PACKAGE_NAME = '@chips/cli';

function readVersion(): string {
  try {
    const pkg = require('../package.json') as unknown;
    if (
      typeof pkg === 'object' &&
      pkg !== null &&
      (pkg as { name?: unknown }).name === PACKAGE_NAME &&
      typeof (pkg as { version?: unknown }).version === 'string'
    ) {
      return (pkg as { version: string }).version;
    }
  } catch {
    // 包清单不可读时退回 0.0.0（构建产物缺失的诊断场景）。
  }
  return '0.0.0';
}

/** `chips` 版本。 */
export const CLI_VERSION: string = readVersion();
