/**
 * CLI 承载链路协议分件（《17-CLI承载链路契约》，工单039 波0 契约冻结）。
 *
 * 本模块是承载链路的**唯一类型与常量来源**：宿主 carrier 服务端（波1）与 CLI 发现组装
 * （波2）都只消费此处导出，禁止任何消费方复刻第二份字面量、封套或路径推导
 * （工单024 ChipsError 分叉的同族红线）。
 *
 * 波0 只冻结类型、常量与形状：
 * - 封套复用 {@link ICarrierRequest} / {@link ICarrierResponse}（`IBridgeRequest` / `IBridgeResponse` 的别名再导出）；
 * - 握手帧 {@link ICarrierHandshakeRequest} / {@link ICarrierHandshakeResponse}；
 * - 承载登记文件记录 {@link ICarrierDiscoveryRecord}；
 * - 端点派生纯函数形状 {@link ICarrierEndpoints}（函数实现归波1，落点即本模块）；
 * - `details.reason` 词表 {@link CARRIER_HANDSHAKE_REASONS}（契约 §5.3 封闭六值）。
 *
 * @remarks
 * 序列化纪律（契约 §3.5）：JSON、camelCase、epoch 毫秒；`bearerToken` 不落日志与结果信封（契约 §2.8）。
 */

import type { IChipsError } from './errors.js';
import type { IBridgeRequest, IBridgeResponse } from './ipc.js';

/** 承载链路协议字面量（契约 §3.1；升级只走版本号协商，禁特性探测）。 */
export const CARRIER_PROTOCOL = 'chips-cli-carrier/1';

/** 协议字面量类型（唯一名字来源）。 */
export type CarrierProtocol = typeof CARRIER_PROTOCOL;

/** 握手超时常量，毫秒（契约 §3.3：双向 fail-closed）。 */
export const CARRIER_HANDSHAKE_TIMEOUT_MS = 5000;

/** 发现文件名（POSIX/win32 同名，落 `<userData>` 根，契约 §2.2）。 */
export const CARRIER_DISCOVERY_FILE_NAME = 'chips-carrier.json';

/** 承载端点文件名，POSIX socket 固定形态（超长缩短形态见 {@link CARRIER_SOCKET_SHORT_PREFIX}，契约 §2.2–§2.3）。 */
export const CARRIER_SOCKET_FILE_NAME = 'chips-carrier.sock';

/** POSIX `sun_path` 字节上限（darwin 104；linux 108，按更严的 104 收敛为规范必项，契约 §2.3）。 */
export const CARRIER_SOCKET_PATH_MAX_BYTES = 104;

/** socket 名超限时的缩短前缀：`chips-c-<16位hex>.sock`（契约 §2.3；缩短仍超限则承载面 fail-closed）。 */
export const CARRIER_SOCKET_SHORT_PREFIX = 'chips-c-';

/** win32 named pipe 名前缀：`\\.\pipe\chips-carrier-<16位hex>`（契约 §2.2，散列 userdata 根以隔离多用户并发）。 */
export const CARRIER_PIPE_NAME_PREFIX = '\\\\.\\pipe\\chips-carrier-';

/** 发现文件与 socket 文件权限模式（POSIX，契约 §2.4；win32 边界按契约 §1.4 挂账）。 */
export const CARRIER_ENDPOINT_FILE_MODE = 0o600;

/** 端点所在 `userData` 目录权限模式（POSIX，契约 §2.4）。 */
export const CARRIER_ENDPOINT_DIR_MODE = 0o700;

/** 承载端点覆盖环境变量（契约 §2.6：跳过发现文件与按需拉起，仍必须握手）。 */
export const CARRIER_SOCKET_ENV = 'CHIPS_CARRIER_SOCKET';

/** 确定性离线条环境变量（契约 §2.6：值只接受 `1`，命中即全链跳过）。 */
export const CARRIER_DISABLE_ENV = 'CHIPS_CARRIER_DISABLE';

/** {@link CARRIER_DISABLE_ENV} 的唯一合法生效值。 */
export const CARRIER_DISABLE_VALUE = '1';

/** 承载登记文件记录（契约 §2.4：未知字段拒绝；camelCase、epoch 毫秒）。 */
export interface ICarrierDiscoveryRecord {
  /** 恒为 {@link CARRIER_PROTOCOL}；读出即不匹配按 `protocol_mismatch` 处理。 */
  readonly protocol: string;
  /** 宿主每次承载实例启动随机生成；与握手响应 `instanceId` 必须一致。 */
  readonly instanceId: string;
  /** {@link deriveCarrierEndpoints} 输出的承载端点值。 */
  readonly socketPath: string;
  /** 宿主进程 PID（陈旧双判据之一）。 */
  readonly pid: number;
  /** 承载实例启动时刻，epoch 毫秒整数（陈旧双判据之二）。 */
  readonly startedAt: number;
  /** CSPRNG 32 字节小写 hex 64 字符；每实例重新生成，不落日志。 */
  readonly bearerToken: string;
}

