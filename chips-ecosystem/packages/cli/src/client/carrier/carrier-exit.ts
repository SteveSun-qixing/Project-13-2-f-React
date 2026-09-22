/**
 * 承载错误 → 退出码旁表（《17-CLI承载链路契约》§5.3 收口列；工单024 波D `registerExitCodeHint` 旁表机制）。
 *
 * 零新码族纪律（《17》§5.3/§6.1-3）：`details.reason` 六值只作 `CLI_TARGET_UNAVAILABLE` 内的细分定性，
 * 用户可见码恒取自现行 §2.5 表；退出码差异（发现阶段 → 3、执行阶段 → 6）由**失败类别**决定而非码值，
 * 因此用 `registerExitCodeHint` 进程内旁表登记，提示不进错误对象、不进输出（《RFC-ChipsError统一裁定》§4.6）。
 */

import { CARRIER_HANDSHAKE_REASONS, type CarrierHandshakeReason } from '@chips/bridge';

import type { ChipsError, CliExitCode } from '../../errors.js';
import { registerExitCodeHint } from '../../errors.js';

/**
 * `reason` → 收口退出码（《17》§5.3 表逐行；`carrier_unavailable` 的「拉起超时 → 9」臂属按需启动，
 * 不在本波承载客户端组装面，本表只登记发现阶段的 → 3）。
 */
export const CARRIER_REASON_EXIT_CODES: Readonly<Record<CarrierHandshakeReason, CliExitCode>> = {
  [CARRIER_HANDSHAKE_REASONS.protocolMismatch]: 3,
  [CARRIER_HANDSHAKE_REASONS.tokenInvalid]: 6,
  [CARRIER_HANDSHAKE_REASONS.handshakeTimeout]: 3,
  [CARRIER_HANDSHAKE_REASONS.carrierUnavailable]: 3,
  [CARRIER_HANDSHAKE_REASONS.connectionLost]: 6,
  [CARRIER_HANDSHAKE_REASONS.routeUnregistered]: 6,
};

/** 从错误 `details.reason` 读出承载定性；无词表内 reason 返回 `null`。 */
export function carrierReasonOf(error: ChipsError): CarrierHandshakeReason | null {
  const details = error.details;
  if (typeof details !== 'object' || details === null) {
    return null;
  }
  const reason = (details as { reason?: unknown }).reason;
  if (
    typeof reason === 'string' &&
    Object.values(CARRIER_HANDSHAKE_REASONS).includes(reason as CarrierHandshakeReason)
  ) {
    return reason as CarrierHandshakeReason;
  }
  return null;
}

/**
 * 发现阶段 `CLI_TARGET_UNAVAILABLE` 是否应改判为「无匹配插件命令」（§2.3 回退 3）。
 *
 * 《17》§5.3 收口列只把 `protocol_mismatch / handshake_timeout / carrier_unavailable` 定性为发现
 * 阶段 3；`token_invalid / connection_lost / route_unregistered` 属执行定性，收口码为 6——不得被
 * 「命令未找到」伪装。非承载来源、无词表 reason 的 `CLI_TARGET_UNAVAILABLE`（如缺适配器）维持现行
 * 缺省定性：保守改判 3（§2.3）。
 */
export function isCarrierDiscoveryNotFoundFallback(error: ChipsError): boolean {
  const reason = carrierReasonOf(error);
  if (reason === null) {
    return true;
  }
  return CARRIER_REASON_EXIT_CODES[reason] === 3;
}

/**
 * 按承载定性登记退出码旁表：`CLI_TARGET_UNAVAILABLE` 缺省 6（`exitCodeForCode`），
 * 发现阶段定性（protocol_mismatch/handshake_timeout/carrier_unavailable）覆写为 3。
 * 就地登记、返回同一错误实例（保持本进程 catch 链身份，提示不丢失）。
 */
export function attachCarrierExitCodeHint<T extends ChipsError>(error: T): T {
  const reason = carrierReasonOf(error);
  if (reason === null) {
    return error;
  }
  registerExitCodeHint(error, CARRIER_REASON_EXIT_CODES[reason]);
  return error;
}
