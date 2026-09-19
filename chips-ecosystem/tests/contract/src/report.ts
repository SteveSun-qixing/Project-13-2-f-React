/**
 * 契约测试报告：把 vitest 运行结果渲染为 `reports/contract/` 下的 JSON 与 Markdown。
 *
 * 报告是 G8 的流水线工件：失败时必须包含逐条偏差文本（差异清单），
 * 成功时给出通过清单与快照模式；两种模式都输出，便于 CI 归档与复盘。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { REPORTS_DIR } from './paths.js';

export const REPORT_SCHEMA_VERSION = 1;

export interface ContractTestEntry {
  readonly name: string;
  readonly fullName: string;
  readonly state: string;
  readonly durationMs: number;
  readonly errors: readonly string[];
}

export interface ContractTestFile {
  readonly file: string;
  readonly tests: readonly ContractTestEntry[];
}

export interface ContractReportSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly durationMs: number;
}

export interface ContractReport {
  readonly schemaVersion: number;
  readonly gate: 'G8';
  readonly title: string;
  readonly generatedAt: string;
  readonly snapshotMode: 'verify' | 'update';
  readonly status: 'passed' | 'failed';
  readonly summary: ContractReportSummary;
  readonly files: readonly ContractTestFile[];
  readonly unhandledErrors: readonly string[];
}

export interface BuildReportInput {
  readonly files: readonly ContractTestFile[];
  readonly unhandledErrors: readonly string[];
  readonly durationMs: number;
  readonly snapshotMode: 'verify' | 'update';
}

export function buildContractReport(input: BuildReportInput): ContractReport {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const file of input.files) {
    for (const test of file.tests) {
      total += 1;
      if (test.state === 'passed') {
        passed += 1;
      } else if (test.state === 'failed') {
        failed += 1;
      } else {
        skipped += 1;
      }
    }
  }
  const status = failed > 0 || input.unhandledErrors.length > 0 ? 'failed' : 'passed';
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    gate: 'G8',
    title: '契约一致性测试报告',
    generatedAt: new Date().toISOString(),
    snapshotMode: input.snapshotMode,
    status,
    summary: { total, passed, failed, skipped, durationMs: input.durationMs },
    files: input.files,
    unhandledErrors: input.unhandledErrors,
  };
}

export function renderMarkdownReport(report: ContractReport): string {
  const lines: string[] = [];
  lines.push('# 契约一致性测试报告（G8）');
  lines.push('');
  lines.push(`- 生成时间：${report.generatedAt}`);
  lines.push(`- 状态：${report.status === 'passed' ? '通过' : '失败'}`);
  lines.push(`- 快照模式：${report.snapshotMode === 'update' ? '显式更新' : '校验'}`);
  lines.push(
    `- 汇总：共 ${report.summary.total}，通过 ${report.summary.passed}，失败 ${report.summary.failed}，跳过 ${report.summary.skipped}，耗时 ${report.summary.durationMs} ms`,
  );
  lines.push('');
  if (report.summary.failed > 0) {
    lines.push('## 失败清单');
    lines.push('');
    for (const file of report.files) {
      for (const test of file.tests) {
        if (test.state !== 'failed') {
          continue;
        }
        lines.push(`### ${test.fullName}`);
        lines.push('');
        lines.push(`- 文件：\`${file.file}\``);
        for (const error of test.errors) {
          lines.push('');
          lines.push('```text');
          lines.push(error);
          lines.push('```');
        }
        lines.push('');
      }
    }
  }
  if (report.unhandledErrors.length > 0) {
    lines.push('## 未处理错误');
    lines.push('');
    for (const error of report.unhandledErrors) {
      lines.push('```text');
      lines.push(error);
      lines.push('```');
      lines.push('');
    }
  }
  lines.push('## 用例清单');
  lines.push('');
  for (const file of report.files) {
    lines.push(`### ${file.file}`);
    lines.push('');
    for (const test of file.tests) {
      const marker = test.state === 'passed' ? '通过' : test.state === 'failed' ? '失败' : '跳过';
      lines.push(`- [${marker}] ${test.fullName}（${test.durationMs} ms）`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('**报告结束**');
  lines.push('');
  return lines.join('\n');
}

export interface WrittenReport {
  readonly jsonPath: string;
  readonly markdownPath: string;
}

export function writeContractReport(report: ContractReport, reportsDir: string = REPORTS_DIR): WrittenReport {
  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, 'contract-report.json');
  const markdownPath = path.join(reportsDir, 'contract-report.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, renderMarkdownReport(report), 'utf8');
  return { jsonPath, markdownPath };
}
