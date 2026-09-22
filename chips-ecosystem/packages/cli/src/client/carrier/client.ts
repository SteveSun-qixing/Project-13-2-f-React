/**
 * 承载客户端组装：把发现消费、端点解析、握手会话、按需启动拼装成 `ICliInvoker` 传输端口
 * （《17-CLI承载链路契约》§5.6「CLI 侧发现组装与 `ICliInvoker` 实装归波 2」；
 * §5.2 按需启动臂与 bin 生命周期归波 3，本模块承装）。
 *
 * 职责边界：
 * - 一次性建连（§3.6「一次 CLI 调用 = 一次连接 = 一个会话」）：首请求惰性建立会话并复用至进程结束；
 * - 环境门槛（`CHIPS_CARRIER_DISABLE` / `CHIPS_CARRIER_SOCKET`）→ 端点派生（唯一经 `@chips/bridge`）
 *   → 发现文件消费（含陈旧双判据，CLI 无删除权）→ 建连握手 → 串行封套请求；
 * - 按需拉起（§5.2，Q6(c)）：发现阶段失败（文件缺失/陈旧/连接失败定性
 *   `carrier_unavailable`）且未处于环境覆盖态时，按平台发行包固定布局解析宿主可执行文件——
 *   解析不出按现行无承载回退（原定性透错），解析成功则 detached 拉起正常实例并在 30s 预算内
 *   轮询就绪（超时 → `CLI_TIMEOUT`/9）；拉起原语由 `launch` 配置注入（缺省实现见 `launch.ts`）；
 * - bin 生命周期：{@link ICarrierInvoker.dispose} 收口 CLI 自身会话（拉起后宿主的存续/退出
 *   语义不入 v1，§5.2-6）。
 *
 * 单一事实源纪律（《17》§6.1）：端点派生、封套、协议字面量、`reason` 词表一律 import `@chips/bridge`，
 * 退出码一律走 CLI 既有在册旁表（`attachCarrierExitCodeHint`），零新码族、零第二实现。
 *
 * @remarks `userdataRoot` 由组装调用方（生产装配 `runtime/production-client.ts` 按 §2.2
 * 发行布局解析 / 测试注入）提供：CLI 禁止复刻 Electron 命名逻辑的散落推导（§2.2 红线），
 * 根解析唯一落 `userdata.ts`，本工厂以入参接收根，不自行派生。
 */

import { randomUUID } from 'node:crypto';

import { CARRIER_DISABLE_ENV, CARRIER_HANDSHAKE_REASONS } from '@chips/bridge';

import { ChipsError, cliError } from '../../errors.js';
import { createNodeFileSystem, type IFileSystemPort } from '../../args/filesystem.js';
import type { ICliInvoker } from '../types.js';

import { carrierProtocolMismatchError, carrierUnavailableError } from './errors.js';
import { attachCarrierExitCodeHint, carrierReasonOf } from './carrier-exit.js';
import {
  createSystemPidProbe,
  readCarrierDiscovery,
  type CarrierDiscoveryRead,
  type IPidProbe,
} from './discovery.js';
import {
  HOST_LAUNCH_READY_BUDGET_MS,
  HOST_LAUNCH_READY_POLL_MS,
  type ICarrierLaunchConfig,
} from './launch.js';
import {
  deriveEndpointsForRoot,
  resolveCarrierDisabled,
  resolveCarrierTarget,
  type ICarrierTarget,
} from './paths.js';
import { nodeCarrierSocketFactory } from './socket.js';
import {
  openCarrierSession,
  type CarrierSocketFactory,
  type ICarrierSession,
} from './transport.js';

/** 承载调用端口：在 {@link ICliInvoker} 之上追加会话释放（供 bin 生命周期在波 3 接线）。 */
export interface ICarrierInvoker extends ICliInvoker {
  /** 释放底层会话连接（幂等；未建连时为空操作）。 */
  dispose(): void;
}

