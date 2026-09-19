/**
 * 语义化版本与版本范围（[版本与迁移规范] §三、§四）。
 *
 * 范围文法：
 * ```
 * 范围表达式 := 比较组 (空格 比较组)*        # 空格 = 逻辑与
 * 比较组     := 比较项 (空格 比较项)*
 * 比较项     := 运算符? 版本核心
 * 运算符     := "=" | ">" | ">=" | "<" | "<=" | "^" | "~"
 * 版本核心   := MAJOR.MINOR.PATCH | MAJOR.MINOR | MAJOR | "*"
 * 或表达式   := 范围表达式 ("||" 范围表达式)*  # || = 逻辑或
 * ```
 * 预发布版本默认不匹配任何范围，除非范围自身显式包含相同 `MAJOR.MINOR.PATCH` 的预发布标识。
 */

import { cliError } from '../errors.js';

/** 解析后的版本。 */
export interface ISemverVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
}

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** 解析版本字符串；非法返回 undefined。 */
export function parseSemver(text: string): ISemverVersion | undefined {
  const match = VERSION_PATTERN.exec(text.trim());
  if (match === null) {
    return undefined;
  }
  const [, major, minor, patch, prerelease] = match;
  if (major === undefined || minor === undefined || patch === undefined) {
    return undefined;
  }
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease === undefined ? [] : prerelease.split('.'),
  };
}

/** 比较版本：a < b 返回 -1，a > b 返回 1，相等返回 0。 */
export function compareSemver(a: ISemverVersion, b: ISemverVersion): number {
  if (a.major !== b.major) {
    return a.major < b.major ? -1 : 1;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor ? -1 : 1;
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0) {
    return 1;
  }
  if (b.length === 0) {
    return -1;
  }
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? '';
    const right = b[index] ?? '';
    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) {
      const leftValue = Number(left);
      const rightValue = Number(right);
      if (leftValue !== rightValue) {
        return leftValue < rightValue ? -1 : 1;
      }
      continue;
    }
    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }
    if (left !== right) {
      return left < right ? -1 : 1;
    }
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

interface IComparator {
  readonly version: ISemverVersion;
  /** 是否命中（不含预发布排除规则）。 */
  matches(candidate: ISemverVersion): boolean;
  /** 版本核心是否携带预发布标识。 */
  readonly hasPrerelease: boolean;
}

interface IGroup {
  readonly comparators: readonly IComparator[];
  readonly hasPrerelease: boolean;
}

/** 解析范围；非法返回 undefined。 */
export function parseRange(text: string): readonly IGroup[] | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const groups: IGroup[] = [];
  for (const groupText of trimmed.split('||')) {
    const comparators: IComparator[] = [];
    const tokens = groupText.trim().split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length === 0) {
      return undefined;
    }
    for (const token of tokens) {
      const comparator = parseComparator(token);
      if (comparator === undefined) {
        return undefined;
      }
      comparators.push(comparator);
    }
    groups.push({
      comparators,
      hasPrerelease: comparators.some((comparator) => comparator.hasPrerelease),
    });
  }
  return groups;
}

/** 范围语法是否合法。 */
export function isValidRange(text: string): boolean {
  return parseRange(text) !== undefined;
}

