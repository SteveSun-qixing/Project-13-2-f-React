/**
 * 契约偏差模型：全部检查统一返回 {@link ContractViolation} 列表，空列表表示一致。
 *
 * - 每条偏差必须携带稳定的机器可判定 `code`、可定位的 `subject`（能力 ID、事件 ID、
 *   快照路径、文档 `路径#章节` 等）与简体中文 `message`；
 * - 报告按 `code`、`subject` 排序，保证同一偏差在多次运行中输出稳定，便于 CI 比对。
 */

export interface ContractViolation {
  readonly code: string;
  readonly subject: string;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface ViolationOptions {
  readonly expected?: string;
  readonly actual?: string;
}

export function violation(
  code: string,
  subject: string,
  message: string,
  options: ViolationOptions = {}
): ContractViolation {
  const result: ContractViolation = { code, subject, message };
  if (options.expected !== undefined) {
    return {
      ...result,
      expected: options.expected,
      ...(options.actual !== undefined ? { actual: options.actual } : {}),
    };
  }
  return options.actual !== undefined ? { ...result, actual: options.actual } : result;
}

/** 单条偏差的稳定文本形态（测试失败消息与报告共用）。 */
export function formatViolation(item: ContractViolation): string {
  const parts = [`[${item.code}] ${item.subject}：${item.message}`];
  if (item.expected !== undefined || item.actual !== undefined) {
    parts.push(`  期望：${item.expected ?? '—'}`);
    parts.push(`  实际：${item.actual ?? '—'}`);
  }
  return parts.join('\n');
}

export function formatViolations(violations: readonly ContractViolation[]): string {
  return violations.map(formatViolation).join('\n');
}

/** 稳定排序：先按 code，再按 subject，最后按 message。 */
export function sortViolations(violations: readonly ContractViolation[]): ContractViolation[] {
  return [...violations].sort((left, right) => {
    const byCode = left.code.localeCompare(right.code);
    if (byCode !== 0) {
      return byCode;
    }
    const bySubject = left.subject.localeCompare(right.subject);
    return bySubject !== 0 ? bySubject : left.message.localeCompare(right.message);
  });
}

/**
 * 断言无偏差；存在偏差时抛出包含全部偏差的稳定文本。
 * 失败消息即报告中的差异清单，禁止只输出首条偏差。
 */
export function assertNoViolations(violations: readonly ContractViolation[]): void {
  if (violations.length === 0) {
    return;
  }
  const sorted = sortViolations(violations);
  throw new Error(`契约不一致：共 ${sorted.length} 项偏差\n${formatViolations(sorted)}`);
}

/** 集合差异：用于 ID 级一致性检查（文档为期望侧，实现为实际侧）。 */
export interface SetDifference {
  readonly missing: readonly string[];
  readonly extra: readonly string[];
}

export function diffSets(expected: Iterable<string>, actual: Iterable<string>): SetDifference {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: [...expectedSet].filter((value) => !actualSet.has(value)).sort(),
    extra: [...actualSet].filter((value) => !expectedSet.has(value)).sort(),
  };
}

/** 数组 → 去重升序（用于权限映射等无序集合的稳定比较）。 */
export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
