#!/usr/bin/env node
/**
 * `chips` 可执行入口（用户侧与开发侧共用同一可执行文件，[CLI 完整参考] §1.1）。
 */

import { main } from './main.js';

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
