/**
 * vitest 自定义报告器：运行结束（无论通过或失败）写入 `reports/contract/`。
 *
 * 使用 `onTestRunEnd` 而不是测试内钩子，保证用例断言失败、收集失败与
 * 进程未捕获错误都能进入报告；报告器不修改退出码，门禁判定仍由 vitest 退出码承担。
 */

import type {
  Reporter,
  SerializedError,
  TestCase,
  TestModule,
  TestRunEndReason,
} from 'vitest/node';

import { workspaceRelative } from './paths.js';
import {
  buildContractReport,
  writeContractReport,
  type ContractTestEntry,
  type ContractTestFile,
} from './report.js';
import { isSnapshotUpdateMode } from './snapshot.js';

function toEntry(test: TestCase): ContractTestEntry {
  const result = test.result();
  const diagnostic = test.diagnostic();
  const errors = 'errors' in result && result.errors !== undefined ? result.errors : [];
  return {
    name: test.name,
    fullName: test.fullName,
    state: result.state,
    durationMs: diagnostic?.duration ?? 0,
    errors: errors.map((error) => error.message),
  };
}

function collectFiles(testModules: ReadonlyArray<TestModule>): ContractTestFile[] {
  const files: ContractTestFile[] = [];
  for (const module of testModules) {
    const tests: ContractTestEntry[] = [];
    for (const test of module.children.allTests()) {
      tests.push(toEntry(test));
    }
    files.push({ file: workspaceRelative(module.moduleId), tests });
  }
  return files.sort((left, right) => left.file.localeCompare(right.file));
}

export default class ContractReporter implements Reporter {
  private startTime = Date.now();

  onTestRunStart(): void {
    this.startTime = Date.now();
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    _reason: TestRunEndReason
  ): void {
    const files = collectFiles(testModules);
    const report = buildContractReport({
      files,
      unhandledErrors: unhandledErrors.map((error) => error.message),
      durationMs: Date.now() - this.startTime,
      snapshotMode: isSnapshotUpdateMode() ? 'update' : 'verify',
    });
    const written = writeContractReport(report);
    if (report.status === 'failed') {
      console.error(
        `[contract] 失败 ${report.summary.failed} 项；报告：${workspaceRelative(written.markdownPath)}`
      );
    } else {
      console.warn(
        `[contract] 通过 ${report.summary.passed} 项；报告：${workspaceRelative(written.markdownPath)}`
      );
    }
  }
}
