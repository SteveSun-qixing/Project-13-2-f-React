#!/usr/bin/env tsx
/**
 * 覆盖率聚合报告 CLI（根脚本 `pnpm report:coverage` 入口）。
 *
 * 判定唯一归属 G6（工单 017），本入口只委托执行并透出结论与退出码。
 */

import { runCoverageGate } from './runner.ts';

const result = runCoverageGate();

if (result.exitCode === 2) {
  process.stderr.write(`${result.message ?? '覆盖率报告执行失败'}\n`);
} else if (result.exitCode === 1 && result.report !== undefined) {
  process.stderr.write(
    `覆盖率判定未达标（G6 结论：${result.report.conclusion}），详见 reports/coverage/summary.md\n`
  );
}

process.exitCode = result.exitCode;