/** `createCarrierInvoker` 组装选项。 */
export interface ICarrierInvokerOptions {
  /** 宿主实例 `userData` 根（由发行包装配 / 测试注入；CLI 不复刻 Electron 命名，《17》§2.2）。 */
  readonly userdataRoot: string;
  /** 环境变量视图（缺省 `process.env`）。 */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** 文件端口（缺省 Node 实现）。 */
  readonly fileSystem?: IFileSystemPort;
  /** 进程判据探针（缺省系统探针，《17》§2.5-3 双判据）。 */
  readonly pidProbe?: IPidProbe;
  /** 端点连接工厂（缺省 `node:net` path 型连接）。 */
  readonly connect?: CarrierSocketFactory;
  /** CLI 进程实例标识（缺省随机 UUID；仅诊断关联，不参与授权，《17》§3.2）。 */
  readonly clientId?: string;
  /** 握手超时注入位（缺省恒为契约字面量，测试等形不放宽默认值，《17》§3.3）。 */
  readonly handshakeTimeoutMs?: number;
  /** 时钟注入位（仅系统探针缺省实现消费）。 */
  readonly now?: () => number;
  /**
   * 按需启动配置（《17》§5.2，Q6(c)）：缺省 `undefined` 即不拉起——发现失败按 §5.4 定性
   * 透错（波 2 组装面原语义，测试/e2e 覆盖态用）；生产装配注入缺省实现
   * （`createDefaultHostLauncherConfig`）。
   */
  readonly launch?: ICarrierLaunchConfig;
}

/**
 * 组装承载调用端口：返回 `ICarrierInvoker`，首请求惰性建立单会话并复用至释放。
 *
 * @throws 建立/传输/握手层失败以 `CLI_TARGET_UNAVAILABLE` + `details.reason` 透出（《17》§5.3），
 * 退出码经 `attachCarrierExitCodeHint` 旁表按 §5.3 收口列定性；环境覆盖违规原样透出
 * `CLI_PATH_INVALID`（5）/`CLI_ARGUMENT_INVALID`（2）；封套业务错误与 R3 `BRIDGE_INTERNAL` 臂原样透传走既有码表。
 */
