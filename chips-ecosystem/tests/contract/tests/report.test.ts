/**
 * 失败报告自测：报告构建与渲染必须包含失败清单与逐条偏差文本。
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  buildContractReport,
  renderMarkdownReport,
  writeContractReport,
  type ContractTestFile,
} from '../src/report.js';

const files: readonly ContractTestFile[] = [
  {
    file: 'tests/contract/tests/capabilities.test.ts',
    tests: [
      {
        name: '通过用例',
        fullName: '能力表 > 通过用例',
        state: 'passed',
        durationMs: 3,
        errors: [],
      },
      {
        name: '失败用例',
        fullName: '能力表 > 失败用例',
        state: 'failed',
        durationMs: 5,
        errors: [
          '[CONTRACT_CAPABILITY_MISSING] file:read：文档登记的内置能力未出现在 Bridge 注册表',
        ],
      },
    ],
  },
];

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'chips-contract-report-'));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('buildContractReport', () => {
  it('汇总计数与状态由用例结果推导', () => {
    const report = buildContractReport({
      files,
      unhandledErrors: [],
      durationMs: 42,
      snapshotMode: 'verify',
    });
    expect(report.schemaVersion).toBe(1);
    expect(report.gate).toBe('G8');
    expect(report.status).toBe('failed');
    expect(report.summary).toEqual({ total: 2, passed: 1, failed: 1, skipped: 0, durationMs: 42 });
  });

  it('未处理错误也判定为失败', () => {
    const report = buildContractReport({
      files: [],
      unhandledErrors: ['boom'],
      durationMs: 1,
      snapshotMode: 'verify',
    });
    expect(report.status).toBe('failed');
  });
});

describe('renderMarkdownReport', () => {
  it('失败报告包含失败清单与偏差全文', () => {
    const report = buildContractReport({
      files,
      unhandledErrors: [],
      durationMs: 10,
      snapshotMode: 'update',
    });
    const markdown = renderMarkdownReport(report);
    expect(markdown).toContain('## 失败清单');
    expect(markdown).toContain('CONTRACT_CAPABILITY_MISSING');
    expect(markdown).toContain('快照模式：显式更新');
    expect(markdown).toContain('**报告结束**');
  });
});

describe('writeContractReport', () => {
  it('写出 JSON 与 Markdown 两个工件', () => {
    const report = buildContractReport({
      files,
      unhandledErrors: [],
      durationMs: 7,
      snapshotMode: 'verify',
    });
    const written = writeContractReport(report, tempDir);
    const json = JSON.parse(readFileSync(written.jsonPath, 'utf8')) as { status: string };
    expect(json.status).toBe('failed');
    expect(readFileSync(written.markdownPath, 'utf8')).toContain('契约一致性测试报告');
  });
});
