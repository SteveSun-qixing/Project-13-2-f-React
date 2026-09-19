import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const testsDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(testsDir, '..');
const workspaceRoot = resolve(packageDir, '..', '..');
const scriptPath = join(packageDir, 'scripts', 'verify-patches.mjs');

const tempDirs: string[] = [];

interface CheckResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function runVerifier(root: string): CheckResult {
  try {
    const stdout = execFileSync('node', [scriptPath, '--root', root], { encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? -1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('补丁栈门禁 verify-patches.mjs', () => {
  it('台账、补丁文件、pnpm 登记与已安装上游包一致', () => {
    const result = runVerifier(workspaceRoot);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('补丁栈校验通过');
    expect(result.stdout).toContain('antd@6.6.4');
  });

  it('pnpm 未登记补丁时校验失败', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'chips-antd-patches-'));
    tempDirs.push(fixture);
    mkdirSync(fixture, { recursive: true });
    writeFileSync(
      join(fixture, 'package.json'),
      JSON.stringify({ name: 'patches-fixture', private: true })
    );

    const result = runVerifier(fixture);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('未登记到 pnpm.patchedDependencies');
  });

  it('缺少工作区根清单时以用法错误退出', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'chips-antd-patches-empty-'));
    tempDirs.push(fixture);

    const result = runVerifier(fixture);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('工作区根 package.json 不存在');
  });
});
