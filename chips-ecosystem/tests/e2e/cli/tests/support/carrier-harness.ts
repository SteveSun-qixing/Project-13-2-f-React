/**
 * 承载链路 E2E 编排支撑（工单039 波 3，任务 #166）。
 *
 * 纪律：被测面一律 spawn 真实 `packages/cli/dist/bin.js`（与 `harness.runChips` 同源口径），
 * 对端为契约独立实现桩进程（`carrier-stub-host.mjs`，零 `@chips/*` 依赖）；公开面
 * `createCarrierInvoker` / `createServiceRouterClient` 经 `@chips/cli` 包根出口消费
 * （`client/carrier/index.ts` 头注明示「消费方（发行包装配 / e2e）只经此面接入」），
 * 禁止 import CLI 内部深路径。
 *
 * 路径纪律：macOS `sun_path` 上限 104 字节（《17》§2.3），POSIX 临时基路径一律走 `/tmp`
 * 短基（`os.tmpdir()` 的 `/var/folders/...` 深路径会触发缩短形态，干扰逐字段断言稳定面）；
 * 派生端点路径以 `/tmp` 字面量构造且不 realpath，保证 stub bind 与 CLI connect 字符串全等。
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseEnv, resolveCliBin, runChips, type ICliRun } from './harness';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 桩宿主（契约独立实现）文件位置。 */
export const STUB_HOST_FILE = path.join(MODULE_DIR, 'carrier-stub-host.mjs');

/** 发现文件名（§2.2 布局；测试资产按契约文档独立复写，与实现零共享）。 */
export const DISCOVERY_FILE_NAME = 'chips-carrier.json';

/** 桩发现文件在册 token（固定值仅测试域；真实实现为 CSPRNG）。 */
export const STUB_TOKEN = 'f'.repeat(64);

/** 创建短基临时目录。 */
export function makeCarrierTempDir(kind: string): string {
  const base = process.platform === 'win32' ? tmpdir() : '/tmp';
  return mkdtempSync(path.join(base, `c166-${kind}-`));
}

/** 清理临时目录（afterAll 无条件）。 */
export function cleanupCarrierDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/** 按平台发行布局派生 fake HOME 下的 `userData` 根（《17》§2.2；测试资产独立实现）。 */
export function carrierUserDataForHome(home: string): string {
  if (process.platform === 'win32') {
    return `${home}\\Chips`;
  }
  if (process.platform === 'darwin') {
    return path.posix.join(home, 'Library', 'Application Support', 'Chips');
  }
  return path.posix.join(home, '.config', 'Chips');
}

/** fake HOME 环境（CLI 侧 `userData` 根派生的注入面）。 */
export interface IFakeHome {
  readonly home: string;
  readonly userdataRoot: string;
  readonly discoveryFile: string;
  readonly socketPath: string;
}

/** 建 fake HOME 与派生端点（POSIX 保持 `/tmp` 字面路径，不 realpath）。 */
export function createFakeHome(kind: string): IFakeHome {
  const home = makeCarrierTempDir(`h-${kind}`);
  const userdataRoot = carrierUserDataForHome(home);
  return {
    home,
    userdataRoot,
    discoveryFile: `${userdataRoot}/${DISCOVERY_FILE_NAME}`.replace(/\//g, path.sep),
    socketPath:
      process.platform === 'win32'
        ? `\\\\.\\pipe\\chips-carrier-${shortHash(userdataRoot)}`
        : `${userdataRoot}/chips-carrier.sock`,
  };
}

/** win32 命名管道名散列后缀段（§2.2：SHA-256(root) 前 16 字符；测试资产独立实现）。 */
function shortHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}

/** 启动桩宿主的选项。 */
export interface IStartStubInput {
  readonly userdataRoot: string;
  readonly commandsFile?: string;
  readonly frameLogFile?: string;
  /** 服务端期望 token 与发现文件 token 故意不一致 → `token_invalid` 场景。 */
  readonly expectTokenMismatch?: boolean;
  /** 端点覆盖（`CHIPS_CARRIER_SOCKET` 直连臂：stub 绑覆盖路径、发现文件仍写根）。 */
  readonly socketOverride?: string;
  readonly instanceId?: string;
}

/** 运行中的桩宿主句柄。 */
export interface IStubHandle {
  readonly pid: number;
  readonly instanceId: string;
  readonly socketPath: string;
  readonly discoveryFile: string;
  readonly child: ReturnType<typeof spawn>;
  /** SIGTERM：写入方清理权路径（发现文件与 socket 删除，《17》§2.5-5）。 */
  stop(): Promise<void>;
  /** SIGKILL：残留现场（陈旧双判据消费臂）。 */
  kill(): void;
}

