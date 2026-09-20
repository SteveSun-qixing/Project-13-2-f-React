import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runCheck } from '../check-coverage.mjs';
import { loadGateExemptions } from '../lib/exemption.mjs';
import {
  coverageConfig,
  fixture,
  gatesDir,
  noFlags,
  violationCodes,
  warningCodes,
} from './helpers.mjs';

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

// —— 豁免消费挂点（§6.3 / 工单 017）三态：命中留痕放行 / 过期维持失败 / 要素缺失维持失败。

const exemptConfig = (registry) =>
  coverageConfig({ rustSurface: true, exemption: { gateId: 'G6', registry } });

const runExempt = (registry) =>
  runCheck({
    workspaceRoot: fixture('coverage-exempt'),
    config: exemptConfig(registry),
    flags: noFlags,
  });

test('coverage：命中有效豁免时 rust-core 转 COVERAGE030 留痕放行，数字照常呈现', async () => {
  const report = await runExempt('debt-active.md');
  assert.equal(report.status, 'pass');
  assert.deepEqual(
    report.violations.filter((item) => item.code === 'COVERAGE010'),
    []
  );
  const trace = report.warnings.filter((item) => item.code === 'COVERAGE030');
  assert.equal(trace.length, 1);
  assert.ok(trace[0].message.includes('TD-TEST'));
  assert.ok(trace[0].message.includes('70.00%'));
  assert.ok(report.summary.groups.includes('rust-core=pass(TD-TEST)'));
  const core = report.summary.coverage.find((group) => group.id === 'rust-core');
  assert.equal(core.pass, true);
  assert.deepEqual(core.exempted, ['TD-TEST']);
  // 数字照常呈现：留痕不改测量。
  assert.equal(core.metrics.lines.pct, 70);
  assert.equal(core.metrics.lines.covered, 14);
  assert.equal(core.metrics.lines.total, 20);
});

test('coverage：豁免过期时维持 COVERAGE010 失败并留 COVERAGE031 痕', async () => {
  const report = await runExempt('debt-expired.md');
  assert.equal(report.status, 'fail');
  assert.ok(violationCodes(report).includes('COVERAGE010'));
  assert.ok(
    report.warnings.some((item) => item.code === 'COVERAGE031' && item.message.includes('期限已过'))
  );
  assert.ok(report.summary.groups.includes('rust-core=fail'));
});

test('coverage：豁免要素缺失时不构成豁免，判定维持失败', async () => {
  const report = await runExempt('debt-missing-elements.md');
  assert.equal(report.status, 'fail');
  assert.ok(violationCodes(report).includes('COVERAGE010'));
  assert.ok(
    report.warnings.some((item) => item.code === 'COVERAGE031' && item.message.includes('要素缺失'))
  );
});

test('coverage：豁免状态非 active（已清偿）时维持失败', async () => {
  const report = await runExempt('debt-repaid.md');
  assert.equal(report.status, 'fail');
  assert.ok(violationCodes(report).includes('COVERAGE010'));
  assert.ok(
    report.warnings.some(
      (item) => item.code === 'COVERAGE031' && item.message.includes('非 active')
    )
  );
});

test('coverage：登记文件无机读块时按无豁免处理并留痕', async () => {
  const report = await runExempt('debt-noblock.md');
  assert.equal(report.status, 'fail');
  assert.ok(violationCodes(report).includes('COVERAGE010'));
  assert.ok(warningCodes(report).includes('COVERAGE031'));
  assert.ok(report.warnings.some((item) => item.message.includes('GATE-EXEMPTIONS')));
});

test('coverage：未配置 exemption 时行为与合并前一致（既有用例即证据，此处验证挂点缺省）', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('coverage-rust-surface'),
    config: coverageConfig({ rustSurface: true }),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  assert.deepEqual(warningCodes(report), []);
});

test('coverage：真实《技术债务清单》机读块可解析且 TD-001 为有效 active 登记（含 scope 机读字段）', () => {
  const workspaceRoot = path.resolve(gatesDir, '..', '..');
  const ctx = loadGateExemptions({
    workspaceRoot,
    registryPath: '../项目日志与笔记/技术债务清单.md',
    gateId: 'G6',
  });
  assert.deepEqual(ctx.notices, []);
  const td001 = ctx.valid.find((item) => item.id === 'TD-001');
  assert.ok(td001, `有效登记：${JSON.stringify(ctx.valid.map((item) => item.id))}`);
  assert.equal(td001.group, 'rust-core');
  assert.equal(td001.metric, 'lines');
  assert.equal(td001.status, 'active');
  // 工单 027：scope 承诺必须机读化，TD-001 只绑定 chips-native。
  assert.deepEqual(td001.scopePaths, ['packages/native/']);
});

