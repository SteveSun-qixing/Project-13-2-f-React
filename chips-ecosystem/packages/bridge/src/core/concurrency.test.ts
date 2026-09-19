import { describe, expect, it } from 'vitest';
import { createCapabilityGate, type IGateLimits } from './concurrency.js';

const PARALLEL: IGateLimits = { concurrency: 'parallel', maxQueue: 32, sessionInFlightLimit: 2 };
const SERIAL: IGateLimits = { concurrency: 'serial', maxQueue: 1, sessionInFlightLimit: 2 };

async function expectRejects(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('createCapabilityGate parallel', () => {
  it('并行策略允许并发，只受会话在途上限约束', async () => {
    const gate = createCapabilityGate();
    const first = await gate.acquire('file:read', 's1', PARALLEL);
    const second = await gate.acquire('file:read', 's1', PARALLEL);
    expect(gate.inFlight('file:read', 's1')).toBe(2);
    await expectRejects(gate.acquire('file:read', 's1', PARALLEL), 'BRIDGE_SESSION_BUSY');
    const otherSession = await gate.acquire('file:read', 's2', PARALLEL);
    gate.release(first);
    gate.release(first);
    expect(gate.inFlight('file:read', 's1')).toBe(0);
    gate.release(second);
    gate.release(otherSession);
  });
});

describe('createCapabilityGate serial', () => {
  it('串行 FIFO：前一个释放后下一个才开始，且会话在途上限生效', async () => {
    const gate = createCapabilityGate();
    const first = await gate.acquire('demo:run', 's1', SERIAL);
    expect(gate.inFlight('demo:run', 's1')).toBe(1);
    const secondPromise = gate.acquire('demo:run', 's2', SERIAL);
    expect(gate.queueLength('demo:run')).toBe(1);
    // 队列已满：新的等待者溢出
    await expectRejects(gate.acquire('demo:run', 's3', SERIAL), 'BRIDGE_QUEUE_OVERFLOW');
    // 会话在途上限在出队时校验：s1 仍在途，等待者被拒绝
    gate.release(first);
    await expectRejects(secondPromise, 'BRIDGE_SESSION_BUSY');
    expect(gate.queueLength('demo:run')).toBe(0);
    expect(gate.inFlight('demo:run', 's1')).toBe(0);
  });

  it('串行队列按申请顺序放行', async () => {
    const gate = createCapabilityGate();
    const limits: IGateLimits = { concurrency: 'serial', maxQueue: 4, sessionInFlightLimit: 4 };
    const running = await gate.acquire('demo:run', 's1', limits);
    const order: string[] = [];
    const second = gate.acquire('demo:run', 's2', limits).then((ticket) => {
      order.push('s2');
      return ticket;
    });
    const third = gate.acquire('demo:run', 's3', limits).then((ticket) => {
      order.push('s3');
      return ticket;
    });
    gate.release(running);
    const secondTicket = await second;
    expect(order).toEqual(['s2']);
    gate.release(secondTicket);
    const thirdTicket = await third;
    expect(order).toEqual(['s2', 's3']);
    gate.release(thirdTicket);
  });

  it('cancelCapability 拒绝全部等待者，运行中的调用不受影响', async () => {
    const gate = createCapabilityGate();
    const limits: IGateLimits = { concurrency: 'serial', maxQueue: 4, sessionInFlightLimit: 4 };
    const running = await gate.acquire('demo:run', 's1', limits);
    const waiting = gate.acquire('demo:run', 's2', limits);
    gate.cancelCapability('demo:run');
    await expectRejects(waiting, 'BRIDGE_CANCELLED');
    expect(gate.queueLength('demo:run')).toBe(0);
    gate.release(running);
    expect(gate.inFlight('demo:run', 's1')).toBe(0);
    gate.cancelCapability('missing');
  });

  it('cancelSession 只拒绝该会话的等待者，可指定错误码', async () => {
    const gate = createCapabilityGate();
    const limits: IGateLimits = { concurrency: 'serial', maxQueue: 4, sessionInFlightLimit: 4 };
    const running = await gate.acquire('demo:run', 's1', limits);
    const waitingA = gate.acquire('demo:run', 's1', limits);
    const waitingB = gate.acquire('demo:run', 's2', limits);
    const custom = new Error('会话关闭');
    gate.cancelSession('s1', custom);
    await expect(waitingA).rejects.toBe(custom);
    expect(gate.queueLength('demo:run')).toBe(1);
    gate.release(running);
    const ticketB = await waitingB;
    expect(ticketB.sessionId).toBe('s2');
    gate.release(ticketB);
    gate.cancelSession('missing');
  });

  it('空闲时 cancel 清理队列且 release 无副作用', () => {
    const gate = createCapabilityGate();
    gate.cancelCapability('demo:run');
    gate.cancelSession('s1');
    expect(gate.queueLength('demo:run')).toBe(0);
    expect(gate.inFlight('demo:run', 's1')).toBe(0);
  });

  it('串行队列在 drain 跳过已取消条目', async () => {
    const gate = createCapabilityGate();
    const limits: IGateLimits = { concurrency: 'serial', maxQueue: 4, sessionInFlightLimit: 4 };
    const running = await gate.acquire('demo:run', 's1', limits);
    const waiting = gate.acquire('demo:run', 's2', limits);
    gate.cancelSession('s2');
    await expectRejects(waiting, 'BRIDGE_CANCELLED');
    gate.release(running);
    expect(gate.queueLength('demo:run')).toBe(0);
  });
});