/** 启动桩宿主并等待发现文件就绪（≤20s；不就绪即抛错，不静默降级）。 */
export async function startStubHost(input: IStartStubInput): Promise<IStubHandle> {
  const args = [STUB_HOST_FILE, '--root', input.userdataRoot, '--token', STUB_TOKEN];
  if (input.commandsFile !== undefined) {
    args.push('--commands', input.commandsFile);
  }
  if (input.frameLogFile !== undefined) {
    args.push('--log', input.frameLogFile);
  }
  if (input.socketOverride !== undefined) {
    args.push('--socket', input.socketOverride);
  }
  if (input.expectTokenMismatch === true) {
    args.push('--expect-token', '0'.repeat(64));
  }
  if (input.instanceId !== undefined) {
    args.push('--instance', input.instanceId);
  }
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderrText = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    stderrText += chunk;
  });
  const deadline = Date.now() + 20_000;
  const discoveryFile = path.join(input.userdataRoot, DISCOVERY_FILE_NAME);
  while (!existsSync(discoveryFile)) {
    if (child.exitCode !== null || Date.now() > deadline) {
      const code = String(child.exitCode);
      throw new Error(`桩宿主未就绪即退出（code=${code}）：${stderrText}`);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }
  const record = JSON.parse(readFileSync(discoveryFile, 'utf8')) as {
    pid: number;
    instanceId: string;
    socketPath: string;
  };
  return {
    pid: record.pid,
    instanceId: record.instanceId,
    socketPath: record.socketPath,
    discoveryFile,
    child,
    stop: async (): Promise<void> => {
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 5_000);
        child.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
    kill: (): void => {
      child.kill('SIGKILL');
    },
  };
}

/** 写场景命令文件（`ICliCommandView` 列表镜像，07.12 §5.8）；目标目录未预建时先建（夹具侧预建，
 * `userdataRoot` 形态的 `Chips` 目录由桩宿主启动才落，命令文件须先于桩就位传入 `--commands`）。 */
export function writeCommandsFile(dir: string, scenario: unknown): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'commands.json');
  writeFileSync(file, `${JSON.stringify(scenario, null, 2)}\n`);
  return file;
}

/** 构造一个 app 目标 `ICliCommandView`（`job.wait` 控制执行时序臂）。 */
export function appCommand(input: {
  readonly pluginId: string;
  readonly path: readonly string[];
  readonly commandId: string;
  readonly wait: boolean;
}): Record<string, unknown> {
  const entryId = `${input.pluginId}.cli.${input.path.join('.')}`;
  return {
    entryId,
    commandPath: input.path,
    commandId: input.commandId,
    pluginId: input.pluginId,
    enabled: true,
    conflicts: [],
    declaration: {
      commandPath: input.path,
      commandId: input.commandId,
      title: `命令 ${input.path.join(' ')}`,
      target: { type: 'app', pluginId: input.pluginId },
      job: { wait: input.wait },
      output: { json: 'supported' },
    },
  };
}

/** 帧日志条目（token 已在桩侧脱敏，《17》§2.8）。 */
export interface IFrameEntry {
  readonly direction: 'in' | 'out';
  readonly frame: Record<string, unknown>;
}

/** 解析帧日志 JSONL。 */
export function readFrameLog(file: string): readonly IFrameEntry[] {
  if (!existsSync(file)) {
    return [];
  }
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(
      (line) => JSON.parse(line) as unknown as IFrameEntry
    );
}

/** fake HOME 注入的 CLI 运行环境（承载在线态：显式撤闸离线缺省并接管 HOME 派生）。
 *
 * `CHIPS_CARRIER_DISABLE`/`CHIPS_CARRIER_SOCKET` 以**值 `undefined` 的在册键**返回而非经
 * `baseEnv` 删除：`runChips` 缺省注入 `CHIPS_CARRIER_DISABLE='1'` 后合并 `options.env`，
 * 缺失键会被该缺省抢占、带值 `undefined` 的在册键才能在合并层撤闸（Node spawn 对
 * `undefined` 值跳过该变量；基线 `process.env` 的控制键清除仍由 `baseEnv` 承担）。
 */
export function carrierRunEnv(home: IFakeHome): Record<string, string | undefined> {
  const env = baseEnv({
    HOME: home.home,
    USERPROFILE: home.home,
    APPDATA: home.home,
    XDG_CONFIG_HOME: path.posix.join(home.home, '.config'),
  });
  return { ...env, CHIPS_CARRIER_DISABLE: undefined, CHIPS_CARRIER_SOCKET: undefined };
}

/** 以承载在线态运行真 bin。 */
export function runChipsWithCarrier(home: IFakeHome, args: readonly string[], cwd: string): ICliRun {
  return runChips(args, { cwd, env: carrierRunEnv(home) });
}

/** 假发行 bundle 组装结果。 */
export interface ILaunchBundle {
  readonly binFile: string;
  readonly hostFile: string;
}

/**
 * 解析 `yaml` 包目录真实落位（bin 运行时依赖；从 CLI 包根锚点走同一 walk-up 链，
 * 与 `dist/bin.js` 在仓库内的实际解析面逐字一致）。
 */