// —— 工单 027：匹配粒度收紧到 scope 级（成因绑定归因）。
// 夹具 coverage-exempt-piggyback 复刻工单推演口径：健康存量 chips-core 100/100、
// TD-001 成因 native 4/10、零测试新成员 chips-newcrate 0/10、核心面外 other-rust 100/100；
// rust-core 聚合 104/120 = 86.67% < 90%（组失败），rust-overall 204/220 = 92.73% > 80%。

const piggybackConfig = (registry) =>
  coverageConfig({
    rustSurface: true,
    exemption: registry === null ? null : { gateId: 'G6', registry },
  });

const runPiggyback = (registry) =>
  runCheck({
    workspaceRoot: fixture('coverage-exempt-piggyback'),
    config: piggybackConfig(registry),
    flags: noFlags,
  });

test('coverage（工单027 状态①）：无豁免配置时 piggyback 组聚合失败即红', async () => {
  const report = await runPiggyback(null);
  assert.equal(report.status, 'fail');
  assert.ok(
    report.violations.some(
      (item) =>
        item.code === 'COVERAGE010' && item.message.includes('rust-core 覆盖率 lines 86.67%')
    ),
    `实际违规：${JSON.stringify(report.violations.map((item) => item.message))}`
  );
  assert.deepEqual(warningCodes(report), []);
  assert.ok(report.summary.groups.includes('rust-core=fail'));
});

test('coverage（工单027 状态②）：未登记新成员搭组时组级豁免不放行，维持红', async () => {
  const report = await runPiggyback('debt-scoped-native.md');
  assert.equal(report.status, 'fail');
  assert.ok(
    report.violations.some(
      (item) =>
        item.code === 'COVERAGE010' && item.message.includes('rust-core 覆盖率 lines 86.67%')
    )
  );
  const traces = report.warnings.filter((item) => item.code === 'COVERAGE031');
  assert.equal(traces.length, 1);
  assert.ok(traces[0].message.includes('TD-TEST'));
  assert.ok(traces[0].message.includes('packages/core-rust/crates/chips-newcrate'));
  assert.ok(traces[0].message.includes('不成立'));
  assert.ok(!report.warnings.some((item) => item.code === 'COVERAGE030'));
  assert.ok(report.summary.groups.includes('rust-core=fail'));
});

test('coverage（工单027 状态③）：全部未达标成员均有 scope 登记时转 COVERAGE030 留痕放行', async () => {
  const report = await runPiggyback('debt-scoped-both.md');
  assert.equal(report.status, 'pass');
  assert.deepEqual(
    report.violations.filter((item) => item.code === 'COVERAGE010'),
    []
  );
  const trace = report.warnings.filter((item) => item.code === 'COVERAGE030');
  assert.equal(trace.length, 1);
  assert.ok(trace[0].message.includes('TD-TEST'));
  assert.ok(trace[0].message.includes('TD-TEST2'));
  assert.ok(trace[0].message.includes('86.67%'));
  assert.ok(report.summary.groups.includes('rust-core=pass(TD-TEST+TD-TEST2)'));
  const core = report.summary.coverage.find((group) => group.id === 'rust-core');
  assert.equal(core.pass, true);
  assert.deepEqual(core.exempted, ['TD-TEST', 'TD-TEST2']);
  // 数字照常呈现：留痕不改测量。
  assert.equal(core.metrics.lines.pct, 86.67);
  assert.equal(core.metrics.lines.covered, 104);
  assert.equal(core.metrics.lines.total, 120);
});

test('coverage（工单027）：登记缺 scopePaths（v1 旧形态）按要素缺失维持失败', async () => {
  const report = await runExempt('debt-noscope.md');
  assert.equal(report.status, 'fail');
  assert.ok(violationCodes(report).includes('COVERAGE010'));
  assert.ok(
    report.warnings.some(
      (item) => item.code === 'COVERAGE031' && item.message.includes('scopePaths')
    )
  );
});
