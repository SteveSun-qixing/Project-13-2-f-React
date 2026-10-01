/**
 * 资源打开路由服务（`14-资源打开与默认处理器契约` §四/§五 的宿主承载）。
 *
 * 权威：`14.02` §2.2（能力契约与输入约束）、`14.04` §4.1~§4.7（解析、投递、降级与失败语义）、
 * `14.05` §5.1（启动参数扩展）、§5.5（`resource:opened` 先于 `openFile` 的顺序约束）、
 * `14.06` §6.2（槽位视图）、§11 约束与不变量（OR-1~OR-12）。
 *
 * @remarks
 * - 本服务是打开路由的唯一宿主实现：深度校验（§2.2 Schema 的确定性收敛）→ 归一
 *   （`resolve-handler.ts`）→ 候选快照 → 解析 → 按角色投递（端口）→ 结果回执；
 *   未命中按 §4.6 确定性降级，禁止静默失败（OR-11）。
 * - 路由阶段不读取资源字节、不做网络探测（OR-10）；投递授权（§4.4）的登记与注销属
 *   接收方会话面（工单053 点位五在册授权链），本服务不另建授权表。
 * - `resource:opened` 顺序约束（§5.5）：仅对已 `active` 的运行中实例、在 `openFile` 之前
 *   发布；新建实例不使用该事件（初始上下文随 `ctx.args.resourceOpen` 送达）。
 * - 帧来源（`frame`）身份归 RenderHost 校验臂（渲染引擎设计 §9.2，工单 #85 落波）；
 *   能力调用面在册来源为 `in-app`，本服务以能力通道在册值构造上下文。
 */

import {
  RESOURCE_OPEN_CAPABILITY_IDS,
  RESOURCE_OPEN_ERROR_CODES,
  RESOURCE_OPEN_PAYLOAD_MAX_BYTES,
} from './contract.js';
import type { IResourceOpenContext, IResourceOpenRequest, IResourceOpenResult } from './context.js';
import { ResourceOpenError, asResourceOpenError } from './errors.js';
import type {
  IAppInstancePort,
  IHandlerCatalogPort,
  IHandlerPreferencePort,
  IDocumentScopeFormPort,
  IResourceOpenFallbackPort,
  IServiceInstancePort,
} from './ports.js';
import { buildHandlerSlots, normalizeFailureError, normalizeOpenRequest, resolveHandler } from './resolve-handler.js';
import type { INormalizedOpenRequest, IHandlerSlotsOutput } from './resolve-handler.js';

/** 能力调用上下文（与 `@chips/bridge` `ICapabilityContext` 同构；宿主路由管线组装）。 */
export interface IResourceOpenCapabilityContext {
  /** 取消信号；会话销毁、超时或运行时停机时触发。 */
  readonly signal: AbortSignal;
  /** 调用截止时间（Unix epoch 毫秒）。 */
  readonly deadline?: number;
  /** 触发调用的会话标识；用于诊断。 */
  readonly sessionId: string;
  /** 调用方标识（插件 ID 或 `platform`）；仅用于诊断，不参与授权。 */
  readonly callerId: string;
}

/** 路由服务依赖（端口全部注入；离线可测）。 */
export interface IResourceOpenServiceDeps {
  /** 处理器候选目录。 */
  readonly catalog: IHandlerCatalogPort;
  /** 默认处理器偏好。 */
  readonly preferences: IHandlerPreferencePort;
  /** 应用实例投递。 */
  readonly appInstances: IAppInstancePort;
  /** 服务实例投递。 */
  readonly serviceInstances: IServiceInstancePort;
  /** 未命中降级。 */
  readonly fallback: IResourceOpenFallbackPort;
  /** 文档作用域形态探针（§4.6 Directory/Archive 判别；缺位时文档作用域一律按不可回退处置）。 */
  readonly documentScopes?: IDocumentScopeFormPort;
}

