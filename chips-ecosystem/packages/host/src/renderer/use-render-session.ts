/**
 * `useRenderSession`：壳与 RenderHost 之间的唯一桥接 Hook。
 *
 * 权威：`05-渲染引擎设计` §3.2（React 壳分层与 Hook 职责：创建会话、挂载/卸载、订阅事件、
 * 组件卸载时 `dispose()`）。
 *
 * @remarks
 * - 重试即重走完整链路（§6.4/§11）：先释放旧会话，再以新会话从头执行解析管线。
 * - 本 Hook 不挂载任何 Provider；UI 根环境由插件入口按工单002 口径自行挂载。
 */

import { useCallback, useEffect, useState } from 'react';

import type { IRenderEngine, IRenderSession, RenderEventMap, RenderEventName, RenderRequest, RenderSessionState } from './render-engine.js';
import { toChipsError } from '../preload/chips-error.js';
import type { ChipsError } from '../preload/chips-error.js';

/** Hook 返回面。 */
export interface IUseRenderSessionResult {
  /** 当前会话（解析管线在途时为 `null`）。 */
  readonly session: IRenderSession | null;
  /** 会话状态（会话未创建前为 `opening`）。 */
  readonly state: RenderSessionState;
  /** 会话失败信息（未失败为 `null`）。 */
  readonly error: ChipsError | null;
  /** 重试（重走完整链路；仅对可重试错误有意义）。 */
  readonly retry: () => void;
}

/**
 * 创建并持有渲染会话：组件卸载或请求变化时 `dispose()` 旧会话。
 */
export function useRenderSession(engine: IRenderEngine, request: RenderRequest): IUseRenderSessionResult {
  const [session, setSession] = useState<IRenderSession | null>(null);
  const [state, setState] = useState<RenderSessionState>('opening');
  const [error, setError] = useState<ChipsError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let active: IRenderSession | null = null;
    setState('opening');
    setError(null);
    setSession(null);
    const created = engine
      .open(request)
      .then((createdSession) => {
        if (cancelled) {
          void createdSession.dispose();
          return;
        }
        active = createdSession;
        setSession(createdSession);
        setState(createdSession.state);
        const reflectState = (next: RenderSessionState): void => {
          setState(next);
        };
        createdSession.subscribe('ready', () => {
          reflectState('ready');
        });
        createdSession.subscribe('error', (payload: RenderEventMap['error']) => {
          reflectState('error');
          setError(payload);
        });
        createdSession.subscribe('disposed', () => {
          reflectState('disposed');
        });
      })
      .catch((openError: unknown) => {
        if (cancelled) {
          return;
        }
        // 会话创建（请求校验）阶段的失败：无会话可挂，直接进入错误态。
        setState('error');
        setError(toChipsError(openError, 'BRIDGE_INTERNAL', '渲染会话创建失败'));
      });
    return () => {
      cancelled = true;
      void created.then(() => {
        void active?.dispose();
      });
    };
  }, [engine, request, attempt]);

  const retry = useCallback((): void => {
    setAttempt((current) => current + 1);
  }, []);

  return { session, state, error, retry };
}

/** 事件名联合重导出（Hook 消费方无需导入引擎模块内部）。 */
export type { RenderEventName };
