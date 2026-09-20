import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCheck } from '../check-boundaries.mjs';
import {
  boundariesConfig,
  fixture,
  gatesDir,
  noFlags,
  scaffoldBoundariesConfig,
  violationCodes,
} from './helpers.mjs';

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

test('boundaries：packages/sdk → @chips/scaffold 薄转发有向边放行（02-SDK-API规范 §8.2 规则 9）', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-scaffold'),
    config: scaffoldBoundariesConfig(),
    flags: noFlags,
  });
  const sdkViolations = report.violations.filter(
    (item) => item.file === undefined || !item.file.startsWith('packages/ui')
  );
  assert.deepEqual(
    sdkViolations,
    [],
    `sdk / scaffold 两侧的 workspace:* 依赖与运行时 import 不应报任何违规：${JSON.stringify(
      sdkViolations
    )}`
  );
});

test('boundaries：放行面仅限 sdk→scaffold，其他包指向 @chips/scaffold 的边仍拒', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-scaffold'),
    config: scaffoldBoundariesConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  assert.ok(codes.includes('BOUNDARY010'), 'packages/ui 依赖 @chips/scaffold 应报 BOUNDARY010');
  assert.ok(codes.includes('BOUNDARY020'), 'packages/ui 源码导入 @chips/scaffold 应报 BOUNDARY020');
  for (const item of report.violations) {
    assert.ok(
      item.file !== undefined && item.file.startsWith('packages/ui'),
      `违规应全部来自未放行的 packages/ui：${JSON.stringify(item)}`
    );
  }
});

test('boundaries：生产配置 gates.config.json 的 sdk 规则已登记 @chips/scaffold 放行边', () => {
  const config = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gates.config.json'), 'utf8'));
  const rules = config.boundaries.rules;
  const sdkRule = rules.find((rule) => rule.id === 'packages/sdk');
  assert.ok(sdkRule, '缺少 packages/sdk 规则');
  assert.ok(
    sdkRule.allowedInternal.includes('@chips/scaffold'),
    'packages/sdk allowedInternal 应包含 @chips/scaffold（§8.2 规则 9 薄转发边）'
  );
  assert.ok(
    !sdkRule.typeOnlyInternal.includes('@chips/scaffold'),
    '转发入口是运行时 import，@chips/scaffold 不应被限为 import type'
  );
  const otherScaffoldRules = rules.filter(
    (rule) => rule.id !== 'packages/sdk' && (rule.allowedInternal ?? []).includes('@chips/scaffold')
  );
  assert.deepEqual(otherScaffoldRules, [], '@chips/scaffold 放行边应唯一归属 packages/sdk 规则');
});