/** 结构化克隆兼容检查（`05-事件契约规范` §3.4 平台子集：本域拒绝函数、Symbol 与 BigInt）。 */
function isCloneable(value: unknown): boolean {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return false;
  }
  if (typeof value !== 'object' || value === null) {
    return true;
  }
  for (const item of Object.values(value)) {
    if (!isCloneable(item)) {
      return false;
    }
  }
  return true;
}

/** 深度校验打开请求输入（§2.2 输入 Schema 的确定性收敛；越界一律 `BRIDGE_INVALID_INPUT`）。 */
function readOpenInput(capabilityId: string, input: unknown): IResourceOpenRequest {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
      message: '能力输入必须是对象',
      details: { capabilityId },
    });
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'intent' && key !== 'resource') {
      throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
        message: `不支持的字段：${key}`,
        details: { capabilityId, field: key },
      });
    }
  }
  const intent = record.intent;
  if (intent !== undefined && intent !== 'view' && intent !== 'edit') {
    throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
      message: 'intent 只允许 view 或 edit',
      details: { capabilityId, field: 'intent' },
    });
  }
  const resource = record.resource;
  if (typeof resource !== 'object' || resource === null || Array.isArray(resource)) {
    throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
      message: 'resource 必须是对象',
      details: { capabilityId, field: 'resource' },
    });
  }
  const resourceRecord = resource as Record<string, unknown>;
  for (const key of Object.keys(resourceRecord)) {
    if (key !== 'uri' && key !== 'mimeType' && key !== 'fileName' && key !== 'title' && key !== 'payload') {
      throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
        message: `resource 不支持的字段：${key}`,
        details: { capabilityId, field: `resource.${key}` },
      });
    }
  }
  if (typeof resourceRecord.uri !== 'string' || resourceRecord.uri.length === 0 || resourceRecord.uri.length > 2048) {
    throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
      message: 'resource.uri 必须是 1..2048 字符的字符串',
      details: { capabilityId, field: 'resource.uri' },
    });
  }
  if (
    resourceRecord.mimeType !== undefined &&
    (typeof resourceRecord.mimeType !== 'string' ||
      resourceRecord.mimeType.length > 128 ||
      !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(resourceRecord.mimeType))
  ) {
    throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
      message: 'resource.mimeType 必须是小写 type/subtype 形态',
      details: { capabilityId, field: 'resource.mimeType' },
    });
  }
  if (
    resourceRecord.fileName !== undefined &&
    (typeof resourceRecord.fileName !== 'string' ||
      resourceRecord.fileName.length < 1 ||
      resourceRecord.fileName.length > 255)
  ) {
    throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
      message: 'resource.fileName 必须是 1..255 字符的字符串',
      details: { capabilityId, field: 'resource.fileName' },
    });
  }
  if (
    resourceRecord.title !== undefined &&
    (typeof resourceRecord.title !== 'string' || resourceRecord.title.length < 1 || resourceRecord.title.length > 128)
  ) {
    throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
      message: 'resource.title 必须是 1..128 字符的字符串',
      details: { capabilityId, field: 'resource.title' },
    });
  }
  if (resourceRecord.payload !== undefined) {
    const payload = resourceRecord.payload;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
        message: 'resource.payload 必须是对象',
        details: { capabilityId, field: 'resource.payload' },
      });
    }
    if (Object.keys(payload).length > 32) {
      throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
        message: 'resource.payload 项数超过 32 上限',
        details: { capabilityId, field: 'resource.payload' },
      });
    }
    if (!isCloneable(payload)) {
      throw new ResourceOpenError('BRIDGE_INVALID_INPUT', {
        message: 'resource.payload 必须可结构化克隆',
        details: { capabilityId, field: 'resource.payload' },
      });
    }
  }
  return {
    ...(intent === undefined ? {} : { intent }),
    resource: resourceRecord as unknown as IResourceOpenRequest['resource'],
  };
}

/** 未命中降级目标（§4.6 决策树的确定性收敛）。 */
type FallbackTarget =
  | { readonly kind: 'external' }
  | { readonly kind: 'shell'; readonly path: string }
  | { readonly kind: 'missing'; readonly reason: 'unrecoverable-source' | 'system-open-unavailable' };

