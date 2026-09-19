/**
 * 语义化版本与版本范围（[版本与迁移规范] §3.1、§3.2、§4.1–§4.3）。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError } from '../src/errors.js';
import {
  assertValidRange,
  compareSemver,
  isValidRange,
  parseRange,
  parseSemver,
  satisfies,
  satisfiesRange,
} from '../src/artifacts/semver.js';

function version(text: string): NonNullable<ReturnType<typeof parseSemver>> {
  const parsed = parseSemver(text);
  if (parsed === undefined) {
    throw new Error(`测试前置：版本不可解析 ${text}`);
  }
  return parsed;
}

describe('版本解析（§3.1 版本格式）', () => {
  it('三段式与预发布、构建元数据', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseSemver('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0, prerelease: [] });
    expect(parseSemver('1.2.3-alpha.1')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['alpha', '1'] });
    expect(parseSemver('1.2.3+build.5')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseSemver('1.2.3-rc.2+build.5')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['rc', '2'] });
  });

  it('两侧空白忽略', () => {
    expect(parseSemver('  1.2.3  ')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
  });

  it('禁止前导零与其它前缀（§3.1）', () => {
    expect(parseSemver('1.02.0')).toBeUndefined();
    expect(parseSemver('01.2.3')).toBeUndefined();
    expect(parseSemver('1.2.03')).toBeUndefined();
    expect(parseSemver('00.1.2')).toBeUndefined();
    expect(parseSemver('v1.2.3')).toBeUndefined();
    expect(parseSemver('=1.2.3')).toBeUndefined();
  });

  it('不完整或多余分段与非法字符', () => {
    expect(parseSemver('')).toBeUndefined();
    expect(parseSemver('1')).toBeUndefined();
    expect(parseSemver('1.2')).toBeUndefined();
    expect(parseSemver('1.2.3.4')).toBeUndefined();
    expect(parseSemver('a.b.c')).toBeUndefined();
    expect(parseSemver('1.2.x')).toBeUndefined();
    expect(parseSemver('1.2.3-')).toBeUndefined();
    expect(parseSemver('1.2.3+')).toBeUndefined();
  });
});

describe('优先级比较（§3.2）', () => {
  it('主版本、次版本、修订号逐级比较', () => {
    expect(compareSemver(version('2.0.0'), version('1.9.9'))).toBe(1);
    expect(compareSemver(version('1.0.0'), version('1.0.0'))).toBe(0);
    expect(compareSemver(version('1.0.0'), version('1.1.0'))).toBe(-1);
    expect(compareSemver(version('1.1.0'), version('1.1.1'))).toBe(-1);
  });

  it('预发布优先级低于同三段正式版', () => {
    expect(compareSemver(version('1.0.0'), version('1.0.0-rc.1'))).toBe(1);
    expect(compareSemver(version('1.0.0-rc.1'), version('1.0.0'))).toBe(-1);
  });

  it('预发布标识逐段比较：数字按数值、字母按字典序、数字段先于字母段', () => {
    expect(compareSemver(version('1.0.0-alpha.1'), version('1.0.0-alpha.2'))).toBe(-1);
    expect(compareSemver(version('1.0.0-alpha.10'), version('1.0.0-alpha.9'))).toBe(1);
    expect(compareSemver(version('1.0.0-alpha'), version('1.0.0-beta'))).toBe(-1);
    expect(compareSemver(version('1.0.0-1'), version('1.0.0-alpha'))).toBe(-1);
    expect(compareSemver(version('1.0.0-alpha'), version('1.0.0-alpha.1'))).toBe(-1);
    expect(compareSemver(version('1.0.0-alpha.1'), version('1.0.0-alpha.1'))).toBe(0);
  });

  it('构建元数据不参与比较', () => {
    expect(compareSemver(version('1.0.0+build.1'), version('1.0.0+build.2'))).toBe(0);
  });
});

describe('范围文法（§4.1）', () => {
  it('全部合法写法', () => {
    for (const range of [
      '*',
      '1',
      '1.2',
      '1.2.3',
      '=1.2.3',
      '>1.2.3',
      '>=1.2.3',
      '<1.2.3',
      '<=1.2.3',
      '^1.2.3',
      '~1.2.3',
      '>=1.0.0 <2.0.0',
      '^1.0.0 || ^2.0.0',
    ]) {
      expect(isValidRange(range), range).toBe(true);
    }
  });

  it('非法写法返回 undefined / false', () => {
    for (const range of [
      '',
      '   ',
      '>=',
      '=>1.0.0',
      '>= 1.0.0',
      'abc',
      '1.2.3.4',
      '^1.2.3.4',
      '1.0.0 ||',
      'v1.2.3',
      '1.02.0',
    ]) {
      expect(parseRange(range), range).toBeUndefined();
      expect(isValidRange(range), range).toBe(false);
    }
  });

  it('空白与 || 归一：比较组与逻辑或分组', () => {
    const groups = parseRange('^1.0.0 || >=2.0.0 <3.0.0');
    expect(groups).toBeDefined();
    expect(groups?.length).toBe(2);
    expect(groups?.[0]?.comparators.length).toBe(1);
    expect(groups?.[1]?.comparators.length).toBe(2);
  });

  it('空格分隔的多个比较项参与同一组', () => {
    const groups = parseRange('>=1.0.0 <2.0.0');
    const candidate = version('1.4.3');
    expect(groups?.[0]?.comparators.every((comparator) => comparator.matches(candidate))).toBe(true);
  });
});

describe('运算符语义（§4.2 全表）', () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ['*', '0.0.1', true],
    ['*', '10.20.30', true],
    ['*', '1.2.0-beta.1', false],
    ['1', '1.0.0', true],
    ['1', '1.9.9', true],
    ['1', '2.0.0', false],
    ['1', '0.9.9', false],
    ['1.2', '1.2.0', true],
    ['1.2', '1.2.9', true],
    ['1.3', '1.3.0', true],
    ['1.2.3', '1.2.3', true],
    ['1.2.3', '1.2.4', false],
    ['=1.2.3', '1.2.3', true],
    ['=1.2.3', '1.2.2', false],
    ['=1.2', '1.2.5', true],
    ['=1.2', '1.3.0', false],
    ['>1.2.3', '1.2.4', true],
    ['>1.2.3', '1.2.3', false],
    ['>=1.2.3', '1.2.3', true],
    ['>=1.2.3', '1.2.2', false],
    ['>=1.2', '1.2.0', true],
    ['<1.2.3', '1.2.2', true],
    ['<1.2.3', '1.2.3', false],
    ['<=1.2.3', '1.2.3', true],
    ['<=1.2.3', '1.2.4', false],
    ['<=1.2', '1.3.0', false],
    ['^1.2.3', '1.2.3', true],
    ['^1.2.3', '1.9.9', true],
    ['^1.2.3', '2.0.0', false],
    ['^1.2.3', '1.2.2', false],
    ['^0.2.3', '0.2.9', true],
    ['^0.2.3', '0.3.0', false],
    ['^0.0.3', '0.0.3', true],
    ['^0.0.3', '0.0.4', false],
    ['^0.0.0', '0.0.0', true],
    ['^0.0.0', '0.0.1', false],
    ['~1.2.3', '1.2.9', true],
    ['~1.2.3', '1.3.0', false],
    ['~1.2', '1.2.0', true],
    ['~1.2', '1.3.0', false],
    ['~1', '1.0.0', true],
    ['~1', '1.9.9', true],
    ['~1', '2.0.0', false],
    ['>=1.0.0 <2.0.0', '1.2.0', true],
    ['>=1.0.0 <2.0.0', '1.4.3', true],
    ['>=1.0.0 <2.0.0', '2.0.1', false],
    ['>=1.0.0 <2.0.0', '0.9.9', false],
    ['^1.0.0 || ^2.0.0', '1.5.0', true],
    ['^1.0.0 || ^2.0.0', '2.1.0', true],
    ['^1.0.0 || ^2.0.0', '3.0.0', false],
  ];

  it.each(cases)('`%s` 对 %s 判定为 %s', (range, text, expected) => {
    expect(satisfies(text, range)).toBe(expected);
  });

  it('构建元数据在范围匹配时忽略（§4.3.1）', () => {
    expect(satisfies('1.2.3+build.9', '1.2.3')).toBe(true);
    expect(satisfies('1.2.3+build.9', '^1.0.0')).toBe(true);
  });

  it('预发布版本默认不匹配任何范围（§4.3.2 与 §4.2 示例表）', () => {
    expect(satisfies('1.2.0-beta.1', '^1.2.0')).toBe(false);
    expect(satisfies('1.2.0-beta.1', '>=1.0.0 <2.0.0')).toBe(false);
    expect(satisfies('1.9.9-rc.2', '^1.2.0')).toBe(false);
    expect(satisfies('1.9.9-rc.2', '>=1.0.0 <2.0.0')).toBe(false);
    expect(satisfies('2.0.0-alpha.1', '1')).toBe(false);
  });

  it('版本或范围非法时一律不满足（§4.3.4 由调用方判定错误码）', () => {
    expect(satisfies('1.2', '^1.0.0')).toBe(false);
    expect(satisfies('1.2.3', '>=')).toBe(false);
    expect(satisfies('', '*')).toBe(false);
  });
});

describe('satisfiesRange（已解析输入）', () => {
  it('按组求或、组内求与', () => {
    const groups = parseRange('^1.0.0 || ^3.0.0');
    if (groups === undefined) {
      throw new Error('测试前置：范围不可解析');
    }
    expect(satisfiesRange(version('3.4.5'), groups)).toBe(true);
    expect(satisfiesRange(version('2.0.0'), groups)).toBe(false);
  });

  it('空组集合不满足', () => {
    expect(satisfiesRange(version('1.0.0'), [])).toBe(false);
  });
});

describe('assertValidRange（清单校验入口）', () => {
  it('合法范围不抛出', () => {
    expect(() => assertValidRange('>=1.0.0 <2.0.0', 'dependencies[0].version')).not.toThrow();
  });

  it('非法范围抛 CPK_MANIFEST_INVALID 并携带指针', () => {
    try {
      assertValidRange('>=abc', 'engines.chips');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      const normalized = error as ChipsError;
      expect(normalized.code).toBe('CPK_MANIFEST_INVALID');
      expect(normalized.details).toEqual({ stage: 'manifest', pointer: 'engines.chips' });
      return;
    }
    throw new Error('期望抛出 CPK_MANIFEST_INVALID');
  });
});
