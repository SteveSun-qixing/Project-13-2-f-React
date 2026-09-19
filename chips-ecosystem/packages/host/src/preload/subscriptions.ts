/**
 * preload 订阅登记。
 *
 * 权威：`02-Bridge三层设计` §2.4（事件订阅流程）、§7.5（事件通道）。
 *
 * @remarks
 * - `subscribe` 同步登记本地订阅并返回可退订句柄；同一窗口内 `eventId` 计数 0 → 1 时挂载
 *   `event:<eventId>` 监听并经 `event:control` 发起订阅。
 * - 回执确认前到达的事件先缓冲，确认后按序派发；回执失败时丢弃缓冲、移除监听，订阅不建立。
 * - 单 handler 抛错不影响其他订阅者与后续投递。
 */

import { EVENT_CONTROL_CHANNEL, eventChannel } from '../protocol/channels.js';
import { isEventControlResponse, isEventEnvelope } from '../protocol/wire.js';
import type { IPreloadTransport } from './transport.js';

/** 可退订句柄。 */
export interface ISubscription {
  /** 退订；幂等。 */
  dispose(): void;
}

/** 订阅登记依赖。 */
export interface SubscriptionRegistryDeps {
  /** 传输口。 */
  readonly transport: IPreloadTransport;
  /** `controlId` 生成器（`crypto.randomUUID()`）。 */
  readonly generateControlId: () => string;
  /** 诊断口；记录 handler 异常与非法下行负载。 */
  readonly onDiagnostic: (message: string, details?: Readonly<Record<string, unknown>>) => void;
}

/** 确认前的事件缓冲上限；超出即丢弃并记诊断（回执异常时的内存保护）。 */
export const MAX_PENDING_EVENTS = 256;

interface HandlerEntry {
  readonly handler: (payload: unknown) => void;
  alive: boolean;
}

interface SubscriptionGroup {
  readonly eventId: string;
  state: 'pending' | 'active' | 'failed';
  readonly controlId: string;
  readonly handlers: Set<HandlerEntry>;
  readonly buffer: unknown[];
  readonly listener: (payload: unknown) => void;
}

/** 死订阅；非法入参时返回，行为与已退订一致。 */
function createDeadSubscription(): ISubscription {
  return {
    dispose(): void {
      return;
    },
  };
}

/** 订阅登记表。 */
export class SubscriptionRegistry {
  private readonly deps: SubscriptionRegistryDeps;
  private readonly groups = new Map<string, SubscriptionGroup>();
  private disposed = false;

  constructor(deps: SubscriptionRegistryDeps) {
    this.deps = deps;
  }

  /**
   * 登记订阅。
   *
   * @param eventId 事件 ID（事件契约登记值）。
   * @param handler 投递回调。
   * @returns 可退订句柄；非法入参返回死订阅并记诊断。
   */
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription {
    if (this.disposed) {
      return createDeadSubscription();
    }
    if (typeof eventId !== 'string' || eventId.length === 0 || typeof handler !== 'function') {
      this.deps.onDiagnostic('忽略非法事件订阅请求');
      return createDeadSubscription();
    }
    let group = this.groups.get(eventId);
    if (group === undefined) {
      group = this.createGroup(eventId);
      this.groups.set(eventId, group);
    }
    const entry: HandlerEntry = { handler, alive: true };
    group.handlers.add(entry);
    return {
      dispose: () => {
        this.disposeEntry(group, entry);
      },
    };
  }

