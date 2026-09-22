/**
 * 资源 URI 单一 TS 镜像锁（任务 #190 D6，host 面）。
 *
 * 权威：`06-资源协议规范` §二（URI 语法）——契约未指定第二实现；核心 `path_guard.rs`/`uri.rs`
 * 为安全终权，TS 侧语法镜像唯一在册位为 `src/protocol/resource-uri.ts`。
 *
 * @remarks
 * - D6 勘查结论：并立的第二镜像落位 `packages/bridge/src/protocol/resource-uri.ts`
 *   （bridge 契约层形态，内部四消费位），收敛方案（re-export 翻正或契约双锁等值）属
 *   packages/bridge 面改动，随 #189 冻结期交回主裁定（#190 派单例外条款）；
 * - 本套件锁 host 面两条硬判据：① host 全仓 URI 解析实现定义位唯一（禁复刻臂）；
 *   ② host 任何文件不得从 `@chips/bridge` 引入 URI 解析臂（第二镜像在 host 零引用）。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(packageRoot, 'src');
const SINGLE_MIRROR_FILE = join(sourceRoot, 'protocol', 'resource-uri.ts');

/** 递归收集 `src` 下全部 TS/TSX 源文件。 */
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

describe('资源 URI 单一 TS 镜像（#190-D6 host 面）', () => {
  it('src 覆盖面非空且镜像定义位在册', () => {
    expect(sources.length).toBeGreaterThan(40);
    expect(sources).toContain(SINGLE_MIRROR_FILE);
  });

  it('URI 解析实现定义位唯一：其余文件不得复刻解析臂', () => {
    const definitionPatterns = [
      /export function parseResourceUri\b/,
      /export function normalizeResourceInput\b/,
      /export function toCanonicalResourceUri\b/,
      /function decodeOnceChecked\b/,
      /function isForbiddenUnicodeCodePoint\b/,
      /function validateSegment\b/,
      /export const RESOURCE_URI_MAX_LENGTH\b/,
    ];
    for (const file of sources) {
      if (file === SINGLE_MIRROR_FILE) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      for (const pattern of definitionPatterns) {
        expect(pattern.test(content), `${relative(packageRoot, file)} 复刻了镜像定义 ${pattern.source}`).toBe(false);
      }
    }
  });

  it('第二镜像（@chips/bridge URI 解析臂）在 host 零引用', () => {
    // 从 '@chips/bridge' 的 import 语句中不得出现 URI 解析面符号（ChipsError 等协议类型不受限）。
    const bridgeImportPattern = /import\s*\{([^}]*)\}\s*from\s*'@chips\/bridge'/g;
    const forbiddenSpecifiers = ['parseResourceUri', 'normalizeResourceInput', 'toCanonicalResourceUri'];
    for (const file of sources) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(bridgeImportPattern)) {
        const specifiers = (match[1] ?? '').split(',').map((part) => part.trim().split(/\s+as\s+/)[0] ?? '');
        for (const specifier of specifiers) {
          expect(forbiddenSpecifiers.includes(specifier), `${relative(packageRoot, file)} 引用了 ${specifier}`).toBe(
            false,
          );
        }
      }
    }
  });

  it('URI 解析消费位一律指向唯一镜像模块', () => {
    const parseArmIdentifiers = ['parseResourceUri', 'normalizeResourceInput', 'toCanonicalResourceUri'];
    // 逐条 import/export-from 语句抽取「具名符号 → 模块说明符」，注释提及不计。
    const fromClausePattern = /(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'([^']+)'/g;
    let consumerCount = 0;
    for (const file of sources) {
      if (file === SINGLE_MIRROR_FILE) {
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
                .split(/\s+as\s+/)[0] ?? '',
          )
          .filter((part) => part.length > 0);
        const moduleSpecifier = match[2] ?? '';
        if (specifiers.some((specifier) => parseArmIdentifiers.includes(specifier))) {
          consumerCount += 1;
          expect(
            moduleSpecifier.endsWith('protocol/resource-uri.js'),
            `${relative(packageRoot, file)} 的解析臂引入自 ${moduleSpecifier}，必须指向唯一镜像模块`,
          ).toBe(true);
        }
      }
    }
    // 在册消费面盘点（preload 预检、协议处理器、窗口装载白名单、审计脱敏、帧视图构建、包出口等）。
    expect(consumerCount).toBeGreaterThanOrEqual(5);
  });
});
