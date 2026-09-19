import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixture, gatesDir } from './helpers.mjs';

function run(script, args) {
  return spawnSync(process.execPath, [path.join(gatesDir, script), ...args], { encoding: 'utf8' });
}

const docsGood = [
  '--workspace-root',
  fixture('docs-good'),
  '--config',
  fixture('docs-good/gates.config.json'),
];
const docsBad = [
  '--workspace-root',
  fixture('docs-bad'),
  '--config',
  fixture('docs-bad/gates.config.json'),
];

test('CLI：--help 退出码 0', () => {
  assert.equal(run('check-docs.mjs', ['--help']).status, 0);
  assert.equal(run('gates-all.mjs', ['--help']).status, 0);
  assert.equal(run('check-entries.mjs', ['--help']).status, 0);
});

test('CLI：合格夹具退出码 0', () => {
  const result = run('check-docs.mjs', [...docsGood, '--no-report']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('CLI：缺陷夹具退出码 1', () => {
  const result = run('check-docs.mjs', [...docsBad, '--no-report']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test('CLI：配置缺失退出码 2', () => {
  const result = run('check-docs.mjs', ['--config', fixture('no-such-config.json'), '--no-report']);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /配置或用法错误|不存在或不可读/);
});

test('CLI：报告写入失败退出码 3', () => {
  const result = run('check-docs.mjs', [...docsGood, '--report-dir', 'blocked']);
  assert.equal(result.status, 3, result.stdout + result.stderr);
  assert.match(result.stderr, /报告写入失败/);
});

test('CLI：--json 输出可解析的 JSON 报告', () => {
  const result = run('check-docs.mjs', [...docsGood, '--no-report', '--json']);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.gate, 'docs');
  assert.equal(report.status, 'pass');
});

test('CLI：gates-all 聚合退出码与 --only 校验', () => {
  const failed = run('gates-all.mjs', [...docsBad, '--only', 'docs', '--no-report']);
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  const unknown = run('gates-all.mjs', ['--only', 'bogus', '--no-report']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /未知门禁/);
});

test('CLI：check-entries 通过 / 失败退出码', () => {
  const good = run('check-entries.mjs', [fixture('entries-good'), '--no-report']);
  assert.equal(good.status, 0, good.stdout + good.stderr);
  const bad = run('check-entries.mjs', [fixture('entries-bad'), '--no-report']);
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
});

test('CLI：--no-report 不产生报告目录', () => {
  const result = run('check-entries.mjs', [fixture('entries-good'), '--no-report']);
  assert.equal(result.status, 0);
  const fs = spawnSync(process.execPath, [
    '-e',
    `process.exit(require('node:fs').existsSync(process.argv[1]) ? 1 : 0)`,
    path.join(fixture('entries-good'), 'reports'),
  ]);
  assert.equal(fs.status, 0);
});
