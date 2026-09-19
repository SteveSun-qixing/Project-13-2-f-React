/**
 * 测试用 Mock Bridge（02-SDK-API规范 §7.1、§7.2）。
 *
 * 构造与 `IChipsBridge` 同形状的 Mock，提供能力桩、事件触发、资源夹具与调用记录。
 * Mock 只模拟调用结果，不执行权限判定与 schema 校验（§7.1）：这类断言通过桩的返回值与
 * 抛出的 `ChipsError` 表达，平台侧行为由 Bridge 与契约测试保证。
 *
 * 行为口径（§7.2 规则表）：
 *
 * | 成员 | 规则 |
 * |---|---|
 * | `handle` | 同一能力后注册覆盖先注册；未注册能力的调用拒绝 `BRIDGE_CAPABILITY_NOT_FOUND` |
 * | `handle` 的 handler | 抛 `ChipsError` 时以该错误拒绝；抛其他值经 `toChipsError` 归一后拒绝 |
 * | `emit` | 同步调用该事件全部订阅 handler；无订阅时丢弃 |
 * | `calls` | 按时序记录 `request`；`resource()` 不经能力通道，不记录 |
 * | `resource` | URI 语法非法同步抛 `RESOURCE_INVALID_URI`；未登记资源的 `metadata()` / `read()` 拒绝 `RESOURCE_NOT_FOUND` |
 * | `resource` 句柄 | `release()` 后拒绝 `RESOURCE_HANDLE_RELEASED`；失效后拒绝 `RESOURCE_HANDLE_INVALIDATED` |
 * | `invalidate` | 使对应句柄失效并触发 `onInvalidate` 回调 |
 * | `subscriptionCount` | 返回该事件当前有效订阅数 |
 * | `reset` | 清空桩、调用记录与订阅，资源恢复为初始配置 |
 */

import { toChipsError } from '../errors.js';
import type {
  IChipsBridge,
  IResourceHandle,
  ISubscription,
  ResourceInvalidateReason,
} from '../types/bridge.js';
import { MOCK_ERROR_CODES, mockError } from './codes.js';
import { MockResourceHandle, mockUriFailureReason } from './mock-resource.js';
import type { IMockResourceInit } from './mock-resource.js';

/** 能力桩：入参与出参均以 `unknown` 承载，形状由调用点断言。 */
type MockHandler = (input: unknown) => unknown;

/** 事件订阅项；`active` 保证同一 `(eventId, handler)` 多次订阅各自独立退订。 */
interface MockSubscriptionEntry {
  readonly handler: (payload: unknown) => void;
  active: boolean;
}

/** Mock 资源表：URI → 夹具。 */
type MockResourceTable = Readonly<Record<string, IMockResourceInit>>;

/** 创建 Mock Bridge 的选项。 */
export interface IMockBridgeOptions {
  /** 初始资源表：URI → 资源夹具。 */
  readonly resources?: MockResourceTable;
}

/** 一次能力调用的记录。 */
export interface IMockCall {
  readonly capabilityId: string;
  readonly input: unknown;
}

/** 测试用 Bridge：实现 `IChipsBridge`，并提供桩与观测能力。 */
export interface IMockBridge extends IChipsBridge {
  /**
   * 登记能力桩；同一能力后注册覆盖先注册。
   *
   * @param capabilityId - 能力 ID
   * @param handler - 输入到输出的映射；可返回值或 Promise，抛错按 `ChipsError` 口径处理
   */
  handle<TInput = unknown, TOutput = unknown>(
    capabilityId: string,
    handler: (input: TInput) => TOutput | Promise<TOutput>,
  ): void;

  /**
   * 触发事件；同步调用该事件的全部订阅 handler。
   *
   * @param eventId - 事件 ID
   * @param payload - 事件载荷
   */
  emit(eventId: string, payload: unknown): void;

  /**
   * 使指定 URI 的句柄失效并派发失效原因。
   *
   * @param uri - 资源 URI
   * @param reason - 失效原因
   */
  invalidate(uri: string, reason: ResourceInvalidateReason): void;

  /**
   * 指定事件当前有效订阅数；用于断言 `dispose()` 行为。
   *
   * @param eventId - 事件 ID
   * @returns 有效订阅数
   */
  subscriptionCount(eventId: string): number;

  /** 按调用时序记录的能力调用轨迹。 */
  readonly calls: readonly IMockCall[];

  /** 清空桩、调用记录与订阅，资源恢复为初始配置。 */
  reset(): void;
}

/** Mock Bridge 实现。 */
class MockBridge implements IMockBridge {
  readonly #handlers = new Map<string, MockHandler>();

  readonly #subscriptions = new Map<string, MockSubscriptionEntry[]>();

  readonly #calls: IMockCall[] = [];

  readonly #initialResources: MockResourceTable;

  #resources: Map<string, IMockResourceInit>;

  readonly #liveHandles = new Map<string, MockResourceHandle[]>();

  constructor(options?: IMockBridgeOptions) {
    this.#initialResources = options?.resources ?? {};
    this.#resources = new Map(Object.entries(this.#initialResources));
  }

