/**
 * 平台运行时端口替身（仅测试代码）。
 *
 * @remarks 记录调用序列、提供可配置的 IPC 响应与事件下行捕获；不实现任何权限或路由语义。
 */

import type { IPalHost } from '../../src/platform/contracts/index.js';
import type {
  IEventSink,
  IPlatformHostChannel,
  IPlatformRuntime,
  IPlatformStartupInput,
  IResourceBackend,
  IResourceReadRequest,
  IResourceReadResult,
  ISessionSource,
} from '../../src/runtime/contracts.js';
import type {
  IBridgeRequest,
  IBridgeResponse,
  IEventControlRequest,
  IEventControlResponse,
  IResourceControlRequest,
  IResourceControlResponse,
} from '../../src/protocol/wire.js';

/** 运行时替身选项。 */
export interface FakeRuntimeOptions {
  /** 能力调用实现；缺省返回 `BRIDGE_CAPABILITY_NOT_FOUND`。 */
  readonly handleRequest?: (session: ISessionSource, request: IBridgeRequest) => Promise<IBridgeResponse>;
  /** 资源控制实现；缺省返回成功且元数据为 `null`。 */
  readonly handleResourceControl?: (
    session: ISessionSource,
    request: IResourceControlRequest,
  ) => Promise<IResourceControlResponse>;
  /** 事件控制实现；缺省返回成功。 */
  readonly handleEventControl?: (
    session: ISessionSource,
    request: IEventControlRequest,
  ) => Promise<IEventControlResponse>;
  /** 资源读取实现；缺省抛出 `RESOURCE_NOT_FOUND`。 */
  readonly readResource?: (request: IResourceReadRequest) => Promise<IResourceReadResult>;
}

/** 运行时替身。 */
export interface FakeRuntime {
  readonly runtime: IPlatformRuntime;
  /** 调用记录。 */
  readonly calls: {
    start: Array<{ host: IPalHost; channel: IPlatformHostChannel }>;
    restorePlugins: number;
    stopPlugins: number;
    shutdown: number;
    startupInputs: IPlatformStartupInput[][];
    windowClosed: number[];
    sink: IEventSink | null;
    forwarded: number;
    detached: number;
  };
  /** 触发权限快照下行。 */
  pushPermissions(
    windowId: number,
    update: { sessionId: string; grantedPermissions: string[]; permissionVersion: number },
  ): void;
}

/** 构造运行时替身。 */
export function createFakeRuntime(options: FakeRuntimeOptions = {}): FakeRuntime {
  const calls: FakeRuntime['calls'] = {
    start: [],
    restorePlugins: 0,
    stopPlugins: 0,
    shutdown: 0,
    startupInputs: [],
    windowClosed: [],
    sink: null,
    forwarded: 0,
    detached: 0,
  };

  const notFound = (requestId: string): IBridgeResponse => ({
    requestId,
    ok: false,
    error: { code: 'BRIDGE_CAPABILITY_NOT_FOUND', message: '能力不存在', retryable: false },
  });

  const resources: IResourceBackend = {
    async read(request: IResourceReadRequest): Promise<IResourceReadResult> {
      if (options.readResource !== undefined) {
        return options.readResource(request);
      }
      throw { code: 'RESOURCE_NOT_FOUND', message: '资源不存在', retryable: false };
    },
  };

  const runtime: IPlatformRuntime = {
    async start(host: IPalHost, channel: IPlatformHostChannel): Promise<void> {
      calls.start.push({ host, channel });
    },
    async restorePlugins(): Promise<void> {
      calls.restorePlugins += 1;
    },
    async handleStartupInputs(inputs: readonly IPlatformStartupInput[]): Promise<void> {
      calls.startupInputs.push([...inputs]);
    },
    async stopPlugins(): Promise<void> {
      calls.stopPlugins += 1;
    },
    async shutdown(): Promise<void> {
      calls.shutdown += 1;
    },
    ipc: {
      async handleRequest(session, request): Promise<IBridgeResponse> {
        if (options.handleRequest !== undefined) {
          return options.handleRequest(session, request);
        }
        return notFound(request.requestId);
      },
      async handleResourceControl(session, request): Promise<IResourceControlResponse> {
        if (options.handleResourceControl !== undefined) {
          return options.handleResourceControl(session, request);
        }
        return { requestId: request.requestId, ok: true, metadata: null };
      },
      async handleEventControl(session, request): Promise<IEventControlResponse> {
        if (options.handleEventControl !== undefined) {
          return options.handleEventControl(session, request);
        }
        return { controlId: request.controlId, ok: true };
      },
      handleWindowClosed(windowId: number): void {
        calls.windowClosed.push(windowId);
      },
    },
    resources,
    forwardEvents(sink: IEventSink): () => void {
      calls.sink = sink;
      calls.forwarded += 1;
      return () => {
        calls.detached += 1;
        calls.sink = null;
      };
    },
  };

  return {
    runtime,
    calls,
    pushPermissions(windowId, update): void {
      const entry = calls.start.at(-1);
      if (entry === undefined) {
        throw new Error('运行时尚未启动');
      }
      entry.channel.pushSessionPermissions(windowId, update);
    },
  };
}
