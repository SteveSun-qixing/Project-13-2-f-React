import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../check-coverage.mjs';
import { coverageConfig, fixture, noFlags, violationCodes } from './helpers.mjs';

test('coverage：达标报告通过（TS 分组 + Rust）', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-good'),
    config: coverageConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.tsFiles, 2);
});

test('coverage：不达标报告报告 COVERAGE010', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-bad'),
    config: coverageConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  assert.ok(codes.includes('COVERAGE010'));
  assert.ok(
    report.violations.some((item) => item.code === 'COVERAGE010' && item.message.includes('shared'))
  );
  assert.ok(
    report.violations.some(
      (item) => item.code === 'COVERAGE010' && item.message.includes('rust-core')
    )
  );
});

test('coverage：报告缺失报告 COVERAGE001（TS 与 Rust 各一条）', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-missing'),
    config: coverageConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  assert.equal(report.violations.filter((item) => item.code === 'COVERAGE001').length, 2);
});

test('coverage：报告格式非法报告 COVERAGE002', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-broken'),
    config: coverageConfig({ rustRequired: false }),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  assert.deepEqual(violationCodes(report), ['COVERAGE002']);
});

test('coverage：空报告报告 COVERAGE020 与必需组 COVERAGE011', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-empty'),
    config: coverageConfig({ rustRequired: false }),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  assert.ok(codes.includes('COVERAGE020'));
  assert.ok(codes.includes('COVERAGE011'));
});

test('coverage：Rust 核心面按 chips-* crate 路径聚合，与总体分别判定', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-rust-surface'),
    config: coverageConfig({ rustSurface: true }),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  // 总体 114/120 = 95.00% 达标；核心面 14/20 = 70.00% 不达标（chips-native 并入核心面）
  assert.ok(report.summary.groups.includes('rust-overall=pass'));
  assert.ok(report.summary.groups.includes('rust-core=fail'));
  assert.ok(
    report.violations.some(
      (item) =>
        item.code === 'COVERAGE010' && item.message.includes('rust-core 覆盖率 lines 70.00%')
    ),
    `实际违规：${JSON.stringify(report.violations.map((item) => item.message))}`
  );
  assert.ok(
    !report.violations.some(
      (item) => item.code === 'COVERAGE010' && item.message.startsWith('rust-overall')
    )
  );
});

test('coverage：Rust 核心面达标时不产生违规', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-rust-good'),
    config: coverageConfig({ rustSurface: true }),
    flags: noFlags,
  });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.ok(report.summary.groups.includes('rust-overall=pass'));
  assert.ok(report.summary.groups.includes('rust-core=pass'));
});

test('coverage：核心面路径前缀内无行条目时报 COVERAGE011 而非放行', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-rust-no-core'),
    config: coverageConfig({ rustSurface: true }),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const missing = report.violations.filter((item) => item.code === 'COVERAGE011');
  assert.equal(missing.length, 1);
  assert.ok(missing[0].message.includes('rust-core'));
  assert.ok(report.summary.groups.includes('rust-overall=pass'));
});
