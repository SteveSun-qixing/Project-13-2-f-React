import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli } from '../src/cli.js';
import { DEFAULT_DOCS_ROOT } from '../src/sources.js';

interface ConsoleCapture {
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly restore: () => void;
}

/**
 * 捕获 `process.stdout` / `process.stderr` 写入。
 *
 * @remarks 以 `vi.spyOn` 接管写口：`write` 继承自 `Writable.prototype`，`mockRestore` 会删除自有
 * 属性并还原原型实现（不 detach 方法引用，避免 `this` 绑定漂移）。
 */
function captureConsole(): ConsoleCapture {
  let stdout = '';
  let stderr = '';
  const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
    stdout += chunk.toString();
    return true;
  });
  const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
    stderr += chunk.toString();
    return true;
  });
  return {
    stdout: () => stdout,
    stderr: () => stderr,
    restore: () => {
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
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
