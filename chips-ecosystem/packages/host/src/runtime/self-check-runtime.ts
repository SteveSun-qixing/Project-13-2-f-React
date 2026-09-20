/**
 * 壳自检运行时。
 *
 * @remarks
 * - 用途：在平台核心（Cordis + Bridge）装配前，允许壳以真实 Electron 链路启动并自检
 *   （`pnpm --filter @chips/host dev`）；**不注册任何能力、事件与资源作用域**。
 * - 所有调用返回正式"未注册"错误码（`BRIDGE_CAPABILITY_NOT_FOUND` / `RESOURCE_NOT_FOUND` /
 *   `EVENT_NOT_REGISTERED`），不空实现、不伪造成功（17 §3.3 SB-5）。
 * - `platform` 作用域由本运行时服务：映射到平台构建产物目录（壳页与其脚本），
 *   这是平台自有资源的最小读路径；其余作用域一律 `RESOURCE_NOT_FOUND`。
 */

import type { IBridgeResponse, IEventControlResponse, IResourceControlResponse } from '../protocol/wire.js';
import type {
  IEventSink,
  IPlatformHostChannel,
  IPlatformIpcEndpoint,
  IPlatformRuntime,
  IPlatformStartupInput,
  ISessionSource,
} from './contracts.js';
import { createPlatformResourceBackend } from './platform-resource.js';
import type { IPalHost } from '../platform/contracts/index.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';

/** 自检运行时选项。 */
export interface SelfCheckRuntimeOptions {
  /** 平台构建产物根目录（`chips-resource://platform/<path>` 的映射根）。 */
  readonly platformRoot: string;
  /** 诊断口；默认写 `process.stderr`（自检入口仅用于开发期自检）。 */
  readonly diagnostics?: DiagnosticsSink;
}

const capabilityNotFound = (requestId: string): IBridgeResponse => ({
  requestId,
  ok: false,
  error: { code: 'BRIDGE_CAPABILITY_NOT_FOUND', message: '能力未注册（平台核心尚未装配）', retryable: false },
});

const resourceNotFound = (requestId: string): IResourceControlResponse => ({
  requestId,
  ok: false,
  error: { code: 'RESOURCE_NOT_FOUND', message: '资源不存在（平台核心尚未装配）', retryable: false },
});

const eventNotRegistered = (controlId: string): IEventControlResponse => ({
  controlId,
  ok: false,
  error: { code: 'EVENT_NOT_REGISTERED', message: '事件未注册（平台核心尚未装配）', retryable: false },
});

/** 壳自检运行时的 IPC 端点。 */
function createSelfCheckIpcEndpoint(): IPlatformIpcEndpoint {
  return {
    async handleRequest(_session: ISessionSource, request): Promise<IBridgeResponse> {
      return Promise.resolve(capabilityNotFound(request.requestId));
    },
    async handleResourceControl(_session: ISessionSource, request): Promise<IResourceControlResponse> {
      return Promise.resolve(resourceNotFound(request.requestId));
    },
    async handleEventControl(_session: ISessionSource, request): Promise<IEventControlResponse> {
      return Promise.resolve(eventNotRegistered(request.controlId));
    },
    handleWindowClosed(): void {
      return;
    },
  };
}

/**
 * 创建壳自检运行时。
 *
 * @param options 选项。
 */
export function createSelfCheckRuntime(options: SelfCheckRuntimeOptions): IPlatformRuntime {
  const ipc = createSelfCheckIpcEndpoint();
  const resources = createPlatformResourceBackend(options.platformRoot);
  const diagnostics = options.diagnostics ?? createStderrDiagnostics();
  return {
    async start(_host: IPalHost, _channel: IPlatformHostChannel): Promise<void> {
      return Promise.resolve();
    },
    async restorePlugins(): Promise<void> {
      return Promise.resolve();
    },
    async handleStartupInputs(inputs: readonly IPlatformStartupInput[]): Promise<void> {
      if (inputs.length === 0) {
        return Promise.resolve();
      }
      diagnostics.warn('startup', '平台核心尚未装配，启动输入未投递', { count: inputs.length });
      return Promise.resolve();
    },
    async stopPlugins(): Promise<void> {
      return Promise.resolve();
    },
    async shutdown(): Promise<void> {
      return Promise.resolve();
    },
    ipc,
    resources,
    forwardEvents(_sink: IEventSink): () => void {
      return () => {
        return;
      };
    },
  };
}
