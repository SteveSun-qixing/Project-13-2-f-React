import { useCallback, useEffect, useRef, useState } from 'react';
import { chips } from '@chips/sdk';
import { useCommandRuntime } from '@chips/ui';
import {
  APP_COMMAND_IDS,
  appCommandDefinitions,
  createAppCommandHandlers,
  type AppCommandStatus,
  type CommunityCommandActions,
} from './appCommands';

/** 命令注册阶段：注册中 → 就绪；失败进入 error 并携带错误码。 */
export type CommandRegistryPhase = 'registering' | 'ready' | 'error';

/** 注册阶段的简体中文展示文案。 */
export const COMMAND_PHASE_LABELS: Readonly<Record<CommandRegistryPhase, string>> = {
  registering: '命令注册中',
  ready: '命令已就绪',
  error: '命令通道异常',
};

function toErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'COMMAND_RUNTIME_ERROR';
}

/** `useAppCommands` 返回值。 */
export interface UseAppCommandsResult {
  readonly phase: CommandRegistryPhase;
  readonly errorCode: string | null;
  readonly lastInvoked: AppCommandStatus | null;
  /** 装配命令业务动作（界面层以最新状态装配，避免陈旧闭包）。 */
  readonly setActions: (actions: CommunityCommandActions | null) => void;
  /** 以 `source: 'api'` 触发刷新视图命令（界面内按钮通道）。 */
  readonly invokeRefreshView: () => Promise<void>;
}

/**
 * 应用 UI 命令运行时接线（《13-命令系统契约》§5.6 与 §5.7）。
 *
 * 装配顺序：
 * 1. 挂载时逐条 `chips.request('command:register', { definition })` 注册携带
 *    `handlerId` 的命令记录（权限 `command:write`，见 manifest permissions）；
 * 2. 用 `@chips/ui` 命令运行时的 `attach` 绑定本地处理器；运行时订阅
 *    `command:invoked`，按 `(commandId, handlerId)` 配对执行；
 * 3. 卸载时撤销订阅并注销命令记录（`command:unregister` 幂等）。
 *
 * `command:*` 能力的生产派发随宿主能力面逐能力派单；Bridge 不可用或能力未就绪时，
 * 注册失败收敛为 `phase: 'error'` 与错误码，界面不抛错（诚实降级，不假接线）。
 */
export function useAppCommands(): UseAppCommandsResult {
  const runtime = useCommandRuntime();
  const [phase, setPhase] = useState<CommandRegistryPhase>('registering');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastInvoked, setLastInvoked] = useState<AppCommandStatus | null>(null);
  const actionsRef = useRef<CommunityCommandActions | null>(null);

  useEffect(() => {
    let cancelled = false;
    let detach: { dispose(): void } | null = null;
    setPhase('registering');
    setErrorCode(null);
    void (async (): Promise<void> => {
      try {
        for (const definition of appCommandDefinitions) {
          await chips.request('command:register', { definition });
        }
        if (cancelled) {
          return;
        }
        detach = runtime.attach(
          createAppCommandHandlers(
            {
              openCard: (path: string): void => {
                actionsRef.current?.openCard(path);
              },
              refreshView: (): void => {
                actionsRef.current?.refreshView();
              },
            },
            (status: AppCommandStatus): void => {
              setLastInvoked(status);
            },
          ),
        );
        setPhase('ready');
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorCode(toErrorCode(error));
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      detach?.dispose();
      for (const definition of appCommandDefinitions) {
        const settled = chips.request('command:unregister', { commandId: definition.id });
        void settled.catch((): undefined => undefined);
      }
    };
  }, [runtime]);

  const setActions = useCallback((actions: CommunityCommandActions | null): void => {
    actionsRef.current = actions;
  }, []);

  const invokeRefreshView = useCallback(async (): Promise<void> => {
    try {
      await runtime.invoke({ commandId: APP_COMMAND_IDS.refreshView, source: 'api' });
      setErrorCode(null);
    } catch (error: unknown) {
      setErrorCode(toErrorCode(error));
    }
  }, [runtime]);

  return { phase, errorCode, lastInvoked, setActions, invokeRefreshView };
}
