/**
 * 承载 `reason` → 退出码旁表逐行核验（《17-CLI承载链路契约》§5.3 收口列；工单024 波D 旁表机制）。
 *
 * 零新码族纪律：用户可见码恒 `CLI_TARGET_UNAVAILABLE`，退出码差异由 `registerExitCodeHint` 旁表按
 * 失败类别登记；本表逐行锁死 §5.3 收口列，防漂移。
 */

import { describe, expect, it } from 'vitest';

import { CARRIER_HANDSHAKE_REASONS, type CarrierHandshakeReason } from '@chips/bridge';

import { ChipsError, cliError, exitCodeForError } from '../src/errors.js';
import {
  CARRIER_REASON_EXIT_CODES,
  attachCarrierExitCodeHint,
  carrierReasonOf,
  isCarrierDiscoveryNotFoundFallback,
} from '../src/client/carrier/carrier-exit.js';
import {
  carrierConnectionLostError,
  carrierHandshakeTimeoutError,
  carrierProtocolMismatchError,
  carrierTokenInvalidError,
  carrierUnavailableError,
} from '../src/client/carrier/errors.js';

function carrierError(reason: CarrierHandshakeReason): ChipsError {
  return cliError('CLI_TARGET_UNAVAILABLE', undefined, { reason });
}

describe('CARRIER_REASON_EXIT_CODES 逐行（§5.3）', () => {
  it('词表六值全覆盖、无缺漏', () => {
    expect(Object.keys(CARRIER_REASON_EXIT_CODES).sort()).toEqual(
      Object.values(CARRIER_HANDSHAKE_REASONS).slice().sort()
    );
  });

  const rows: ReadonlyArray<readonly [CarrierHandshakeReason, number]> = [
    [CARRIER_HANDSHAKE_REASONS.protocolMismatch, 3],
    [CARRIER_HANDSHAKE_REASONS.tokenInvalid, 6],
    [CARRIER_HANDSHAKE_REASONS.handshakeTimeout, 3],
    [CARRIER_HANDSHAKE_REASONS.carrierUnavailable, 3],
    [CARRIER_HANDSHAKE_REASONS.connectionLost, 6],
    [CARRIER_HANDSHAKE_REASONS.routeUnregistered, 6],
  ];

  for (const [reason, exit] of rows) {
    it(`${reason} → ${exit}`, () => {
      expect(CARRIER_REASON_EXIT_CODES[reason]).toBe(exit);
    });
  }
});

describe('attachCarrierExitCodeHint：登记后 exitCodeForError 读旁表', () => {
  const cases: ReadonlyArray<readonly [ChipsError, number]> = [
    [carrierProtocolMismatchError(), 3],
    [carrierTokenInvalidError(), 6],
    [carrierHandshakeTimeoutError(), 3],
    [carrierUnavailableError(), 3],
    [carrierConnectionLostError(), 6],
  ];

  for (const [error, exit] of cases) {
    it(`${String(error.details)} → 退出码 ${exit}`, () => {
      const hinted = attachCarrierExitCodeHint(error);
      expect(hinted).toBe(error);
      expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
      expect(exitCodeForError(error)).toBe(exit);
    });
  }

  it('route_unregistered 定性 → 6（防御臂）', () => {
    const error = carrierError(CARRIER_HANDSHAKE_REASONS.routeUnregistered);
    attachCarrierExitCodeHint(error);
    expect(exitCodeForError(error)).toBe(6);
  });

  it('非承载错误（无 reason 词表）→ 不覆写，回落既有码表缺省 6', () => {
    const error = cliError('CLI_TARGET_UNAVAILABLE', undefined, { unrelated: true });
    const returned = attachCarrierExitCodeHint(error);
    expect(returned).toBe(error);
    expect(exitCodeForError(error)).toBe(6);
  });
});

describe('carrierReasonOf：定性抽取', () => {
  it('词表内 reason → 原样返回', () => {
    expect(carrierReasonOf(carrierConnectionLostError())).toBe('connection_lost');
  });

  it('无 details / 非词表 reason → null', () => {
    expect(carrierReasonOf(cliError('CLI_TARGET_UNAVAILABLE'))).toBeNull();
    expect(carrierReasonOf(carrierError('not_a_reason' as CarrierHandshakeReason))).toBeNull();
  });
});

describe('isCarrierDiscoveryNotFoundFallback：发现阶段改判面（§5.3 vs §2.3）', () => {
  it('无词表 reason 的 CLI_TARGET_UNAVAILABLE（缺适配器等）→ 保守改判 true（维持 §2.3 回退 3）', () => {
    expect(
      isCarrierDiscoveryNotFoundFallback(
        cliError('CLI_TARGET_UNAVAILABLE', undefined, { method: 'x' })
      )
    ).toBe(true);
  });

  it('非词表 reason → 视作无定性，改判 true', () => {
    expect(
      isCarrierDiscoveryNotFoundFallback(carrierError('not_a_reason' as CarrierHandshakeReason))
    ).toBe(true);
  });

  const discovery: readonly CarrierHandshakeReason[] = [
    CARRIER_HANDSHAKE_REASONS.protocolMismatch,
    CARRIER_HANDSHAKE_REASONS.handshakeTimeout,
    CARRIER_HANDSHAKE_REASONS.carrierUnavailable,
  ];
  for (const reason of discovery) {
    it(`发现定性 ${reason}（§5.3 收口 3）→ 改判 true`, () => {
      expect(isCarrierDiscoveryNotFoundFallback(carrierError(reason))).toBe(true);
    });
  }

  const execution: readonly CarrierHandshakeReason[] = [
    CARRIER_HANDSHAKE_REASONS.tokenInvalid,
    CARRIER_HANDSHAKE_REASONS.connectionLost,
    CARRIER_HANDSHAKE_REASONS.routeUnregistered,
  ];
  for (const reason of execution) {
    it(`执行定性 ${reason}（§5.3 收口 6）→ 改判 false（原样透出，不伪装为未找到）`, () => {
      expect(isCarrierDiscoveryNotFoundFallback(carrierError(reason))).toBe(false);
    });
  }
});
