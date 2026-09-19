import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { emitContract } from './emit.js';
import { parseContract } from './parse.js';
import type {
  ContractBuild,
  ContractSources,
  DocReader,
  GeneratedFile,
  ValidationIssue,
} from './types.js';
import { validateContract } from './validate.js';

export interface BuildOptions {
  readonly reader: DocReader;
  readonly sources: ContractSources;
}

/** 解析 → 校验 → 渲染。 */
export function buildContract(options: BuildOptions): ContractBuild {
  const parsed = parseContract(options.reader, options.sources);
  const issues = validateContract(parsed);
  const model = {
    capabilities: parsed.capabilities,
    permissions: parsed.permissions,
    events: parsed.events,
    errorCodes: parsed.errorCodes,
    facts: parsed.facts,
    sources: parsed.sources,
  };
  return { model, issues, files: emitContract(model) };
}

export interface WriteResult {
  readonly written: readonly string[];
  readonly unchanged: readonly string[];
}

/** 写出生成物；内容一致的文件不重写。 */
export function writeContractFiles(files: readonly GeneratedFile[], outDir: string): WriteResult {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const unchanged: string[] = [];
  for (const file of files) {
    const target = path.join(outDir, file.path);
    let current: string | null = null;
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = null;
    }
    if (current === file.content) {
      unchanged.push(file.path);
      continue;
    }
    writeFileSync(target, file.content, 'utf8');
    written.push(file.path);
  }
  return { written, unchanged };
}

function firstDifference(expected: string, actual: string): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const limit = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < limit; index += 1) {
    const left = expectedLines[index];
    const right = actualLines[index];
    if (left !== right) {
      return `第 ${index + 1} 行不一致（期望 ${JSON.stringify(left ?? null)}，实际 ${JSON.stringify(right ?? null)}）`;
    }
  }
  return '内容不一致';
}

export interface CheckResult {
  readonly build: ContractBuild;
  readonly issues: readonly ValidationIssue[];
  readonly ok: boolean;
}

/** 门禁校验：解析校验 + 生成物与磁盘逐字节比对 + 生成目录额外文件检查。 */
export function checkContract(options: BuildOptions & { readonly outDir: string }): CheckResult {
  const build = buildContract(options);
  const issues: ValidationIssue[] = [...build.issues];

  let diskFiles: readonly string[] = [];
  try {
    diskFiles = readdirSync(options.outDir);
  } catch {
    issues.push({ rule: 'generated-missing', message: `生成目录不存在：${options.outDir}` });
  }

  for (const file of build.files) {
    const target = path.join(options.outDir, file.path);
    let content = '';
    try {
      content = readFileSync(target, 'utf8');
    } catch {
      issues.push({ rule: 'generated-missing', message: `缺少生成物：${file.path}` });
      continue;
    }
    if (content !== file.content) {
      issues.push({
        rule: 'generated-stale',
        message: `生成物与文档库不一致：${file.path}（${firstDifference(file.content, content)}）`,
      });
    }
  }

  const expected = new Set(build.files.map((file) => file.path));
  for (const name of diskFiles) {
    if (name.endsWith('.ts') && !expected.has(name)) {
      issues.push({
        rule: 'generated-extra',
        message: `生成目录出现未登记的文件（生成目录禁止手写）：${name}`,
      });
    }
  }

  return { build, issues, ok: issues.length === 0 };
}

/** 生成并写盘，返回写入结果与构建结果。 */
export function generateContract(options: BuildOptions & { readonly outDir: string }): {
  readonly build: ContractBuild;
  readonly result: WriteResult;
} {
  const build = buildContract(options);
  if (build.issues.length > 0) {
    throw new Error(
      `契约校验未通过，禁止写盘：\n${build.issues.map((issue) => `[${issue.rule}] ${issue.message}`).join('\n')}`
    );
  }
  const result = writeContractFiles(build.files, options.outDir);
  return { build, result };
}
