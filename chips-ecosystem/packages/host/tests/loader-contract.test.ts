/**
 * 装载器契约漂移锁单测（计划书测试面第 1 条；权威《03-插件包格式》§四、§八，
 * 《01-薯片内核设计》§6.2/§6.7，形态沿 `document-capability-contract.test.ts` 先例）。
 *
 * 覆盖：
 * - `codes.ts` 的 11 码 `CPK_*` 与 `@chips/sdk` 生成表 `CPK_` 前缀集合双向逐项一致；
 *   生命周期域引用的 8 码 `KERNEL_*` 逐项落在生成表内；
 * - `retryable` 口径（CPK 全不可重试）与 `loaderWireError` 的 `IWireChipsError` 构造面；
 * - `limits.ts` 的 `CPK_LIMITS` 与 `@chips/cli` `artifacts/cpk-validate.ts` 同名表
 *   源文本字面逐项一致；生命周期超时常量与《01-薯片内核设计》§6.7 文档值一致。
 *
 * @remarks
 * - `@chips/host` 对 `@chips/{sdk,cli}` 零运行时依赖：本套件读取其**源文件文本**做结构
 *   解析比对，不建立 import 依赖边——这正是"双源不漂移"的锁。
 * - 生命周期事件（`plugin:*`）ID/payload 面漂移锁随 `lifecycle.ts`（阶段五）在本套件
 *   补齐；当前装载器交付面尚无宿主侧事件常量源可比对（裁决登记开发日志）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CPK_ERROR_CODES,
  CPK_ERROR_RETRYABLE,
  LIFECYCLE_ERROR_CODES,
  LOADER_ERROR_MESSAGES,
  LOADER_ERROR_RETRYABLE,
  loaderWireError,
  type LoaderErrorCode,
} from '../src/loader/codes.js';
import { CPK_LIMITS, LIFECYCLE_TIMEOUTS } from '../src/loader/limits.js';

/** 读取工作区源文件原文（不建立包依赖边）。 */
function readWorkspaceSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, import.meta.url)), 'utf8');
}

const SDK_ERROR_CODES_SOURCE = readWorkspaceSource(
  '../../../packages/sdk/src/generated/error-codes.ts',
);
const CLI_CPK_VALIDATE_SOURCE = readWorkspaceSource(
  '../../../packages/cli/src/artifacts/cpk-validate.ts',
);

/** 提取 `export const ERROR_CODES = [...]` 数组中的全部字符串字面量。 */
function extractGeneratedErrorCodes(source: string): readonly string[] {
  const block = /export const ERROR_CODES = \[([\s\S]*?)\]/.exec(source);
  if (block === null || block[1] === undefined) {
    throw new Error('未在 @chips/sdk 生成源中找到 ERROR_CODES 数组');
  }
  return [...block[1].matchAll(/'([A-Z0-9_]+)'/g)].map((match) => match[1] ?? '');
}

const GENERATED_CODES = extractGeneratedErrorCodes(SDK_ERROR_CODES_SOURCE);
const GENERATED_CPK_CODES = GENERATED_CODES.filter((code) => code.startsWith('CPK_')).sort();
const HOST_CPK_CODES = Object.values(CPK_ERROR_CODES).sort();

/** 提取 `export const CPK_LIMITS = { ... } as const` 中的 `key: 表达式,` 字面对照。 */
function extractLimitsTable(source: string): Map<string, string> {
  const block = /export const CPK_LIMITS = \{([\s\S]*?)\} as const;/.exec(source);
  if (block === null || block[1] === undefined) {
    throw new Error('未在源文件中找到 CPK_LIMITS 常量表');
  }
  const table = new Map<string, string>();
  for (const match of block[1].matchAll(/^\s*(\w+):\s*([^/\n]+?),\s*$/gm)) {
    const key = match[1] ?? '';
    const value = (match[2] ?? '').trim();
    table.set(key, value);
  }
  return table;
}

