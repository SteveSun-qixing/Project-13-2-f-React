import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../check-boundaries.mjs';
import { boundariesConfig, fixture, noFlags, violationCodes } from './helpers.mjs';

test('boundaries：合格夹具通过包依赖与 Rust 依赖检查', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-good'),
    config: boundariesConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.packages, 3);
  assert.equal(report.summary.crates, 2);
});

test('boundaries：缺陷夹具覆盖 BOUNDARY001-042', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-bad'),
    config: boundariesConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  for (const code of [
    'BOUNDARY001',
    'BOUNDARY010',
    'BOUNDARY011',
    'BOUNDARY012',
    'BOUNDARY020',
    'BOUNDARY021',
    'BOUNDARY022',
    'BOUNDARY030',
    'BOUNDARY040',
    'BOUNDARY041',
    'BOUNDARY042',
  ]) {
    assert.ok(codes.includes(code), `缺少违规代码 ${code}`);
  }
});
