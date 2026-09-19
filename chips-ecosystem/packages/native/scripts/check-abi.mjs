#!/usr/bin/env node
/**
 * ABI 契约检查：`abi/export-surface.json` ↔ `src/abi.rs` ↔ `types/chips-native.d.ts`。
 *
 * 判定：
 * 1. Rust 导出表与清单 `exports` 名称与顺序逐项一致（未登记函数不得注册）；
 * 2. 类型声明文件的函数面与清单 `exports` 完全一致（不得声明未注册函数）；
 * 3. 清单 `blocked` 项必须引用真实存在的工单目录（问题工单 工单NNN-*）；
 * 4. 每个导出项含 `kind`（sync/async）与非空 `signature`。
 *
 * 退出码：0 通过；1 失败。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');
const projectRoot = path.resolve(workspaceRoot, '..');

const surfacePath = path.join(packageRoot, 'abi', 'export-surface.json');
const abiSourcePath = path.join(packageRoot, 'src', 'abi.rs');
const declarationPath = path.join(packageRoot, 'types', 'chips-native.d.ts');

/** @param {string} message */
function fail(message) {
  console.error(`[check-abi] ${message}`);
  process.exitCode = 1;
}

/** @param {string} file @returns {string} */
function readText(file) {
  if (!fs.existsSync(file)) {
    fail(`文件不存在：${path.relative(workspaceRoot, file)}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

/** @param {string} source @returns {string[]} */
function parseRustExportNames(source) {
  const table = source.match(/export_table!\s*\{([\s\S]*?)\n\}/);
  if (!table) {
    fail('src/abi.rs 中找不到 export_table! 块');
    return [];
  }
  const names = [];
  for (const line of table[1].split('\n')) {
    const match = line.match(/^\s*"([A-Za-z][A-Za-z0-9]*)"\s*=>/);
    if (match) {
      names.push(match[1]);
    }
  }
  return names;
}

/** @param {string} source @returns {string[]} */
function parseDeclarationNames(source) {
  const names = [];
  for (const match of source.matchAll(/^export function ([A-Za-z][A-Za-z0-9]*)\s*\(/gm)) {
    names.push(match[1]);
  }
  return names;
}

/** @param {string[]} actual @param {string[]} expected @param {string} label */
function assertSameNames(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    fail(`${label}与清单不一致：\n  实际：${actual.join(', ')}\n  清单：${expected.join(', ')}`);
  }
}

/** @param {string} ticket @returns {boolean} */
function ticketDirectoryExists(ticket) {
  const ticketRoot = path.join(projectRoot, '项目日志与笔记');
  if (!fs.existsSync(ticketRoot)) {
    return false;
  }
  return fs
    .readdirSync(ticketRoot)
    .some(
      (entry) => entry.startsWith(ticket) && fs.statSync(path.join(ticketRoot, entry)).isDirectory()
    );
}

const surface = JSON.parse(readText(surfacePath));
const exportNames = surface.exports.map((entry) => entry.name);
const rustNames = parseRustExportNames(readText(abiSourcePath));
assertSameNames(rustNames, exportNames, 'Rust 导出表');

const declarationNames = parseDeclarationNames(readText(declarationPath));
assertSameNames(declarationNames, exportNames, '类型声明');

for (const entry of surface.exports) {
  if (entry.kind !== 'sync' && entry.kind !== 'async') {
    fail(`导出项 kind 非法：${entry.name} → ${entry.kind}`);
  }
  if (typeof entry.signature !== 'string' || entry.signature.length === 0) {
    fail(`导出项缺少 signature：${entry.name}`);
  }
}

for (const entry of surface.blocked ?? []) {
  if (typeof entry.ticket !== 'string' || entry.ticket.length === 0) {
    fail(`阻塞项未引用工单：${entry.name}`);
    continue;
  }
  if (!ticketDirectoryExists(entry.ticket)) {
    fail(`阻塞项引用的工单目录不存在：${entry.name} → ${entry.ticket}`);
  }
  if (exportNames.includes(entry.name)) {
    fail(`阻塞项同时出现在已实现导出中：${entry.name}`);
  }
}

if (process.exitCode) {
  console.error('[check-abi] 失败：ABI 契约不一致');
} else {
  console.warn(
    `[check-abi] 通过：导出 ${exportNames.length} 项，阻塞 ${(surface.blocked ?? []).length} 项`
  );
}
