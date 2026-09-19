import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildContract,
  checkContract,
  generateContract,
  writeContractFiles,
} from '../src/generate.js';
import { createMemoryReader, fixtureDocs, fixtureSources } from './fixtures.js';

import type { DocReader } from '../src/types.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'contract-gen-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function fixtureReader(overrides: Readonly<Record<string, string>> = {}): DocReader {
  return createMemoryReader({ ...fixtureDocs, ...overrides });
}

describe('契约生成流水线', () => {
  it('样例文档构建通过且写出全部文件', () => {
    const build = buildContract({ reader: fixtureReader(), sources: fixtureSources });
    expect(build.issues).toEqual([]);
    const result = writeContractFiles(build.files, workDir);
    expect(result.written).toHaveLength(6);
    expect(result.unchanged).toEqual([]);
  });

  it('重复生成字节一致且第二次写入全部未变化（幂等）', () => {
    const { build, result } = generateContract({
      reader: fixtureReader(),
      sources: fixtureSources,
      outDir: workDir,
    });
    expect(result.written).toHaveLength(6);

    const second = generateContract({
      reader: fixtureReader(),
      sources: fixtureSources,
      outDir: workDir,
    });
    expect(second.result.written).toEqual([]);
    expect(second.result.unchanged).toHaveLength(6);

    for (const file of build.files) {
      const onDisk = readFileSync(path.join(workDir, file.path), 'utf8');
      const regenerated = second.build.files.find((candidate) => candidate.path === file.path);
      expect(onDisk).toBe(file.content);
      expect(regenerated?.content).toBe(file.content);
    }
  });

  it('check 对已写产物通过', () => {
    generateContract({ reader: fixtureReader(), sources: fixtureSources, outDir: workDir });
    const result = checkContract({
      reader: fixtureReader(),
      sources: fixtureSources,
      outDir: workDir,
    });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('文档漂移时 check 失败并给出计数问题', () => {
    generateContract({ reader: fixtureReader(), sources: fixtureSources, outDir: workDir });
    const result = checkContract({
      reader: fixtureReader({
        'capability.md': fixtureDocs['capability.md']?.replace('6 项计数', '7 项计数') ?? '',
      }),
      sources: fixtureSources,
      outDir: workDir,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toContain('capability-count');
  });

  it('生成物被手写篡改时 check 报 stale', () => {
    generateContract({ reader: fixtureReader(), sources: fixtureSources, outDir: workDir });
    writeFileSync(path.join(workDir, 'capability-ids.ts'), '// 手写覆盖\n', 'utf8');
    const result = checkContract({
      reader: fixtureReader(),
      sources: fixtureSources,
      outDir: workDir,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toContain('generated-stale');
  });

  it('生成目录出现未登记 TS 文件时 check 报 extra', () => {
    generateContract({ reader: fixtureReader(), sources: fixtureSources, outDir: workDir });
    writeFileSync(path.join(workDir, 'handwritten.ts'), '// 手写常量\n', 'utf8');
    const result = checkContract({
      reader: fixtureReader(),
      sources: fixtureSources,
      outDir: workDir,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toContain('generated-extra');
  });

  it('生成目录缺失时 check 报 missing', () => {
    mkdirSync(path.join(workDir, 'nested'), { recursive: true });
    const result = checkContract({
      reader: fixtureReader(),
      sources: fixtureSources,
      outDir: path.join(workDir, 'nested', 'absent'),
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toContain('generated-missing');
  });

  it('校验不通过时拒绝写盘', () => {
    expect(() =>
      generateContract({
        reader: fixtureReader({
          'capability.md': fixtureDocs['capability.md']?.replace('6 项计数', '9 项计数') ?? '',
        }),
        sources: fixtureSources,
        outDir: workDir,
      })
    ).toThrow(/契约校验未通过/);
  });
});
