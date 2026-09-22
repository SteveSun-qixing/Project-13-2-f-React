/**
 * 资源 URI 解析臂「单一定义位 + 零复刻臂」机械锁（任务 #198，D6 bridge 面包内归一）。
 *
 * 权威：`06-资源协议规范` §二（URI 语法）——契约不指定 TS 第二实现；核心
 * `path_guard.rs`/`uri.rs` 为安全终权。#190 已在 host 面锁定跨包唯一定义位
 * （`packages/host/tests/resource-uri-single-mirror.test.ts`），本套件锁定
 * `@chips/bridge` 包内侧：包内 URI 解析与归一只认 `src/protocol/resource-uri.ts`
 * 单一定义位，任何文件（含消费位）不得复刻解析/归一臂或另起裸 http 归一支路。
 *
 * @remarks
 * - #198 归一记录：`src/core/qualifiers.ts` 旧私有 `normalizeBareHttp`（裸 http(s)
 *   → external 复合串的第二份实现，跳过 userinfo 前置拒、origin URL 归一与百分号
 *   大写归一）已退役，消费位翻正为唯一解析臂 `normalizeResourceInput`；
 * - 与 host 唯一镜像的跨包语义差异（ASCII 强制、长度上限、非字符全集臂等）按
 *   #198 三方映射审计如实报差登记（开发日志与交回报告），不在本锁范围内静默归一。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(packageRoot, 'src');
const SINGLE_DEFINITION_FILE = join(sourceRoot, 'protocol', 'resource-uri.ts');

/** 递归收集 `src` 下全部 TS/TSX 源文件（归档目录不在 `src` 内，天然出局）。 */
function collectSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectSources(path));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(path);
    }
  }
  return files;
}

const sources = collectSources(sourceRoot);

describe('资源 URI 解析臂单一定义位（#198 bridge 包内）', () => {
  it('src 覆盖面非空且唯一解析臂定义位在册', () => {
    expect(sources.length).toBeGreaterThan(30);
    expect(sources).toContain(SINGLE_DEFINITION_FILE);
  });

  it('URI 解析与归一定义臂唯一：其余文件不得复刻', () => {
    const definitionPatterns = [
      /export function parseResourceUri\b/,
      /export function normalizeResourceInput\b/,
      /export function normalizeHttpReference\b/,
      /export function isReservedResourceScope\b/,
      /function decodeOnce\b/,
      /function validateSegment\b/,
      /function validatePath\b/,
      /function normalizeExternalOrigin\b/,
    ];
    for (const file of sources) {
      if (file === SINGLE_DEFINITION_FILE) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      for (const pattern of definitionPatterns) {
        expect(
          pattern.test(content),
          `${relative(packageRoot, file)} 复刻了唯一解析臂定义 ${pattern.source}`
        ).toBe(false);
      }
    }
  });

  it('退役复刻臂零复活：全包不得再现 normalizeBareHttp 定义或 external 复合串第二拼装位', () => {
    // 全局正则统一走 matchAll 计数；`normalizeBareHttp` 退役臂全包零位（含唯一解析臂），
    // `chips-resource://external/${` 模板拼装位只许出现在唯一解析臂文件内。
    const zeroEverywherePatterns = [/function normalizeBareHttp\b/g];
    const mirrorOnlyPatterns = [/`chips-resource:\/\/external\/\$\{/g];
    for (const file of sources) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of zeroEverywherePatterns) {
        const hits = [...content.matchAll(pattern)];
        expect(
          hits.length,
          `${relative(packageRoot, file)} 命中退役复刻臂定义 ${pattern.source}`
        ).toBe(0);
      }
      if (file === SINGLE_DEFINITION_FILE) {
        continue;
      }
      for (const pattern of mirrorOnlyPatterns) {
        const hits = [...content.matchAll(pattern)];
        expect(
          hits.length,
          `${relative(packageRoot, file)} 复刻了 external 规范串第二拼装位 ${pattern.source}`
        ).toBe(0);
      }
    }
  });

  it('URI 解析消费位一律指向唯一解析臂模块', () => {
    const parseArmIdentifiers = [
      'parseResourceUri',
      'normalizeResourceInput',
      'normalizeHttpReference',
      'isReservedResourceScope',
    ];
    const fromClausePattern = /(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'([^']+)'/g;
    let consumerCount = 0;
    for (const file of sources) {
      if (file === SINGLE_DEFINITION_FILE) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(fromClausePattern)) {
        const specifiers = (match[1] ?? '')
          .split(',')
          .map(
            (part) =>
              part
                .trim()
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/)[0] ?? ''
          )
          .filter((part) => part.length > 0);
        const moduleSpecifier = match[2] ?? '';
        if (specifiers.some((specifier) => parseArmIdentifiers.includes(specifier))) {
          const resolved = resolve(dirname(file), moduleSpecifier).replace(/\.js$/, '');
          expect(
            resolved === SINGLE_DEFINITION_FILE.replace(/\.ts$/, ''),
            `${relative(packageRoot, file)} 的解析臂引入自 ${moduleSpecifier}，必须指向唯一解析臂模块`
          ).toBe(true);
          consumerCount += 1;
        }
      }
    }
    // 在册消费面盘点（权限评估、限定匹配、客户端壳、schema format、协议出口、本臂锁测）。
    expect(consumerCount).toBeGreaterThanOrEqual(6);
  });
});
