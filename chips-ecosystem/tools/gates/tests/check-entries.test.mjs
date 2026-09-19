import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../check-entries.mjs';
import { fixture, violationCodes } from './helpers.mjs';

test('entries：自包含主入口与 vendor 白名单渲染入口通过', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-good') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.mainSpecifiers, 0);
  assert.equal(report.summary.renderSpecifiers, 2);
});

test('entries：非法模块引用报告 ENTRY010', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-bad') });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  assert.ok(codes.includes('ENTRY010'));
  assert.equal(report.violations.filter((item) => item.code === 'ENTRY010').length, 3);
});

test('entries：入口缺失报告 ENTRY001', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-missing') });
  assert.equal(report.status, 'fail');
  assert.deepEqual(violationCodes(report), ['ENTRY001']);
  assert.equal(report.violations.length, 2);
});

test('entries：非 UTF-8 入口报告 ENTRY003', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-binary') });
  assert.equal(report.status, 'fail');
  assert.ok(violationCodes(report).includes('ENTRY003'));
});

test('entries：超过上限报告 ENTRY002', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-good'), maxBytes: 10 });
  assert.equal(report.status, 'fail');
  assert.equal(report.violations.filter((item) => item.code === 'ENTRY002').length, 2);
});