  /** 按调用时序记录的能力调用轨迹。 */
  get calls(): readonly IMockCall[] {
    return this.#calls;
  }

  /**
   * 唯一能力调用入口：记录轨迹并执行桩。
   *
   * @param capabilityId - 能力 ID
   * @param input - 能力输入
   * @returns 桩的返回值
   * @throws ChipsError 未登记桩时抛 `BRIDGE_CAPABILITY_NOT_FOUND`；桩内异常按归一口径抛出
   */
  async request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
    this.#calls.push({ capabilityId, input });
    const handler = this.#handlers.get(capabilityId);
    if (handler === undefined) {
      throw mockError(MOCK_ERROR_CODES.capabilityNotFound, '该能力未登记 Mock 桩', {
        capabilityId,
      });
    }
    try {
      return (await handler(input)) as TOutput;
    } catch (error) {
      throw toChipsError(error);
    }
  }

  /**
   * 订阅事件。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调
   * @returns 可退订句柄，`dispose()` 幂等
   */
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription {
    const entries = this.#subscriptions.get(eventId) ?? [];
    entries.push({ handler, active: true });
    this.#subscriptions.set(eventId, entries);
    return {
      dispose: (): void => {
        const current = this.#subscriptions.get(eventId);
        if (current === undefined) {
          return;
        }
        const entry = current.find((item) => item.handler === handler && item.active);
        if (entry === undefined) {
          return;
        }
        entry.active = false;
        const index = current.indexOf(entry);
        current.splice(index, 1);
        if (current.length === 0) {
          this.#subscriptions.delete(eventId);
        }
      },
    };
  }

  /**
   * 创建 Mock 资源句柄。
   *
   * @param uri - `chips-resource://` URI
   * @returns 懒读取夹具的句柄
   * @throws ChipsError URI 语法非法时同步抛 `RESOURCE_INVALID_URI`
   */
  resource(uri: string): IResourceHandle {
    const reason = mockUriFailureReason(uri);
    if (reason !== undefined) {
      throw mockError(MOCK_ERROR_CODES.invalidUri, '资源地址语法不合法', { uri, reason });
    }
    const handle = new MockResourceHandle(uri, () => this.#resources.get(uri));
    const handles = this.#liveHandles.get(uri) ?? [];
    handles.push(handle);
    this.#liveHandles.set(uri, handles);
    return handle;
  }

  /**
   * 登记能力桩。
   *
   * @param capabilityId - 能力 ID
   * @param handler - 输入到输出的映射
   */
  handle<TInput = unknown, TOutput = unknown>(
    capabilityId: string,
    handler: (input: TInput) => TOutput | Promise<TOutput>,
  ): void {
    this.#handlers.set(capabilityId, handler as MockHandler);
  }

  /**
   * 触发事件：同步调用该事件全部有效订阅 handler；无订阅时丢弃。
   *
   * @param eventId - 事件 ID
   * @param payload - 事件载荷
   */
  emit(eventId: string, payload: unknown): void {
    const entries = this.#subscriptions.get(eventId);
    if (entries === undefined || entries.length === 0) {
      return;
    }
    for (const entry of [...entries]) {
      if (entry.active) {
        entry.handler(payload);
      }
    }
    const remaining = entries.filter((entry) => entry.active);
    if (remaining.length === 0) {
      this.#subscriptions.delete(eventId);
      return;
    }
    this.#subscriptions.set(eventId, remaining);
  }

  /**
   * 使指定 URI 的全部 `open` 句柄失效并同步派发失效原因。
   *
   * @param uri - 资源 URI
   * @param reason - 失效原因
   */
  invalidate(uri: string, reason: ResourceInvalidateReason): void {
    const handles = this.#liveHandles.get(uri);
    if (handles === undefined) {
      return;
    }
    for (const handle of [...handles]) {
      handle.invalidate(reason);
    }
    const open = handles.filter((handle) => handle.state === 'open');
    if (open.length === 0) {
      this.#liveHandles.delete(uri);
      return;
    }
    this.#liveHandles.set(uri, open);
  }

  /**
   * 指定事件当前有效订阅数。
   *
   * @param eventId - 事件 ID
   * @returns 有效订阅数
   */
  subscriptionCount(eventId: string): number {
    return this.#subscriptions.get(eventId)?.length ?? 0;
  }

  /**
   * 清空桩、调用记录与订阅，资源恢复为初始配置。
   *
   * 已创建的句柄保持自身状态：`reset()` 只重置 Mock 的登记表，不回滚句柄生命周期。
   */
  reset(): void {
    this.#handlers.clear();
    this.#subscriptions.clear();
    this.#calls.length = 0;
    this.#resources = new Map(Object.entries(this.#initialResources));
  }
}

/**
 * 创建 Mock Bridge。
 *
 * @param options - 资源夹具等初始选项
 * @returns 与 `IChipsBridge` 同形状的 Mock
 */
export function createMockBridge(options?: IMockBridgeOptions): IMockBridge {
  return new MockBridge(options);
}
