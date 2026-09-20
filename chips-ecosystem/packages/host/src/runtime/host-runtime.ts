/**
 * 生产组合根运行时：把能力清单装配成真实 `IPlatformRuntime`。
 *
 * 权威：`02-Bridge三层设计` §2.1（主进程适配层：会话解析 + 路由 + 错误归一）、§5.2（路由管线）、
 * §7.4（会话解析与绑定）、§8（超时/取消/并发），`08-权限系统设计` §7（运行时权限判定与会话快照），
 * `17-跨端Shell与平台抽象设计` §2.4（启动/停机顺序）。
 *
 * @remarks
 * - 组合根职责：注册显式能力清单（不再一律返回 `BRIDGE_CAPABILITY_NOT_FOUND`）、按 IPC 来源解析并
 *   **懒建会话**、以权限快照来源判定授权、投递事件下行、管理资源句柄与事件订阅、提供诊断快照。
 * - 诊断快照含"已预留、待接线"面（`report().reserved`）：`document:*` 等槽位由
 *   `capabilities/reserved.ts` 声明、由本运行时与注册表实态比对呈现，不参与注册；未接线的槽位被调用时
 *   返回真实的注册表未命中错误（`BRIDGE_CAPABILITY_NOT_FOUND`）。
 * - 与旧空壳运行时的分工：`self-check-runtime.ts` 仍是"核心未装配"的诚实回退；本运行时装配真实清单，
 *   自检入口经它返回真实响应（P0-1 交付点 1）。
 * - 权限判定与会话口径对齐 `02`/`08`，但深度 Schema 校验、限定值细粒度匹配、插件拓扑恢复在 Rust Bridge
 *   内核交付后由内核承担（见开发日志集成缺口）。
 */

import { BRIDGE_ERROR_CODES, bridgeWireError } from '../protocol/error-codes.js';
import { parseResourceUri } from '../protocol/resource-uri.js';
import type { ISessionPermissionsUpdate } from '../protocol/wire.js';
import { asWireError } from './contracts.js';
import type {
  IBridgeRequest,
  IBridgeResponse,
  IEventControlRequest,
  IEventControlResponse,
  IEventEnvelope,
  IResourceControlRequest,
  IResourceControlResponse,
  IWireResourceMetadata,
} from '../protocol/wire.js';
import type { IPalHost } from '../platform/contracts/index.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import type {
  IEventSink,
  IPlatformHostChannel,
  IPlatformIpcEndpoint,
  IPlatformRuntime,
  IPlatformStartupInput,
  IResourceBackend,
  IResourceReadRequest,
  ISessionSource,
} from './contracts.js';
import { createHostCapabilityRegistry, type IHostCapabilityRegistryOptions } from './capability/registry.js';
import { createHostSessionRegistry, type IHostSessionProvisioner } from './capability/session.js';
import { createHostCallScheduler } from './capability/scheduler.js';
import { createHostCapabilityRouter } from './capability/router.js';
import { createEventSubscriptionCenter, createResourceHandleCenter } from './capability/subscription.js';
import { createPlatformResourceBackend } from './platform-resource.js';
import { RESERVED_CAPABILITIES } from './capabilities/reserved.js';
import type { IReservedCapabilityDeclaration } from './capabilities/reserved.js';
import type {
  IHostCapabilityDescriptor,
  IHostReservedCapabilityView,
  IHostRuntimeReport,
  IHostSession,
} from './capability/contracts.js';

/** 生产运行时选项。 */
export interface HostRuntimeOptions {
  /** 能力清单（显式注册单元，含内置与外部提供方）。 */
  readonly capabilities?: readonly IHostCapabilityDescriptor[];
  /**
   * 预留槽位声明（诊断面）；缺省取 `capabilities/reserved.ts` 的组合根默认清单。
   *
   * @remarks 预留清单**不参与注册**，只用于诊断面呈现"已预留、待接线"；传空数组即关闭该面。
   */
  readonly reservedCapabilities?: readonly IReservedCapabilityDeclaration[];
  /** 会话授权来源（权限快照）；缺省见 {@link createPlatformSessionProvisioner}。 */
  readonly sessionProvisioner?: IHostSessionProvisioner;
  /** 注册表注入项（已知权限词表 / 清单声明）。 */
  readonly registryOptions?: IHostCapabilityRegistryOptions;
  /** 资源读取后端；缺省用 `platformRoot` 构造平台作用域后端。 */
  readonly resources?: IResourceBackend;
  /** 平台构建产物根目录（缺省资源后端的映射根）。 */
  readonly platformRoot?: string;
  /** 诊断口；缺省写 `process.stderr`。 */
  readonly diagnostics?: DiagnosticsSink;
  /** 时钟（毫秒）；测试可注入。 */
  readonly now?: () => number;
}

/** 生产运行时端口（附带诊断快照查询）。 */
export interface IHostRuntime extends IPlatformRuntime {
  /** 组合诊断快照（能力 / 会话 / 在途 / 订阅 / 句柄）。 */
  report(): IHostRuntimeReport;
}

