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
 * - 端点派生纯函数 {@link deriveCarrierEndpoints}（波 1 实现落本模块，host/CLI 双侧消费同一实现）；
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
 * 实现即本模块的 {@link deriveCarrierEndpoints}。
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

/**
 * `userdata` 根的 16 位小写散列（契约 §2.2 win32 pipe 名与 §2.3 缩短 socket 名共用）。
 *
 * @remarks SHA-256(UTF-8(userdataRoot)) 十六进制摘要前 16 字符；纯计算，无 IO。
 * 本包构建面零 Node 依赖（`types: []`），SHA-256 为内联纯实现，与
 * `node:crypto.createHash('sha256')` 输出逐字节一致（测试侧以 Node 实现做金钥锁）。
 */
function hash16(userdataRoot: string): string {
  return sha256Hex(userdataRoot).slice(0, 16);
}

/** SHA-256 轮常数（FIPS 180-4 §4.2.2）。 */
const SHA256_K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** FIPS 180-4 SHA-256：UTF-8 输入 → 64 位小写 hex 输出（无 IO、无平台分支）。 */
function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  let paddedLength = bytes.length + 1;
  while (paddedLength % 64 !== 56) {
    paddedLength += 1;
  }
  const totalLength = paddedLength + 8;
  const buffer = new Uint8Array(totalLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;
  const view = new DataView(buffer.buffer);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let t = 0; t < 16; t += 1) {
      w[t] = view.getUint32(offset + t * 4, false);
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15] ?? 0, 7) ^ rotr(w[t - 15] ?? 0, 18) ^ ((w[t - 15] ?? 0) >>> 3);
      const s1 = rotr(w[t - 2] ?? 0, 17) ^ rotr(w[t - 2] ?? 0, 19) ^ ((w[t - 2] ?? 0) >>> 10);
      w[t] = ((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0;
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;
    for (let t = 0; t < 64; t += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (SHA256_K[t] ?? 0) + (w[t] ?? 0)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

/** 当前进程平台标识（无 Node 类型面下探测 `process.platform`；缺省按 POSIX 分支）。 */
function currentPlatform(): string {
  const probe = globalThis as { process?: { platform?: string } };
  return probe.process?.platform ?? 'posix';
}

/**
 * 契约端点路径拼接（规范拼接：仅处理根尾分隔符去重，不做 `.`/`..` 规格化；
 * host 与 CLI 双侧消费同一函数输出并原样落盘/比对，天然一致）。
 */
function joinEndpoint(root: string, name: string, isWin32: boolean): string {
  const separator = isWin32 ? '\\' : '/';
  const trimmed = root.length > 1 ? root.replace(/[\\/]+$/, '') : root;
  if (trimmed === '' || trimmed === separator) {
    return `${trimmed === separator ? '' : trimmed}${separator}${name}`;
  }
  return `${trimmed}${separator}${name}`;
}

/**
 * 承载路径唯一派生纯函数（契约 §2.2 单一派生源条款；波 1 实现落点，RFC §五.1 在册）。
 *
 * @remarks
 * - 无 IO、无时钟、不做存在性判断；同输入（同一 OS 平台）字节级同输出。
 * - 平台形态在调用时取 `process.platform`：win32 派生 pipe 名，POSIX 派生 socket 路径
 *   （超 {@link CARRIER_SOCKET_PATH_MAX_BYTES} 走 §2.3 缩短形态）。
 * - 缩短后仍超限（`userdataRoot` 本身过深）时输出保持缩短形态原样返回，**消费方**按
 *   UTF-8 字节数对照上限执行承载面 fail-closed（契约 §2.3 第 3 条）；禁止在本函数之外
 *   引入第二份路径推导。
 */
export function deriveCarrierEndpoints(userdataRoot: string): ICarrierEndpoints {
  const isWin32 = currentPlatform() === 'win32';
  const discoveryFile = joinEndpoint(userdataRoot, CARRIER_DISCOVERY_FILE_NAME, isWin32);
  let socketPath: string;
  if (isWin32) {
    socketPath = `${CARRIER_PIPE_NAME_PREFIX}${hash16(userdataRoot)}`;
  } else {
    const standard = joinEndpoint(userdataRoot, CARRIER_SOCKET_FILE_NAME, false);
    socketPath =
      new TextEncoder().encode(standard).length <= CARRIER_SOCKET_PATH_MAX_BYTES
        ? standard
        : joinEndpoint(
            userdataRoot,
            `${CARRIER_SOCKET_SHORT_PREFIX}${hash16(userdataRoot)}.sock`,
            false
          );
  }
  return { userdataRoot, discoveryFile, socketPath };
}
