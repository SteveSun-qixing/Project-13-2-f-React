/**
 * 共享层测试夹具：Mock Bridge 端口、命令视图工厂与应用根包裹。
 *
 * 平台调用一律经 `ICommandBridgePort` 注入（`CommandProvider` 的 `port`），
 * 不伪造 `window.chips` 全局；`@chips/sdk/testing` 落位后由其 `installMockBridge` 承担。
 *
 * 包裹渲染的 `container` 收口到窗口运行环境根元素（见 `renderWithWindowEnvironment`），
 * 结构断言因此只针对被测组件自身，不依赖主题根的实现细节。
 */

import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import React from 'react';
import type { ReactNode } from 'react';

import { ChipsProvider, CommandProvider } from '../../src';
import type {
  ICommandBridgePort,
  ICommandDefinition,
  ICommandOwner,
  ICommandState,
  ICommandSubscription,
  ICommandView,
} from '../../src';

export interface IMockBridgeCall {
  readonly capabilityId: string;
  readonly input: unknown;
}

export interface IMockBridge {
  readonly port: ICommandBridgePort;
  readonly calls: readonly IMockBridgeCall[];
  readonly subscribed: readonly string[];
  handle<T>(capabilityId: string, handler: (input: unknown) => T | Promise<T>): void;
  emit(eventId: string, payload: unknown): void;
  reset(): void;
}

/** 创建 Mock Bridge 端口：记录调用、能力桩与事件派发。 */
export function createMockBridge(): IMockBridge {
  const handlers = new Map<string, (input: unknown) => unknown>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const calls: IMockBridgeCall[] = [];
  const subscribed: string[] = [];

  const port: ICommandBridgePort = {
    request: async <TOutput,>(capabilityId: string, input?: unknown): Promise<TOutput> => {
      calls.push({ capabilityId, input });
      const handler = handlers.get(capabilityId);
      if (handler === undefined) {
        throw new Error(`Mock Bridge 未登记能力：${capabilityId}`);
      }
      return (await handler(input)) as TOutput;
    },
    subscribe: (eventId: string, handler: (payload: unknown) => void): ICommandSubscription => {
      subscribed.push(eventId);
      const set = listeners.get(eventId) ?? new Set<(payload: unknown) => void>();
      set.add(handler);
      listeners.set(eventId, set);
      return {
        dispose: (): void => {
          set.delete(handler);
        },
      };
    },
  };

  return {
    port,
    calls,
    subscribed,
    handle: <T,>(capabilityId: string, handler: (input: unknown) => T | Promise<T>): void => {
      handlers.set(capabilityId, (input) => handler(input));
    },
    emit: (eventId: string, payload: unknown): void => {
      for (const listener of listeners.get(eventId) ?? []) {
        listener(payload);
      }
    },
    reset: (): void => {
      handlers.clear();
      listeners.clear();
      calls.length = 0;
      subscribed.length = 0;
    },
  };
}

const DEFAULT_OWNER: ICommandOwner = {
  kind: 'plugin',
  pluginId: 'chips.test.app',
  sessionId: null,
};
const DEFAULT_STATE: ICommandState = { visible: true, enabled: true, checked: false };

/** 创建命令视图（可覆盖定义、图标、目标、状态与 owner）。 */
export function makeCommandView(options: {
  readonly definition: Partial<ICommandDefinition> & Pick<ICommandDefinition, 'id' | 'title'>;
  readonly iconUri?: string | null;
  readonly owner?: ICommandOwner;
  readonly target?: 'platform' | 'main' | 'ui';
  readonly state?: Partial<ICommandState>;
  readonly updatedAt?: string;
}): ICommandView {
  return {
    definition: options.definition,
    iconUri: options.iconUri ?? null,
    owner: options.owner ?? DEFAULT_OWNER,
    target: options.target ?? 'ui',
    state: { ...DEFAULT_STATE, ...(options.state ?? {}) },
    updatedAt: options.updatedAt ?? '2026-09-19T00:00:00.000Z',
  };
}

/**
 * 窗口运行环境根元素：`ChipsProvider` 经主题根安装 antd `App` 根节点，
 * 该节点才是被测组件树在挂载容器内的实际根。夹具把它作为 `container` 返回，
 * 使结构断言直接指向被测组件自身（`container.firstElementChild` 即被测组件根元素）。
 *
 * @param container RTL 挂载容器
 * @returns 窗口运行环境根元素
 */
function windowEnvironmentRoot(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error('未找到窗口运行环境根元素，ChipsProvider 未安装主题根。');
  }
  return root;
}

/**
 * 以窗口运行环境为夹具渲染被测元素。
 *
 * 环境经 RTL `wrapper` 挂载：`rerender` 只替换被测组件，提供者树（令牌、主题根、
 * 命令运行时）保持不变，与真实窗口的挂载方式一致。
 *
 * @param ui 被测元素
 * @param Wrapper 运行环境包裹组件
 * @returns 以窗口运行环境根为 `container` 的渲染结果
 */
function renderWithWindowEnvironment(
  ui: React.ReactElement,
  Wrapper: React.FC<{ children: ReactNode }>
): RenderResult {
  const result = render(ui, { wrapper: Wrapper });
  return { ...result, container: windowEnvironmentRoot(result.container) };
}

/** 包裹窗口运行环境（令牌、主题根与 App 上下文）。 */
export function renderWithApp(ui: React.ReactElement): RenderResult {
  const AppEnvironment: React.FC<{ children: ReactNode }> = ({ children }) => (
    <ChipsProvider appId="chips.test.app" surface="window">
      {children}
    </ChipsProvider>
  );
  return renderWithWindowEnvironment(ui, AppEnvironment);
}

/** 包裹窗口运行环境与命令运行时。 */
export function renderWithCommands(ui: React.ReactElement, port: ICommandBridgePort): RenderResult {
  const CommandEnvironment: React.FC<{ children: ReactNode }> = ({ children }) => (
    <ChipsProvider appId="chips.test.app" surface="window">
      <CommandProvider port={port}>{children}</CommandProvider>
    </ChipsProvider>
  );
  return renderWithWindowEnvironment(ui, CommandEnvironment);
}
