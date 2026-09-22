/**
 * 按需启动：宿主可执行文件固定布局解析与短生命周期承载拉起
 * （《17-CLI承载链路契约》§5.2，立项评估 Q6 裁定采 (c)）。
 *
 * 条款逐字落点：
 * - §5.2-1：仅当能按平台发行包固定布局解析出宿主可执行文件时自动拉起；解析不出按现行
 *   无承载回退（发现阶段 → `CLI_COMMAND_NOT_FOUND`/退出码 3 的既有链，《17》§5.3 收口）；
 * - §5.2-2：解析锚点 = CLI 自身正式入口文件（`packages/cli/package.json` bin 指向的
 *   `dist/bin.js`）realpath 所在目录，自该目录向上至多 6 级逐层探测；darwin 候选
 *   `<D>/Contents/MacOS/Chips`、win32 候选 `<D>\Chips.exe`、linux 候选 `<D>/Chips`；
 *   命中还须是可执行文件（POSIX `X_OK`），否则继续向上探测；
 * - §5.2-3：detached 启动解析出的宿主正常实例（空附加参数，无「承载专用启动模式」），
 *   CLI 不等待其 stdio；单实例锁保证不会拉起第二个宿主；
 * - §5.2-4：就绪等待 = 轮询发现文件直至出现且双判据新鲜、握手成功；预算 = 既有启动等待
 *   常量 30 秒（`constants.ts` `LIFECYCLE_APPLY_TIMEOUT_MS`），超时 → `CLI_TIMEOUT`（9）；
 * - §5.2-5：monorepo 工作区形态必然解析不出（禁止借道全局陈旧 bin 或猜宿主安装位置），
 *   dev/e2e 场景一律走 `CHIPS_CARRIER_SOCKET` 覆盖面——覆盖态与确定性离线条下本模块
 *   完全不参与（`client.ts` 组装位收口）；
 * - §5.2-6：拉起后宿主的存续/退出语义不入 v1——本模块对拉起进程只做「启动即放手」
 *   （detached + unref，不持句柄、不看护、不收口），bin 生命周期只负责 CLI 自身会话释放。
 */

