/**
 * 契约测试包的路径定位：全部路径从本文件位置推导，不依赖进程工作目录。
 *
 * 目录关系：`chips-ecosystem/tests/contract/src` → 包根 `tests/contract`
 * → 工作区根 `chips-ecosystem` → 仓库根（含 `薯片生态文档库/`）。
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

/** `chips-ecosystem/tests/contract/`。 */
export const PACKAGE_ROOT = path.resolve(thisDir, '..');

/** `chips-ecosystem/`。 */
export const WORKSPACE_ROOT = path.resolve(PACKAGE_ROOT, '../..');

/** 仓库根（含 `薯片生态文档库/` 与 `重构大计划/`）。 */
export const REPO_ROOT = path.resolve(WORKSPACE_ROOT, '..');

/** 文档库根：单一事实源。 */
export const DOCS_ROOT = path.join(REPO_ROOT, '薯片生态文档库');

/** 快照目录（随包提交，供差异评审）。 */
export const SNAPSHOTS_DIR = path.join(PACKAGE_ROOT, 'snapshots');

/** 契约测试报告目录（G8：输出到 `reports/contract/`，不入库）。 */
export const REPORTS_DIR = path.join(WORKSPACE_ROOT, 'reports/contract');

/** 以工作区根为基准的展示路径。 */
export function workspaceRelative(absolutePath: string): string {
  return path.relative(WORKSPACE_ROOT, absolutePath).split(path.sep).join('/');
}

/** 以仓库根为基准的展示路径。 */
export function repoRelative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}
