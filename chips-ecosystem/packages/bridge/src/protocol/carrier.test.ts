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
