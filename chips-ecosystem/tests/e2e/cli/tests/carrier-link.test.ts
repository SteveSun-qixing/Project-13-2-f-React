/**
 * 承载链路真 bin × 桩宿主配对 E2E（工单039 波 3 交付 A，任务 #166）。
 *
 * 口径（《17-CLI承载链路契约》）：
 * - 被测面 = 真实 `packages/cli/dist/bin.js` 子进程（经生产装配 `createProductionClient`，
 *   §2.2 根派生 + §5.2 按需启动缺省臂全部在场）；对端 = 契约独立实现桩进程
 *   （`carrier-stub-host.mjs`），真 UDS/命名管道端点零 mock；
 * - `app` 目标 `job.wait=false` 命令 = bin 可达的 `command:invoke` 全信封臂（07.04 §5.3）；
 * - `app` 目标默认 wait 臂 = R3 证据臂：`cli.task.create` 帧如实落到承载存储，
 *   随后 `apps.ensureRunning` 适配器缺位收口 6——启动输入正式投递未就绪的挂账证据，
 *   禁止临时投递凑绿（宿主 `handleStartupInputs` 仍诚实 warn）；
 * - 按需启动成功臂按 Q6(c) 假发行 bundle 驱动（固定布局解析 → detached 拉起 → 就绪轮询），
 *   工作区形态（repo dist）必然解析不出 → 现行 3 回退臂同文件锁定；
 * - `CHIPS_CARRIER_DISABLE=1` 确定性加固臂（Q4 裁定制言随单核）：承载完全在场
 *   （发现文件 + 活桩端点 + 在册命令）时仍按无承载定性收口，帧日志零条目作「从未建连」
 *   最强证据，断言面零放宽；
 * - 断言只认退出码、错误信封 `code`/`details`、结果信封逐字段与帧日志轨迹，零文案匹配。
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  STUB_TOKEN,
  appCommand,
  buildLaunchBundle,
  carrierRunEnv,
  createFakeHome,
  makeCarrierTempDir,
  cleanupCarrierDir,
  readFrameLog,
  runBundledChips,
  runChipsWithCarrier,
  startStubHost,
  writeCommandsFile,
  type IFakeHome,
} from './support/carrier-harness';
import { expectFailure, expectSuccessJson, runChips } from './support/harness';

const tempDirs: string[] = [];
const CWD = process.cwd();

function fakeHome(kind: string): IFakeHome {
  return createFakeHome(kind);
}

function tempDir(kind: string): string {
  const dir = makeCarrierTempDir(kind);
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of tempDirs) {
    cleanupCarrierDir(dir);
  }
});

describe('§2.6 环境变量严格面（真 bin）', () => {
  it('CHIPS_CARRIER_DISABLE 非 1 值 → CLI_ARGUMENT_INVALID / 2', () => {
    const run = runChips(['demo', 'hello', '--json'], {
      cwd: CWD,
      env: { CHIPS_CARRIER_DISABLE: 'yes' },
    });
    expectFailure(run, 'CLI_ARGUMENT_INVALID', 2);
  });

  it('CHIPS_CARRIER_SOCKET 非绝对路径 → CLI_PATH_INVALID / 5', () => {
    const run = runChips(['demo', 'hello', '--json'], {
      cwd: CWD,
      env: { CHIPS_CARRIER_DISABLE: undefined, CHIPS_CARRIER_SOCKET: 'relative/socket.sock' },
    });
    expectFailure(run, 'CLI_PATH_INVALID', 5);
  });
});

describe('发现阶段臂（承载不在场 / 定性收口）', () => {
  it('工作区形态无宿主：发现文件缺失 → 按需启动解析不出 → 现行 3 回退（Q6(c)）', () => {
    const home = fakeHome('missing');
    tempDirs.push(home.home);
    const run = runChipsWithCarrier(home, ['demo', 'hello', '--json'], CWD);
    const envelope = expectFailure(run, 'CLI_COMMAND_NOT_FOUND', 3);
    expect(Array.isArray(envelope.details?.argv)).toBe(true);
    // CLI 无删除权也不应有写权：不生成任何发现登记（§2.5-4 只属写入方）。
    expect(existsSync(home.discoveryFile)).toBe(false);
  });

  it('桩 SIGKILL 后陈旧残留：双判据 pid_dead → 3，文件保留不删（§2.5-3/4）', async () => {
    const home = fakeHome('stale');
    tempDirs.push(home.home);
    const stub = await startStubHost({ userdataRoot: home.userdataRoot });
    stub.kill();
    await new Promise<void>((resolve) => {
      stub.child.once('exit', () => resolve());
    });
    expect(existsSync(home.discoveryFile)).toBe(true);
    const run = runChipsWithCarrier(home, ['demo', 'hello', '--json'], CWD);
    expectFailure(run, 'CLI_COMMAND_NOT_FOUND', 3);
    // 消费侧无删除权：陈旧文件必须仍在。
    expect(existsSync(home.discoveryFile)).toBe(true);
  });

  it('握手 token 不符（服务端另期望）→ reason=token_invalid / 6（§5.3）', async () => {
    const home = fakeHome('badtoken');
    tempDirs.push(home.home);
    const stub = await startStubHost({
      userdataRoot: home.userdataRoot,
      expectTokenMismatch: true,
      commandsFile: writeCommandsFile(home.userdataRoot, {
        index: {},
        commands: [appCommand({ pluginId: 'chips.demo', path: ['demo', 'hello'], commandId: 'demo.hello', wait: false })],
      }),
    });
    try {
      const run = runChipsWithCarrier(home, ['demo', 'hello', '--json'], CWD);
      const envelope = expectFailure(run, 'CLI_TARGET_UNAVAILABLE', 6);
      expect(envelope.details).toMatchObject({ reason: 'token_invalid' });
    } finally {
      await stub.stop();
    }
  });

  it('SOCKET 覆盖直连但端点无listener：发现文件在场仍失败 → 3 且不拉起（§2.6）', async () => {
    const home = fakeHome('override');
    tempDirs.push(home.home);
    const stub = await startStubHost({ userdataRoot: home.userdataRoot });
    const ghostSocket = path.posix.join(home.home, 'ghost.sock');
    await stub.stop();
    // 手工回写发现文件（覆盖态 token 来源），端点指向无人监听的路径。
    const record = {
      protocol: 'chips-cli-carrier/1',
      instanceId: 'ghost-inst',
      socketPath: ghostSocket,
      pid: process.pid,
      startedAt: Date.now(),
      bearerToken: STUB_TOKEN,
    };
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync(path.dirname(home.discoveryFile), { recursive: true });
    writeFileSync(home.discoveryFile, `${JSON.stringify(record)}\n`);
    const run = runChipsWithCarrier(home, ['demo', 'hello', '--json'], CWD);
    expectFailure(run, 'CLI_COMMAND_NOT_FOUND', 3);
  });

  it('CHIPS_CARRIER_DISABLE=1 加固臂：承载完全在场（发现文件+活桩端点+在册命令）仍确定性回退 3 且零帧交换（§2.6 / Q4 裁定制言）', async () => {
    const home = fakeHome('disablegate');
    tempDirs.push(home.home);
    const frameLog = path.join(home.home, 'frames-disable.jsonl');
    const commandsFile = writeCommandsFile(home.home, {
      index: { 'demo hello': ['chips.demo.cli.demo.hello'] },
      commands: [
        appCommand({
          pluginId: 'chips.demo.app',
          path: ['demo', 'hello'],
          commandId: 'demo.hello',
          wait: false,
        }),
      ],
    });
    const stub = await startStubHost({
      userdataRoot: home.userdataRoot,
      commandsFile,
      frameLogFile: frameLog,
    });
    try {
      // 承载在线套件同源的显式环境，仅叠加 DISABLE=1：离线条必须闸在发现之前。
      const env = { ...carrierRunEnv(home), CHIPS_CARRIER_DISABLE: '1' };
      const run = runChips(['demo', 'hello', '--json'], { cwd: CWD, env });
      expectFailure(run, 'CLI_COMMAND_NOT_FOUND', 3);
      // 最强证据：桩宿主帧日志零条目——从未建连，更无任何封套触达承载。
      expect(readFrameLog(frameLog)).toEqual([]);
      // CLI 无删除权也不应有写权：发现登记原样在场。
      expect(existsSync(home.discoveryFile)).toBe(true);
    } finally {
      await stub.stop();
    }
  });
});

describe('承载在线臂（真 bin × 桩宿主）', () => {
  it('app wait:false → command:invoke 全信封逐字段 → 0（§5.1 在册路由闭环）', async () => {
    const home = fakeHome('online');
    tempDirs.push(home.home);
    const frameLog = path.join(home.home, 'frames-online.jsonl');
    const commandsFile = writeCommandsFile(home.home, {
      index: { 'demo hello': ['chips.demo.cli.demo.hello'] },
      commands: [
        appCommand({
          pluginId: 'chips.demo.app',
          path: ['demo', 'hello'],
          commandId: 'demo.hello',
          wait: false,
        }),
      ],
    });
    const stub = await startStubHost({
      userdataRoot: home.userdataRoot,
      commandsFile,
      frameLogFile: frameLog,
      instanceId: 'inst-online',
    });
    try {
      const run = runChipsWithCarrier(home, ['demo', 'hello', '--json'], CWD);
      const parsed = expectSuccessJson(run, 0) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        ok: true,
        entryId: 'chips.demo.app.cli.demo.hello',
        commandPath: 'demo hello',
        commandId: 'demo.hello',
        target: { type: 'app', pluginId: 'chips.demo.app' },
      });
      expect(parsed.output).toMatchObject({
        commandId: 'demo.hello',
        target: 'main',
        status: 'completed',
      });
      expect(typeof (parsed.output as { invocationId?: unknown }).invocationId).toBe('string');

      const frames = readFrameLog(frameLog);
      const handshake = frames.find((entry) => entry.direction === 'in' && 'clientId' in entry.frame);
      expect(handshake?.frame).toMatchObject({
        protocol: 'chips-cli-carrier/1',
        bearerTokenPresent: true,
      });
      // token 不落日志（§2.8）。
      expect(readFileSync(frameLog, 'utf8')).not.toContain(STUB_TOKEN);
      const capabilityIds = frames
        .filter((entry) => entry.direction === 'in' && 'capabilityId' in entry.frame)
        .map((entry) => entry.frame.capabilityId);
      expect(capabilityIds).toEqual(['cli.command.list', 'command:invoke']);
      const invokeIn = frames.find(
        (entry) => entry.frame.capabilityId === 'command:invoke'
      );
      expect(invokeIn?.frame.input).toMatchObject({ commandId: 'demo.hello', source: 'cli' });
    } finally {
      await stub.stop();
      // §2.5-5 写入方清理权：SIGTERM 后发现文件与 socket 均删除。
      expect(existsSync(home.discoveryFile)).toBe(false);
      expect(existsSync(home.socketPath)).toBe(false);
    }
  });

  it('app wait:true → cli.task.create 帧落承载、ensureRunning 缺位收口 6（R3 挂账证据臂）', async () => {
    const home = fakeHome('r3');
    tempDirs.push(home.home);
    const frameLog = path.join(home.home, 'frames-r3.jsonl');
    const commandsFile = writeCommandsFile(home.home, {
      index: { 'demo job': ['chips.demo.cli.demo.job'] },
      commands: [
        appCommand({
          pluginId: 'chips.demo.app',
          path: ['demo', 'job'],
          commandId: 'demo.job',
          wait: true,
        }),
      ],
    });
    const stub = await startStubHost({
      userdataRoot: home.userdataRoot,
      commandsFile,
      frameLogFile: frameLog,
    });
    try {
      const run = runChipsWithCarrier(home, ['demo', 'job', '--json'], CWD);
      const envelope = expectFailure(run, 'CLI_TARGET_UNAVAILABLE', 6);
      expect(envelope.details).toMatchObject({ method: 'apps.ensureRunning' });
      const capabilityIds = readFrameLog(frameLog)
        .filter((entry) => entry.direction === 'in' && 'capabilityId' in entry.frame)
        .map((entry) => entry.frame.capabilityId);
      // 任务已在承载存储创建、投递链在启动输入处如实挂账——未凑绿亦未伪造。
      expect(capabilityIds).toEqual(['cli.command.list', 'cli.task.create']);
    } finally {
      await stub.stop();
    }
  });

  it('SOCKET 覆盖直连成功臂：端点覆盖 + 派生发现文件读 token（§2.6）', async () => {
    const home = fakeHome('direct');
    tempDirs.push(home.home);
    const customSocket = path.posix.join(home.home, 'direct.sock');
    const commandsFile = writeCommandsFile(home.home, {
      index: {},
      commands: [
        appCommand({
          pluginId: 'chips.demo.app',
          path: ['demo', 'hello'],
          commandId: 'demo.hello',
          wait: false,
        }),
      ],
    });
    const stub = await startStubHost({
      userdataRoot: home.userdataRoot,
      socketOverride: customSocket,
      commandsFile,
    });
    try {
      const env = { ...carrierRunEnv(home), CHIPS_CARRIER_SOCKET: customSocket };
      const run = runChips(['demo', 'hello', '--json'], { cwd: CWD, env });
      const parsed = expectSuccessJson(run, 0) as Record<string, unknown>;
      expect(parsed.commandPath).toBe('demo hello');
    } finally {
      await stub.stop();
    }
  });
});

describe('§5.2 按需启动成功臂（假发行 bundle，Q6(c)）', () => {
  it('固定布局解析 → detached 拉起宿主桩 → 就绪轮询 → 请求闭环 0', () => {
    const bundleRoot = tempDir('bundle');
    const home = fakeHome('launch');
    tempDirs.push(home.home);
    const frameLog = path.join(home.home, 'frames-launch.jsonl');
    const commandsFile = writeCommandsFile(bundleRoot, {
      index: {},
      commands: [
        appCommand({
          pluginId: 'chips.demo.app',
          path: ['demo', 'hello'],
          commandId: 'demo.hello',
          wait: false,
        }),
      ],
    });
    const bundle = buildLaunchBundle({
      bundleRoot,
      userdataRoot: home.userdataRoot,
      commandsFile,
      frameLogFile: frameLog,
    });
    expect(existsSync(bundle.hostFile)).toBe(true);
    const env = carrierRunEnv(home);
    // 发现文件不在场且未覆盖：生产装配的缺省拉起链被触发（30s 预算内轮询就绪）。
    expect(existsSync(home.discoveryFile)).toBe(false);
    const run = runBundledChips(bundle.binFile, ['demo', 'hello', '--json'], env, CWD);
    const parsed = expectSuccessJson(run, 0) as Record<string, unknown>;
    expect(parsed).toMatchObject({ ok: true, commandPath: 'demo hello', commandId: 'demo.hello' });
    // 拉起出来的就是固定布局解析出的那个宿主壳。
    expect(existsSync(home.discoveryFile)).toBe(true);
    const frames = readFrameLog(frameLog);
    expect(frames.some((entry) => 'clientId' in entry.frame)).toBe(true);
  }, 120_000);
});
