import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runCheck, parseYamlSubset, cleanlinessViolations } from '../check-generated-project.mjs';
import { UsageError } from '../lib/cli.mjs';
import { fixture, gatesDir, noFlags, violationCodes } from './helpers.mjs';

const workspaceRoot = path.resolve(gatesDir, '..', '..');

test('generated-project：真实工作区四角色生成链全量通过', async () => {
  const report = await runCheck({ workspaceRoot, config: {}, flags: noFlags });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.violations, []);
  assert.equal(report.summary.roles, 4);
  assert.equal(report.summary.e2e, 'skipped');
  assert.equal(report.summary.parser, 'yaml');
  assert.ok(report.summary.files >= 40);
  assert.ok(report.summary.tsChecked >= 20);
});

test('generated-project：脏生成物夹具命中 GP020/021/022/030/031/033', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('generated-project-dirty'),
    config: {},
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  assert.deepEqual(violationCodes(report), ['GP020', 'GP021', 'GP022', 'GP030', 'GP031', 'GP033']);
  // 脏夹具被四个角色各复用一次：每角色 8 条违规（src 语法错产生 2 条 parse 诊断）。
  assert.equal(report.violations.length, 32);
});

test('generated-project：缺文件夹具命中 GP040（核心文件缺失 + 空正文）', async () => {
  const report = await runCheck({
    workspaceRoot: fixture('generated-project-missing'),
    config: {},
    flags: noFlags,
  });
  assert.equal(report.status, 'fail');
  assert.deepEqual(violationCodes(report), ['GP040']);
  assert.equal(report.violations.length, 8);
  assert.ok(
    report.violations.some((item) => item.message.includes('manifest.yaml')),
    'manifest.yaml 缺失必须留痕'
  );
  assert.ok(
    report.violations.some((item) => item.message.includes('内容为空')),
    '空正文文件必须留痕'
  );
});

test('generated-project：脚手架目录缺失报 UsageError（fail-closed）', async () => {
  await assert.rejects(
    () =>
      runCheck({
        workspaceRoot: fixture('generated-project-no-scaffold'),
        config: {},
        flags: noFlags,
      }),
    (error) => error instanceof UsageError && /脚手架目录不存在/.test(error.message)
  );
});

test('generated-project：内置 YAML 子集解析器覆盖发射器文法', () => {
  const text = [
    'id: chips.basecard.gatecheck',
    'version: 0.1.0',
    'name: "带引号: 与 \\"转义\\""',
    'debug: true',
    'empty: null',
    'ratio: 1.5',
    'tags:',
    '  - alpha',
    '  - beta',
    'emptyList: []',
    'emptyMap: {}',
    'runtime:',
    '  targets:',
    '    - host',
    'cardTypes:',
    '  - id: card.markdown',
    '    schemaVersion: ">=1.0.0 <2.0.0"',
    '  - id: card.other',
    '',
  ].join('\n');
  const parsed = parseYamlSubset(text);
  assert.equal(parsed.id, 'chips.basecard.gatecheck');
  assert.equal(parsed.version, '0.1.0');
  assert.equal(parsed.name, '带引号: 与 "转义"');
  assert.equal(parsed.debug, true);
  assert.equal(parsed.empty, null);
  assert.equal(parsed.ratio, 1.5);
  assert.deepEqual(parsed.tags, ['alpha', 'beta']);
  assert.deepEqual(parsed.emptyList, []);
  assert.deepEqual(parsed.emptyMap, {});
  assert.deepEqual(parsed.runtime, { targets: ['host'] });
  assert.deepEqual(parsed.cardTypes, [
    { id: 'card.markdown', schemaVersion: '>=1.0.0 <2.0.0' },
    { id: 'card.other' },
  ]);
});

test('generated-project：清洁度断言逐判据命中', () => {
  const found = cleanlinessViolations({
    projectLabel: 'gen/demo',
    sandboxRoot: '/tmp/sandbox-x',
    files: [
      {
        path: 'README.md',
        content:
          '标识：{{PLUGIN_ID}}\nTODO 未收口\n旧身份 app-standard 泄露\n沙箱：/tmp/sandbox-x/gen\n',
      },
      {
        path: 'src/main.ts',
        content: "import x from '/Users/dev/outside';\nexport const ok = x;\n",
      },
      { path: 'src/clean.ts', content: "import { y } from './y';\nexport const z = y;\n" },
    ],
  });
  const codes = [...new Set(found.map((item) => item.code))].sort();
  assert.deepEqual(codes, ['GP030', 'GP031', 'GP032', 'GP033']);
  assert.equal(found.filter((item) => item.code === 'GP030').length, 1);
  assert.equal(found.filter((item) => item.code === 'GP031').length, 1);
  assert.equal(found.filter((item) => item.code === 'GP032').length, 2);
  assert.equal(found.filter((item) => item.code === 'GP033').length, 1);
});
