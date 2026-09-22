/**
 * 正式应用窗口冒烟闸（金链路刀4 / 任务 #100；判据承接 #79 壳自检冒烟闸）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、
 * `06-开发与运维/03-测试规范` 冒烟闸口径。
 *
 * @remarks
 * - 默认跳过（`npx vitest run` 不拉真实窗口）；`pnpm smoke:app` 以
 *   `CHIPS_HOST_SMOKE=1` 启用本套件：spawn 真实 Electron 运行时装载 `dist/main/app.js`，
 *   经启动参数 `--chips-open-card` 真实驱动卡片窗口编排。
 * - 判据逐项：①构建产物齐备；②壳窗口存活观察窗内进程不死；③stderr 零字节；
 *   ④输出无 `HOST_STARTUP_FAILED`；⑤`SIGTERM` 优雅收口退出码 0。
 * - 不新增任何测试依赖：`node:child_process` + Electron 本体。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SMOKE_ENABLED = process.env.CHIPS_HOST_SMOKE === '1';
const describeSmoke = SMOKE_ENABLED ? describe : describe.skip;

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appEntry = join(packageRoot, 'dist/main/app.js');

/** 壳窗口存活观察窗（毫秒）：覆盖真实 Electron 启动 + 壳窗口与卡片窗口装载。 */
const ALIVE_WINDOW_MS = 5_000;

/** SIGTERM 后优雅收口上限。 */
const TERM_EXIT_MS = 15_000;

/** 冒烟卡片来源引用（语法合法的 managed scope URI；文档数据面按冻结契约不进 stderr）。 */
const SMOKE_CARD_SOURCE = 'chips-resource://platform/documents/smoke.card';

/**
 * 并行路在途豁免臂（当前事实基线，登记任务 #196 F4 口径翻正——原判据出处 #99 已随刀4a
 * 收口，豁免臂存续成因翻正为在册实况）：`document:*` 组合根诚实回退警告
 * （`document-capability` 未装载诊断）在工单 036 收口（§11.3 Neon 暴露面尚无文档
 * scope/storage 端口载体，正式适配器未接线，组合根生产通道恒缺省）前每次生产组合根
 * 启动各出现一次。除该固定前缀行外 stderr 仍必须逐字节为零；豁免行计数超过 1 或出现
 * 任何非豁免内容即红。臂退役判定：退役条件 = 工单 036 收口（W3 计划 §三.P2「app-smoke
 * 豁免臂退役」），该前置未达成，本波如实维持不强行退役；工单 036 收口波删除本臂并
 * 恢复零字节严格判据（禁删除纪律走就近归档）。登记见开发日志（刀4b 合缝点、#196 段三宿主波）。
 */
const IN_FLIGHT_STDERR_PREFIX = '[chips-host:warn] [document-capability] document:* 未装载';

function splitExempt(stderr: string): { readonly exempt: string[]; readonly remainder: string } {
  const exempt: string[] = [];
  const rest: string[] = [];
  for (const line of stderr.split('\n')) {
    if (line.startsWith(IN_FLIGHT_STDERR_PREFIX)) {
      exempt.push(line);
    } else if (line.length > 0) {
      rest.push(line);
    }
  }
  return { exempt, remainder: rest.join('\n') };
}

function resolveElectronBin(): string {
  const require = createRequire(join(packageRoot, 'smoke-resolve.cjs'));
  const bin: unknown = require('electron');
  if (typeof bin !== 'string' || bin.length === 0) {
    throw new Error('electron 依赖异常：未返回二进制路径');
  }
  return bin;
}

interface RunResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly earlyExit: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly stderrBytes: number;
}

async function runAppSmoke(): Promise<RunResult> {
  const electronBin = resolveElectronBin();
  const child = spawn(electronBin, [appEntry, '--chips-open-card', SMOKE_CARD_SOURCE], {
    cwd: packageRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  let exitCode: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let exited = false;
  const exitPromise = new Promise<void>((resolveExit) => {
    child.once('exit', (code, killSignal) => {
      exitCode = code;
      signal = killSignal;
      exited = true;
      resolveExit();
    });
  });

  const earlyExit = await Promise.race([
    exitPromise.then(() => true),
    new Promise<boolean>((resolveRace) => {
      setTimeout(() => resolveRace(false), ALIVE_WINDOW_MS);
    }),
  ]);

  if (!exited) {
    child.kill('SIGTERM');
    const termTimeout = setTimeout(() => {
      if (!exited) {
        child.kill('SIGKILL');
      }
    }, TERM_EXIT_MS);
    await exitPromise;
    clearTimeout(termTimeout);
  }

  const stderrBuffer = Buffer.concat(stderrChunks);
  return {
    exitCode,
    signal,
    earlyExit,
    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: stderrBuffer.toString('utf8'),
    stderrBytes: stderrBuffer.length,
  };
}

describeSmoke('薯片宿主正式应用冒烟闸（CHIPS_HOST_SMOKE=1）', () => {
  it('判据①：dist 应用入口与渲染入口产物齐备', () => {
    const required = [
      'dist/main/app.js',
      'dist/preload/index.js',
      'dist/renderer/shell.html',
      'dist/renderer/shell-window.js',
      'dist/renderer/entries/card.html',
      'dist/renderer/entries/card.js',
      'dist/renderer/entries/frame.html',
      'dist/renderer/entries/frame.js',
    ];
    for (const relative of required) {
      expect(existsSync(join(packageRoot, relative)), `缺少构建产物：${relative}`).toBe(true);
    }
    expect(existsSync(appEntry)).toBe(true);
  });

  it(
    '判据②–⑤：壳+卡片窗口存活、stderr 零字节（#99 在途豁免臂外）、无 HOST_STARTUP_FAILED、SIGTERM 优雅收口退出码 0',
    async () => {
      const result = await runAppSmoke();
      const output = `${result.stdout}${result.stderr}`;
      const { exempt, remainder } = splitExempt(result.stderr);
      // 运行摘要写入 stdout，供实跑留痕。
      process.stdout.write(
        `[smoke:app] earlyExit=${result.earlyExit} stderrBytes=${result.stderrBytes} ` +
          `exemptLines=${exempt.length} remainderBytes=${Buffer.byteLength(remainder, 'utf8')} ` +
          `exitCode=${String(result.exitCode)} signal=${String(result.signal)}\n`,
      );
      if (remainder.length > 0) {
        process.stdout.write(`[smoke:app] 非豁免 stderr 内容（判据要求为空）：\n${remainder}\n`);
      }
      expect(result.earlyExit, '壳窗口存活观察窗内进程提前退出（含卡片窗口装载段）').toBe(false);
      expect(remainder, `非豁免 stderr 必须零字节，实际：${JSON.stringify(remainder)}`).toBe('');
      expect(exempt.length, '#99 在途豁免行只允许诚实回退警告各一条').toBeLessThanOrEqual(1);
      expect(output).not.toContain('HOST_STARTUP_FAILED');
      expect(result.signal, 'SIGTERM 应被优雅处理而非信号终止残留').toBeNull();
      expect(result.exitCode, '优雅收口退出码').toBe(0);
    },
    ALIVE_WINDOW_MS + TERM_EXIT_MS + 30_000,
  );
});
