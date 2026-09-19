import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const testsDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(testsDir, '..');
const workspaceRoot = resolve(packageDir, '..', '..');
const scriptPath = join(packageDir, 'scripts', 'check-boundary.mjs');

const tempDirs: string[] = [];

interface CheckResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function runChecker(root: string): CheckResult {
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

function writeFixtureFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), 'chips-antd-boundary-'));
  tempDirs.push(fixture);
  writeFixtureFile(
    join(fixture, 'package.json'),
    JSON.stringify({ name: 'boundary-fixture', private: true }, null, 2)
  );
  writeFixtureFile(
    join(fixture, 'packages', 'antd', 'package.json'),
    readFileSync(join(packageDir, 'package.json'), 'utf8')
  );
  return fixture;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('依赖边界门禁 check-boundary.mjs', () => {
  it('真实工作区通过：@chips/antd 仅 packages/ui 可用、fork 无 @chips/* 依赖', () => {
    const result = runChecker(workspaceRoot);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('依赖边界检查通过');
  });

  it('插件声明或导入 @chips/antd 被判违规', () => {
    const fixture = createFixture();
    writeFixtureFile(
      join(fixture, 'packages', 'plugin-demo', 'package.json'),
      JSON.stringify(
        { name: '@chips/plugin-demo', dependencies: { '@chips/antd': 'workspace:*' } },
        null,
        2
      )
    );
    writeFixtureFile(
      join(fixture, 'packages', 'plugin-demo', 'src', 'index.ts'),
      "import { Button } from '@chips/antd';\n"
    );

    const result = runChecker(fixture);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('仅允许 packages/ui');
    expect(result.stderr).toContain('声明了 @chips/antd 依赖');
  });

  it('packages/ui 声明并导入 @chips/antd 合法', () => {
    const fixture = createFixture();
    writeFixtureFile(
      join(fixture, 'packages', 'ui', 'package.json'),
      JSON.stringify({ name: '@chips/ui', dependencies: { '@chips/antd': 'workspace:*' } }, null, 2)
    );
    writeFixtureFile(
      join(fixture, 'packages', 'ui', 'src', 'index.ts'),
      "export { Button } from '@chips/antd';\n"
    );

    const result = runChecker(fixture);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('依赖边界检查通过');
  });

  it('fork 之外的包导入 antd 被判违规', () => {
    const fixture = createFixture();
    writeFixtureFile(
      join(fixture, 'plugins', 'viewer', 'src', 'ui.tsx'),
      "import { Button } from 'antd';\n"
    );

    const result = runChecker(fixture);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('antd 仅允许 packages/antd 内部使用');
  });
});
