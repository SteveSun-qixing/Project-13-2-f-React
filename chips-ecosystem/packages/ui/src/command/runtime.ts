/**
 * 应用 UI 命令运行时：平台命令注册表的无头适配层。
 *
 * 权威：《薯片生态文档库/05-接口与契约/13-命令系统契约》§5.6。
 * - `attach` 注册本地处理器，`(commandId, handlerId)` 与平台 `command:register` 记录配对；
 * - 运行时订阅 `command:invoked`，匹配后执行本地处理器；找不到处理器记录结构化诊断，不抛出；
 * - 本地处理器抛出的异常被捕获并记录诊断，不影响其他命令与窗口；
 * - `list` / `invoke` 统一经 Bridge 能力（`command:list` / `command:invoke`），
 *   不缓存跨上下文的 `state`，不维护第二份注册表。
 */

import type {
  CommandLocalHandler,
  ICommandBridgePort,
  ICommandDiagnostic,
  ICommandInvokeInput,
  ICommandInvokeOutput,
  ICommandListInput,
  ICommandListOutput,
  ICommandLocalRegistration,
  ICommandRuntime,
  ICommandSubscription,
  ICommandView,
} from './contract';

/** 创建命令运行时的选项。 */
export interface ICreateCommandRuntimeOptions {
  /** 平台访问端口；`null` 表示当前环境无 Bridge（`list` / `invoke` 以错误拒绝）。 */
  readonly port: ICommandBridgePort | null;
  /** 诊断出口；缺省输出到 `console.warn`。 */
  readonly onDiagnostic?: (diagnostic: ICommandDiagnostic) => void;
}

/** 运行时控制器：公开面是 `ICommandRuntime`，`dispose` 供 `CommandProvider` 释放订阅。 */
export interface ICommandRuntimeController extends ICommandRuntime {
  /** 释放 `command:invoked` 订阅；幂等。 */
  dispose(): void;
}

/** 本地处理器注册项的内部记录：token 用于「后注册覆盖先注册、旧句柄释放不影响新处理器」。 */
interface ILocalHandlerEntry {
  readonly handler: CommandLocalHandler;
  readonly token: symbol;
}

/** 事件载荷守卫：至少含字符串 `commandId` 与 `handlerId`。 */
function readInvokedIds(payload: unknown): { commandId: string; handlerId: string } | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const candidate = payload as { commandId?: unknown; handlerId?: unknown };
  if (typeof candidate.commandId !== 'string' || typeof candidate.handlerId !== 'string') {
    return null;
  }
  return { commandId: candidate.commandId, handlerId: candidate.handlerId };
}

/** `command:list` 载荷守卫：`views` 取自平台响应，只接受数组形态。 */
function isViewList(value: unknown): value is readonly ICommandView[] {
  return Array.isArray(value);
}

/** 组装本地处理器索引键。 */
function handlerKey(commandId: string, handlerId: string): string {
  return `${commandId}\u0000${handlerId}`;
}

function defaultDiagnosticSink(diagnostic: ICommandDiagnostic): void {
  console.warn(`[chips/ui] ${diagnostic.message}`, diagnostic);
}

/**
 * 创建命令运行时。
 *
 * @param options 运行时选项（端口与诊断出口）
 * @returns 运行时控制器
 */
export function createCommandRuntime(
  options: ICreateCommandRuntimeOptions
): ICommandRuntimeController {
  const { port } = options;
  const report = options.onDiagnostic ?? defaultDiagnosticSink;
  const handlers = new Map<string, ILocalHandlerEntry>();
  let invocationSubscription: ICommandSubscription | null = null;
  let disposed = false;

  const dispatch = (payload: unknown): void => {
    const ids = readInvokedIds(payload);
    if (ids === null) {
      report({
        code: 'PAYLOAD_INVALID',
        message: 'command:invoked 载荷缺少 commandId 或 handlerId，已忽略该次派发。',
        detail: payload,
      });
      return;
    }
    const entry = handlers.get(handlerKey(ids.commandId, ids.handlerId));
    if (entry === undefined) {
      report({
        code: 'HANDLER_MISSING',
        message: `命令 ${ids.commandId} 的本地处理器 ${ids.handlerId} 未注册，已忽略该次派发。`,
        commandId: ids.commandId,
        handlerId: ids.handlerId,
      });
      return;
    }
    try {
      const result = entry.handler((payload as { payload?: unknown }).payload);
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          report({
            code: 'HANDLER_FAILED',
            message: `命令 ${ids.commandId} 的本地处理器执行失败。`,
            commandId: ids.commandId,
            handlerId: ids.handlerId,
            detail: error,
          });
        });
      }
    } catch (error) {
      report({
        code: 'HANDLER_FAILED',
        message: `命令 ${ids.commandId} 的本地处理器执行失败。`,
        commandId: ids.commandId,
        handlerId: ids.handlerId,
        detail: error,
      });
    }
  };

  if (port !== null) {
    try {
      invocationSubscription = port.subscribe('command:invoked', dispatch);
    } catch (error) {
      report({
        code: 'SUBSCRIBE_FAILED',
        message: '订阅 command:invoked 失败，ui 目标命令的本地处理器不会被执行。',
        detail: error,
      });
    }
  }

  const requirePort = (): ICommandBridgePort => {
    if (port === null) {
      throw new Error('命令运行时未连接到平台 Bridge：window.chips 不可用。');
    }
    return port;
  };

  return {
    attach(registrations: readonly ICommandLocalRegistration[]): ICommandSubscription {
      if (disposed) {
        throw new Error('命令运行时已释放，无法再注册本地处理器。');
      }
      const entries: { readonly key: string; readonly token: symbol }[] = [];
      for (const registration of registrations) {
        const key = handlerKey(registration.commandId, registration.handlerId);
        const token = Symbol(registration.commandId);
        handlers.set(key, { handler: registration.handler, token });
        entries.push({ key, token });
      }
      let released = false;
      return {
        dispose: (): void => {
          if (released) {
            return;
          }
          released = true;
          for (const entry of entries) {
            if (handlers.get(entry.key)?.token === entry.token) {
              handlers.delete(entry.key);
            }
          }
        },
      };
    },

    async list(input?: ICommandListInput): Promise<readonly ICommandView[]> {
      const bridge = requirePort();
      let output: ICommandListOutput;
      try {
        output = await bridge.request<ICommandListOutput>('command:list', input);
      } catch (error) {
        report({
          code: 'LIST_FAILED',
          message: '读取命令列表失败。',
          detail: error,
        });
        throw error;
      }
      if (typeof output !== 'object' || output === null || !isViewList(output.views)) {
        const error = new Error('平台返回的命令列表结构非法：缺少 views 数组。');
        report({ code: 'LIST_FAILED', message: error.message, detail: output });
        throw error;
      }
      return output.views;
    },

    async invoke(input: ICommandInvokeInput): Promise<ICommandInvokeOutput> {
      const bridge = requirePort();
      try {
        return await bridge.request<ICommandInvokeOutput>('command:invoke', input);
      } catch (error) {
        report({
          code: 'INVOKE_FAILED',
          message: `调用命令 ${input.commandId} 失败。`,
          commandId: input.commandId,
          detail: error,
        });
        throw error;
      }
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      handlers.clear();
      invocationSubscription?.dispose();
      invocationSubscription = null;
    },
  };
}
