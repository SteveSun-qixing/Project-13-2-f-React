/**
 * 承载链路协议分件冻结面守卫（《17-CLI承载链路契约》波0 契约冻结）：
 * 字面量、超时、文件名、reason 词表与环境变量名是本契约的跨仓唯一来源，
 * 任何值漂移都必须同时改契约文档并递增版本，本测试把「先改文档」的纪律机械化为红。
 */

import { describe, expect, it } from 'vitest';

import {
  CARRIER_DISABLE_ENV,
  CARRIER_DISABLE_VALUE,
  CARRIER_DISCOVERY_FILE_NAME,
  CARRIER_ENDPOINT_DIR_MODE,
  CARRIER_ENDPOINT_FILE_MODE,
  CARRIER_HANDSHAKE_REASON_VALUES,
  CARRIER_HANDSHAKE_REASONS,
  CARRIER_HANDSHAKE_TIMEOUT_MS,
  CARRIER_PIPE_NAME_PREFIX,
  CARRIER_PROTOCOL,
  CARRIER_SOCKET_ENV,
  CARRIER_SOCKET_FILE_NAME,
  CARRIER_SOCKET_PATH_MAX_BYTES,
  CARRIER_SOCKET_SHORT_PREFIX,
  deriveCarrierEndpoints,
} from './carrier.js';

describe('承载链路协议常量（《17》冻结值）', () => {
  it('协议字面量与握手超时', () => {
    expect(CARRIER_PROTOCOL).toBe('chips-cli-carrier/1');
    expect(CARRIER_HANDSHAKE_TIMEOUT_MS).toBe(5000);
  });

  it('发现文件与端点文件名（契约 §2.2 落点形状）', () => {
    expect(CARRIER_DISCOVERY_FILE_NAME).toBe('chips-carrier.json');
    expect(CARRIER_SOCKET_FILE_NAME).toBe('chips-carrier.sock');
    expect(CARRIER_SOCKET_SHORT_PREFIX).toBe('chips-c-');
    expect(CARRIER_PIPE_NAME_PREFIX).toBe('\\\\.\\pipe\\chips-carrier-');
  });

  it('POSIX 权限模式与 sun_path 上限（契约 §2.3–§2.4）', () => {
    expect(CARRIER_ENDPOINT_FILE_MODE).toBe(0o600);
    expect(CARRIER_ENDPOINT_DIR_MODE).toBe(0o700);
    expect(CARRIER_SOCKET_PATH_MAX_BYTES).toBe(104);
    // 缩短名 `chips-c-` + 16 位 hex + `.sock` 自身 29 字节，为深路径预留预算（契约 §2.3）。
    expect(`${CARRIER_SOCKET_SHORT_PREFIX}0123456789abcdef.sock`.length).toBe(29);
  });

  it('环境变量名与离线条生效值（契约 §2.6 / 07.02 §2.7 登记面）', () => {
    expect(CARRIER_SOCKET_ENV).toBe('CHIPS_CARRIER_SOCKET');
    expect(CARRIER_DISABLE_ENV).toBe('CHIPS_CARRIER_DISABLE');
    expect(CARRIER_DISABLE_VALUE).toBe('1');
  });
});

describe('details.reason 封闭词表（契约 §5.3 六值零外泄）', () => {
  it('词表恰为六值且逐值冻结', () => {
    expect(CARRIER_HANDSHAKE_REASONS).toEqual({
      protocolMismatch: 'protocol_mismatch',
      tokenInvalid: 'token_invalid',
      handshakeTimeout: 'handshake_timeout',
      carrierUnavailable: 'carrier_unavailable',
      connectionLost: 'connection_lost',
      routeUnregistered: 'route_unregistered',
    });
    expect(CARRIER_HANDSHAKE_REASON_VALUES).toHaveLength(6);
    expect(new Set(CARRIER_HANDSHAKE_REASON_VALUES).size).toBe(6);
  });

  it('词表值不与任何用户可见错误码同名（零新码族防漂移）', () => {
    for (const reason of CARRIER_HANDSHAKE_REASON_VALUES) {
      expect(reason).not.toMatch(/^CLI_/);
      expect(reason).toMatch(/^[a-z_]+$/);
    }
  });
});

