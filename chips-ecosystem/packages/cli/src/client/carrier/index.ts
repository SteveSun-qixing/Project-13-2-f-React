/**
 * CLI 承载链路客户端组装出口（工单039 波 2）。
 *
 * 单一入口聚合发现消费、端点解析、握手会话、错误映射与 `ICarrierInvoker` 组装；
 * 消费方（发行包装配 / e2e）只经此面接入承载链路，不直连内部模块。
 */

export {
  createCarrierInvoker,
  type ICarrierInvoker,
  type ICarrierInvokerOptions,
} from './client.js';

export {
  resolveCarrierDisabled,
  resolveCarrierSocketOverride,
  resolveCarrierTarget,
  deriveEndpointsForRoot,
  type ICarrierTarget,
} from './paths.js';

export {
  parseDiscoveryRecord,
  judgeStaleness,
  readCarrierDiscovery,
  createSystemPidProbe,
  type IPidProbe,
  type CarrierStaleness,
  type CarrierDiscoveryRead,
} from './discovery.js';

export {
  openCarrierSession,
  type ICarrierSocket,
  type ICarrierSession,
  type ICarrierSessionInput,
  type CarrierSocketFactory,
} from './transport.js';

export { connectCarrierSocket, nodeCarrierSocketFactory } from './socket.js';

export {
  carrierTransportError,
  carrierTokenInvalidError,
  carrierHandshakeTimeoutError,
  carrierConnectionLostError,
  carrierUnavailableError,
  carrierProtocolMismatchError,
  carrierWireErrorToCliError,
  carrierExitCodeForError,
  type ICarrierTransportDetails,
} from './errors.js';

export {
  CARRIER_REASON_EXIT_CODES,
  carrierReasonOf,
  attachCarrierExitCodeHint,
} from './carrier-exit.js';