import { spawn } from 'node:child_process';
import { constants as fsConstants, accessSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

import { LIFECYCLE_APPLY_TIMEOUT_MS, TASK_POLL_INTERVAL_MS } from '../../constants.js';

/** §5.2-2「自该目录向上至多 6 级」的层级上限（锚点目录本身为第 0 级探测位）。 */
export const HOST_BIN_UPWARD_LEVELS = 6;

/** 拉起就绪轮询预算（§5.2-4：既有启动等待常量 30s，《17》§5.2 逐字引用，不新造基线）。 */
export const HOST_LAUNCH_READY_BUDGET_MS = LIFECYCLE_APPLY_TIMEOUT_MS;

/** 拉起就绪的发现文件轮询间隔（只影响等待节奏，与任务轮询同族实现细节，不构成性能基线）。 */
export const HOST_LAUNCH_READY_POLL_MS = TASK_POLL_INTERVAL_MS;

/** 平台 → 相对探测根的候选文件路径段（§5.2-2 字段级冻结布局，禁止扩充或别名）。 */
function hostBinCandidates(platform: NodeJS.Platform): readonly string[] {
  if (platform === 'win32') {
    return ['Chips.exe'];
  }
  if (platform === 'darwin') {
    return ['Contents', 'MacOS', 'Chips'];
  }
  return ['Chips'];
}

/**
 * 拉起配置（发现组装侧消费，《17》§5.2）：解析、spawn 与就绪预算全部注入化，
 * 生产缺省由 {@link createDefaultHostLauncherConfig} 装配；测试/e2e 以替身驱动。
 */
export interface ICarrierLaunchConfig {
  /** 按 §5.2-2 固定布局解析宿主可执行文件；解析不出返回 `null`（→ 现行无承载回退）。 */
  resolveHostExecutable(): string | null;
  /** §5.2-3 拉起：detached 启动正常实例，不等待 stdio；spawn 失败按解析不出同定性收口。 */
  spawnHost(executable: string): void;
  /** 就绪等待预算毫秒（缺省 30s，§5.2-4）。 */
  readonly readyBudgetMs?: number;
  /** 发现文件轮询间隔毫秒（缺省 {@link HOST_LAUNCH_READY_POLL_MS}）。 */
  readonly readyPollIntervalMs?: number;
  /** 时钟注入位（仅缺省轮询预算消费）。 */
  readonly now?: () => number;
  /** 休眠注入位（测试等形不放宽缺省语义）。 */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** 解析选项（测试注入位；缺省全部绑真实文件系统）。 */
export interface IHostExecutableResolveInput {
  /** CLI 自身正式入口文件（realpath 锚点，§5.2-2）。 */
  readonly cliEntryFile: string;
  readonly platform?: NodeJS.Platform;
  /** 可执行文件探针：存在、是普通文件且（POSIX）可执行。 */
  readonly isExecutableFile?: (file: string) => boolean;
  /** realpath 注入位（缺省 `fs.realpathSync`）。 */
  readonly realpath?: (file: string) => string;
}

/** 缺省可执行文件探针：`stat` 普通文件 + POSIX `X_OK`（win32 无权限位语义，命中即可）。 */
export function defaultIsExecutableFile(file: string): boolean {
  try {
    if (!statSync(file).isFile()) {
      return false;
    }
    if (process.platform === 'win32') {
      return true;
    }
    accessSync(file, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * §5.2-2 固定布局解析：锚点 realpath 所在目录起，自该目录向上至多 6 级逐层探测平台候选。
 *
 * @returns 命中的宿主可执行文件绝对路径；全部落空返回 `null`（调用方走现行无承载回退，
 *          禁止借道全局陈旧 bin 或猜测宿主安装位置——§5.2-5 禁漂移条款）。
 */
export function resolveHostExecutable(input: IHostExecutableResolveInput): string | null {
  const platform = input.platform ?? process.platform;
  const isExecutableFile = input.isExecutableFile ?? defaultIsExecutableFile;
  const realpath = input.realpath ?? ((file: string): string => realpathSync(file));
  const joiner =
    platform === 'win32'
      ? (...segments: string[]): string => path.win32.join(...segments)
      : (...segments: string[]): string => path.posix.join(...segments);
  const dirname =
    platform === 'win32'
      ? (file: string): string => path.win32.dirname(file)
      : (file: string): string => path.posix.dirname(file);
  let anchor: string;
  try {
    anchor = dirname(realpath(input.cliEntryFile));
  } catch {
    return null;
  }
  const segments = hostBinCandidates(platform);
  let current = anchor;
  for (let level = 0; level <= HOST_BIN_UPWARD_LEVELS; level += 1) {
    const candidate = joiner(current, ...segments);
    if (isExecutableFile(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
  return null;
}

/** 缺省拉起实现：detached + stdio ignore + unref（§5.2-3；不等待、不看护，§5.2-6）。 */
export function defaultSpawnHost(executable: string): void {
  const child = spawn(executable, [], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

/**
 * 生产缺省拉起配置：解析锚点绑 CLI 正式入口 realpath，spawn 走系统进程表。
 *
 * @param cliEntryFile CLI 自身正式入口文件（发行 bin 指向的 `dist/bin.js`）。
 */
export function createDefaultHostLauncherConfig(
  cliEntryFile: string,
  overrides: Partial<Omit<ICarrierLaunchConfig, 'resolveHostExecutable'>> = {}
): ICarrierLaunchConfig {
  return {
    resolveHostExecutable: () => resolveHostExecutable({ cliEntryFile }),
    spawnHost: overrides.spawnHost ?? defaultSpawnHost,
    ...(overrides.readyBudgetMs === undefined ? {} : { readyBudgetMs: overrides.readyBudgetMs }),
    ...(overrides.readyPollIntervalMs === undefined
      ? {}
      : { readyPollIntervalMs: overrides.readyPollIntervalMs }),
    ...(overrides.now === undefined ? {} : { now: overrides.now }),
    ...(overrides.sleep === undefined ? {} : { sleep: overrides.sleep }),
  };
}
