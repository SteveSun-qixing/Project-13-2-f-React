/**
 * 快照引擎：确定性序列化、深度差异与显式更新。
 *
 * 更新只允许通过环境变量 `CHIPS_CONTRACT_SNAPSHOT_UPDATE=1` 显式触发
 * （`pnpm test:contract:update`），普通运行绝不静默覆盖快照；
 * 差异清单进入测试失败消息与 `reports/contract/`。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { SNAPSHOTS_DIR, workspaceRelative } from './paths.js';
import { violation, type ContractViolation } from './violations.js';

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface SnapshotDiff {
  readonly path: string;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly expected?: string;
  readonly actual?: string;
}

export interface SnapshotComparison {
  readonly name: string;
  readonly file: string;
  readonly status: 'unchanged' | 'created' | 'updated' | 'missing' | 'diff';
  readonly diffs: readonly SnapshotDiff[];
}

export interface SnapshotInput {
  readonly name: string;
  /** 快照生成逻辑标识（评审时定位生成器）。 */
  readonly generator: string;
  /** 事实源（文档 `路径#章节`）。 */
  readonly sources: readonly string[];
  readonly data: unknown;
}

const MAX_VALUE_LENGTH = 400;

export function isSnapshotUpdateMode(): boolean {
  return process.env['CHIPS_CONTRACT_SNAPSHOT_UPDATE'] === '1';
}

function truncate(value: string): string {
  return value.length <= MAX_VALUE_LENGTH ? value : `${value.slice(0, MAX_VALUE_LENGTH)}…`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 递归按键排序，保证同一数据在任意构造顺序下序列化一致。 */
export function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableClone(entry));
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
      result[key] = stableClone(value[key]);
    }
    return result;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(stableClone(value), null, 2)}\n`;
}

function describe(value: unknown): string {
  if (value === undefined) {
    return '—';
  }
  return truncate(stableStringify(value).trim());
}

export function deepDiff(expected: unknown, actual: unknown, basePath = ''): SnapshotDiff[] {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const diffs: SnapshotDiff[] = [];
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const entryPath = `${basePath}[${index}]`;
      if (index >= actual.length) {
        diffs.push({ path: entryPath, kind: 'removed', expected: describe(expected[index]) });
        continue;
      }
      if (index >= expected.length) {
        diffs.push({ path: entryPath, kind: 'added', actual: describe(actual[index]) });
        continue;
      }
      diffs.push(...deepDiff(expected[index], actual[index], entryPath));
    }
    return diffs;
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const diffs: SnapshotDiff[] = [];
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort(
      (left, right) => left.localeCompare(right)
    );
    for (const key of keys) {
      const entryPath = basePath === '' ? key : `${basePath}.${key}`;
      if (!(key in actual)) {
        diffs.push({ path: entryPath, kind: 'removed', expected: describe(expected[key]) });
        continue;
      }
      if (!(key in expected)) {
        diffs.push({ path: entryPath, kind: 'added', actual: describe(actual[key]) });
        continue;
      }
      diffs.push(...deepDiff(expected[key], actual[key], entryPath));
    }
    return diffs;
  }
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    return [
      {
        path: basePath === '' ? '<根>' : basePath,
        kind: 'changed',
        expected: describe(expected),
        actual: describe(actual),
      },
    ];
  }
  return [];
}

function snapshotFilePath(name: string): string {
  return path.join(SNAPSHOTS_DIR, name.endsWith('.json') ? name : `${name}.json`);
}

function payload(input: SnapshotInput): unknown {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generator: input.generator,
    sources: [...input.sources],
    data: input.data,
  };
}

/** 比较（或显式更新）快照；返回状态与差异清单。 */
export function compareSnapshot(input: SnapshotInput): SnapshotComparison {
  const file = snapshotFilePath(input.name);
  const next = stableStringify(payload(input));
  const exists = existsSync(file);
  const previous = exists ? readFileSync(file, 'utf8') : null;

  if (isSnapshotUpdateMode()) {
    if (previous === next) {
      return { name: input.name, file, status: 'unchanged', diffs: [] };
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, next, 'utf8');
    return { name: input.name, file, status: exists ? 'updated' : 'created', diffs: [] };
  }

  if (previous === null) {
    return { name: input.name, file, status: 'missing', diffs: [] };
  }
  if (previous === next) {
    return { name: input.name, file, status: 'unchanged', diffs: [] };
  }
  let expected: unknown;
  try {
    expected = JSON.parse(previous) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      name: input.name,
      file,
      status: 'diff',
      diffs: [{ path: '<快照文件>', kind: 'changed', expected: `无法解析：${reason}` }],
    };
  }
  return { name: input.name, file, status: 'diff', diffs: deepDiff(expected, payload(input)) };
}

const MAX_REPORTED_DIFFS = 100;

/** 把快照比较结果转换为契约偏差（供测试断言与报告）。 */
export function snapshotViolations(comparison: SnapshotComparison): ContractViolation[] {
  const subject = workspaceRelative(comparison.file);
  if (comparison.status === 'missing') {
    return [
      violation(
        'CONTRACT_SNAPSHOT_MISSING',
        subject,
        '契约快照缺失；评审后运行 `pnpm test:contract:update` 生成并提交'
      ),
    ];
  }
  if (comparison.status !== 'diff') {
    return [];
  }
  const violations = comparison.diffs.slice(0, MAX_REPORTED_DIFFS).map((diff) =>
    violation(
      'CONTRACT_SNAPSHOT_DIFF',
      `${subject}#${diff.path}`,
      `快照差异（${diff.kind}）：文档契约已变化，必须显式评审并更新快照`,
      {
        ...(diff.expected === undefined ? {} : { expected: diff.expected }),
        ...(diff.actual === undefined ? {} : { actual: diff.actual }),
      }
    )
  );
  if (comparison.diffs.length > MAX_REPORTED_DIFFS) {
    violations.push(
      violation(
        'CONTRACT_SNAPSHOT_DIFF_TRUNCATED',
        subject,
        `快照差异超过 ${MAX_REPORTED_DIFFS} 条，其余 ${comparison.diffs.length - MAX_REPORTED_DIFFS} 条未在报告中列出`
      )
    );
  }
  return violations;
}
