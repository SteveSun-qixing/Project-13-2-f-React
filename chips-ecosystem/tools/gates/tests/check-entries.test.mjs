import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../check-entries.mjs';
import { UsageError } from '../lib/cli.mjs';
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

// 工单 021 收口：角色感知判定（事实源 manifest.yaml 顶层 type；判定表见 lib/plugin-entries.mjs）。

test('entries：service 角色无 render.js 判绿（角色正例）', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-service-good') });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.role, 'service');
  assert.equal(report.summary.renderRequirement, 'forbidden');
  assert.equal(report.summary.mainSpecifiers, 0);
  assert.equal(report.summary.renderSpecifiers, null);
});

test('entries：service 角色携带 render.js 报告 ENTRY004（与 CLI validate 互斥面归零）', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-service-render') });
  assert.equal(report.status, 'fail');
  assert.deepEqual(violationCodes(report), ['ENTRY004']);
});

test('entries：app 角色缺 render.js 仍报 ENTRY001（渲染入口必需反例）', async () => {
  const report = await runCheck({ pluginDir: fixture('entries-app-no-render') });
  assert.equal(report.status, 'fail');
  assert.deepEqual(violationCodes(report), ['ENTRY001']);
  assert.equal(report.violations.length, 1);
  assert.match(report.violations[0].message, /render\.js/);
  assert.equal(report.summary.role, 'app');
});

test('entries：未知角色报错（无法判定入口集合，fail-closed）', async () => {
  await assert.rejects(
    () => runCheck({ pluginDir: fixture('entries-unknown-role') }),
    (error) =>
      error instanceof UsageError &&
      /未知插件角色/.test(error.message) &&
      /widget/.test(error.message)
  );
});

test('entries：缺少 manifest.yaml 报错（角色不可猜测，fail-closed）', async () => {
  await assert.rejects(
    () => runCheck({ pluginDir: fixture('entries-no-manifest') }),
    (error) => error instanceof UsageError && /manifest\.yaml/.test(error.message)
  );
});