export function createCarrierInvoker(options: ICarrierInvokerOptions): ICarrierInvoker {
  const env = options.env ?? process.env;
  const fileSystem = options.fileSystem ?? createNodeFileSystem();
  const pidProbe = options.pidProbe ?? createSystemPidProbe(options.now ?? Date.now);
  const connect = options.connect ?? nodeCarrierSocketFactory;
  const clientId = options.clientId ?? randomUUID();

  let sessionPromise: Promise<ICarrierSession> | null = null;
  let settledSession: ICarrierSession | null = null;

  /** 单次建链（不做拉起）：发现文件消费 → 建连握手。失败按 §5.3/§5.4 定性抛出。 */
  async function connectOnce(target: ICarrierTarget): Promise<ICarrierSession> {
    // 发现文件消费：覆盖态仍从派生发现文件读取 token 与 instanceId（§2.6）。
    const read = readCarrierDiscovery(fileSystem, target.discoveryFile, pidProbe);
    if (read.status !== 'ready') {
      throw discoveryFailure(read, target.discoveryFile);
    }
    // 建连握手（失败在会话内按 §5.3 定性透出；连接被拒收口 carrier_unavailable）。
    const session = await openCarrierSession({
      socketPath: target.socketPath,
      record: read.record,
      clientId,
      connect,
      ...(options.handshakeTimeoutMs === undefined
        ? {}
        : { handshakeTimeoutMs: options.handshakeTimeoutMs }),
    });
    settledSession = session;
    return session;
  }

  async function establish(): Promise<ICarrierSession> {
    // 1. 确定性离线条：全链跳过，按无承载定性（§2.6），按需启动同被跳过。
    if (resolveCarrierDisabled(env)) {
      throw carrierUnavailableError({ env: CARRIER_DISABLE_ENV });
    }
    // 2. 端点派生（唯一经 `@chips/bridge`）+ 环境覆盖解析（违规原样抛 CLI_PATH_INVALID/ARGUMENT_INVALID）。
    const endpoints = deriveEndpointsForRoot(options.userdataRoot);
    const target = resolveCarrierTarget(endpoints, env);
    try {
      return await connectOnce(target);
    } catch (error) {
      // 3. §5.2 按需启动闸：`CHIPS_CARRIER_SOCKET` 覆盖态跳过拉起（§2.6/§5.2 首句），
      //    未配置 `launch` 的组装面维持波 2 定性透错；其余发现阶段失败
      //    （缺失/陈旧/连接失败收口 `carrier_unavailable`）进入拉起判定链。
      const launch = options.launch;
      if (launch === undefined || target.overridden || !isLaunchableFailure(error)) {
        throw error;
      }
      return await launchAndAwaitReady(launch, target, error as ChipsError);
    }
  }

  /** §5.2 拉起判定链：解析不出 → 原定性透错；解析成功 → detached 拉起 + 30s 就绪轮询，超时 `CLI_TIMEOUT`（9）。 */
  async function launchAndAwaitReady(
    launch: ICarrierLaunchConfig,
    target: ICarrierTarget,
    originalError: ChipsError
  ): Promise<ICarrierSession> {
    const executable = launch.resolveHostExecutable();
    if (executable === null) {
      // §5.2-1：解析不出按现行无承载回退（发现阶段定性原样透错 → 3，run.ts 既有链）。
      throw originalError;
    }
    try {
      launch.spawnHost(executable);
    } catch {
      // 拉起失败（进程表拒绝等）与解析不出同定性收口：不伪造第二语义（§5.3 零新码族）。
      throw originalError;
    }
    const budgetMs = launch.readyBudgetMs ?? HOST_LAUNCH_READY_BUDGET_MS;
    const pollIntervalMs = launch.readyPollIntervalMs ?? HOST_LAUNCH_READY_POLL_MS;
    const now = launch.now ?? Date.now;
    const sleep = launch.sleep ?? defaultLaunchSleep;
    const deadline = now() + budgetMs;
    let lastError: ChipsError = originalError;
    for (;;) {
      await sleep(pollIntervalMs);
      try {
        return await connectOnce(target);
      } catch (error) {
        if (!isLaunchableFailure(error)) {
          // 就绪后的非发现阶段定性（如 `token_invalid`/`protocol_mismatch`）如实收口，不再重试。
          throw error instanceof ChipsError ? error : lastError;
        }
        lastError = error as ChipsError;
      }
      if (now() >= deadline) {
        // §5.2-4：超时 → `CLI_TIMEOUT`（退出码 9，承载链路分支自协议落地起可实测，《17》§5.3）。
        throw cliError('CLI_TIMEOUT', undefined, {
          budgetMs,
          path: target.discoveryFile,
        });
      }
    }
  }

  function ensureSession(): Promise<ICarrierSession> {
    if (sessionPromise === null) {
      sessionPromise = establish();
    }
    return sessionPromise;
  }

  return {
    async request<TOutput>(routeId: string, input?: unknown): Promise<TOutput> {
      try {
        const session = await ensureSession();
        return await session.request<TOutput>(routeId, input);
      } catch (error) {
        throw error instanceof ChipsError ? attachCarrierExitCodeHint(error) : error;
      }
    },
    dispose(): void {
      const session = settledSession;
      settledSession = null;
      sessionPromise = null;
      session?.close();
    },
  };
}

/** 发现失败定性 → 承载错误（`protocol_mismatch` 独立臂，其余缺失/陈旧/形状非法合 `carrier_unavailable`，《17》§5.3）。 */
function discoveryFailure(
  read: Exclude<CarrierDiscoveryRead, { status: 'ready' }>,
  discoveryFile: string
): ChipsError {
  if (read.status === 'protocol_mismatch') {
    return carrierProtocolMismatchError({ path: discoveryFile });
  }
  return carrierUnavailableError({ path: discoveryFile });
}

/**
 * 拉起触发判定（《17》§5.2 首句：发现文件缺失或陈旧、连接失败；§5.3 对应收口行
 * `carrier_unavailable`「视同发现失败 → 3；拉起超时 → 9」）。`protocol_mismatch`/
 * `token_invalid`/`handshake_timeout` 不在 §5.2 触发清单内，不拉起。
 */
function isLaunchableFailure(error: unknown): boolean {
  if (!(error instanceof ChipsError)) {
    return false;
  }
  return carrierReasonOf(error) === CARRIER_HANDSHAKE_REASONS.carrierUnavailable;
}

/** 就绪轮询缺省休眠（节奏实现细节，不构成性能基线）。 */
function defaultLaunchSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