/** 默认平台会话授权来源标识。 */
const PLATFORM_SESSION_PLUGIN_ID = 'platform';

/**
 * 默认会话授权来源：为壳自身窗口建立平台会话并授予全量权限。
 *
 * @remarks
 * 插件会话的权限快照来源（清单 + 授权记录）由 Rust Bridge 内核交付后经注入点接管；
 * 核心缺位期，壳页所在窗口按平台会话处理（08 §4.4 平台自身免权限）。
 */
export function createPlatformSessionProvisioner(): IHostSessionProvisioner {
  return {
    provision(): { pluginId: string; grantedPermissions: readonly string[] } {
      return { pluginId: PLATFORM_SESSION_PLUGIN_ID, grantedPermissions: ['*'] };
    },
  };
}

function sessionSourceId(source: ISessionSource): string {
  return `session:${String(source.windowId)}:${source.frameId === null ? 'main' : String(source.frameId)}`;
}

function metadataFromHeaders(
  uri: string,
  scope: string,
  headers: Readonly<Record<string, string>>,
): IWireResourceMetadata {
  const rawType = headers['Content-Type'];
  const mimeType =
    rawType === undefined ? 'application/octet-stream' : (rawType.split(';')[0] ?? 'application/octet-stream');
  const rawLength = headers['Content-Length'];
  const size = rawLength === undefined ? 0 : Number.parseInt(rawLength, 10) || 0;
  return { uri, size, mimeType, version: '0', scope };
}

/**
 * 创建生产组合根运行时。
 *
 * @param options 选项。
 */
