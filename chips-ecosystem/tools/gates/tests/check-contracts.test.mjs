import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../check-contracts.mjs';
import { contractsConfig, fixture, noFlags, violationCodes } from './helpers.mjs';

test('contracts：合格夹具通过并统计三类 ID', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('contracts-good'),
    config: contractsConfig('generated'),
    flags: noFlags,
  });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.docsCapabilities, 4);
  assert.equal(report.summary.docsPermissions, 3);
  assert.equal(report.summary.docsEvents, 2);
  // 夹具含《能力契约规范》§3.1 登记的 camelCase 动作段 `window:setTitle`，
  // 属合法形态：门禁不得对其产生任何警告（工单 003 收口第 1 条）。
  assert.deepEqual(report.warnings, []);
});

test('contracts：缺陷夹具覆盖 010/011/012/013/020/021/030/031/040/041/042/043', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('contracts-bad'),
    config: contractsConfig('generated'),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  for (const code of [
    'CONTRACT010',
    'CONTRACT011',
    'CONTRACT012',
    'CONTRACT013',
    'CONTRACT020',
    'CONTRACT021',
    'CONTRACT030',
    'CONTRACT031',
    'CONTRACT040',
    'CONTRACT041',
    'CONTRACT042',
    'CONTRACT043',
  ]) {
    assert.ok(codes.includes(code), `缺少违规代码 ${code}`);
  }
});

test('contracts：生成物目录缺失报告 CONTRACT001', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('contracts-good'),
    config: contractsConfig('generated-missing'),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  assert.deepEqual(violationCodes(report), ['CONTRACT001']);
  assert.equal(report.summary.generated, 'missing');
});

test('contracts：生成物结构非法报告 CONTRACT002', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('contracts-good'),
    config: contractsConfig('generated-broken'),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  assert.ok(codes.includes('CONTRACT002'));
  assert.ok(codes.includes('CONTRACT001'));
});
