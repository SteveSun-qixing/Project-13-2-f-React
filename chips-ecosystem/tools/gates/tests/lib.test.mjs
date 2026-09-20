import test from 'node:test';
import assert from 'node:assert/strict';
import { flagValue, parseArgv } from '../lib/cli.mjs';
import {
  CAPABILITY_ID,
  EVENT_ID,
  PERMISSION_BASE_ID,
  duplicates,
  parseTsConstArray,
  parseTsPermissionMapping,
  sameStringSet,
} from '../lib/ids.mjs';
import {
  bodyAfterMetadata,
  extractLinks,
  firstParagraph,
  stripDocumentFooter,
} from '../lib/markdown.mjs';
import { classify, matchGlob } from '../lib/walk.mjs';
import { extractManifestType } from '../lib/plugin-entries.mjs';

test('parseArgv：长选项、等号、否定与位置参数', () => {
  const { flags, positionals } = parseArgv([
    'plugins/hello',
    '--json',
    '--workspace-root=/tmp',
    '--no-report',
    '--only',
    'docs,contracts',
  ]);
  assert.deepEqual(positionals, ['plugins/hello']);
  assert.equal(flags.get('json'), true);
  assert.equal(flags.get('workspace-root'), '/tmp');
  assert.equal(flags.get('report'), false);
  assert.equal(flags.get('only'), 'docs,contracts');
  assert.equal(flagValue(flags, 'missing', 'fallback'), 'fallback');
});

test('ID 文法与 contract-gen 生成物一致', () => {
  assert.ok(CAPABILITY_ID.test('file:read'));
  assert.ok(CAPABILITY_ID.test('window:setTitle'));
  assert.ok(!CAPABILITY_ID.test('file:read:extra:target'));
  assert.ok(PERMISSION_BASE_ID.test('filesystem:read'));
  assert.ok(!PERMISSION_BASE_ID.test('filesystem:read:extra'));
  assert.ok(EVENT_ID.test('plugin:installed'));
  assert.ok(!EVENT_ID.test('plugin.installed'));
});

test('duplicates 与 sameStringSet', () => {
  assert.deepEqual(duplicates(['a', 'b', 'a', 'c', 'b']), ['a', 'b']);
  assert.ok(sameStringSet(['a', 'b'], ['b', 'a']));
  assert.ok(!sameStringSet(['a'], ['a', 'b']));
});

test('parseTsConstArray：提取生成物数组', () => {
  const source = [
    'export const Capability = { FILE_READ: "file:read" } as const;',
    'export const CAPABILITY_IDS = [',
    "  'file:read',",
    "  'window:setTitle',",
    '] as const satisfies readonly CapabilityId[];',
  ].join('\n');
  assert.deepEqual(parseTsConstArray(source, 'CAPABILITY_IDS'), ['file:read', 'window:setTitle']);
  assert.equal(parseTsConstArray(source, 'MISSING_IDS'), null);
});

test('parseTsPermissionMapping：提取能力 → 权限映射', () => {
  const source = [
    'export const CAPABILITY_PERMISSIONS: Readonly<Record<CapabilityId, readonly PermissionId[]>> = {',
    "  'file:read': ['filesystem:read'],",
    "  'file:copy': ['filesystem:read', 'filesystem:write'],",
    "  'cli:task-get': [],",
    '};',
  ].join('\n');
  const mapping = parseTsPermissionMapping(source);
  assert.deepEqual([...mapping.keys()], ['file:read', 'file:copy', 'cli:task-get']);
  assert.deepEqual(mapping.get('file:copy'), ['filesystem:read', 'filesystem:write']);
  assert.deepEqual(mapping.get('cli:task-get'), []);
  assert.equal(parseTsPermissionMapping('export const OTHER = {};'), null);
});

test('markdown：行号、首段与文档尾', () => {
  const text = [
    '第 1 行',
    '第 2 行',
    '[坏链](./missing.md) 与 `代码块链接 [x](./no.md)`',
    '```',
    '[fence](./no.md)',
    '```',
  ].join('\n');
  const links = extractLinks(text);
  assert.deepEqual(
    links.map((link) => link.target),
    ['./missing.md']
  );
  assert.equal(links[0].line, 3);
  assert.equal(extractLinks(text, { raw: true }).length, 3);

  const withFooter =
    '> 元数据\n\n---\n\n## 一、节\n\n正文第一行。\n正文第二行。\n\n---\n\n**文档结束**';
  assert.ok(!stripDocumentFooter(withFooter).includes('文档结束'));
  assert.equal(bodyAfterMetadata(withFooter), '## 一、节\n\n正文第一行。\n正文第二行。');
  assert.equal(
    firstParagraph('## 一、节\n\n短\n\n这是达到最小长度的第一个实质段落内容。'),
    '这是达到最小长度的第一个实质段落内容。'
  );
});

test('walk：glob 与规则分类', () => {
  assert.ok(matchGlob('plugins/*/*', 'plugins/apps/editor'));
  assert.ok(!matchGlob('plugins/*/*', 'plugins/apps'));
  assert.ok(matchGlob('packages/host*', 'packages/host'));
  const rules = [
    { id: 'a', match: 'packages/a' },
    { id: 'plugins', match: 'plugins/*/*' },
  ];
  assert.equal(classify('packages/a', rules).id, 'a');
  assert.equal(classify('plugins/apps/editor', rules).id, 'plugins');
  assert.equal(classify('unknown/dir', rules), null);
  assert.equal(classify('packages/a/src/x.ts', rules), null);
});

test('extractManifestType：顶层 type 提取、引号剥离与嵌套键不误匹配（工单 021）', () => {
  assert.equal(extractManifestType('id: chips.app.demo\ntype: app\nname: 示例\n'), 'app');
  assert.equal(extractManifestType('type: "service"\n'), 'service');
  assert.equal(extractManifestType("type: 'basecard'\n"), 'basecard');
  assert.equal(
    extractManifestType('runtime:\n  type: not-a-role\ntargets: [host]\ntype: boxlayout\n'),
    'boxlayout'
  );
  assert.equal(extractManifestType('id: chips.app.demo\nname: 示例\n'), undefined);
  assert.equal(extractManifestType('type:\nname: 示例\n'), undefined);
  assert.equal(extractManifestType('type:   \n'), undefined);
});
