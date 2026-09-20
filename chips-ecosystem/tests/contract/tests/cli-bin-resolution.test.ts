/**
 * 插件脚本链 bin 解析锚点守卫（工单020 缺陷①，G8）：
 * `pnpm exec chips` 必须解析到**当前工作区**的 `@chips/cli`（根 `node_modules/.bin`），
 * 不得静默漂移到全局安装的同名陈旧 bin；并登记 `package` 脚本链端到端用例
 * （`pnpm --filter @chips/plugin-hello run package` → 产物经正式引擎 validate 通过）。
 *
 * 《07-CLI完整参考》§3.5.2/§3.5.3、RFC-CLI信任根注入面 §四.5。用例自清理：
 * 产出的 `dist/hello-0.1.0.cpk` 用后即删，不留工作区脏产物、不触碰夹具链。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const helloDir = `${repoRoot}examples/plugins/hello`;
const cliEntry = `${repoRoot}packages/cli/dist/bin.js`;
const packedArchive = `${helloDir}/dist/hello-0.1.0.cpk`;

/** 记录需要兜底清理的产物路径。 */
const producedArtifacts: string[] = [];

afterAll(() => {
  for (const path of producedArtifacts) {
    rmSync(path, { force: true });
  }
});

/** 同步休眠（Atomics 超时等待，不引入异步调度）。 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** 持有者进程是否存活（`kill` 信号 0 探测；ESRCH 即已退出）。 */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

/**
 * `package` 脚本链互斥锁（跨进程）：`pnpm -r test:contract` 会让
 * `@chips/contract-tests` 同时经受控直跑与 `packages/bridge` 转发两条执行面并发运行本套件，
 * 双方都会在同一绝对路径 pack/清理产物；嵌套归档拒绝是既有校验强度，因此并发写同一
 * 产物属执行面串扰而非产品缺陷。这里以原子 `mkdir` 建锁串行化临界区；
 * 残锁接管双保险——持有者进程已退出（worker 被超时终止后进程不复存在）或锁龄超 3 分钟即接管。
 * 等待预算必须小于本用例显式超时（见 `it` 第三参数），保证被终止的等待者不会留下二次残锁。
 */
function withPackageChainLock<T>(body: () => T): T {
  const lockDir = `${tmpdir()}/chips-contract-hello-package.lock`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      mkdirSync(lockDir);
      writeFileSync(`${lockDir}/owner`, String(process.pid));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      let takeover = false;
      try {
        const ownerPid = Number(readFileSync(`${lockDir}/owner`, 'utf8').trim());
        const staleMs = Date.now() - statSync(lockDir).mtimeMs;
        takeover =
          (Number.isInteger(ownerPid) && ownerPid > 0 && !pidAlive(ownerPid)) || staleMs > 180_000;
      } catch {
        takeover = true; // 锁目录/owner 文件读失败：视为残锁。
      }
      if (takeover) {
        rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(`等待 package 脚本链互斥锁超时（持有者见 ${lockDir}/owner）：${lockDir}`);
      }
      sleepSync(200);
    }
  }
  try {
    return body();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

function run(
  command: string,
  args: readonly string[],
  cwd: string
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(command, [...args], { cwd, encoding: 'utf8', timeout: 180_000 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('工作区 bin 锚点与 package 脚本链', () => {
  it('pnpm exec chips 在插件子包内解析到当前工作区 bin（无 PATH 静默回退）', () => {
    const which = run('pnpm', ['exec', 'which', 'chips'], helloDir);
    expect(which.status, `${which.stdout}\n${which.stderr}`).toBe(0);
    const resolved = which.stdout.trim();
    expect(resolved.startsWith(repoRoot), `解析到工作区之外：${resolved}`).toBe(true);
    expect(resolved.endsWith('node_modules/.bin/chips')).toBe(true);
  });

  it('pnpm exec chips --version 与当前工作区 CLI 构建产物同源', () => {
    expect(existsSync(cliEntry), `请先构建 @chips/cli：${cliEntry}`).toBe(true);
    const workspace = run('pnpm', ['exec', 'chips', '--version'], helloDir);
    expect(workspace.status, workspace.stderr).toBe(0);
    const direct = run(process.execPath, [cliEntry, '--version'], helloDir);
    expect(direct.status, direct.stderr).toBe(0);
    expect(workspace.stdout).toBe(direct.stdout);
    // 漂移守卫：全局陈旧 bin（若存在）不得成为解析结果——与直接执行工作区入口逐字节一致即为锚定。
    expect(workspace.stdout.trim().length).toBeGreaterThan(0);
  });

  // 显式超时须大于互斥锁等待预算（90s）+ 冷载 pack/validate 用时，
  // 避免 vitest 默认 30s 超时在临界区内终止持有者进程制造残锁。
  it('package 脚本链端到端：pack 产物通过正式引擎 validate（EXIT=0）', () => {
    withPackageChainLock(() => {
      // 旧产物先清理（嵌套归档拒算是既有校验强度，见 RFC §六.2）。
      rmSync(packedArchive, { force: true });
      producedArtifacts.push(packedArchive);

      const packed = run('pnpm', ['--filter', '@chips/plugin-hello', 'run', 'package'], repoRoot);
      expect(packed.status, `${packed.stdout}\n${packed.stderr}`).toBe(0);
      expect(existsSync(packedArchive)).toBe(true);

      const validated = run('node', [cliEntry, 'plugin', 'validate', packedArchive], repoRoot);
      expect(validated.status, `${validated.stdout}\n${validated.stderr}`).toBe(0);
      expect(validated.stdout).toContain('结果: valid');

      rmSync(packedArchive, { force: true });
      expect(existsSync(packedArchive)).toBe(false);
    });
  }, 240_000);
});