function resolveYamlPackageRoot(cliPackageRoot: string): string {
  const require = createRequire(path.join(cliPackageRoot, 'dist', 'bin.js'));
  try {
    return path.dirname(require.resolve('yaml/package.json'));
  } catch {
    const main = require.resolve('yaml');
    let dir = path.dirname(main);
    while (dir !== path.dirname(dir) && path.basename(dir) !== 'yaml') {
      dir = path.dirname(dir);
    }
    if (dir === path.dirname(dir)) {
      throw new Error(`yaml 包目录解析失败（main=${main}）`);
    }
    return dir;
  }
}

/**
 * 组装假发行 bundle（§5.2 Q6(c) 按需启动成功臂）：把真实构建产物 `dist/` 复制进
 * 平台固定布局，并在候选位落一个「exec node 桩宿主」的可执行壳；`node_modules` 以
 * 逐条目 symlink 引回仓库真实链接，并显式钉入 `yaml`（未声明依赖的 walk-up 侥幸面在
 * /tmp 下断链，见函数体注记与升级事项），只读消费零污染。
 *
 * @returns 假 bundle 内 `bin.js` 路径（spawn 该入口即等价发行 `chips` bin）。
 */
export function buildLaunchBundle(input: {
  readonly bundleRoot: string;
  readonly userdataRoot: string;
  readonly commandsFile?: string;
  readonly frameLogFile?: string;
}): ILaunchBundle {
  const cliBin = resolveCliBin();
  const cliDist = path.dirname(cliBin);
  const cliPackageRoot = path.dirname(cliDist);
  const isDarwin = process.platform === 'darwin';
  const binParent = isDarwin
    ? path.posix.join(input.bundleRoot, 'Contents', 'Helpers', 'bin')
    : path.posix.join(input.bundleRoot, 'bin');
  const binDir = path.posix.join(binParent, 'dist');
  mkdirSync(binDir, { recursive: true });
  cpSync(cliDist, binDir, { recursive: true });
  const nodeModulesDir = path.posix.join(binParent, 'node_modules');
  const nodeModulesSource = path.join(cliPackageRoot, 'node_modules');
  // 逐条目落位而非整目录 symlink：pnpm 严格布局下 `packages/cli/node_modules` 只含直接
  // workspace 链接（`@chips/*`）；`dist` 的 ESM 运行时依赖 `yaml` 在工作区形态靠向上
  // walk-up 到仓库外层 node_modules 侥幸解析（`@chips/cli` 未声明该依赖——升级事项，
  // 由主智能体收口 package.json/lockfile 面）。假 bundle 落于 /tmp 后该 walk-up 断链，
  // 本夹具把仓库真实 yaml 包目录显式钉入，保证本臂验证对象是 §5.2 拉起机制而非包装账。
  mkdirSync(nodeModulesDir, { recursive: true });
  if (existsSync(nodeModulesSource)) {
    for (const entry of readdirSync(nodeModulesSource)) {
      if (entry.startsWith('.')) {
        continue;
      }
      symlinkSync(
        path.join(nodeModulesSource, entry),
        path.posix.join(nodeModulesDir, entry),
        'dir'
      );
    }
  }
  const yamlLink = path.posix.join(nodeModulesDir, 'yaml');
  if (!existsSync(yamlLink)) {
    symlinkSync(resolveYamlPackageRoot(cliPackageRoot), yamlLink, 'dir');
  }
  const hostDir = isDarwin
    ? path.posix.join(input.bundleRoot, 'Contents', 'MacOS')
    : input.bundleRoot;
  mkdirSync(hostDir, { recursive: true });
  const hostName = process.platform === 'win32' ? 'Chips.exe' : 'Chips';
  const hostFile = path.posix.join(hostDir, hostName);
  const stubArgs = [
    JSON.stringify(STUB_HOST_FILE),
    '--root',
    JSON.stringify(input.userdataRoot),
    '--token',
    STUB_TOKEN,
  ];
  if (input.commandsFile !== undefined) {
    stubArgs.push('--commands', JSON.stringify(input.commandsFile));
  }
  if (input.frameLogFile !== undefined) {
    stubArgs.push('--log', JSON.stringify(input.frameLogFile));
  }
  if (process.platform === 'win32') {
    writeFileSync(hostFile, `@echo off\r\n"${process.execPath}" ${stubArgs.join(' ')}\r\n`, 'utf8');
  } else {
    writeFileSync(hostFile, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${stubArgs.join(' ')}\n`, 'utf8');
    chmodSync(hostFile, 0o755);
  }
  return { binFile: path.posix.join(binDir, 'bin.js'), hostFile };
}

/** 以假发行 bundle 的 bin 入口运行 `chips`（其余口径与 `runChips` 一致）。 */
export function runBundledChips(
  binFile: string,
  args: readonly string[],
  env: Record<string, string | undefined>,
  cwd: string
): ICliRun {
  const result = spawnSync(process.execPath, [binFile, ...args], {
    cwd,
    env: { ...env },
    encoding: 'utf8',
  });
  if (result.error !== undefined) {
    throw new Error(`bundle bin 子进程启动失败：${result.error.message}`);
  }
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
