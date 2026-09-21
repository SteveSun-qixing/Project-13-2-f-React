/**
 * cpk 夹具链契约守卫（G8）：对 `tests/e2e/fixtures/cpk` 的在用夹具执行
 * 重建链逐字节比对与五阶段校验矩阵（经 `@chips/cli` 正式 pack/validate 链路，
 * 《03-插件包格式》§六/§八、《07-CLI完整参考》§3.5.2/§3.5.3）；
 * 并锁定重建关键区与 `package` 脚本链的共锁互斥协议与 pack 前同族残留清理时序
 * （闸链幂等回归锁，全部离线断言，零串扰真实锁目录）。
 *
 * 判定委托给夹具生成器自身的 `--check`（生成与校验同源，单一事实回路）：
 * 任何 `packages/*.cpk`、`checklist.json` 与生成链产物的漂移都会在此显红。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const generatorPath = fileURLToPath(
  new URL('../../e2e/fixtures/cpk/generate-cpk-fixtures.mjs', import.meta.url)
);
const siblingCliBinTestPath = fileURLToPath(
  new URL('./cli-bin-resolution.test.ts', import.meta.url)
);

/** 同步休眠（Atomics 超时等待，不引入异步调度）。 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

describe('cpk 夹具链（装载器与插件链 E2E 在用输入）', () => {
  it('生成器入口存在（fixtures/cpk 资产完整）', () => {
    expect(existsSync(generatorPath)).toBe(true);
  });

  it('--check：重建链逐字节一致且五阶段校验矩阵（1 正 3 负）符合期望', () => {
    const result = spawnSync(process.execPath, [generatorPath, '--check'], {
      encoding: 'utf8',
      timeout: 180_000,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('五阶段校验矩阵（1 正 3 负）全部符合期望');
  }, 200_000);
});

/**
 * 驱动脚本：在纯净 node 进程里导入生成器模块（主流程带直接执行守卫，导入不触发重建），
 * 按 mode 断言锁原语导出、残锁接管、活持有者互斥与残留清理范围。互斥场景一律使用
 * 调用方注入的独立临时锁目录（`CHIPS_LOCK_DIR`），绝不复用真实 `package` 链锁目录，
 * 保证与并发执行面零串扰。
 */
const LOCK_DRIVER = [
  "import { spawn, spawnSync } from 'node:child_process';",
  "import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';",
  "import path from 'node:path';",
  "import { tmpdir } from 'node:os';",
  '',
  'const gen = await import(process.env.CHIPS_GEN_URL);',
  'const mode = process.argv[1];',
  'const out = (value) => {',
  '  console.log(JSON.stringify(value));',
  '};',
  'const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);',
  '',
  "if (mode === 'export-check') {",
  '  out({',
  '    lockBase: path.basename(gen.PACKAGE_CHAIN_LOCK_DIR),',
  "    hasLock: typeof gen.withPackageChainLock === 'function',",
  "    hasCleanup: typeof gen.removeFamilyPackResidue === 'function',",
  '    pluginDirBase: path.basename(gen.HELLO_PLUGIN_DIR),',
  '  });',
  "} else if (mode === 'stale-takeover') {",
  '  const lockDir = process.env.CHIPS_LOCK_DIR;',
  "  const dead = spawnSync(process.execPath, ['-e', '']);",
  '  mkdirSync(lockDir);',
  "  writeFileSync(path.join(lockDir, 'owner'), String(dead.pid));",
  '  const started = Date.now();',
  "  const value = gen.withPackageChainLock(() => 'body-ran', { lockDir, timeoutMs: 5000 });",
  '  out({ value, waitedMs: Date.now() - started, released: !existsSync(lockDir) });',
  "} else if (mode === 'contended') {",
  '  const lockDir = process.env.CHIPS_LOCK_DIR;',
  '  const releaseFile = process.env.CHIPS_RELEASE_FILE;',
  '  const holderCode = [',
  '    "import { existsSync, mkdirSync, rmSync, writeFileSync } from \'node:fs\';",',
  "    'const lockDir = process.env.CHIPS_LOCK_DIR;',",
  "    'const releaseFile = process.env.CHIPS_RELEASE_FILE;',",
  "    'mkdirSync(lockDir);',",
  '    \'writeFileSync(lockDir + \\"/owner\\", String(process.pid));\',',
  "    'const deadline = Date.now() + 15000;',",
  "    'while (Date.now() < deadline && !existsSync(releaseFile)) {',",
  "    '  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);',",
  "    '}',",
  "    'rmSync(lockDir, { recursive: true, force: true });',",
  "  ].join('\\n');",
  "  const holder = spawn(process.execPath, ['--input-type=module', '-e', holderCode], {",
  '    detached: true,',
  "    stdio: 'ignore',",
  '    env: { ...process.env, CHIPS_LOCK_DIR: lockDir, CHIPS_RELEASE_FILE: releaseFile },',
  '  });',
  '  holder.unref();',
  '  let visible = false;',
  '  for (let waited = 0; waited < 5000; waited += 100) {',
  '    if (existsSync(lockDir)) {',
  '      visible = true;',
  '      break;',
  '    }',
  '    sleepSync(100);',
  '  }',
  '  if (!visible) {',
  "    holder.kill('SIGKILL');",
  "    out({ error: 'holder-did-not-acquire' });",
  '    process.exitCode = 3;',
  '  } else {',
  '    let threw = false;',
  "    let message = '';",
  '    let ran = false;',
  '    try {',
  "      ran = gen.withPackageChainLock(() => 'should-not-run', { lockDir, timeoutMs: 700 }) ===",
  "        'should-not-run';",
  '    } catch (error) {',
  '      threw = true;',
  '      message = error.message;',
  '    }',
  '    out({ threw, ran, message, lockStillHeld: existsSync(lockDir) });',
  "    writeFileSync(releaseFile, 'release');",
  '  }',
  "} else if (mode === 'cleanup-scope') {",
  "  const root = mkdtempSync(path.join(tmpdir(), 'chips-contract-residue-'));",
  "  const pluginDir = path.join(root, 'demo');",
  '  const files = [',
  "    'dist/index.js',",
  "    'dist/demo-0.1.0.cpk',",
  "    'dist/demo-0.9.9.cpk',",
  "    'dist/demo-notes.cpk',",
  "    'dist/demo-1.0.0.zip',",
  "    'dist/foreign-1.0.0.cpk',",
  "    'dist/sub/demo-2.0.0.cpk',",
  "    'render.js',",
  '  ];',
  '  for (const rel of files) {',
  '    const abs = path.join(pluginDir, rel);',
  '    mkdirSync(path.dirname(abs), { recursive: true });',
  "    writeFileSync(abs, 'x');",
  '  }',
  '  const removed = gen.removeFamilyPackResidue(pluginDir);',
  '  const rest = [];',
  '  const walk = (dir) => {',
  '    for (const entry of readdirSync(dir, { withFileTypes: true })) {',
  '      if (entry.isDirectory()) {',
  '        walk(path.join(dir, entry.name));',
  '      } else {',
  '        rest.push(path.relative(pluginDir, path.join(dir, entry.name)));',
  '      }',
  '    }',
  '  };',
  '  walk(pluginDir);',
  '  rmSync(root, { recursive: true, force: true });',
  '  out({ removed, rest: rest.sort() });',
  '} else {',
  "  out({ error: 'unknown-mode' });",
  '  process.exitCode = 2;',
  '}',
].join('\n');

