/**
 * 资源打开路由的生产投递与降级适配器。
 *
 * 权威：`14-资源打开与默认处理器契约` §4.3（按角色投递表）、§4.6（未命中降级）、
 * §5.5（`resource:opened` 定向投递）、§10（`APP_OPEN_FILE_UNSUPPORTED` 等错误归属）、
 * `07-应用插件接口` §6.2（`openFile` 投递语义）、`10-服务插件接口` §7.5（`handleFile`）。
 *
 * @remarks
 * - 实例投递经装载器与激活通道的正式面：启用走 `loader.enable`（T2 启动流程，失败按
 *   `KERNEL_*` 原码透传）；运行中实例投递调激活通道保管的角色入口方法（`openFile` /
 *   `handleFile`，无上下文形参，不经应用实例上下文构造臂）。
 * - **`launch` 调用臂的在册缺位（工单066 / 判定表 T6）**：新建实例的 `launch(ctx)` 需要
 *   应用实例上下文（`IAppContext`：window / bridge / lifecycle 面），该构造臂属应用窗口
 *   运行时。装配前按 §4.3「处理器启动失败」语义以在册码 `APP_LAUNCH_FAILED` 如实拒绝
 *   （`details.reason: 'app-instance-context-unwired'`），不改投其他候选；T6 落波在本
 *   适配器的 launch 臂原位补齐，消费方与描述符零改动。
 * - `resource:opened` 发布走宿主事件总线（组合根注入的 `emitEvent` 出口，与 `plugin:*`
 *   生命周期事件同一投递面）；按实例窗口的定向投递随 T6 实例窗口登记面收口。
 * - 降级臂（§4.6）：`external` 经 PAL `shellOpen.openExternal`（`webdav://` 等非放行
 *   scheme 被端口拒绝即按回退失败收口）；`shell`（目录态文档根）经 `openPath`；
 *   全部失败一律 `RESOURCE_HANDLER_MISSING`（§4.6 回退失败语义）。
 */

import { parseResourceUri } from '../../../protocol/resource-uri.js';
import type { IPluginRecord, PluginRole } from '../../../loader/types.js';
import type { IPalShellOpenPort } from '../../../platform/contracts/index.js';
import type { DiagnosticsSink } from '../../../shared/diagnostics.js';
import type { DocumentScopeLedger } from '../../document/adapters/scope-ledger.js';
import { RESOURCE_OPEN_EVENT_IDS } from '../contract.js';
import type { IResourceOpenContext, IResourceOpenLaunchArgs } from '../context.js';
import { ResourceOpenError, asResourceOpenError } from '../errors.js';
import type {
  IAppInstancePort,
  IDocumentScopeFormPort,
  IResourceOpenFallbackPort,
  IServiceInstancePort,
} from '../ports.js';

/** 已激活角色入口的最小结构视图（`IPluginActivatedEntry.entry` 的消费切片）。 */
export type ActivatedEntryView = {
  readonly role: PluginRole;
  readonly entry: Readonly<Record<string, unknown>>;
};

/** 装载与激活面的最小消费视图（组合根接宿主运行时装载器与激活通道的同一实例）。 */
export interface ILoaderInstanceView {
  /** 按 ID 查记录（`ICpkPluginLoader.get` 同签名）。 */
  get(id: string): IPluginRecord | undefined;
  /** 启用（`ICpkPluginLoader.enable` 同签名；T2 启动流程）。 */
  enable(id: string): Promise<IPluginRecord>;
  /** 已激活入口保管投影（激活通道 `activatedEntry` 同签名）。 */
  activatedEntryOf(pluginId: string): ActivatedEntryView | undefined;
}

/** 插件入口方法错误 → 路由域错误（§4.7：在册码原样保留；未携码异常归一 `APP_OPEN_FILE_FAILED`）。 */
function entryMethodError(error: unknown): ResourceOpenError {
  const normalized = asResourceOpenError(error);
  if (normalized.code !== 'BRIDGE_INTERNAL') {
    return normalized;
  }
  return new ResourceOpenError('APP_OPEN_FILE_FAILED', {
    message: '处理器接收打开投递失败',
    details: { reason: error instanceof Error ? error.message : typeof error },
  });
}

/** 取角色入口上的可选方法（非函数即未实现）。 */
function entryMethod(
  entry: Readonly<Record<string, unknown>> | undefined,
  name: string,
): { readonly target: Readonly<Record<string, unknown>>; readonly method: (uri: string) => Promise<void> } | undefined {
  const method = entry?.[name];
  if (entry === undefined || typeof method !== 'function') {
    return undefined;
  }
  return { target: entry, method: method as (uri: string) => Promise<void> };
}

/**
 * 构造应用实例投递的生产适配器（§4.3 表 `app` 行）。
 *
 * @param deps 装载与激活视图 + 宿主事件出口 + 诊断口。
 */
