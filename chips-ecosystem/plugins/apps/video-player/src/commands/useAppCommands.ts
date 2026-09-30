import React, { useCallback, useEffect, useState } from 'react';
import { chips } from '@chips/sdk';
import { useCommandRuntime } from '@chips/ui';
import {
  APP_COMMAND_IDS,
  appCommandDefinitions,
  createAppCommandHandlers,
  type AppCommandActionMap,
  type AppCommandStatus,
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
  /** 属性箭头签名：实现即箭头函数属性，界面层解构消费；方法签名会触发 unbound-method。 */
  invokeOpenCard: (path: string) => Promise<void>;
  invokeRefreshView: () => Promise<void>;
  invokeTogglePlayback: () => Promise<void>;
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
 * `actions` 携带播放控制命令的业务动作（界面层以控制器方法装配）；`command:*` 能力的
 * 生产派发随宿主能力面逐能力派单，Bridge 不可用或能力未就绪时，注册失败收敛为
 * `phase: 'error'` 与错误码，界面不抛错（播放控制由界面与键位交互直接承载）。
 */
export function useAppCommands(actions?: AppCommandActionMap): UseAppCommandsResult {
  const runtime = useCommandRuntime();
  const [phase, setPhase] = useState<CommandRegistryPhase>('registering');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastInvoked, setLastInvoked] = useState<AppCommandStatus | null>(null);

  // 动作表经 ref 现取：控制器对象按渲染换代，注册 effect 不随动作表身份重跑（幂等装配一次）。
  const actionsRef = React.useRef<AppCommandActionMap>(actions ?? {});
  actionsRef.current = actions ?? {};

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
        detach = runtime.attach(createAppCommandHandlers(() => actionsRef.current, setLastInvoked));
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

  const invokeCommand = useCallback(
    async (commandId: string, payload?: unknown): Promise<void> => {
      try {
        if (payload === undefined) {
          await runtime.invoke({ commandId, source: 'api' });
        } else {
          await runtime.invoke({ commandId, payload, source: 'api' });
        }
        setErrorCode(null);
      } catch (error: unknown) {
        setErrorCode(toErrorCode(error));
      }
    },
    [runtime],
  );

  return {
    phase,
    errorCode,
    lastInvoked,
    invokeOpenCard: (path: string): Promise<void> => invokeCommand(APP_COMMAND_IDS.openCard, { path }),
    invokeRefreshView: (): Promise<void> => invokeCommand(APP_COMMAND_IDS.refreshView),
    invokeTogglePlayback: (): Promise<void> => invokeCommand(APP_COMMAND_IDS.togglePlayback),
  };
}