/** 端点派生结果（契约 §2.2 字段级规范；纯函数实现归波1，落点即本模块）。 */
export interface ICarrierEndpoints {
  /** 派生输入回显：宿主实例 `userData` 根。 */
  readonly userdataRoot: string;
  /** `<userdataRoot>/chips-carrier.json`。 */
  readonly discoveryFile: string;
  /** POSIX socket 路径（含 §2.3 缩短形态）或 win32 pipe 名。 */
  readonly socketPath: string;
}

/**
 * 承载路径唯一派生纯函数签名（契约 §2.2 单一派生源条款）：
 * 无 IO、无时钟、同输入字节级同输出；host/CLI 双侧消费同一实现并由契约测试锁一致。
 * 实现归波1（落点即本模块的 `export function deriveCarrierEndpoints(...)`）。
 */
export type DeriveCarrierEndpoints = (userdataRoot: string) => ICarrierEndpoints;

/** 握手请求帧：连接首帧，非封套帧（契约 §3.2）。 */
export interface ICarrierHandshakeRequest {
  /** 客户端声称的协议字面量（v1 恒为 {@link CARRIER_PROTOCOL}）。 */
  readonly protocol: string;
  /** CLI 进程实例随机标识（仅诊断关联，不参与授权）。 */
  readonly clientId: string;
  /** 与发现文件同值的 bearer token。 */
  readonly bearerToken: string;
}

/** 握手成功响应帧（契约 §3.2）。 */
export interface ICarrierHandshakeSuccess {
  /** 线格式原样回显请求 `protocol`。 */
  readonly protocol: string;
  /** 协商结果：恒等于请求字面量的回显。 */
  readonly negotiated: CarrierProtocol;
  /** 宿主语义版本字符串（诊断呈现，不参与判定）。 */
  readonly hostVersion: string;
  /** 必须与发现文件 `instanceId` 一致。 */
  readonly instanceId: string;
}

/** 握手失败响应帧：`error.code` 恒为 `CLI_TARGET_UNAVAILABLE`，`details.reason` 取 {@link CARRIER_HANDSHAKE_REASONS}。 */
export interface ICarrierHandshakeFailure {
  readonly protocol: string;
  /** 判别式定值：失败时无协商结果。 */
  readonly negotiated: null;
  readonly error: IChipsError;
}

/** 握手响应帧联合（契约 §3.2）。 */
export type ICarrierHandshakeResponse = ICarrierHandshakeSuccess | ICarrierHandshakeFailure;

/**
 * 承载请求封套：复用 Bridge 请求形状，`capabilityId` 槽承载路由面在册 `routeId`
 * （《17》§5.1：`cli.command.*` / `cli.task.*` / `command:invoke`）。
 * 槽位复用不等于 `cli.*` 进入 Bridge 能力注册表（《17》§4.4 禁令）。
 */
export type ICarrierRequest = IBridgeRequest;

/** 承载响应封套：复用 Bridge 响应形状（错误对象 `IChipsError`）。 */
export type ICarrierResponse = IBridgeResponse;

/**
 * 承载链路传输/握手层 `details.reason` 封闭词表（契约 §5.3）：
 * 用户可见错误码零新增（Q5），细分定性只进 `details`，不落 §2.5 码表。
 */
export const CARRIER_HANDSHAKE_REASONS = {
  /** 握手字面量不被服务端支持，或发现文件 `protocol` 不匹配。 */
  protocolMismatch: 'protocol_mismatch',
  /** bearer token 常量时间比较不等。 */
  tokenInvalid: 'token_invalid',
  /** 建连后 {@link CARRIER_HANDSHAKE_TIMEOUT_MS} 内握手未成。 */
  handshakeTimeout: 'handshake_timeout',
  /** 端点不可达：发现文件缺失/陈旧/形状非法、连接被拒、`instanceId` 错位等。 */
  carrierUnavailable: 'carrier_unavailable',
  /** 已建会话后连接中途断（宿主崩溃/重启）。 */
  connectionLost: 'connection_lost',
  /** 服务端收到非在册 `routeId`（防御面）。 */
  routeUnregistered: 'route_unregistered',
} as const;

/** `details.reason` 词表类型。 */
export type CarrierHandshakeReason =
  (typeof CARRIER_HANDSHAKE_REASONS)[keyof typeof CARRIER_HANDSHAKE_REASONS];

/** 词表值集合（契约测试与实现校验共用）。 */
export const CARRIER_HANDSHAKE_REASON_VALUES: readonly CarrierHandshakeReason[] =
  Object.values(CARRIER_HANDSHAKE_REASONS);