export function createLoaderAppInstancePort(deps: {
  readonly loader: ILoaderInstanceView;
  readonly publishEvent: (eventId: string, payload: unknown) => void;
  readonly diagnostics?: DiagnosticsSink;
}): IAppInstancePort {
  return {
    state(pluginId) {
      return deps.loader.get(pluginId)?.state === 'active' ? 'active' : 'absent';
    },

    async launch(pluginId: string, args: IResourceOpenLaunchArgs): Promise<{ readonly windowId: number | null }> {
      void args;
      // T2 启动流程（§4.3「按启动流程请求启用」；失败按 `KERNEL_*` 原码透传，不改投候选）。
      await deps.loader.enable(pluginId);
      // launch 调用臂需要应用实例上下文（IAppContext），构造臂归应用窗口运行时
      // （工单066 / 判定表 T6）：按 §4.3「处理器启动失败」语义如实拒绝，禁假接线。
      deps.diagnostics?.warn('resource-open', '应用实例上下文构造臂未装配，打开投递按处理器启动失败收口', {
        pluginId,
        reason: 'app-instance-context-unwired',
      });
      throw new ResourceOpenError('APP_LAUNCH_FAILED', {
        details: { pluginId, reason: 'app-instance-context-unwired' },
        retryable: true,
      });
    },

    async openFile(pluginId: string, uri: string): Promise<void> {
      const activated = deps.loader.activatedEntryOf(pluginId);
      const openFile = entryMethod(activated?.entry, 'openFile');
      if (openFile === undefined || activated?.role !== 'app') {
        // §10：命中实例未实现 `openFile`。
        throw new ResourceOpenError('APP_OPEN_FILE_UNSUPPORTED', { details: { pluginId } });
      }
      try {
        await openFile.method.call(openFile.target, uri);
      } catch (error) {
        throw entryMethodError(error);
      }
    },

    publishOpened(pluginId: string, context: IResourceOpenContext): void {
      // §5.5 信封：payload = { pluginId, context }；事件是通知，不承担请求-响应。
      deps.publishEvent(RESOURCE_OPEN_EVENT_IDS.opened, { pluginId, context });
    },
  };
}

/** 构造服务实例投递的生产适配器（§4.3 表 `service` 行）。 */
export function createLoaderServiceInstancePort(deps: { readonly loader: ILoaderInstanceView }): IServiceInstancePort {
  return {
    async handleFile(pluginId: string, uri: string): Promise<void> {
      const record = deps.loader.get(pluginId);
      if (record === undefined) {
        throw new ResourceOpenError('KERNEL_PLUGIN_NOT_FOUND', { details: { pluginId } });
      }
      if (record.state !== 'active') {
        // §4.3：服务未启用时按文件关联路由请求启用后投递（失败按原码透传）。
        await deps.loader.enable(pluginId);
      }
      const activated = deps.loader.activatedEntryOf(pluginId);
      const handleFile = entryMethod(activated?.entry, 'handleFile');
      if (handleFile === undefined || activated?.role !== 'service') {
        throw new ResourceOpenError('APP_OPEN_FILE_UNSUPPORTED', { details: { pluginId } });
      }
      try {
        await handleFile.method.call(handleFile.target, uri);
      } catch (error) {
        throw entryMethodError(error);
      }
    },
  };
}

/** 从 External 受管引用重建系统打开 URL（§4.6 `mode: 'external'`）。 */
export function externalUrlOf(managedUri: string): string | null {
  const parsed = parseResourceUri(managedUri);
  if (!parsed.ok || parsed.origin === null) {
    return null;
  }
  const port = parsed.origin.port === null ? '' : `:${String(parsed.origin.port)}`;
  const path = parsed.path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${parsed.origin.scheme}://${parsed.origin.host}${port}/${path}${parsed.query === null ? '' : `?${parsed.query}`}`;
}

/** 构造未命中降级的生产适配器（§4.6；全部失败归一 `RESOURCE_HANDLER_MISSING`）。 */
export function createPalResourceOpenFallback(deps: {
  readonly shellOpen: IPalShellOpenPort | undefined;
  readonly diagnostics?: DiagnosticsSink;
}): IResourceOpenFallbackPort {
  const missing = (cause: string, details?: { readonly uri?: string }): ResourceOpenError =>
    new ResourceOpenError('RESOURCE_HANDLER_MISSING', {
      details: { reason: 'system-open-unavailable', cause, ...(details === undefined ? {} : details) },
    });
  return {
    async openExternal(managedUri: string): Promise<void> {
      const url = externalUrlOf(managedUri);
      if (deps.shellOpen === undefined || url === null) {
        throw missing(deps.shellOpen === undefined ? 'shell-port-unavailable' : 'external-url-unresolvable', {
          uri: managedUri,
        });
      }
      try {
        await deps.shellOpen.openExternal(url);
      } catch (error) {
        const cause =
          typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'unknown';
        throw missing(cause, { uri: managedUri });
      }
    },

    async openWithSystemDefault(target: { readonly kind: 'document-root'; readonly path: string }): Promise<void> {
      if (deps.shellOpen === undefined) {
        throw missing('shell-port-unavailable');
      }
      try {
        await deps.shellOpen.openPath(target.path);
      } catch (error) {
        const cause =
          typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'unknown';
        deps.diagnostics?.warn('resource-open', '目录来源系统打开失败，按回退失败语义收口', { cause });
        throw missing(cause);
      }
    },
  };
}

/** 构造文档作用域形态探针（§4.6 Directory/Archive 判别；在册账单点只读）。 */
export function createLedgerDocumentScopeForm(ledger: DocumentScopeLedger): IDocumentScopeFormPort {
  return {
    probe(scope: string): { readonly form: 'directory'; readonly path: string } | { readonly form: 'archive' } | null {
      const entry = ledger.findByScope(scope);
      if (entry === undefined) {
        return null;
      }
      return entry.form === 'directory' ? { form: 'directory', path: entry.canonicalPath } : { form: 'archive' };
    },
  };
}