/** 按作用域判定未命中降级臂（§4.6 决策树；确定性，不读字节）。 */
function resolveFallbackTarget(scope: string, documentScopes: IDocumentScopeFormPort | undefined): FallbackTarget {
  if (scope === 'external') {
    return { kind: 'external' };
  }
  if (scope === 'memory') {
    // Memory 字节无底层真实路径，不可回退系统打开（§4.6）。
    return { kind: 'missing', reason: 'unrecoverable-source' };
  }
  if (scope.startsWith('card-') || scope.startsWith('box-')) {
    // 文档作用域：目录态走 shell、归档成员不可回退（§4.6）；探针缺位按不可回退处置。
    const form = documentScopes?.probe(scope);
    if (form === undefined || form === null || form.form === 'archive') {
      return { kind: 'missing', reason: 'unrecoverable-source' };
    }
    return { kind: 'shell', path: form.path };
  }
  // 工作区、插件、临时作用域属 Directory 来源（§4.6），其底层真实路径解析臂随
  // 各作用域挂载波落位（现域挂载面未建，系统打开不可用即按回退失败语义收口）。
  return { kind: 'missing', reason: 'system-open-unavailable' };
}

/** 构造上下文（§5.1；来源取能力通道在册值 `in-app`）。 */
function buildOpenContext(normalized: INormalizedOpenRequest, slot: string): IResourceOpenContext {
  return {
    intent: normalized.intent,
    origin: 'in-app',
    uri: normalized.view.uri,
    mimeType: normalized.view.mimeType,
    ...(normalized.view.extension === undefined ? {} : { extension: normalized.view.extension }),
    ...(normalized.view.fileName === undefined ? {} : { fileName: normalized.view.fileName }),
    ...(normalized.view.title === undefined ? {} : { title: normalized.view.title }),
    slot,
    ...(normalized.view.payload === undefined ? {} : { payload: normalized.view.payload }),
  };
}

/** `resolved` 视图（§4.5；展示与诊断用，不携带真实路径）。 */
function resolvedView(normalized: INormalizedOpenRequest): IResourceOpenResult['resolved'] {
  return {
    uri: normalized.view.uri,
    mimeType: normalized.view.mimeType,
    ...(normalized.view.extension === undefined ? {} : { extension: normalized.view.extension }),
    ...(normalized.view.fileName === undefined ? {} : { fileName: normalized.view.fileName }),
  };
}

/**
 * 降级臂失败 → `RESOURCE_HANDLER_MISSING`（§4.6「回退失败返回」的路由级单点）：
 * 降级端口抛出的在册 MISSING 原样透传，其余失败折叠为 MISSING 并以 `details.cause`
 * 保留在册原因码（诊断不含未脱敏路径）。
 */
function missingFromFallback(error: unknown, uri?: string): ResourceOpenError {
  const normalized = asResourceOpenError(error);
  if (normalized.code === RESOURCE_OPEN_ERROR_CODES.handlerMissing) {
    return normalized;
  }
  return new ResourceOpenError(RESOURCE_OPEN_ERROR_CODES.handlerMissing, {
    details: {
      reason: 'system-open-unavailable',
      cause: normalized.code,
      ...(uri === undefined ? {} : { uri }),
    },
  });
}

/** 打开路由服务（组合根唯一持有；禁止按调用新建）。 */
export interface IResourceOpenService {
  /** `resource:open` 处理器（§2.2/§四）。 */
  executeOpen(input: unknown, ctx: IResourceOpenCapabilityContext): Promise<IResourceOpenResult>;
  /** `resource:list-handlers` 处理器（§6.2）。 */
  executeListHandlers(ctx: IResourceOpenCapabilityContext): Promise<IHandlerSlotsOutput>;
}

