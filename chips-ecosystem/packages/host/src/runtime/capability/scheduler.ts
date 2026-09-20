/**
 * 能力调用并发与在途闸门（02-Bridge三层设计 §8.3 并发控制、§4.1 注册项默认值）。
 *
 * 权威：`02-Bridge三层设计` §8.3（`serial` 同一能力 ID 全局 FIFO、`maxQueue` 上限、超限
 * `BRIDGE_QUEUE_OVERFLOW`）、§8.4（同会话对同一能力在途上限、超限 `BRIDGE_SESSION_BUSY`）。
 *
 * @remarks
 * - 闸门只做准入与计数，不做权限/Schema/路由（分层职责，见 `router.ts`）。
 * - 会话在途计数在任何拒绝路径下都成对回收，不泄漏配额。
 * - `serial` 等待可被取消信号打断（会话关闭 / 运行时停机），打断时以 `BRIDGE_CANCELLED` 拒绝并出队。
 * - Bridge 内核（Rust）交付后由内核承担限流；本闸门是壳侧组合根在核心缺位期的等价实现，形状与错误码一致。
 */

import { BRIDGE_ERROR_CODES, bridgeWireError } from '../../protocol/error-codes.js';
import type { HostCapabilityConcurrency } from './contracts.js';

/** 单次调用的闸门入参（取自注册项的归一值）。 */
export interface IHostCallGate {
  readonly capabilityId: string;
  readonly sessionId: string;
  readonly concurrency: HostCapabilityConcurrency;
  readonly maxQueue: number;
  readonly sessionInFlightLimit: number;
  /** 取消信号；等待 `serial` 队列时据此让位。 */
  readonly signal: AbortSignal;
}

/** 闸门许可；调用结束时必须调用一次 {@link release}。 */
export interface IHostCallPermit {
  /** 释放许可（幂等）：回收会话在途计数并让出 `serial` 锁位。 */
  release(): void;
}

/** 并发闸门接口。 */
export interface IHostCallScheduler {
  /**
   * 获取调用许可。
   *
   * @throws {Error} 携带 `IWireChipsError` 同构 `code` 字段：`BRIDGE_SESSION_BUSY` / `BRIDGE_QUEUE_OVERFLOW` /
   * `BRIDGE_CANCELLED`。
   */
  acquire(gate: IHostCallGate): Promise<IHostCallPermit>;
  /** 当前在途调用总数（诊断用）。 */
  readonly inFlight: number;
}

/** `serial` 能力的排队状态。 */
interface ISerialState {
  busy: boolean;
  readonly waiting: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
}

function gateError(
  code: (typeof BRIDGE_ERROR_CODES)[keyof typeof BRIDGE_ERROR_CODES],
  details: Record<string, unknown>,
): Error {
  return Object.assign(new Error(''), bridgeWireError(code, { details }));
}

/** 创建能力调用并发闸门。 */
export function createHostCallScheduler(): IHostCallScheduler {
  const sessionInFlight = new Map<string, number>();
  const serialStates = new Map<string, ISerialState>();
  let inFlight = 0;

  const sessionKey = (capabilityId: string, sessionId: string): string => `${capabilityId}\u0000${sessionId}`;

  const serialState = (capabilityId: string): ISerialState => {
    const existing = serialStates.get(capabilityId);
    if (existing !== undefined) {
      return existing;
    }
    const created: ISerialState = { busy: false, waiting: [] };
    serialStates.set(capabilityId, created);
    return created;
  };

  const releaseSession = (capabilityId: string, sessionId: string): void => {
    const key = sessionKey(capabilityId, sessionId);
    const current = sessionInFlight.get(key) ?? 0;
    if (current <= 1) {
      sessionInFlight.delete(key);
    } else {
      sessionInFlight.set(key, current - 1);
    }
  };

  const handOverSerial = (capabilityId: string): void => {
    const state = serialStates.get(capabilityId);
    if (state === undefined) {
      return;
    }
    const next = state.waiting.shift();
    if (next === undefined) {
      state.busy = false;
      return;
    }
    next.resolve();
  };

  const enterSerial = (gate: IHostCallGate): Promise<void> => {
    const state = serialState(gate.capabilityId);
    if (!state.busy) {
      state.busy = true;
      return Promise.resolve();
    }
    if (state.waiting.length >= gate.maxQueue) {
      return Promise.reject(
        gateError(BRIDGE_ERROR_CODES.queueOverflow, {
          capabilityId: gate.capabilityId,
          sessionId: gate.sessionId,
          maxQueue: gate.maxQueue,
        }),
      );
    }
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const entry: { resolve: () => void; reject: (error: unknown) => void } = {
        resolve: (): void => undefined,
        reject,
      };
      const onAbort = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        const index = state.waiting.indexOf(entry);
        if (index >= 0) {
          state.waiting.splice(index, 1);
        }
        gate.signal.removeEventListener('abort', onAbort);
        reject(gateError(BRIDGE_ERROR_CODES.cancelled, { capabilityId: gate.capabilityId, sessionId: gate.sessionId }));
      };
      entry.resolve = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        gate.signal.removeEventListener('abort', onAbort);
        resolve();
      };
      state.waiting.push(entry);
      if (gate.signal.aborted) {
        onAbort();
      } else {
        gate.signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  };

  return {
    async acquire(gate: IHostCallGate): Promise<IHostCallPermit> {
      const key = sessionKey(gate.capabilityId, gate.sessionId);
      const current = sessionInFlight.get(key) ?? 0;
      if (current >= gate.sessionInFlightLimit) {
        throw gateError(BRIDGE_ERROR_CODES.sessionBusy, {
          capabilityId: gate.capabilityId,
          sessionId: gate.sessionId,
          limit: gate.sessionInFlightLimit,
        });
      }
      sessionInFlight.set(key, current + 1);
      inFlight += 1;

      let released = false;
      const release = (): void => {
        if (released) {
          return;
        }
        released = true;
        releaseSession(gate.capabilityId, gate.sessionId);
        inFlight -= 1;
        if (gate.concurrency === 'serial') {
          handOverSerial(gate.capabilityId);
        }
      };

      if (gate.concurrency === 'serial') {
        try {
          await enterSerial(gate);
        } catch (error) {
          release();
          throw error;
        }
      }

      if (gate.signal.aborted) {
        release();
        throw gateError(BRIDGE_ERROR_CODES.cancelled, {
          capabilityId: gate.capabilityId,
          sessionId: gate.sessionId,
        });
      }
      return { release };
    },
    get inFlight(): number {
      return inFlight;
    },
  };
}
