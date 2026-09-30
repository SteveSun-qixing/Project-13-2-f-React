/**
 * 真 Electron 宿主配对 E2E（工单039 波 3 交付 A 之旗标臂，任务 #166）。
 *
 * 双态 fail-closed（先例 `playwright.config.ts:20`、`app-smoke.test.ts:24-25`，
 * 判例 #139 段B/#150 段B「旗标未置=显式 skip 留痕」）：
 * - `CHIPS_E2E_REQUIRE_CARRIER_HOST` 未置：套件显式 skip 并 stdout 留痕（不静默跳）；
 * - 置位：真实拉起 Electron 宿主（`packages/host/dist/main/app.js`，`--user-data-dir`
 *   钉死承载 `userData` 根）→ 发现登记逐字段 → 真 bin 经正式承载链握手 → 公开面
 *   `cli.task.*` 封套 → `SIGTERM` 后写入方清理（§2.5-5）。置位态终验由主智能体
 *   串行执行；本文件保证置位路径代码真实可达、未置态闸绿。
 *
 * R3 在册口径：宿主 `handleStartupInputs` 未正式装配、`command:invoke` 端口未装配时
 * 如实拒绝（`BRIDGE_INTERNAL`）——本套件不跑 invoke 成功路径、不临时投递凑绿。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { createCarrierInvoker, createServiceRouterClient } from '@chips/cli';

import {
  cleanupCarrierDir,
  createFakeHome,
  runChipsWithCarrier,
  type IFakeHome,
} from './support/carrier-harness';
import { expectFailure, resolveEcosystemRoot } from './support/harness';

const REQUIRED = process.env.CHIPS_E2E_REQUIRE_CARRIER_HOST === '1';
if (!REQUIRED) {
  process.stdout.write(
    '[carrier-host-e2e] CHIPS_E2E_REQUIRE_CARRIER_HOST 未置 → 真宿主配对套件显式 skip' +
      '（工单039 波 3 旗标臂；置位终验由主智能体串行执行：CHIPS_E2E_REQUIRE_CARRIER_HOST=1 ' +
      'pnpm --filter @chips/cli run build && pnpm --filter @chips/host run build && ' +
      'vitest run --config tests/e2e/cli/vitest.config.ts）。\n'
  );
}
const describeCarrierHost = REQUIRED ? describe : describe.skip;

const HOST_ROOT = path.join(resolveEcosystemRoot(), 'packages', 'host');
const HOST_APP_ENTRY = path.join(HOST_ROOT, 'dist', 'main', 'app.js');

/** 宿主冷启动预算（真 Electron + carrier open；与 §5.2 拉起就绪预算同族但另册放宽）。 */
const HOST_READY_BUDGET_MS = 60_000;

let fakeHome: IFakeHome | null = null;
let hostChild: ChildProcess | null = null;

