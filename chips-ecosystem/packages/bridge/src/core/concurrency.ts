/**
 * 并发闸门（02-Bridge三层设计 §8.3）。
 *
 * - `parallel`（默认）：同一能力可并发执行，只受会话在途上限约束；
 * - `serial`：同一能力 ID 全局 FIFO 队列，等待数超过 `maxQueue` 返回 `BRIDGE_QUEUE_OVERFLOW`；
 * - 同一会话对同一能力的在途调用上限取注册项 `sessionInFlightLimit`，超限返回 `BRIDGE_SESSION_BUSY`。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '../protocol/errors.js';
import type { CapabilityConcurrency } from '../protocol/capability.js';

export interface IGateLimits {
  readonly concurrency: CapabilityConcurrency;
  readonly maxQueue: number;
  readonly sessionInFlightLimit: number;
}

export interface IGateTicket {
  readonly capabilityId: string;
  readonly sessionId: string;
  readonly serial: boolean;
}

interface IQueuedEntry {
  readonly sessionId: string;
  readonly resolve: (ticket: IGateTicket) => void;
  readonly reject: (error: Error) => void;
  canceled: boolean;
}

interface ISerialQueue {
  running: boolean;
  readonly pending: IQueuedEntry[];
  limits: IGateLimits;
}

export interface ICapabilityGate {
  /** 申请执行许可；超限或队列溢出时抛出对应 `ChipsError`。 */
  acquire(capabilityId: string, sessionId: string, limits: IGateLimits): Promise<IGateTicket>;
  /** 释放许可（必须与 acquire 成对）。 */
  release(ticket: IGateTicket): void;
  /** 中止某能力的全部等待者（注销/桥关闭）。 */
  cancelCapability(capabilityId: string, error?: Error): void;
  /** 中止某会话的全部等待者（会话关闭）。 */
  cancelSession(sessionId: string, error?: Error): void;
  /** 诊断：某能力等待队列长度。 */
  queueLength(capabilityId: string): number;
  /** 诊断：某 (能力, 会话) 在途数。 */
  inFlight(capabilityId: string, sessionId: string): number;
}

function busyError(): Error {
  return createBridgeError(BRIDGE_ERROR_CODES.sessionBusy, { retryable: true });
}

function overflowError(): Error {
  return createBridgeError(BRIDGE_ERROR_CODES.queueOverflow, { retryable: true });
}

function cancelledError(): Error {
  return createBridgeError(BRIDGE_ERROR_CODES.cancelled, { retryable: false });
}

export function createCapabilityGate(): ICapabilityGate {
  const inFlight = new Map<string, number>();
  const serialQueues = new Map<string, ISerialQueue>();

  const inFlightKey = (capabilityId: string, sessionId: string): string =>
    `${capabilityId}\u0000${sessionId}`;

  const increment = (capabilityId: string, sessionId: string): void => {
    const key = inFlightKey(capabilityId, sessionId);
    inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
  };

  const decrement = (capabilityId: string, sessionId: string): void => {
    const key = inFlightKey(capabilityId, sessionId);
    const current = inFlight.get(key) ?? 0;
    if (current <= 1) {
      inFlight.delete(key);
    } else {
      inFlight.set(key, current - 1);
    }
  };

  const countFor = (capabilityId: string, sessionId: string): number =>
    inFlight.get(inFlightKey(capabilityId, sessionId)) ?? 0;

  /** 诊断：该能力全部会话的在途数合计（串行队列出队校验用）。 */
  const totalFor = (capabilityId: string): number => {
    const prefix = `${capabilityId}\u0000`;
    let total = 0;
    for (const [key, count] of inFlight) {
      if (key.startsWith(prefix)) {
        total += count;
      }
    }
    return total;
  };

  const drain = (capabilityId: string, queue: ISerialQueue): void => {
    if (queue.running) {
      return;
    }
    let entry = queue.pending.shift();
    while (entry !== undefined && entry.canceled) {
      entry = queue.pending.shift();
    }
    if (entry === undefined) {
      return;
    }
    // 在途上限在出队时校验：正在释放、尚未 decrement 的调用仍计入在途；
    // 放行该等待者会达到上限时返回 BRIDGE_SESSION_BUSY。
    if (totalFor(capabilityId) + 1 >= queue.limits.sessionInFlightLimit) {
      entry.reject(busyError());
      drain(capabilityId, queue);
      return;
    }
    queue.running = true;
    increment(capabilityId, entry.sessionId);
    entry.resolve({ capabilityId, sessionId: entry.sessionId, serial: true });
  };

  return {
    acquire(capabilityId: string, sessionId: string, limits: IGateLimits): Promise<IGateTicket> {
      if (limits.concurrency === 'serial') {
        const queue = serialQueues.get(capabilityId) ?? {
          running: false,
          pending: [],
          limits,
        };
        queue.limits = limits;
        serialQueues.set(capabilityId, queue);
        if (!queue.running && queue.pending.length === 0) {
          queue.running = true;
          increment(capabilityId, sessionId);
          return Promise.resolve({ capabilityId, sessionId, serial: true });
        }
        if (queue.pending.length >= limits.maxQueue) {
          return Promise.reject(overflowError());
        }
        return new Promise<IGateTicket>((resolve, reject) => {
          queue.pending.push({ sessionId, resolve, reject, canceled: false });
          drain(capabilityId, queue);
        });
      }
      if (countFor(capabilityId, sessionId) >= limits.sessionInFlightLimit) {
        return Promise.reject(busyError());
      }
      increment(capabilityId, sessionId);
      return Promise.resolve({ capabilityId, sessionId, serial: false });
    },

    release(ticket: IGateTicket): void {
      if (ticket.serial) {
        const queue = serialQueues.get(ticket.capabilityId);
        if (queue !== undefined) {
          // 先出队再减计数：让出队校验看到释放中的在途调用（02-Bridge三层设计 §8.3）。
          queue.running = false;
          drain(ticket.capabilityId, queue);
        }
        decrement(ticket.capabilityId, ticket.sessionId);
        if (queue !== undefined && queue.pending.length === 0 && !queue.running) {
          serialQueues.delete(ticket.capabilityId);
        }
        return;
      }
      decrement(ticket.capabilityId, ticket.sessionId);
    },

    cancelCapability(capabilityId: string, error: Error = cancelledError()): void {
      const queue = serialQueues.get(capabilityId);
      if (queue === undefined) {
        return;
      }
      const pending = queue.pending.splice(0, queue.pending.length);
      for (const entry of pending) {
        entry.canceled = true;
        entry.reject(error);
      }
      if (!queue.running) {
        serialQueues.delete(capabilityId);
      }
    },

    cancelSession(sessionId: string, error: Error = cancelledError()): void {
      for (const [capabilityId, queue] of serialQueues) {
        const retained: IQueuedEntry[] = [];
        for (const entry of queue.pending) {
          if (entry.sessionId === sessionId) {
            entry.canceled = true;
            entry.reject(error);
          } else {
            retained.push(entry);
          }
        }
        queue.pending.splice(0, queue.pending.length, ...retained);
        if (queue.pending.length === 0 && !queue.running) {
          serialQueues.delete(capabilityId);
        }
      }
    },

    queueLength(capabilityId: string): number {
      return serialQueues.get(capabilityId)?.pending.length ?? 0;
    },

    inFlight(capabilityId: string, sessionId: string): number {
      return countFor(capabilityId, sessionId);
    },
  };
}
