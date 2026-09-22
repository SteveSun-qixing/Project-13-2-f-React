/**
 * 承载端点解析与环境变量覆盖面（《17-CLI承载链路契约》§2.2、§2.6）。
 *
 * 单一事实源纪律：承载路径（发现文件与 socket/pipe）一律经 `@chips/bridge` 的
 * `deriveCarrierEndpoints` 派生（§2.2 单一派生源条款），本模块只做「根解析 + 环境覆盖 +
 * 严格错误语义」，禁止复刻第二份落点拼接（《17》§6.1-1 红线）。
 *
 * 环境变量严格语义比照 `CHIPS_TRUST_ROOTS_FILE` 先例（《17》§2.6）：
 * - `CHIPS_CARRIER_DISABLE`：值非 `1` 且非空串 → `CLI_ARGUMENT_INVALID`（退出码 2）；空串按未设置；
 * - `CHIPS_CARRIER_SOCKET`：空串按未设置；POSIX 非绝对路径 / win32 非 `\\.\pipe\` 前缀 →
 *   `CLI_PATH_INVALID`（退出码 5）；命中即跳过发现文件读取与按需拉起，直连端点后仍必须握手与 token 校验。
 */

import { isAbsolute } from 'node:path';

import {
  CARRIER_DISABLE_ENV,
  CARRIER_DISABLE_VALUE,
  CARRIER_PIPE_NAME_PREFIX,
  CARRIER_SOCKET_ENV,
  deriveCarrierEndpoints,
  type ICarrierEndpoints,
} from '@chips/bridge';

import { cliError } from '../../errors.js';

/** 承载端点解析结果：连接目标端点与 token 来源发现文件路径。 */
export interface ICarrierTarget {
  /** 实际连接的端点值：`CHIPS_CARRIER_SOCKET` 覆盖值或派生 socketPath。 */
  readonly socketPath: string;
  /** bearer token 来源发现文件路径（覆盖态仍从派生发现文件读取 token，《17》§2.6）。 */
  readonly discoveryFile: string;
  /** 是否由环境变量直连覆盖（命中即跳过按需拉起，《17》§2.6/§5.2）。 */
  readonly overridden: boolean;
}

/** 当前进程平台标识（win32 分支判定；其余按 POSIX）。 */
function isWin32(): boolean {
  return process.platform === 'win32';
}

/** 校验并归一 `CHIPS_CARRIER_DISABLE`：返回是否处于确定性离线条。 */
export function resolveCarrierDisabled(env: Readonly<Record<string, string | undefined>>): boolean {
  const raw = env[CARRIER_DISABLE_ENV];
  if (raw === undefined || raw === '') {
    return false;
  }
  if (raw !== CARRIER_DISABLE_VALUE) {
    throw cliError(
      'CLI_ARGUMENT_INVALID',
      `${CARRIER_DISABLE_ENV} 只接受值 1（空串按未设置处理）`,
      {
        env: CARRIER_DISABLE_ENV,
        value: raw,
      }
    );
  }
  return true;
}

/**
 * 校验并归一 `CHIPS_CARRIER_SOCKET`：返回覆盖端点值，未设置返回 `null`。
 *
 * @remarks 空串按未设置；POSIX 要求绝对路径，win32 要求 `\\.\pipe\` 前缀（前缀常量为字面
 * 双反斜杠文本，命中即 `startsWith` 判定）；违规 `CLI_PATH_INVALID`（退出码 5），`details.env` 登记。
 */
export function resolveCarrierSocketOverride(
  env: Readonly<Record<string, string | undefined>>
): string | null {
  const raw = env[CARRIER_SOCKET_ENV];
  if (raw === undefined || raw === '') {
    return null;
  }
  if (isWin32()) {
    // `\\.\pipe\` 根前缀由 bridge 常量去掉实例散列后缀段派生，禁止另写字面量（《17》§6.1-1）。
    const pipeRoot = CARRIER_PIPE_NAME_PREFIX.split('chips-carrier-')[0] ?? '';
    if (!raw.startsWith(pipeRoot) || raw.length <= pipeRoot.length) {
      throw cliError(
        'CLI_PATH_INVALID',
        `${CARRIER_SOCKET_ENV} 必须是命名管道名（\\\\.\\pipe\\ 前缀）`,
        {
          env: CARRIER_SOCKET_ENV,
          value: raw,
        }
      );
    }
    return raw;
  }
  if (!isAbsolute(raw)) {
    throw cliError('CLI_PATH_INVALID', `${CARRIER_SOCKET_ENV} 必须是绝对路径`, {
      env: CARRIER_SOCKET_ENV,
      value: raw,
    });
  }
  return raw;
}

/**
 * 解析承载端点：环境覆盖优先，否则从 `userDataRoot` 派生（派生唯一经 `deriveCarrierEndpoints`）。
 *
 * @remarks `CHIPS_CARRIER_SOCKET` 只覆盖连接端点，不提供 token 旁路：发现文件路径恒由
 * `userDataRoot` 派生（《17》§2.6）；`userDataRoot` 由组装位（`createCarrierInvoker`）解析注入。
 */
export function resolveCarrierTarget(
  endpoints: ICarrierEndpoints,
  env: Readonly<Record<string, string | undefined>>
): ICarrierTarget {
  const override = resolveCarrierSocketOverride(env);
  if (override !== null) {
    return { socketPath: override, discoveryFile: endpoints.discoveryFile, overridden: true };
  }
  return {
    socketPath: endpoints.socketPath,
    discoveryFile: endpoints.discoveryFile,
    overridden: false,
  };
}

/** 从 `userData` 根派生承载端点（`@chips/bridge` 单一派生源的薄封装，便于注入根与测试）。 */
export function deriveEndpointsForRoot(userdataRoot: string): ICarrierEndpoints {
  return deriveCarrierEndpoints(userdataRoot);
}
