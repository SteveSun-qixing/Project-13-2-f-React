/**
 * 承载客户端组装：把发现消费、端点解析、握手会话拼装成 `ICliInvoker` 传输端口
 * （《17-CLI承载链路契约》§5.6「CLI 侧发现组装与 `ICliInvoker` 实装归波 2」）。
 *
 * 职责边界（波 2 组装面）：
 * - 一次性建连（§3.6「一次 CLI 调用 = 一次连接 = 一个会话」）：首请求惰性建立会话并复用至进程结束；
 * - 环境门槛（`CHIPS_CARRIER_DISABLE` / `CHIPS_CARRIER_SOCKET`）→ 端点派生（唯一经 `@chips/bridge`）
 *   → 发现文件消费（含陈旧双判据，CLI 无删除权）→ 建连握手 → 串行封套请求；
 * - 按需拉起（§5.2 bin 相对布局解析 + 30s 就绪轮询 → `CLI_TIMEOUT` 9）与真机配对 E2E 归波 3，
 *   本组装面在发现失败时直接按 §5.4 定性透错，不自造拉起、不跨改宿主。
 *
 * 单一事实源纪律（《17》§6.1）：端点派生、封套、协议字面量、`reason` 词表一律 import `@chips/bridge`，
 * 退出码一律走 CLI 既有在册旁表（`attachCarrierExitCodeHint`），零新码族、零第二实现。
 *
 * @remarks `userdataRoot` 由组装调用方（宿主发行包装配 / e2e 注入）提供：CLI 禁止复刻 Electron
 * `app.getPath('userData')` 命名逻辑（§2.2 红线），故本工厂以入参接收根，不自行派生。
 */

import { randomUUID } from 'node:crypto';

import { CARRIER_DISABLE_ENV } from '@chips/bridge';

import { ChipsError } from '../../errors.js';
import { createNodeFileSystem, type IFileSystemPort } from '../../args/filesystem.js';
import type { ICliInvoker } from '../types.js';

import { carrierProtocolMismatchError, carrierUnavailableError } from './errors.js';
import { attachCarrierExitCodeHint } from './carrier-exit.js';
import {
  createSystemPidProbe,
  readCarrierDiscovery,
  type CarrierDiscoveryRead,
  type IPidProbe,
} from './discovery.js';
import { deriveEndpointsForRoot, resolveCarrierDisabled, resolveCarrierTarget } from './paths.js';
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

  async function establish(): Promise<ICarrierSession> {
    // 1. 确定性离线条：全链跳过，按无承载定性（§2.6）。
    if (resolveCarrierDisabled(env)) {
      throw carrierUnavailableError({ env: CARRIER_DISABLE_ENV });
    }
    // 2. 端点派生（唯一经 `@chips/bridge`）+ 环境覆盖解析（违规原样抛 CLI_PATH_INVALID/ARGUMENT_INVALID）。
    const endpoints = deriveEndpointsForRoot(options.userdataRoot);
    const target = resolveCarrierTarget(endpoints, env);
    // 3. 发现文件消费：覆盖态仍从派生发现文件读取 token 与 instanceId（§2.6）。
    const read = readCarrierDiscovery(fileSystem, target.discoveryFile, pidProbe);
    if (read.status !== 'ready') {
      throw discoveryFailure(read, target.discoveryFile);
    }
    // 4. 建连握手（失败在会话内按 §5.3 定性透出；连接被拒收口 carrier_unavailable）。
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