interface IDriverResult {
  status: number | null;
  json: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
}

function runLockDriver(mode: string, extraEnv: Record<string, string> = {}): IDriverResult {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', LOCK_DRIVER, mode], {
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, CHIPS_GEN_URL: pathToFileURL(generatorPath).href, ...extraEnv },
  });
  const lines = (result.stdout ?? '')
    .trim()
    .split('\n')
    .filter((line) => line.length > 0);
  let json: Record<string, unknown> | null = null;
  const last = lines[lines.length - 1];
  if (last !== undefined) {
    try {
      json = JSON.parse(last) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }
  return { status: result.status, json, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** 每个用例独享的临时锁目录（绝不触碰真实 package 链锁目录，零执行面串扰）。 */
function scopedLockPath(label: string): string {
  return path.join(
    tmpdir(),
    `chips-contract-${label}-${String(process.pid)}-${String(Math.floor(Math.random() * 1_000_000))}.lock`
  );
}

describe('cpk 重建关键区互斥与清理时序（闸链幂等回归锁）', () => {
  it('生成器导出锁原语；锁目录与 package 脚本链用例登记同源', () => {
    const driven = runLockDriver('export-check');
    expect(driven.status, `${driven.stdout}\n${driven.stderr}`).toBe(0);
    expect(driven.json).toEqual({
      lockBase: 'chips-contract-hello-package.lock',
      hasLock: true,
      hasCleanup: true,
      pluginDirBase: 'hello',
    });
    // 协议绑定：两侧锁目录名必须一致（任一侧改协议必须两侧同步）。
    expect(readFileSync(siblingCliBinTestPath, 'utf8')).toContain(
      'chips-contract-hello-package.lock'
    );
  });

  it('残锁（持有者已退出）即时接管，临界区结束即释放', () => {
    const lockDir = scopedLockPath('stale');
    try {
      const driven = runLockDriver('stale-takeover', { CHIPS_LOCK_DIR: lockDir });
      expect(driven.status, `${driven.stdout}\n${driven.stderr}`).toBe(0);
      expect(driven.json).toMatchObject({ value: 'body-ran', released: true });
      // 接管路径不经历等待轮询：预算内即时成功。
      expect(Number(driven.json?.waitedMs)).toBeLessThan(3000);
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
    }
  });

  it('活持有者互斥：超等待预算显式报错、不强闯临界区、不动他人锁', () => {
    const lockDir = scopedLockPath('contend');
    const releaseFile = `${lockDir}.release`;
    try {
      const driven = runLockDriver('contended', {
        CHIPS_LOCK_DIR: lockDir,
        CHIPS_RELEASE_FILE: releaseFile,
      });
      expect(driven.status, `${driven.stdout}\n${driven.stderr}`).toBe(0);
      expect(driven.json).toMatchObject({ threw: true, ran: false, lockStillHeld: true });
      expect(String(driven.json?.message)).toContain('互斥锁超时');
      // 驱动退出后持有者收到放行标记，自行清锁退出。
      let released = false;
      for (let waited = 0; waited < 10_000; waited += 100) {
        if (!existsSync(lockDir)) {
          released = true;
          break;
        }
        sleepSync(100);
      }
      expect(released, `持有者未清锁：${lockDir}`).toBe(true);
    } finally {
      rmSync(lockDir, { recursive: true, force: true });
      rmSync(releaseFile, { force: true });
    }
  });

  it('残留清理只删 dist 顶层本包同族 .cpk，外来/嵌套/非归档残留留给守卫与输入面', () => {
    const driven = runLockDriver('cleanup-scope');
    expect(driven.status, `${driven.stdout}\n${driven.stderr}`).toBe(0);
    expect(driven.json).toEqual({
      removed: 3,
      rest: [
        'dist/demo-1.0.0.zip',
        'dist/foreign-1.0.0.cpk',
        'dist/index.js',
        'dist/sub/demo-2.0.0.cpk',
        'render.js',
      ],
    });
  });
});
