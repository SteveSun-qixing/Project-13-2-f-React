import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../check-docs.mjs';
import { docsConfig, fixture, noFlags, violationCodes, warningCodes } from './helpers.mjs';

test('docs：合格夹具零违规零告警', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('docs-good'),
    config: docsConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.summary.pieces, 2);
  assert.equal(report.summary.duplicates, 0);
  assert.equal(report.summary.formalDocs, 1);
});

test('docs：缺陷夹具覆盖 DOCS001-DOCS030 与 DOCS090', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('docs-bad'),
    config: docsConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  const expected = [
    'DOCS001',
    'DOCS002',
    'DOCS010',
    'DOCS011',
    'DOCS012',
    'DOCS013',
    'DOCS014',
    'DOCS015',
    'DOCS020',
    'DOCS021',
    'DOCS022',
    'DOCS023',
    'DOCS024',
    'DOCS030',
  ];
  for (const code of expected) {
    assert.ok(codes.includes(code), `缺少违规代码 ${code}`);
  }
  assert.deepEqual(warningCodes(report), ['DOCS090']);
});

test('docs：文档库根目录缺失时抛出用法错误', async () => {
  await assert.rejects(
    runCheck({
      workspaceRoot: fixture('docs-good'),
      config: { docs: { root: 'missing', index: 'README.md' } },
      flags: noFlags,
    }),
    /文档库根目录不存在/
  );
});
