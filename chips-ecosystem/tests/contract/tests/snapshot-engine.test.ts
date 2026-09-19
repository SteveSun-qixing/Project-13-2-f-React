/**
 * 快照引擎自测：稳定序列化、深度差异与偏差报告纯函数。
 */

import { describe, expect, it } from 'vitest';

import {
  deepDiff,
  snapshotViolations,
  stableStringify,
  type SnapshotComparison,
} from '../src/snapshot.js';

describe('stableStringify', () => {
  it('对象键递归排序，保证序列化确定性', () => {
    const left = stableStringify({ b: 1, a: { d: 2, c: 3 } });
    const right = stableStringify({ a: { c: 3, d: 2 }, b: 1 });
    expect(left).toBe(right);
  });

  it('数组顺序保持不变（顺序是契约的一部分）', () => {
    expect(stableStringify(['b', 'a'])).not.toBe(stableStringify(['a', 'b']));
  });
});

describe('deepDiff', () => {
  it('无差异返回空列表', () => {
    expect(deepDiff({ a: [1, 2], b: 'x' }, { a: [1, 2], b: 'x' })).toEqual([]);
  });

  it('检出新增、删除与修改，并给出可定位路径', () => {
    const diffs = deepDiff(
      { roles: { app: { members: [{ name: 'launch' }] } }, count: 1 },
      { roles: { app: { members: [{ name: 'launch' }, { name: 'handleCommand' }] } }, extra: true },
    );
    const paths = diffs.map((diff) => `${diff.kind}:${diff.path}`);
    expect(paths).toContain('added:roles.app.members[1]');
    expect(paths).toContain('removed:count');
    expect(paths).toContain('added:extra');
  });

  it('数组长度缩短按索引报告删除', () => {
    const diffs = deepDiff([1, 2, 3], [1]);
    expect(diffs.map((diff) => diff.kind)).toEqual(['removed', 'removed']);
    expect(diffs.map((diff) => diff.path)).toEqual(['[1]', '[2]']);
  });

  it('标量变化报告 changed 并携带期望/实际', () => {
    const diffs = deepDiff({ protocol: 'chips-frame/1' }, { protocol: 'chips-frame/2' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ path: 'protocol', kind: 'changed' });
  });
});

describe('snapshotViolations', () => {
  const base: Omit<SnapshotComparison, 'status' | 'diffs'> = {
    name: 'fixture',
    file: '/workspace/chips-ecosystem/tests/contract/snapshots/fixture.json',
  };

  it('缺失快照报告 CONTRACT_SNAPSHOT_MISSING', () => {
    const violations = snapshotViolations({ ...base, status: 'missing', diffs: [] });
    expect(violations).toHaveLength(1);
    expect(violations[0]?.code).toBe('CONTRACT_SNAPSHOT_MISSING');
  });

  it('差异逐条报告 CONTRACT_SNAPSHOT_DIFF', () => {
    const violations = snapshotViolations({
      ...base,
      status: 'diff',
      diffs: [
        { path: 'a', kind: 'changed', expected: '1', actual: '2' },
        { path: 'b[0]', kind: 'added', actual: 'x' },
      ],
    });
    expect(violations.map((item) => item.code)).toEqual([
      'CONTRACT_SNAPSHOT_DIFF',
      'CONTRACT_SNAPSHOT_DIFF',
    ]);
  });

  it('更新与未变化状态不产生偏差', () => {
    expect(snapshotViolations({ ...base, status: 'unchanged', diffs: [] })).toEqual([]);
    expect(snapshotViolations({ ...base, status: 'updated', diffs: [] })).toEqual([]);
    expect(snapshotViolations({ ...base, status: 'created', diffs: [] })).toEqual([]);
  });
});
