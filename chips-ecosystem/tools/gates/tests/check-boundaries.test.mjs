import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCheck } from '../check-boundaries.mjs';
import {
  boundariesConfig,
  bridgeEdgeBoundariesConfig,
  fixture,
  gatesDir,
  noFlags,
  scaffoldBoundariesConfig,
  selfRefBoundariesConfig,
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
    !(sdkRule.typeOnlyInternal ?? []).includes('@chips/scaffold'),
    '转发入口是运行时 import，@chips/scaffold 不应被限为 import type'
  );
  const otherScaffoldRules = rules.filter(
    (rule) => rule.id !== 'packages/sdk' && (rule.allowedInternal ?? []).includes('@chips/scaffold')
  );
  assert.deepEqual(otherScaffoldRules, [], '@chips/scaffold 放行边应唯一归属 packages/sdk 规则');
});

// —— 以下为波 3 边界越界修复（tools/testing 自引用豁免 + 归档排除发现面）三向用例 ——

test('boundaries：自引用豁免——exports 登记子路径放行、未登记子路径维持 BOUNDARY021', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-selfref'),
    config: selfRefBoundariesConfig(),
    flags: noFlags,
  });
  const undeclared = report.violations.filter((item) => item.code === 'BOUNDARY021');
  assert.equal(undeclared.length, 1, `仅未登记子路径应报 BOUNDARY021：${JSON.stringify(report.violations)}`);
  assert.ok(undeclared[0].message.includes('@chips/self/ghost'), '未登记子路径应被点名');
  assert.ok(undeclared[0].file.endsWith('packages/self/src/index.ts'));
  // 登记子路径 `@chips/self/sub` 零违规（连同归档排除后全包无其他违规码）。
  assert.deepEqual(
    report.violations.filter((item) => item.code !== 'BOUNDARY021'),
    [],
    '豁免开启后不应产生其他违规'
  );
});

test('boundaries：自引用豁免缺省关闭（fail-closed）——未配置时登记子路径仍报 BOUNDARY021', async () => {
  const config = selfRefBoundariesConfig();
  delete config.boundaries.selfReferenceViaExports;
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-selfref'),
    config,
    flags: noFlags,
  });
  const undeclared = report.violations.filter((item) => item.code === 'BOUNDARY021');
  assert.equal(undeclared.length, 2, '两条自引用导入均应维持未声明内部依赖判定');
});

test('boundaries：workspaceSkipDirs 排除归档发现面；无配置对照面维持 BOUNDARY001', async () => {
  const skipped = await runCheck({
    workspaceRoot: fixture('boundaries-selfref'),
    config: selfRefBoundariesConfig({ skipArchive: true }),
    flags: noFlags,
  });
  assert.ok(
    !violationCodes(skipped).includes('BOUNDARY001'),
    `配置排除后归档不得进入包发现：${JSON.stringify(skipped.violations)}`
  );
  const unskipped = await runCheck({
    workspaceRoot: fixture('boundaries-selfref'),
    config: selfRefBoundariesConfig({ skipArchive: false }),
    flags: noFlags,
  });
  const archive = unskipped.violations.filter((item) => item.code === 'BOUNDARY001');
  assert.equal(archive.length, 1, '未配置排除时归档残留应如实报 BOUNDARY001（对照面）');
  assert.ok(archive[0].file.startsWith('归档/'), `违规应定位归档目录：${archive[0].file}`);
});

test('boundaries：生产配置 gates.config.json 已登记波 3 两项修复键（防漂移锚点）', () => {
  // 出处：工单 030（ESM 严格解析自引用边）与波 3 越界定性（task88 归档残留）。
  const config = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gates.config.json'), 'utf8'));
  assert.deepEqual(
    config.boundaries.workspaceSkipDirs,
    ['归档'],
    'boundaries.workspaceSkipDirs 应恰为 ["归档"]（归档不参与包发现）'
  );
  assert.equal(
    config.boundaries.selfReferenceViaExports,
    true,
    'boundaries.selfReferenceViaExports 应为 true（exports 面自引用豁免）'
  );
});

// —— 以下为工单024《RFC-ChipsError统一裁定》§3.3 条 2 波 B amendment 三向用例 ——

test('boundaries：packages/sdk 运行时 import @chips/bridge 错误模型边放行（RFC-ChipsError统一裁定 §3.3 条 2）', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-bridge-edge'),
    config: bridgeEdgeBoundariesConfig(),
    flags: noFlags,
  });
  const sdkViolations = report.violations.filter(
    (item) => item.file === undefined || !item.file.startsWith('packages/ui')
  );
  assert.deepEqual(
    sdkViolations,
    [],
    `sdk / bridge 两侧的 workspace:* 依赖与运行时 import 不应报任何违规（含 BOUNDARY022 type-only 限制已解除）：${JSON.stringify(
      sdkViolations
    )}`
  );
});

test('boundaries：放行面仅限 sdk→bridge，其他未放行 runtime 边仍拒', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('boundaries-bridge-edge'),
    config: bridgeEdgeBoundariesConfig(),
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  const codes = violationCodes(report);
  assert.ok(codes.includes('BOUNDARY010'), 'packages/ui 依赖 @chips/bridge 应报 BOUNDARY010');
  assert.ok(
    codes.includes('BOUNDARY020'),
    'packages/ui 源码运行时导入 @chips/bridge 应报 BOUNDARY020'
  );
  for (const item of report.violations) {
    assert.ok(
      item.file !== undefined && item.file.startsWith('packages/ui'),
      `违规应全部来自未放行的 packages/ui：${JSON.stringify(item)}`
    );
  }
});

test('boundaries：生产配置 gates.config.json 的 sdk 规则已按裁定解除 @chips/bridge type-only 限制（防漂移锚点）', () => {
  // 出处：项目日志与笔记/RFC-ChipsError统一裁定/RFC-ChipsError统一裁定.md §3.3 条 2、§八波 B 行。
  const config = JSON.parse(fs.readFileSync(path.join(gatesDir, 'gates.config.json'), 'utf8'));
  const rules = config.boundaries.rules;
  const sdkRule = rules.find((rule) => rule.id === 'packages/sdk');
  assert.ok(sdkRule, '缺少 packages/sdk 规则');
  assert.ok(
    sdkRule.allowedInternal.includes('@chips/bridge'),
    'packages/sdk allowedInternal 应维持含 @chips/bridge（裁定只解除 type-only 形态限制，不新增包图边）'
  );
  assert.ok(
    !(sdkRule.typeOnlyInternal ?? []).includes('@chips/bridge'),
    'RFC-ChipsError统一裁定 §3.3 条 2：packages/sdk typeOnlyInternal 应已移除 @chips/bridge（运行时边放行）'
  );
  const otherTypeOnlyBridge = rules.filter(
    (rule) => rule.id !== 'packages/sdk' && (rule.typeOnlyInternal ?? []).includes('@chips/bridge')
  );
  assert.deepEqual(
    otherTypeOnlyBridge,
    [],
    '@chips/bridge 的 type-only 表项应仅随 packages/sdk 规则在册或被全部移除，不得漂移到其他规则'
  );
});
