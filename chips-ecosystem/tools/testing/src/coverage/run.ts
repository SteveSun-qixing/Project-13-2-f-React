/**
 * 全量覆盖率流程编排（根脚本 `pnpm test:coverage` 入口）。
 *
 * 流程：Rust 覆盖率（cargo-tarpaulin）→ TS 覆盖率（vitest + v8）→
 * 聚合报告（判定委托 G6，工单 017）。
 * 任一环节失败仍继续执行后续环节，保证报告与判定信息完整；最终退出码非零。
 */

import { spawnSync } from 'node:child_process';

import { REPO_ROOT, runCoverageGate, type RunCoverageGateResult } from './runner.ts';

interface CoverageStage {
  readonly id: string;
  readonly label: string;
  readonly command: string;
}

const STAGES: readonly CoverageStage[] = [
  {
    id: 'test:coverage:rust',
    label: 'Rust 覆盖率（cargo-tarpaulin）',
    command:
      'cargo tarpaulin --workspace --no-fail-fast --out Xml Json Lcov --output-dir coverage/rust',
  },
  {
    id: 'test:coverage:ts',
    label: 'TypeScript 覆盖率（vitest + v8）',
    command: 'pnpm exec vitest run --coverage --configLoader runner',
  },
];

const writeLine = (line: string): void => void process.stdout.write(`${line}\n`);

const runStage = (stage: CoverageStage): number => {
  writeLine(`\n=== ${stage.label} ===`);
  writeLine(`$ ${stage.command}`);
  const result = spawnSync(stage.command, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.error !== undefined) {
    process.stderr.write(`阶段执行失败：${stage.label}：${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
};

const main = (): number => {
  const failures: CoverageStage[] = [];
  for (const stage of STAGES) {
    const status = runStage(stage);
    if (status !== 0) {
      failures.push(stage);
      writeLine(`阶段未通过（退出码 ${status}）：${stage.label}`);
    }
  }

  let gate: RunCoverageGateResult;
  try {
    gate = runCoverageGate();
  } catch (error) {
    process.stderr.write(`覆盖率门禁执行异常：${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  if (gate.exitCode === 2) {
    process.stderr.write(`${gate.message ?? '覆盖率门禁执行失败'}\n`);
  }

  if (gate.exitCode !== 0) {
    return gate.exitCode;
  }
  return failures.length > 0 ? 1 : 0;
};

process.exitCode = main();
