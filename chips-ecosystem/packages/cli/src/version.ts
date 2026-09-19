/**
 * CLI 版本读取：从包清单读取 `chips` 版本（唯一事实源为 `package.json`）。
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function readVersion(): string {
  try {
    const pkg = require('../../package.json') as unknown;
    if (typeof pkg === 'object' && pkg !== null && typeof (pkg as { version?: unknown }).version === 'string') {
      return (pkg as { version: string }).version;
    }
  } catch {
    // 包清单不可读时退回 0.0.0（构建产物缺失的诊断场景）。
  }
  return '0.0.0';
}

/** `chips` 版本。 */
export const CLI_VERSION: string = readVersion();