export function createHostRuntime(options: HostRuntimeOptions = {}): IHostRuntime {
  const diagnostics = options.diagnostics ?? createStderrDiagnostics();
  const now = options.now ?? ((): number => Date.now());
  const registry = createHostCapabilityRegistry(options.registryOptions ?? {});
  const sessions = createHostSessionRegistry();
  const scheduler = createHostCallScheduler();
  const events = createEventSubscriptionCenter();
  const handles = createResourceHandleCenter();
  const provisioner = options.sessionProvisioner ?? createPlatformSessionProvisioner();

  const resources: IResourceBackend =
    options.resources ??
    (options.platformRoot !== undefined
      ? createPlatformResourceBackend(options.platformRoot)
      : {
          // 组合根未提供平台根也未注入后端：如实报内部错误，不伪造空结果。
          read(): Promise<never> {
            return Promise.reject(
              Object.assign(new Error('资源管理器未装配'), { code: BRIDGE_ERROR_CODES.internal, retryable: false }),
            );
          },
        });
  const reservedDeclarations = options.reservedCapabilities ?? RESERVED_CAPABILITIES;

  const sinks = new Set<IEventSink>();
  let channel: IPlatformHostChannel | null = null;
  let state: IHostRuntimeReport['state'] = 'idle';

  const publishEvent = (sessionId: string, windowId: number, eventId: string, payload: unknown): void => {
    if (!events.isSubscribed(sessionId, eventId) || sinks.size === 0) {
      return;
    }
    const envelope: IEventEnvelope = { eventId, payload, emittedAt: now() };
    for (const sink of sinks) {
      sink.deliver(windowId, envelope);
    }
  };

  const router = createHostCapabilityRouter({
    registry,
    scheduler,
    now,
    publishEvent,
    sessionSignalFor: (sessionId: string): AbortSignal | undefined => sessions.signalFor(sessionId),
  });

  const pushSnapshot = (session: IHostSession): void => {
    if (channel === null) {
      return;
    }
    const update: ISessionPermissionsUpdate = {
      sessionId: session.sessionId,
      grantedPermissions: [...session.grantedPermissions],
      permissionVersion: session.permissionVersion,
    };
    channel.pushSessionPermissions(session.windowId, update);
  };

  sessions.onPermissionsChanged(pushSnapshot);
  sessions.onClosed((session: IHostSession): void => {
    events.releaseSession(session.sessionId);
    handles.releaseSession(session.sessionId);
  });

  const resolveSession = (source: ISessionSource): IHostSession | null => {
    const existing = sessions.resolve(source);
    if (existing !== undefined) {
      return existing;
    }
    const grant = provisioner.provision(source);
    if (grant === null) {
      return null;
    }
    const opened = sessions.open({
      sessionId: sessionSourceId(source),
      pluginId: grant.pluginId,
      windowId: source.windowId,
      frameId: source.frameId,
      grantedPermissions: grant.grantedPermissions,
      ...(grant.openedDocuments === undefined ? {} : { openedDocuments: grant.openedDocuments }),
    });
    pushSnapshot(opened);
    return opened;
  };

  const unknownSessionBridge = (requestId: string): IBridgeResponse => ({
    requestId,
    ok: false,
    error: bridgeWireError(BRIDGE_ERROR_CODES.sessionUnknown),
  });

  const ipc: IPlatformIpcEndpoint = {
    async handleRequest(source: ISessionSource, request: IBridgeRequest): Promise<IBridgeResponse> {
      if (state !== 'running') {
        return { requestId: request.requestId, ok: false, error: bridgeWireError(BRIDGE_ERROR_CODES.internal) };
      }
      const session = resolveSession(source);
      if (session === null) {
        return unknownSessionBridge(request.requestId);
      }
      return router.route(session, request);
    },

    async handleResourceControl(
      source: ISessionSource,
      request: IResourceControlRequest,
    ): Promise<IResourceControlResponse> {
      const session = resolveSession(source);
      if (session === null) {
        return { requestId: request.requestId, ok: false, error: bridgeWireError(BRIDGE_ERROR_CODES.sessionUnknown) };
      }
      if (request.operation === 'release') {
        handles.release(session.sessionId, request.uri);
        return { requestId: request.requestId, ok: true, metadata: null };
      }
      const parsed = parseResourceUri(request.uri);
      if (!parsed.ok) {
        return {
          requestId: request.requestId,
          ok: false,
          error: { code: parsed.code, message: '资源地址无效', retryable: false },
        };
      }
      if (parsed.scope !== 'platform') {
        const decision = session.grantedPermissions.has('*') || session.grantedPermissions.has('resources:read');
        if (!decision) {
          return {
            requestId: request.requestId,
            ok: false,
            error: bridgeWireError(BRIDGE_ERROR_CODES.permissionDenied, {
              details: { capabilityId: 'resource:open', permission: 'resources:read', missing: ['resources:read'] },
            }),
          };
        }
      }
      const readRequest: IResourceReadRequest = {
        uri: parsed.uri,
        session: source,
        method: 'HEAD',
        range: null,
        headers: {},
      };
      try {
        const result = await resources.read(readRequest);
        const metadata = metadataFromHeaders(parsed.uri, parsed.scope, result.headers);
        handles.acquire(session.sessionId, parsed.uri, metadata);
        return { requestId: request.requestId, ok: true, metadata };
      } catch (error) {
        return { requestId: request.requestId, ok: false, error: asWireError(error) };
      }
    },

    handleEventControl(source: ISessionSource, request: IEventControlRequest): Promise<IEventControlResponse> {
      const session = resolveSession(source);
      if (session === null) {
        return Promise.resolve({
          controlId: request.controlId,
          ok: false,
          error: bridgeWireError(BRIDGE_ERROR_CODES.sessionUnknown),
        });
      }
      if (request.action === 'subscribe') {
        events.subscribe(session.sessionId, request.eventId);
      } else {
        events.unsubscribe(session.sessionId, request.eventId);
      }
      return Promise.resolve({ controlId: request.controlId, ok: true });
    },

    handleWindowClosed(windowId: number): void {
      sessions.closeByWindow(windowId);
    },
  };

  return {
    start(_host: IPalHost, runtimeChannel: IPlatformHostChannel): Promise<void> {
      registry.registerAll(options.capabilities ?? []);
      channel = runtimeChannel;
      state = 'running';
      return Promise.resolve();
    },
    async restorePlugins(): Promise<void> {
      // 插件拓扑恢复属平台核心职责（Rust Bridge 内核交付后接管）；组合根缺位期为无操作。
      return Promise.resolve();
    },
    async handleStartupInputs(inputs: readonly IPlatformStartupInput[]): Promise<void> {
      if (inputs.length === 0) {
        return Promise.resolve();
      }
      diagnostics.warn('startup', '打开路由核心未装配，启动输入暂存未投递', { count: inputs.length });
      return Promise.resolve();
    },
    async stopPlugins(): Promise<void> {
      return Promise.resolve();
    },
    async shutdown(): Promise<void> {
      if (state === 'stopped') {
        return Promise.resolve();
      }
      state = 'stopped';
      for (const view of sessions.list()) {
        if (view.state === 'active') {
          sessions.close(view.sessionId);
        }
      }
      channel = null;
      sinks.clear();
      return Promise.resolve();
    },
    ipc,
    resources,
    forwardEvents(sink: IEventSink): () => void {
      sinks.add(sink);
      let disposed = false;
      return () => {
        if (disposed) {
          return;
        }
        disposed = true;
        sinks.delete(sink);
      };
    },
    report(): IHostRuntimeReport {
      const reserved: IHostReservedCapabilityView[] = [];
      for (const declaration of reservedDeclarations) {
        reserved.push({
          id: declaration.id,
          permissions: declaration.permissions,
          provider: declaration.provider,
          wired: registry.getRegistered(declaration.id) !== undefined,
        });
      }
      return {
        state,
        capabilities: registry.report(),
        sessions: sessions.list(),
        activeSessions: sessions.activeCount,
        inFlight: scheduler.inFlight,
        eventSubscriptions: events.size,
        resourceHandles: handles.size,
        reserved,
      };
    },
  };
}