  /** 释放全部订阅（preload 卸载时调用）；幂等。 */
  disposeAll(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const group of this.groups.values()) {
      group.handlers.clear();
      this.deps.transport.off(eventChannel(group.eventId), group.listener);
    }
    this.groups.clear();
  }

  /** 创建事件组：挂载监听并请求订阅。 */
  private createGroup(eventId: string): SubscriptionGroup {
    const listener = (payload: unknown): void => {
      this.handleIncoming(eventId, payload);
    };
    this.deps.transport.on(eventChannel(eventId), listener);
    const group: SubscriptionGroup = {
      eventId,
      state: 'pending',
      controlId: this.deps.generateControlId(),
      handlers: new Set(),
      buffer: [],
      listener,
    };
    void this.requestControl(group, 'subscribe');
    return group;
  }

  /** 发送订阅控制请求并处理回执。 */
  private async requestControl(group: SubscriptionGroup, action: 'subscribe' | 'unsubscribe'): Promise<void> {
    try {
      const response = await this.deps.transport.invoke(EVENT_CONTROL_CHANNEL, {
        controlId: group.controlId,
        action,
        eventId: group.eventId,
      });
      if (action !== 'subscribe') {
        return;
      }
      if (isEventControlResponse(response)) {
        if (response.ok) {
          this.activate(group);
          return;
        }
        this.fail(group, response.error.code);
        return;
      }
      this.fail(group, 'EVENT_CONTROL_RESPONSE_INVALID');
    } catch (error) {
      if (action === 'subscribe') {
        this.fail(group, error instanceof Error ? error.message : 'EVENT_CONTROL_FAILED');
      }
    }
  }

  /** 回执成功：转为活跃并冲刷缓冲。 */
  private activate(group: SubscriptionGroup): void {
    if (!this.isTracked(group) || group.state !== 'pending') {
      return;
    }
    group.state = 'active';
    const pending = group.buffer.splice(0, group.buffer.length);
    for (const payload of pending) {
      this.dispatch(group, payload);
    }
  }

  /** 回执失败：丢弃缓冲、移除监听、标记失败。 */
  private fail(group: SubscriptionGroup, reason: string): void {
    if (!this.isTracked(group)) {
      return;
    }
    group.state = 'failed';
    group.buffer.length = 0;
    this.deps.onDiagnostic('事件订阅未建立', { eventId: group.eventId, reason });
    this.deps.transport.off(eventChannel(group.eventId), group.listener);
    this.groups.delete(group.eventId);
  }

  /** 判断事件组是否仍在登记表中（避免迟到回执影响已释放的组）。 */
  private isTracked(group: SubscriptionGroup): boolean {
    return this.groups.get(group.eventId) === group;
  }

  /** 处理下行事件。 */
  private handleIncoming(eventId: string, payload: unknown): void {
    const group = this.groups.get(eventId);
    if (group === undefined || group.state === 'failed') {
      return;
    }
    if (!isEventEnvelope(payload)) {
      this.deps.onDiagnostic('丢弃非法事件负载', { eventId });
      return;
    }
    if (group.state === 'pending') {
      if (group.buffer.length >= MAX_PENDING_EVENTS) {
        this.deps.onDiagnostic('事件缓冲超限，丢弃待确认事件', { eventId });
        return;
      }
      group.buffer.push(payload);
      return;
    }
    this.dispatch(group, payload);
  }

  /** 派发事件负载到全部存活 handler。 */
  private dispatch(group: SubscriptionGroup, payload: unknown): void {
    const envelope = payload as { payload: unknown };
    for (const entry of [...group.handlers]) {
      if (!entry.alive) {
        continue;
      }
      try {
        entry.handler(envelope.payload);
      } catch (error) {
        this.deps.onDiagnostic('事件处理器抛出异常', {
          eventId: group.eventId,
          reason: error instanceof Error ? error.message : typeof error,
        });
      }
    }
  }

  /** 释放单个订阅。 */
  private disposeEntry(group: SubscriptionGroup, entry: HandlerEntry): void {
    if (!this.isTracked(group)) {
      return;
    }
    entry.alive = false;
    group.handlers.delete(entry);
    if (group.handlers.size > 0) {
      return;
    }
    this.groups.delete(group.eventId);
    this.deps.transport.off(eventChannel(group.eventId), group.listener);
    if (!this.disposed) {
      void this.sendUnsubscribe(group);
    }
  }

  /** 异步发送退订控制请求。 */
  private async sendUnsubscribe(group: SubscriptionGroup): Promise<void> {
    try {
      await this.deps.transport.invoke(EVENT_CONTROL_CHANNEL, {
        controlId: group.controlId,
        action: 'unsubscribe',
        eventId: group.eventId,
      });
    } catch {
      // 退订失败不阻塞本地释放；主进程在会话关闭时统一清理。
    }
  }
}
