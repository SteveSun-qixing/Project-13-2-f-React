/**
 * 卡片渲染入口组件单测（jsdom + React.createElement，保持 .test.ts 闸门匹配）。
 *
 * 权威：`05-渲染引擎设计` §3.2（Surface 一个会话一个挂载点）、§6.4（降级占位：错误码与重试入口）、
 * 工单002 收口记录（平台窗口壳不挂载 ChipsProvider / CommandProvider——主题根由插件入口提供）。
 */

// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { CardRenderer } from '../src/renderer/card-renderer.js';
import type { IRenderEngine, RenderRequest } from '../src/renderer/render-engine.js';
import { ChipsError } from '../src/preload/chips-error.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REQUEST: RenderRequest = { kind: 'card', source: 'chips-resource://default/card/x.card', mode: 'view' };

/** 会话替身消费面（属性一律箭头函数类型，供断言引用而不触发 unbound-method）。 */
interface ISessionStub {
  readonly id: string;
  readonly state: string;
  readonly mount: (container: HTMLElement) => Promise<void>;
  readonly unmount: () => void;
  readonly subscribe: (event: string, handler: (payload: never) => void) => { readonly dispose: () => void };
  readonly dispose: () => Promise<void>;
}

/** 会话替身夹具：记录订阅处理器供测试逐步驱动事件。 */
const createSessionStub = (): { readonly session: ISessionStub; readonly emit: (event: string, payload: unknown) => void } => {
  const handlers = new Map<string, (payload: never) => void>();
  const session: ISessionStub = {
    id: 'render-test',
    state: 'opening',
    mount: vi.fn(() => Promise.resolve()),
    unmount: vi.fn(),
    subscribe: vi.fn((event: string, handler: (payload: never) => void) => {
      handlers.set(event, handler);
      return {
        dispose: () => {
          handlers.delete(event);
        },
      };
    }),
    dispose: vi.fn(() => Promise.resolve()),
  };
  return {
    session,
    emit: (event, payload) => {
      handlers.get(event)?.(payload as never);
    },
  };
};

/** 渲染夹具：容器 + 根 + 事件驱动入口。 */
const createRenderFixture = (
  engine: IRenderEngine,
  session: ISessionStub,
  emit: (event: string, payload: unknown) => void
) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = createRoot(container);
  return {
    container,
    render() {
      act(() => {
        root?.render(createElement(CardRenderer, { engine, request: REQUEST }));
      });
    },
    emitEvent(event: string, payload: unknown) {
      act(() => {
        emit(event, payload);
      });
    },
    cleanup() {
      act(() => {
        root?.unmount();
      });
      root = null;
      container.remove();
    },
  };
};

/** 组合夹具：替身引擎 + 会话替身。 */
const createFixture = () => {
  const stub = createSessionStub();
  const engine = { open: vi.fn(() => Promise.resolve(stub.session)) } as unknown as IRenderEngine;
  const fixture = createRenderFixture(engine, stub.session, stub.emit);
  return { stub, engine, fixture };
};

describe('卡片渲染入口（05.09 §3.2/§6.4，工单002）', () => {
  it('解析在途呈现加载态（StateBoundary Spin）', () => {
    const pendingEngine = { open: vi.fn(() => new Promise(() => undefined)) } as unknown as IRenderEngine;
    const stub = createSessionStub();
    const fixture = createRenderFixture(pendingEngine, stub.session, stub.emit);
    fixture.render();
    expect(fixture.container.querySelector('.ant-spin')).not.toBeNull();
    fixture.cleanup();
  });

  it('就绪后挂载 surface 并把 iframe 挂载点交给会话', () => {
    const { stub, engine, fixture } = createFixture();
    fixture.render();
    fixture.emitEvent('ready', { sessionId: 'render-test' });
    const surface = fixture.container.querySelector('[data-chips-render-surface="render-test"]');
    expect(surface).not.toBeNull();
    expect(stub.session.mount).toHaveBeenCalledWith(surface);
    fixture.cleanup();
    expect(stub.session.dispose).toHaveBeenCalled();
  });

  it('失败降级占位：简体中文文案含错误码；不可重试错误无重试入口', () => {
    const { stub, fixture } = createFixture();
    fixture.render();
    fixture.emitEvent(
      'error',
      new ChipsError({ code: 'RENDER_DOCUMENT_INVALID', message: '文档内容损坏，无法渲染', retryable: false })
    );
    const text = fixture.container.textContent ?? '';
    expect(text).toContain('文档内容损坏，无法渲染');
    expect(text).toContain('RENDER_DOCUMENT_INVALID');
    expect(fixture.container.querySelector('.ant-btn')).toBeNull();
    fixture.cleanup();
  });

  it('可重试错误提供重试入口：点击后重走完整链路（重新 open）', () => {
    const { stub, engine, fixture } = createFixture();
    fixture.render();
    fixture.emitEvent(
      'error',
      new ChipsError({ code: 'RENDER_FRAME_TIMEOUT', message: '渲染帧启动超时，可重试', retryable: true })
    );
    const retryButton = fixture.container.querySelector<HTMLButtonElement>('.ant-btn');
    expect(retryButton?.textContent).toBe('重试');
    fixture.emitEvent('noop', null);
    retryButton?.click();
    fixture.emitEvent('noop', null);
    expect(engine.open).toHaveBeenCalledTimes(2);
    fixture.cleanup();
  });

  it('组件卸载时释放会话并摘除 surface（§3.2：dispose 收口）', () => {
    const { stub, fixture } = createFixture();
    fixture.render();
    fixture.emitEvent('ready', { sessionId: 'render-test' });
    fixture.cleanup();
    expect(stub.session.dispose).toHaveBeenCalled();
    expect(stub.session.unmount).toHaveBeenCalled();
  });

  it('工单002 口径锁：渲染入口源码不挂载任何 Provider（主题根由插件入口提供）', () => {
    const source = readFileSync(path.resolve(import.meta.dirname, '../src/renderer/card-renderer.tsx'), 'utf8');
    expect(source).not.toContain('ChipsProvider');
    expect(source).not.toContain('CommandProvider');
    const hookSource = readFileSync(
      path.resolve(import.meta.dirname, '../src/renderer/use-render-session.ts'),
      'utf8'
    );
    expect(hookSource).not.toContain('ChipsProvider');
    expect(hookSource).not.toContain('CommandProvider');
  });
});