async function launchHost(): Promise<void> {
  if (fakeHome !== null) {
    return;
  }
  if (!existsSync(HOST_APP_ENTRY)) {
    throw new Error(
      `真宿主旗标置位但宿主构建产物缺失：${HOST_APP_ENTRY}（先 pnpm --filter @chips/host run build）`
    );
  }
  const require = createRequire(path.join(HOST_ROOT, 'carrier-resolve.cjs'));
  const electronBin = require('electron') as unknown;
  if (typeof electronBin !== 'string' || electronBin.length === 0) {
    throw new Error('electron 依赖异常：未返回二进制路径');
  }
  fakeHome = createFakeHome('realhost');
  hostChild = spawn(electronBin, [HOST_APP_ENTRY, `--user-data-dir=${fakeHome.userdataRoot}`], {
    cwd: HOST_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  const deadline = Date.now() + HOST_READY_BUDGET_MS;
  for (;;) {
    if (existsSync(fakeHome.discoveryFile)) {
      return;
    }
    if (hostChild.exitCode !== null) {
      throw new Error(`宿主进程未就绪即退出（code=${String(hostChild.exitCode)}）`);
    }
    if (Date.now() > deadline) {
      throw new Error(`宿主承载发现登记超时未出现：${fakeHome.discoveryFile}`);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
}

afterAll(async () => {
  if (hostChild !== null && hostChild.exitCode === null) {
    hostChild.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        hostChild?.kill('SIGKILL');
        resolve();
      }, 20_000);
      hostChild.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  if (fakeHome !== null) {
    cleanupCarrierDir(fakeHome.home);
  }
});

describeCarrierHost('真宿主配对臂（CHIPS_E2E_REQUIRE_CARRIER_HOST=1）', () => {
  it(
    '发现登记逐字段（§2.4 六字段 + pid 在场 + 端点派生一致）',
    async () => {
      await launchHost();
      if (fakeHome === null) {
        throw new Error('宿主未启动');
      }
      const raw = JSON.parse(readFileSync(fakeHome.discoveryFile, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(Object.keys(raw).sort()).toEqual(
        ['bearerToken', 'instanceId', 'pid', 'protocol', 'socketPath', 'startedAt'].sort()
      );
      expect(raw.protocol).toBe('chips-cli-carrier/1');
      // macOS `/tmp` 是 `/private/tmp` 的符号链接：宿主侧 userData 经 Electron realpath 解析，
      // 夹具 fakeHome 为字面 `/tmp` 前缀，两端比较先归一 symlink（生产 userData 本即真实路径）。
      expect(realpathSync(raw.socketPath as string)).toBe(realpathSync(fakeHome.socketPath));
      expect(typeof raw.pid).toBe('number');
      expect(typeof raw.instanceId).toBe('string');
      expect(typeof raw.bearerToken).toBe('string');
      expect((raw.bearerToken as string).length).toBe(64);
    },
    HOST_READY_BUDGET_MS + 30_000
  );

  it('真 bin 正式装配链 × 真宿主：握手成立、空索引如实定性（不凑绿）', async () => {
    await launchHost();
    if (fakeHome === null) {
      throw new Error('宿主未启动');
    }
    // 真宿主未装载 demo 插件：发现链成功、索引无匹配 → 3（§2.3），
    // 与「发现阶段承载缺失」同码不同因——本臂证明握手/封套真通路（非 5/6/9）。
    const run = runChipsWithCarrier(fakeHome, ['demo', 'hello', '--json'], process.cwd());
    expectFailure(run, 'CLI_COMMAND_NOT_FOUND', 3);
  }, 90_000);

  it('公开面 cli.task.* × 真宿主存储侧信封逐字段（§5.1 在册路由）', async () => {
    await launchHost();
    if (fakeHome === null) {
      throw new Error('宿主未启动');
    }
    const invoker = createCarrierInvoker({ userdataRoot: fakeHome.userdataRoot, env: {} });
    const client = createServiceRouterClient({ invoker });
    try {
      const created = await client.cliTask.create({
        pluginId: 'chips.e2e.carrier',
        commandId: 'e2e.task',
        commandPath: ['e2e', 'task'],
      });
      expect(created).toMatchObject({
        pluginId: 'chips.e2e.carrier',
        commandId: 'e2e.task',
        status: 'running',
      });
      const bound = await client.cliTask.bindInvocation({
        taskId: created.taskId,
        invocationId: 'inv-e2e-real',
      });
      expect(bound.taskId).toBe(created.taskId);
      const settled = await client.cliTask.cancel(created.taskId);
      expect(settled.status).toBe('cancelled');
    } finally {
      invoker.dispose();
    }
  }, 90_000);

  it('SIGTERM 宿主收口后发现登记与 socket 删除（§2.5-5 写入方清理权）', async () => {
    await launchHost();
    if (fakeHome === null || hostChild === null) {
      throw new Error('宿主未启动');
    }
    // 端点可达性证据先行（防「从未建立」假绿）：发现登记在场且非空。
    const probe = readFileSync(fakeHome.discoveryFile, 'utf8');
    expect(probe.length).toBeGreaterThan(0);
    hostChild.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        hostChild?.kill('SIGKILL');
        resolve();
      }, 20_000);
      hostChild.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    expect(existsSync(fakeHome.discoveryFile)).toBe(false);
    expect(existsSync(fakeHome.socketPath)).toBe(false);
  }, 120_000);
});