/** 以指定 `process.platform` 值调用派生纯函数（纯函数按调用时平台分支，测试内恢复）。 */
function deriveOnPlatform(
  platform: string,
  userdataRoot: string
): ReturnType<typeof deriveCarrierEndpoints> {
  const proc = (globalThis as { process: { platform: string } }).process;
  const descriptor = Object.getOwnPropertyDescriptor(proc, 'platform');
  Object.defineProperty(proc, 'platform', { value: platform, configurable: true });
  try {
    return deriveCarrierEndpoints(userdataRoot);
  } finally {
    if (descriptor !== undefined) {
      Object.defineProperty(proc, 'platform', descriptor);
    }
  }
}

describe('deriveCarrierEndpoints 单一派生源（契约 §2.2–§2.3 冻结算法）', () => {
  // 金钥向量：SHA-256(UTF-8(root)) 前 16 位小写 hex，由 `node:crypto` 独立计算冻结
  // （内联实现与 Node 实现的一致性在 host 侧契约测试锁做双侧交叉核对）。
  const WIN32_ROOT = 'C:\\Users\\tester\\AppData\\Roaming\\Chips';
  const WIN32_ROOT_HASH16 = '41b42e5979438437';
  const DEEP_POSIX_ROOT = `/${'deep-'.repeat(24)}application-support-chips`;
  const DEEP_POSIX_ROOT_HASH16 = '406b2f799e658cb5';

  it('POSIX 常规形态：发现文件与 socket 固定名（darwin 锁测平台）', () => {
    const root = '/Users/tester/Library/Application Support/Chips';
    const endpoints = deriveOnPlatform('darwin', root);
    expect(endpoints.userdataRoot).toBe(root);
    expect(endpoints.discoveryFile).toBe(`${root}/chips-carrier.json`);
    expect(endpoints.socketPath).toBe(`${root}/chips-carrier.sock`);
    expect(new TextEncoder().encode(endpoints.socketPath).length).toBeLessThanOrEqual(
      CARRIER_SOCKET_PATH_MAX_BYTES
    );
  });

  it('POSIX 超限缩短形态：`chips-c-<16hex>.sock`（契约 §2.3 第 2 条）', () => {
    // 构造标准名超 104 字节的深路径，缩短名自身仅 29 字节。
    expect(
      new TextEncoder().encode(`${DEEP_POSIX_ROOT}/chips-carrier.sock`).length
    ).toBeGreaterThan(CARRIER_SOCKET_PATH_MAX_BYTES);
    const endpoints = deriveOnPlatform('linux', DEEP_POSIX_ROOT);
    expect(endpoints.socketPath).toBe(
      `${DEEP_POSIX_ROOT}/${CARRIER_SOCKET_SHORT_PREFIX}${DEEP_POSIX_ROOT_HASH16}.sock`
    );
    // 发现文件不随 socket 缩短变化（§2.2 落点表）。
    expect(endpoints.discoveryFile).toBe(`${DEEP_POSIX_ROOT}/chips-carrier.json`);
  });

  it('win32 形态：pipe 名散列 userdata 根（契约 §2.2 表 + 裁定细则②）', () => {
    const endpoints = deriveOnPlatform('win32', WIN32_ROOT);
    expect(endpoints.socketPath).toBe(`${CARRIER_PIPE_NAME_PREFIX}${WIN32_ROOT_HASH16}`);
    expect(endpoints.discoveryFile).toBe(`${WIN32_ROOT}\\chips-carrier.json`);
  });

  it('纯函数纪律：同输入字节级同输出、无存在性判断副作用', () => {
    const root = '/tmp/chips-carrier-contract-lock';
    const first = deriveOnPlatform('darwin', root);
    const second = deriveOnPlatform('darwin', root);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    // 不存在的根照样返回派生值（存在性判断归消费方，契约 §2.2）。
    expect(first.discoveryFile).toContain('chips-carrier.json');
  });

  it('跨平台输出与 `ICarrierEndpoints` 三键形状冻结（封套序列化纪律 §3.5-2 camelCase）', () => {
    const endpoints = deriveOnPlatform('darwin', '/tmp/Chips');
    expect(Object.keys(endpoints).sort()).toEqual(['discoveryFile', 'socketPath', 'userdataRoot']);
  });
});
