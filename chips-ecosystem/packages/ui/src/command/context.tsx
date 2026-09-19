/**
 * 命令运行时的 React 装配：`CommandProvider` / `useCommandRuntime` 与命令视图查询 hook。
 *
 * 权威：《薯片生态文档库/05-接口与契约/13-命令系统契约》§5.6、《08-@chips-ui共享层使用指南》§3.2。
 * - 运行时在窗口内单例（由 `CommandProvider` 提供）；
 * - 命令面板、工具栏与窗口内快捷键组件必须经运行时取数与调用；
 * - 注册表变化（`command:registered` / `command:unregistered` / `command:changed`）与上下文变化
 *   （`document:opened` / `document:closed` / `window:focused`）驱动视图重新查询（契约 §3.4），
 *   组件不得缓存跨上下文的 `state`。
 */

import React from 'react';
import type { ReactElement, ReactNode } from 'react';

import { toChipsUiFailure } from '../utils';
import type { ChipsUiFailure } from '../utils';
import type { ICommandBridgePort, ICommandSubscription, ICommandView } from './contract';
import { reportCommandDiagnostic } from './diagnostics';
import { resolveCommandBridgePort } from './platform-port';
import { createCommandRuntime } from './runtime';
import type { ICommandRuntimeController } from './runtime';

/** 驱动命令视图重新查询的公开事件（契约 §3.4）。 */
export const COMMAND_VIEW_REFRESH_EVENTS: readonly string[] = [
  'command:registered',
  'command:unregistered',
  'command:changed',
  'document:opened',
  'document:closed',
  'window:focused',
];

interface ICommandRuntimeContextValue {
  readonly runtime: ICommandRuntimeController;
  readonly port: ICommandBridgePort | null;
  readonly registryVersion: number;
}

const CommandRuntimeContext = React.createContext<ICommandRuntimeContextValue | null>(null);

export interface CommandProviderProps {
  children: ReactNode;
  /**
   * 平台访问端口；缺省从 `window.chips` 解析。
   * 供平台壳显式注入 SDK 客户端与组件测试注入替身使用（端口形状见 `ICommandBridgePort`）。
   */
  port?: ICommandBridgePort;
}

/**
 * 命令运行时提供者：窗口内挂载一次，包裹所有命令消费组件。
 *
 * @param props 提供者属性
 * @returns 注入运行时上下文的元素
 */
export function CommandProvider({ children, port }: CommandProviderProps): ReactElement {
  const resolvedPort = React.useMemo(() => port ?? resolveCommandBridgePort(), [port]);
  const runtime = React.useMemo(() => createCommandRuntime({ port: resolvedPort }), [resolvedPort]);
  const [registryVersion, setRegistryVersion] = React.useState(0);

  React.useEffect(() => {
    const subscriptions: ICommandSubscription[] = [];
    if (resolvedPort !== null) {
      const bumpVersion = (): void => {
        setRegistryVersion((version) => version + 1);
      };
      for (const eventId of COMMAND_VIEW_REFRESH_EVENTS) {
        try {
          const subscription = resolvedPort.subscribe(eventId, bumpVersion);
          if (typeof subscription?.dispose === 'function') {
            subscriptions.push(subscription);
          }
        } catch (error) {
          reportCommandDiagnostic({
            code: 'SUBSCRIBE_FAILED',
            message: `订阅 ${eventId} 失败，命令列表不会随该事件刷新。`,
            detail: error,
          });
        }
      }
    }
    return () => {
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
      runtime.dispose();
    };
  }, [resolvedPort, runtime]);

  const value = React.useMemo<ICommandRuntimeContextValue>(
    () => ({ runtime, port: resolvedPort, registryVersion }),
    [runtime, resolvedPort, registryVersion]
  );

  return <CommandRuntimeContext.Provider value={value}>{children}</CommandRuntimeContext.Provider>;
}

/** 读取命令运行时上下文；未挂载 `CommandProvider` 时抛出简体中文错误。 */
export function useCommandRuntimeContext(): ICommandRuntimeContextValue {
  const value = React.useContext(CommandRuntimeContext);
  if (value === null) {
    throw new Error('useCommandRuntime 必须在 CommandProvider 内使用。');
  }
  return value;
}

/**
 * 读取命令运行时。
 *
 * @returns 当前窗口的命令运行时单例
 * @throws {Error} 未在 `CommandProvider` 内调用时抛出简体中文错误
 */
export function useCommandRuntime(): ICommandRuntimeController {
  return useCommandRuntimeContext().runtime;
}

/** `useCommandViews` 选项。 */
export interface ICommandViewsOptions {
  /** 是否启用查询；缺省 true（如命令面板关闭时置 false，不发起查询）。 */
  readonly enabled?: boolean;
}

/** `useCommandViews` 返回值。 */
export interface ICommandViewsState {
  readonly views: readonly ICommandView[];
  readonly loading: boolean;
  readonly error: ChipsUiFailure | null;
  /** 立即重新查询（如面板打开时）。 */
  readonly reload: () => void;
}

/**
 * 查询当前上下文的命令视图，并在注册表 / 上下文变化后自动重新查询。
 *
 * @param options 查询选项
 * @returns 视图、加载态、失败信息与手动重查函数
 */
export function useCommandViews(options: ICommandViewsOptions = {}): ICommandViewsState {
  const { enabled = true } = options;
  const { runtime, registryVersion } = useCommandRuntimeContext();
  const [views, setViews] = React.useState<readonly ICommandView[]>([]);
  const [loading, setLoading] = React.useState<boolean>(enabled);
  const [error, setError] = React.useState<ChipsUiFailure | null>(null);
  const [localVersion, setLocalVersion] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError(null);
    runtime.list().then(
      (nextViews) => {
        if (!active) {
          return;
        }
        setViews(nextViews);
        setLoading(false);
      },
      (cause: unknown) => {
        if (!active) {
          return;
        }
        setViews([]);
        setError(toChipsUiFailure(cause, '读取命令列表失败，请重试'));
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [runtime, registryVersion, enabled, localVersion]);

  const reload = React.useCallback((): void => {
    setLocalVersion((version) => version + 1);
  }, []);

  return { views, loading, error, reload };
}
