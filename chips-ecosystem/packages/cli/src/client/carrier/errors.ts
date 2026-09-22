/**
 * 承载链路错误映射（《17-CLI承载链路契约》§5.3、§5.4；工单024 波D 收敛错误面）。
 *
 * 单一事实源纪律：
 * - `details.reason` 词表、协议字面量一律 import `@chips/bridge` carrier 分件（`CARRIER_HANDSHAKE_REASONS`），
 *   禁止在本模块复刻取值；
 * - 用户可见错误码零新增（《17》§5.3 Q5 裁定、§6.1-3）：传输/握手层失败只落 `CLI_TARGET_UNAVAILABLE`，
 *   退出码由 CLI 既有在册旁表（`../errors.js` 的 `exitCodeForError`）决定——本模块不造第二套码表、
 *   不改 §2.5 码值映射；发现阶段失败对 `cli.command.*` 的 → 3 收口由 `run.ts` 既有回退链承担。
 */

import { CARRIER_HANDSHAKE_REASONS, type CarrierHandshakeReason } from '@chips/bridge';
import type { IChipsError } from '@chips/bridge';

import { cliError, exitCodeForError, toCliError, type CliExitCode } from '../../errors.js';
import type { ChipsError } from '@chips/bridge';

/** 传输/握手层错误的 `details` 形状（《17》§5.3：`reason` + 非敏感诊断 `path`/`env`）。 */
export interface ICarrierTransportDetails {
  readonly reason: CarrierHandshakeReason;
  readonly path?: string;
  readonly env?: string;
  readonly [key: string]: unknown;
}

/**
 * 构造客户端侧传输/握手层错误（《17》§5.3）：码恒为 `CLI_TARGET_UNAVAILABLE`，
 * 细分定性只进 `details.reason`，`bearerToken` 与发现文件内容原文禁止入 `details`（§2.8）。
 */
export function carrierTransportError(
  reason: CarrierHandshakeReason,
  details: Omit<ICarrierTransportDetails, 'reason'> = {}
): ChipsError {
  return cliError('CLI_TARGET_UNAVAILABLE', undefined, { reason, ...details });
}

/**
 * `token_invalid` 定性：token 校验失败按《17》§5.3 只落 `reason`，不带任何 token 派生信息。
 */
export function carrierTokenInvalidError(): ChipsError {
  return carrierTransportError(CARRIER_HANDSHAKE_REASONS.tokenInvalid);
}

/** `handshake_timeout` 定性（建连后 `CARRIER_HANDSHAKE_TIMEOUT_MS` 内未成，§3.3）。 */
export function carrierHandshakeTimeoutError(): ChipsError {
  return carrierTransportError(CARRIER_HANDSHAKE_REASONS.handshakeTimeout);
}

/** `connection_lost` 定性（已建会话后连接中途断，在途请求收口 → 6，§5.4）。 */
export function carrierConnectionLostError(): ChipsError {
  return carrierTransportError(CARRIER_HANDSHAKE_REASONS.connectionLost);
}

/** `carrier_unavailable` 定性（端点不可达：发现文件缺失/陈旧/形状非法、连接被拒、`instanceId` 错位等，§5.3）。 */
export function carrierUnavailableError(
  details: Omit<ICarrierTransportDetails, 'reason'> = {}
): ChipsError {
  return carrierTransportError(CARRIER_HANDSHAKE_REASONS.carrierUnavailable, details);
}

/** `protocol_mismatch` 定性（发现文件 `protocol` 字段不匹配，视同发现失败，§5.3）。 */
export function carrierProtocolMismatchError(
  details: Omit<ICarrierTransportDetails, 'reason'> = {}
): ChipsError {
  return carrierTransportError(CARRIER_HANDSHAKE_REASONS.protocolMismatch, details);
}

/**
 * 封套 `error`（跨进程 `IChipsError` 同构普通对象，宿主 `CarrierWireError` 落帧形态）→ CLI `ChipsError`。
 *
 * @remarks 已登记码原样保留（含 R3 `command:invoke` 臂的 `BRIDGE_INTERNAL`——照实透传，不造第二语义，《17》§5.6），
 * 退出码走 CLI 既有在册旁表（`exitCodeForError`），零新码族（《17》§5.1/§5.3）。
 */
export function carrierWireErrorToCliError(wire: IChipsError): ChipsError {
  return toCliError(wire);
}

/** 承载错误 → 进程退出码（旁表复用 `../errors.js` 的既有映射，不新增码值或行）。 */
export function carrierExitCodeForError(error: ChipsError): CliExitCode {
  return exitCodeForError(error);
}