/** 创建资源打开路由服务。 */
export function createResourceOpenService(deps: IResourceOpenServiceDeps): IResourceOpenService {
  return {
    async executeOpen(input, ctx): Promise<IResourceOpenResult> {
      void ctx;
      const request = readOpenInput(RESOURCE_OPEN_CAPABILITY_IDS.open, input);
      const payloadTextLength =
        request.resource.payload === undefined ? 0 : JSON.stringify(request.resource.payload).length;
      const normalized = normalizeOpenRequest(
        request.resource,
        request.intent,
        payloadTextLength,
        RESOURCE_OPEN_PAYLOAD_MAX_BYTES,
      );
      if (!normalized.ok) {
        throw normalizeFailureError(normalized.reason);
      }
      const open: INormalizedOpenRequest = normalized.request;
      const [candidates, preferences] = await Promise.all([deps.catalog.snapshot(), deps.preferences.defaults()]);
      const resolved = resolveHandler(candidates, open.view, preferences);
      if (resolved === null) {
        // 未命中降级（§4.6 确定性顺序；回退失败一律 RESOURCE_HANDLER_MISSING——归一在
        // 本服务单点收口，降级端口自身的在册 MISSING 原样透传）。
        const scope = open.view.uri.slice('chips-resource://'.length).split('/', 1)[0] ?? '';
        const target = resolveFallbackTarget(scope, deps.documentScopes);
        if (target.kind === 'external') {
          try {
            await deps.fallback.openExternal(open.view.uri);
          } catch (error) {
            throw missingFromFallback(error, open.view.uri);
          }
          return { mode: 'external', resolved: resolvedView(open) };
        }
        if (target.kind === 'shell') {
          try {
            await deps.fallback.openWithSystemDefault({ kind: 'document-root', path: target.path });
          } catch (error) {
            throw missingFromFallback(error);
          }
          return { mode: 'shell', resolved: resolvedView(open) };
        }
        throw new ResourceOpenError(RESOURCE_OPEN_ERROR_CODES.handlerMissing, {
          details: { uri: open.view.uri, reason: target.reason },
        });
      }
      const { declaration, slot } = resolved;
      const context = buildOpenContext(open, slot);
      if (declaration.role === 'service') {
        // service 角色（§4.3 表）：启用后调用 handleFile；无窗口、无 windowId。
        try {
          await deps.serviceInstances.handleFile(declaration.pluginId, open.view.uri);
        } catch (error) {
          throw asResourceOpenError(error);
        }
        return { mode: 'service', pluginId: declaration.pluginId, slot, resolved: resolvedView(open) };
      }
      const state = deps.appInstances.state(declaration.pluginId);
      if (state === 'active') {
        // 运行中实例（§5.5）：先发布 `resource:opened`、后 `openFile`；事件是通知，
        // 不承担请求-响应，订阅/处理失败不阻断投递。
        deps.appInstances.publishOpened(declaration.pluginId, context);
        try {
          await deps.appInstances.openFile(declaration.pluginId, open.view.uri);
        } catch (error) {
          throw asResourceOpenError(error);
        }
        return { mode: 'app', pluginId: declaration.pluginId, slot, resolved: resolvedView(open) };
      }
      // 新建实例（§4.3/§5.1）：按启动流程请求启用并以资源打开启动参数创建实例；
      // 启动失败按原错误码拒绝，不改投其他候选（§4.3 规则）。
      let windowId: number | null;
      try {
        const launched = await deps.appInstances.launch(declaration.pluginId, {
          source: 'file-association',
          files: [open.view.uri],
          resourceOpen: context,
        });
        windowId = launched.windowId;
      } catch (error) {
        throw asResourceOpenError(error);
      }
      return {
        mode: 'app',
        pluginId: declaration.pluginId,
        ...(windowId === null ? {} : { windowId }),
        slot,
        resolved: resolvedView(open),
      };
    },

    async executeListHandlers(ctx): Promise<IHandlerSlotsOutput> {
      void ctx;
      const [candidates, preferences] = await Promise.all([deps.catalog.snapshot(), deps.preferences.defaults()]);
      return buildHandlerSlots(candidates, preferences);
    },
  };
}