function parseComparator(token: string): IComparator | undefined {
  const match = /^(>=|<=|=|>|<|\^|~)?(.+)$/.exec(token);
  if (match === null) {
    return undefined;
  }
  const operator = match[1] ?? '';
  const core = match[2] ?? '';
  if (core === '*') {
    return {
      version: { major: 0, minor: 0, patch: 0, prerelease: [] },
      hasPrerelease: false,
      matches: () => true,
    };
  }
  const parsed = parseCore(core);
  if (parsed === undefined) {
    return undefined;
  }
  const { version, precision, prerelease } = parsed;
  const hasPrerelease = prerelease.length > 0;

  switch (operator) {
    case '':
    case '=': {
      if (precision === 3) {
        return {
          version,
          hasPrerelease,
          matches: (candidate) => compareSemver(candidate, version) === 0,
        };
      }
      const upper = precision === 1 ? { major: version.major + 1, minor: 0, patch: 0, prerelease: [] } : { major: version.major, minor: version.minor + 1, patch: 0, prerelease: [] };
      return {
        version,
        hasPrerelease,
        matches: (candidate) =>
          compareSemver(candidate, version) >= 0 && compareSemver(candidate, upper) < 0,
      };
    }
    case '>':
      return { version, hasPrerelease, matches: (candidate) => compareSemver(candidate, version) > 0 };
    case '>=':
      return { version, hasPrerelease, matches: (candidate) => compareSemver(candidate, version) >= 0 };
    case '<':
      return { version, hasPrerelease, matches: (candidate) => compareSemver(candidate, version) < 0 };
    case '<=':
      return { version, hasPrerelease, matches: (candidate) => compareSemver(candidate, version) <= 0 };
    case '^': {
      const upper = caretUpper(version);
      return {
        version,
        hasPrerelease,
        matches: (candidate) =>
          compareSemver(candidate, version) >= 0 && compareSemver(candidate, upper) < 0,
      };
    }
    case '~': {
      const upper =
        precision === 1
          ? { major: version.major + 1, minor: 0, patch: 0, prerelease: [] }
          : { major: version.major, minor: version.minor + 1, patch: 0, prerelease: [] };
      return {
        version,
        hasPrerelease,
        matches: (candidate) =>
          compareSemver(candidate, version) >= 0 && compareSemver(candidate, upper) < 0,
      };
    }
    default:
      return undefined;
  }
}

function caretUpper(version: ISemverVersion): ISemverVersion {
  if (version.major > 0) {
    return { major: version.major + 1, minor: 0, patch: 0, prerelease: [] };
  }
  if (version.minor > 0) {
    return { major: 0, minor: version.minor + 1, patch: 0, prerelease: [] };
  }
  return { major: 0, minor: 0, patch: version.patch + 1, prerelease: [] };
}

function parseCore(
  core: string,
): { readonly version: ISemverVersion; readonly precision: 1 | 2 | 3; readonly prerelease: readonly string[] } | undefined {
  const parts = core.split('.');
  if (parts.length > 3) {
    return undefined;
  }
  const numeric: number[] = [];
  for (const part of parts) {
    if (!/^(0|[1-9]\d*)$/.test(part)) {
      return undefined;
    }
    numeric.push(Number(part));
  }
  const precision = parts.length as 1 | 2 | 3;
  const version: ISemverVersion = {
    major: numeric[0] ?? 0,
    minor: numeric[1] ?? 0,
    patch: numeric[2] ?? 0,
    prerelease: [],
  };
  return { version, precision, prerelease: [] };
}

/** 判断版本是否满足范围（含预发布排除规则）。 */
export function satisfiesRange(version: ISemverVersion, groups: readonly IGroup[]): boolean {
  for (const group of groups) {
    const allMatch = group.comparators.every((comparator) => comparator.matches(version));
    if (!allMatch) {
      continue;
    }
    if (version.prerelease.length === 0) {
      return true;
    }
    const explicitlyIncluded = group.comparators.some(
      (comparator) =>
        comparator.hasPrerelease &&
        comparator.version.major === version.major &&
        comparator.version.minor === version.minor &&
        comparator.version.patch === version.patch,
    );
    if (explicitlyIncluded) {
      return true;
    }
  }
  return false;
}

/** 便捷入口：文本版本满足文本范围。 */
export function satisfies(text: string, range: string): boolean {
  const version = parseSemver(text);
  const groups = parseRange(range);
  if (version === undefined || groups === undefined) {
    return false;
  }
  return satisfiesRange(version, groups);
}

/** 校验版本范围语法，非法抛 `CPK_MANIFEST_INVALID`。 */
export function assertValidRange(range: string, pointer: string): void {
  if (!isValidRange(range)) {
    throw cliError('CPK_MANIFEST_INVALID', `版本范围语法非法：${range}`, { stage: 'manifest', pointer });
  }
}
