/**
 * 承载端点解析与环境覆盖严格语义（《17-CLI承载链路契约》§2.2、§2.6；比照 `CHIPS_TRUST_ROOTS_FILE` 先例）。
 *
 * 覆盖必测臂：
 * - `CHIPS_CARRIER_DISABLE`：空串/未设 → false；`1` → true；其它非空 → `CLI_ARGUMENT_INVALID`（2）；
 * - `CHIPS_CARRIER_SOCKET`：空串/未设 → null；POSIX 绝对/ win32 `\\.\pipe\` 前缀 → 值；违规 → `CLI_PATH_INVALID`（5）；
 * - 覆盖态保留派生发现文件路径（token 来源）与 `overridden` 标志。
 */

import { describe, expect, it } from 'vitest';

import {
  deriveEndpointsForRoot,
  resolveCarrierDisabled,
  resolveCarrierSocketOverride,
  resolveCarrierTarget,
} from '../src/client/carrier/paths.js';
import { ChipsError, exitCodeForError } from '../src/errors.js';

const originalPlatform = process.platform;

function withPlatform(platform: NodeJS.Platform, run: () => void): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  }
}

function expectCliError(run: () => unknown, code: string, exit: number): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ChipsError);
  expect((caught as ChipsError).code).toBe(code);
  expect(exitCodeForError(caught as ChipsError)).toBe(exit);
}

describe('resolveCarrierDisabled（§2.6）', () => {
  it('未设 / 空串 → false', () => {
    expect(resolveCarrierDisabled({})).toBe(false);
    expect(resolveCarrierDisabled({ CHIPS_CARRIER_DISABLE: '' })).toBe(false);
  });

  it('值 1 → true', () => {
    expect(resolveCarrierDisabled({ CHIPS_CARRIER_DISABLE: '1' })).toBe(true);
  });

  it('其它非空值 → CLI_ARGUMENT_INVALID（退出码 2）', () => {
    expectCliError(
      () => resolveCarrierDisabled({ CHIPS_CARRIER_DISABLE: '0' }),
      'CLI_ARGUMENT_INVALID',
      2
    );
    expectCliError(
      () => resolveCarrierDisabled({ CHIPS_CARRIER_DISABLE: 'true' }),
      'CLI_ARGUMENT_INVALID',
      2
    );
  });
});

describe('resolveCarrierSocketOverride（§2.6 POSIX）', () => {
  it('未设 / 空串 → null', () => {
    withPlatform('darwin', () => {
      expect(resolveCarrierSocketOverride({})).toBeNull();
      expect(resolveCarrierSocketOverride({ CHIPS_CARRIER_SOCKET: '' })).toBeNull();
    });
  });

  it('绝对路径 → 原样返回', () => {
    withPlatform('darwin', () => {
      expect(resolveCarrierSocketOverride({ CHIPS_CARRIER_SOCKET: '/tmp/x.sock' })).toBe(
        '/tmp/x.sock'
      );
    });
  });

  it('相对路径 → CLI_PATH_INVALID（退出码 5）', () => {
    withPlatform('darwin', () => {
      expectCliError(
        () => resolveCarrierSocketOverride({ CHIPS_CARRIER_SOCKET: 'tmp/x.sock' }),
        'CLI_PATH_INVALID',
        5
      );
    });
  });
});

describe('resolveCarrierSocketOverride（§2.6 win32 命名管道）', () => {
  it('`\\\\.\\pipe\\` 前缀且含实例名 → 原样返回', () => {
    withPlatform('win32', () => {
      expect(
        resolveCarrierSocketOverride({
          CHIPS_CARRIER_SOCKET: '\\\\.\\pipe\\chips-carrier-abcdef0123456789',
        })
      ).toBe('\\\\.\\pipe\\chips-carrier-abcdef0123456789');
    });
  });

  it('裸前缀无实例段 / 非管道名 → CLI_PATH_INVALID（退出码 5）', () => {
    withPlatform('win32', () => {
      expectCliError(
        () => resolveCarrierSocketOverride({ CHIPS_CARRIER_SOCKET: '\\\\.\\pipe\\' }),
        'CLI_PATH_INVALID',
        5
      );
      expectCliError(
        () => resolveCarrierSocketOverride({ CHIPS_CARRIER_SOCKET: 'C:\\temp\\x.sock' }),
        'CLI_PATH_INVALID',
        5
      );
    });
  });
});

describe('resolveCarrierTarget + 派生单一源（§2.2/§2.6）', () => {
  it('无覆盖：端点取派生 socketPath，overridden false', () => {
    withPlatform('darwin', () => {
      const endpoints = deriveEndpointsForRoot('/userdata/root');
      const target = resolveCarrierTarget(endpoints, {});
      expect(target).toEqual({
        socketPath: endpoints.socketPath,
        discoveryFile: endpoints.discoveryFile,
        overridden: false,
      });
    });
  });

  it('覆盖态：socketPath 取覆盖值、发现文件仍派生（token 来源不旁路）、overridden true', () => {
    withPlatform('darwin', () => {
      const endpoints = deriveEndpointsForRoot('/userdata/root');
      const target = resolveCarrierTarget(endpoints, {
        CHIPS_CARRIER_SOCKET: '/tmp/override.sock',
      });
      expect(target).toEqual({
        socketPath: '/tmp/override.sock',
        discoveryFile: endpoints.discoveryFile,
        overridden: true,
      });
    });
  });
});