describe('CPK 错误码漂移锁（codes.ts ↔ @chips/sdk 生成表）', () => {
  it('CPK_* 码集合与生成表双向逐项一致（11 码）', () => {
    expect(HOST_CPK_CODES).toEqual(GENERATED_CPK_CODES);
    expect(HOST_CPK_CODES).toHaveLength(11);
  });

  it('生命周期域引用的 KERNEL_* 子集逐项落在生成表内', () => {
    const kernelCodes = Object.values(LIFECYCLE_ERROR_CODES);
    expect(kernelCodes).toHaveLength(8);
    for (const code of kernelCodes) {
      expect(GENERATED_CODES, `生成表缺少 ${code}`).toContain(code);
    }
  });

  it('CPK 域全部不可重试（《03-插件包格式》§八）', () => {
    for (const code of Object.values(CPK_ERROR_CODES)) {
      expect(CPK_ERROR_RETRYABLE[code]).toBe(false);
    }
  });

  it('每个登记码均有简体中文文案与 retryable 口径', () => {
    const allCodes: readonly LoaderErrorCode[] = [
      ...Object.values(CPK_ERROR_CODES),
      ...Object.values(LIFECYCLE_ERROR_CODES),
    ];
    for (const code of allCodes) {
      const message = LOADER_ERROR_MESSAGES[code];
      expect(message.length, `错误码 ${code} 缺少文案`).toBeGreaterThan(0);
      expect(typeof LOADER_ERROR_RETRYABLE[code], `错误码 ${code} 缺少 retryable`).toBe(
        'boolean',
      );
    }
  });
});

describe('loaderWireError 构造面（IWireChipsError 同构）', () => {
  it('默认文案与 retryable 取自登记表', () => {
    const error = loaderWireError(CPK_ERROR_CODES.manifestInvalid);
    expect(error).toEqual({
      code: 'CPK_MANIFEST_INVALID',
      message: LOADER_ERROR_MESSAGES.CPK_MANIFEST_INVALID,
      retryable: false,
    });
  });

  it('details 仅在显式提供时出现；message 可覆盖', () => {
    const withDetails = loaderWireError(CPK_ERROR_CODES.signatureInvalid, {
      message: '定制文案',
      details: { stage: 'signature', keyId: 'demo' },
    });
    expect(withDetails.code).toBe('CPK_SIGNATURE_INVALID');
    expect(withDetails.message).toBe('定制文案');
    expect(withDetails.retryable).toBe(false);
    expect(withDetails.details).toEqual({ stage: 'signature', keyId: 'demo' });
  });
});

/** 求值 `50 * 1024 * 1024` 形态的纯乘法字面表达式（源为仓库内常量文本）。 */
function evaluateProduct(literal: string): number {
  const factors = literal
    .replace(/_/g, '')
    .split('*')
    .map((token) => Number(token.trim()));
  if (factors.some((factor) => !Number.isFinite(factor))) {
    throw new Error(`无法解析限额字面：${literal}`);
  }
  return factors.reduce((product, factor) => product * factor, 1);
}

describe('CPK_LIMITS 与超时常量漂移锁', () => {
  it('与 @chips/cli artifacts/cpk-validate.ts 的 CPK_LIMITS 字面逐项一致', () => {
    const cliTable = extractLimitsTable(CLI_CPK_VALIDATE_SOURCE);
    expect(cliTable.size).toBeGreaterThan(0);
    const hostTable = CPK_LIMITS as unknown as Record<string, number>;
    for (const [key, literal] of cliTable) {
      expect(hostTable, `宿主限额表缺字段 ${key}`).toHaveProperty(key);
      expect(hostTable[key], `限额 ${key} 漂移`).toBe(evaluateProduct(literal));
    }
    expect(Object.keys(hostTable).sort()).toEqual([...cliTable.keys()].sort());
  });

  it('生命周期超时常量与《01-薯片内核设计》§6.7 文档值一致', () => {
    expect(LIFECYCLE_TIMEOUTS.applyMs).toBe(30_000);
    expect(LIFECYCLE_TIMEOUTS.stopMs).toBe(10_000);
  });
});
