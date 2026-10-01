/**
 * 契约镜像锁的源码提取器（仅测试代码）。
 *
 * @remarks
 * - 与 `document-capability-contract.test.ts` 的本地提取逻辑同族：不建立 `@chips/host` →
 *   `@chips/sdk` / `@chips/bridge` 的包依赖边，而是读取生成源与登记表原文做结构解析比对；
 *   任一侧漂移即确定性翻红（双源不漂移锁）。
 * - 本文件把三类提取器参数化，供系统服务族各域契约测试共用。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 读取工作区内生成源/登记表原文（相对路径以 `tests/` 目录为基准，与契约测试书写口径一致）。 */
export function readContractSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, new URL('../', import.meta.url))), 'utf8');
}

/** 提取 `KEY: 'value',` 形态常量对象中指定前缀的键值对。 */
export function extractConstantEntries(source: string, keyPrefix: string): Map<string, string> {
  const entries = new Map<string, string>();
  const pattern = new RegExp(String.raw`^\s{2}${keyPrefix}[A-Z_]+:\s*'([^']+)',`, 'gm');
  for (const match of source.matchAll(pattern)) {
    const key = match[0].slice(2).split(':')[0]?.trim() ?? '';
    entries.set(key, match[1] ?? '');
  }
  return entries;
}

/** 提取 `CAPABILITY_PERMISSIONS` 形态映射中指定 ID 前缀行的权限数组。 */
export function extractGeneratedPermissionMap(source: string, idPrefix: string): Map<string, readonly string[]> {
  const entries = new Map<string, readonly string[]>();
  const escaped = idPrefix.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const linePattern = new RegExp(String.raw`^\s*'(${escaped}[^']+)':\s*\[([^\]]*)\],`, 'gm');
  for (const match of source.matchAll(linePattern)) {
    const id = match[1] ?? '';
    const items = [...(match[2] ?? '').matchAll(/'([^']+)'/g)].map((item) => item[1] ?? '');
    entries.set(id, items);
  }
  return entries;
}

/** 一条 `contract(...)` 调用的解析结果。 */
export interface IBridgeContractEntry {
  readonly id: string;
  readonly permissions: readonly string[];
  readonly targets: readonly { permission: string; targetFields: readonly string[] }[];
}

/** 从 `capability-contracts.ts` 原文提取指定能力前缀的 contract 登记项（括号配平，兼容跨行书写）。 */
export function extractBridgeContracts(source: string, idPrefix: string): Map<string, IBridgeContractEntry> {
  const entries = new Map<string, IBridgeContractEntry>();
  const marker = 'contract(';
  let index = source.indexOf(marker);
  while (index !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = index + marker.length - 1; i < source.length; i += 1) {
      if (source[i] === '(') {
        depth += 1;
      } else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      break;
    }
    const call = source.slice(index, end + 1);
    const idMatch = /contract\(\s*'([^']+)'/.exec(call);
    const id = idMatch?.[1];
    if (id !== undefined && id.startsWith(idPrefix)) {
      const permissionsMatch = /\[\s*([^\]]*)\]/.exec(call.slice('contract('.length));
      const permissions = [...(permissionsMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map((item) => item[1] ?? '');
      const targets = [...call.matchAll(/target\('([^']+)'((?:\s*,\s*'[^']*')*)\)/g)].map((match) => ({
        permission: match[1] ?? '',
        targetFields: [...(match[2] ?? '').matchAll(/'([^']+)'/g)].map((field) => field[1] ?? ''),
      }));
      entries.set(id, { id, permissions, targets });
    }
    index = source.indexOf(marker, end + 1);
  }
  return entries;
}
