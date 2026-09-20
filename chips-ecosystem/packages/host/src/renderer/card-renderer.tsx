/**
 * `CardRenderer`：卡片渲染入口组件（壳渲染进程卡片链"渲染"环节的挂载面）。
 *
 * 权威：`05-渲染引擎设计` §3.2（React 壳分层：Surface 一个会话一个挂载点）、§6.4（降级占位：
 * `@chips/ui` 组件 + 简体中文文案 + 错误码与重试入口）、工单002 收口记录（UI 根环境由插件入口
 * 挂载，平台窗口壳不提供、也不得提供主题根——本组件因此不挂载任何 Provider）。
 */

import { StateBoundary } from '@chips/ui';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { useRenderSession } from './use-render-session.js';
import type { IRenderEngine, RenderRequest } from './render-engine.js';

/** `CardRenderer` 属性。 */
export interface CardRendererProps {
  /** 渲染引擎（由窗口壳组合根注入）。 */
  readonly engine: IRenderEngine;
  /** 渲染请求（卡片查看态）。 */
  readonly request: RenderRequest;
}

/**
 * 卡片渲染入口：加载 → 内容 surface（iframe 由 RenderHost 插入）→ 失败降级占位。
 */
export function CardRenderer({ engine, request }: CardRendererProps): ReactElement {
  const { session, state, error, retry } = useRenderSession(engine, request);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null || session === null) {
      return undefined;
    }
    void session.mount(surface);
    return () => {
      session.unmount();
    };
    // 依赖 `state`：加载/错误态下 StateBoundary 不渲染内容区，surface 出现后需重新执行挂载。
  }, [session, state]);

  // 降级占位展示错误码与简体中文说明（§6.4）；可重试错误提供重试入口，重试重走完整链路。
  const boundaryError =
    error === null ? null : { code: error.code, message: `${error.message}（错误码：${error.code}）` };

  return (
    <StateBoundary
      loading={state === 'opening'}
      error={boundaryError}
      {...(error !== null && error.retryable ? { onRetry: retry } : {})}
    >
      <div ref={surfaceRef} data-chips-render-surface={session === null ? undefined : session.id} />
    </StateBoundary>
  );
}
