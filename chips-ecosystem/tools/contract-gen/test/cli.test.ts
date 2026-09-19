import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli } from '../src/cli.js';
import { DEFAULT_DOCS_ROOT } from '../src/sources.js';

interface ConsoleCapture {
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly restore: () => void;
}

function captureConsole(): ConsoleCapture {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  let stdout = '';
  let stderr = '';
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  return {
    stdout: () => stdout,
    stderr: () => stderr,
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    },
  };
}

describe('runCli', () => {
  let workDir: string;
  let capture: ConsoleCapture;

  beforeEach(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'contract-gen-cli-'));
    capture = captureConsole();
  });

  afterEach(() => {
    capture.restore();
    rmSync(workDir, { recursive: true, force: true });
  });

  it('--help 输出用法并以 0 退出', () => {
    expect(runCli(['--help'])).toBe(0);
    expect(capture.stdout()).toContain('chips-contract-gen');
  });

  it('缺少命令时输出用法并以 0 退出', () => {
    expect(runCli([])).toBe(0);
    expect(capture.stdout()).toContain('generate|check|validate');
  });

  it('未知命令以 2 退出', () => {
    expect(runCli(['unknown'])).toBe(2);
    expect(capture.stderr()).toContain('未知命令');
  });

  it('未知参数以 2 退出', () => {
    expect(runCli(['validate', '--bogus'])).toBe(2);
    expect(capture.stderr()).toContain('未知参数');
  });

  it('validate 对真实文档库通过', () => {
    expect(runCli(['validate', '--docs-root', DEFAULT_DOCS_ROOT])).toBe(0);
    expect(capture.stdout()).toContain('契约解析校验通过');
  });

  it('docs-root 不存在时以 1 退出并报错', () => {
    expect(runCli(['validate', '--docs-root', path.join(workDir, 'absent')])).toBe(1);
    expect(capture.stderr()).toContain('读取文档失败');
  });

  it('generate 写出生成物且重复执行幂等', () => {
    const outDir = path.join(workDir, 'generated');
    expect(runCli(['generate', '--out-dir', outDir])).toBe(0);
    expect(capture.stdout()).toContain('写入 6 个文件');
    const first = readFileSync(path.join(outDir, 'capability-ids.ts'), 'utf8');
    expect(runCli(['generate', '--out-dir', outDir])).toBe(0);
    expect(capture.stdout()).toContain('写入 0 个文件');
    expect(readFileSync(path.join(outDir, 'capability-ids.ts'), 'utf8')).toBe(first);
  });

  it('check 对已生成产物通过、被手写篡改后以 1 退出', () => {
    const outDir = path.join(workDir, 'generated');
    expect(runCli(['generate', '--out-dir', outDir])).toBe(0);
    expect(runCli(['check', '--out-dir', outDir])).toBe(0);
    writeFileSync(path.join(outDir, 'event-ids.ts'), '// 手写覆盖\n', 'utf8');
    expect(runCli(['check', '--out-dir', outDir])).toBe(1);
    expect(capture.stderr()).toContain('generated-stale');
  });
});
