/**
 * SDK 类型化客户端（02-SDK-API规范 §3.2、§11 约束 1、3、8）。
 *
 * `ChipsBridge` 实现 `IChipsBridge` 的完整形状，方法面冻结为 `request` / `subscribe` /
 * `resource` 三个方法，不含任何平台逻辑：会话、权限、schema 校验与路由全部由目标 Bridge
 * 承担，SDK 只做转发（§1.2）。
 *
 * 目标解析规则（§3.2、§11 约束 8）：
 *
 * | 场景 | 行为 |
 * |---|---|
 * | 构造时传入 `target` | 全部调用直接转发给 `target` |
 * | 未传入且 `window.chips` 已注入 | 转发给 `window.chips` |
 * | 未传入且 `window.chips` 不存在 | `request` 异步拒绝、`subscribe` 与 `resource` 同步抛出 `SDK_BRIDGE_UNAVAILABLE` |
 * | 未传入、构造后 `window.chips` 才注入 | 后续调用自动使用新注入的 Bridge（解析发生在每次调用） |
 *
 * 错误口径（§6.4、§11 约束 6）：目标 Bridge 返回的错误已由平台完成归一，客户端原样透传，
 * 不改写 `code` / `message` / `details` / `retryable`；客户端自身只产生
 * `SDK_BRIDGE_UNAVAILABLE`。
 */

import { bridgeUnavailableError } from '../errors.js';
import type { IChipsBridge, IResourceHandle, ISubscription } from '../types/bridge.js';

/**
 * `window` 与 `window.chips` 的结构视图。
 *
 * `02-SDK-API规范` §9.2 面向插件把 `Window.chips` 声明为必然存在；非平台运行时（Node、
 * 构建脚本、未注入的测试环境）里两者都可能缺失，故解析时按可缺失读取，缺失即走
 * `SDK_BRIDGE_UNAVAILABLE` 分支。
 */
interface WindowChipsHost {
  readonly window?: {
    readonly chips?: IChipsBridge;
  };
}

/** 解析当前 `window.chips`；`window` 或其上未注入 `chips` 时返回 `undefined`。 */
function resolveWindowBridge(): IChipsBridge | undefined {
  const scope: WindowChipsHost = globalThis;
  return scope.window?.chips;
}

/** 创建客户端时可注入的选项（02-SDK-API规范 §3.2）。 */
export interface ICreateClientOptions {
  /** 显式注入的 Bridge 目标；省略时惰性绑定 `window.chips`。 */
  readonly bridge?: IChipsBridge;
}

/**
 * SDK 客户端：实现 `IChipsBridge`，把调用转发给目标 Bridge。
 *
 * 未显式注入目标时，每次调用解析一次 `window.chips`：目标不可用时 `request` 异步拒绝，
 * `subscribe` 与 `resource` 同步抛出 `ChipsError`（`SDK_BRIDGE_UNAVAILABLE`）。
 */
export class ChipsBridge implements IChipsBridge {
  readonly #injected: IChipsBridge | undefined;

  constructor(target?: IChipsBridge) {
    this.#injected = target;
  }

  /**
   * 解析本次调用的目标 Bridge。
   *
   * @returns 注入目标或当前 `window.chips`
   * @throws ChipsError 两者均不可用时抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  #target(): IChipsBridge {
    if (this.#injected !== undefined) {
      return this.#injected;
    }
    const resolved = resolveWindowBridge();
    if (resolved === undefined) {
      throw bridgeUnavailableError();
    }
    return resolved;
  }

  /**
   * 唯一能力调用入口；转发给目标 Bridge。
   *
   * @param capabilityId - 能力 ID（`<domain>:<action>[:<target>]`）
   * @param input - 能力输入，校验与权限判定由平台完成
   * @returns 能力输出；目标不可用或平台调用失败时以 `ChipsError` 拒绝
   */
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
    let target: IChipsBridge;
    try {
      target = this.#target();
    } catch (error) {
      return Promise.reject(error);
    }
    return target.request<TOutput>(capabilityId, input);
  }

  /**
   * 订阅标准事件；转发给目标 Bridge。
   *
   * @param eventId - 事件 ID
   * @param handler - 载荷回调；同一 `(eventId, handler)` 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription {
    return this.#target().subscribe(eventId, handler);
  }

  /**
   * 创建 `chips-resource://` 懒打开句柄；转发给目标 Bridge。
   *
   * @param uri - 资源 URI
   * @returns 资源句柄；预检失败由目标同步抛出 `ChipsError`
   * @throws ChipsError 目标不可用时同步抛 `SDK_BRIDGE_UNAVAILABLE`
   */
  resource(uri: string): IResourceHandle {
    return this.#target().resource(uri);
  }
}

/**
 * 创建 SDK 客户端。
 *
 * @param options - 创建选项；省略 `bridge` 时按调用惰性绑定 `window.chips`
 * @returns 绑定目标 Bridge 的客户端
 */
export function createClient(options?: ICreateClientOptions): ChipsBridge {
  return new ChipsBridge(options?.bridge);
}

/**
 * 默认客户端：等价于 `createClient()`，供插件业务代码直接使用。
 *
 * 目标在每次调用时解析，因此测试中安装 Mock 后无需重建该单例（§3.2、§11 约束 8）。
 */
export const chips: ChipsBridge = createClient();
