/**
 * 全作用域资源读面（工单036 残段 T5）：`chips-resource://` 由 platform-only 扩至全部作用域。
 *
 * 权威：`06-资源协议规范` §四（权限模型：会话内读取免重复校验、作用域权限表）、
 * §5.2（两条访问路径）、§5.3（范围读取与 416）、§九（安全约束）、§9.3（大小上限）；
 * `04.11` §11.3（chips-resource 句柄正式面：`resourceOpen` / `resourceStat` /
 * `resourceRead` / `resourceReadChunk` / `resourceRelease`）；`08-权限系统设计` §7
 * （运行时权限判定与会话快照）；R19（`resources:read` 读全部作用域）。
 *
 * @remarks
 * - **两条访问路径同源**：`bridge:resource` 的 `open` / `release`（句柄面）与协议路径
 *   `read`（字节面）都落到 chips-resource 句柄正式面——句柄获取时由原生核心完成权威判定
 *   （解析、作用域归属、路径守卫、权限矩阵），本模块不复刻第二套判定。
 * - **权限链（两级）**：① 壳侧会话权限快照判定（08 §7：`resources:read` 或平台全量 `*`，
 *   Platform 作用域公开只读免判）；② 通过后为本读面的原生资源会话（`resourceOpenSession`
 *   kind `window`，owner 取 Bridge 会话插件身份）注入 `resources:read`（R19 基 ID，字面量
 *   与 `crates/chips-resource/src/permission.rs` `PERMISSION_RESOURCES_READ` 同值，裁定J
 *   「权限字面量单源」宿主读面自持位），核心再按作用域矩阵做权威判定——工作区绑定臂、
 *   插件自身臂、External 主机限定臂等未授面仍被核心如实拒绝。
 * - **字节语义**：范围读经 `resourceRead(handleId, offset, length)`；整读经
 *   `resourceReadChunk` 256 KiB 分块循环（§9.3 单次流式拉取上限）。`> 8 MiB` 资源的
 *   `read()` 逐次内联上限由 preload 句柄面（`RESOURCE_INLINE_MAX_BYTES`）守卫；协议路径
 *   的 `Range` / 流式承载按现域能力如实交付——大文件逐段读上限的契约细分（`15-文件处理契约`
 *   §五属文件转换编排域，资源协议侧无在册细分表）按 2 GiB 单资源上限与 256 KiB 分块执行，
 *   契约缺口已在开发日志登记。
 * - **platform 作用域零漂移**：平台作用域继续由 `createPlatformResourceBackend` 承载
 *   （壳页与脚本装载路径，行为逐字不变——原生核心无 platform 挂载，禁改道）。
 * - **会话级联**：Bridge 会话关闭 → 原生资源会话 `resourceCloseSession`（核心级联释放
 *   其名下全部句柄）；句柄 `release` 幂等（§11.3 行 5）。
 */

import { parseResourceUri } from '../protocol/resource-uri.js';
import type { IWireResourceMetadata } from '../protocol/wire.js';
import type { IResourceBackend, IResourceReadRequest, IResourceReadResult } from './contracts.js';
import type { IHostSession } from './capability/contracts.js';
import type {
  INativeResourceModule,
  INativeResourceMetadata,
} from '../capabilities/document/adapters/native-resource-module.js';

/** 读面原生会话注入的权限（R19 基 ID；跨语言权威 `chips-resource/src/permission.rs:23`）。 */
const RESOURCES_READ_PERMISSION = 'resources:read';

/** 平台全量权限哨兵（08 §4.4 平台会话快照）。 */
const PLATFORM_WILDCARD_PERMISSION = '*';

/** 整读分块上限（06 §9.3：单次流式拉取与单条 IPC 上限 256 KiB）。 */
const READ_CHUNK_MAX_BYTES = 256 * 1024;

/** 会话权限快照查询（宿主运行时会话登记表的只读窗口；未解析会话返回 `null`）。 */
export type SessionPermissionsOf = (source: {
  readonly windowId: number;
  readonly frameId: number | null;
}) => ReadonlySet<string> | null;

/** 全作用域资源访问端口（宿主运行时句柄控制与协议后端的共同承载）。 */
export interface IManagedResourceAccessPort {
  /**
   * 句柄打开（`bridge:resource` open）：权限链两级判定后经 `resourceOpen` 取元数据，
   * 句柄在册待 `release`。
   *
   * @throws 带 `code` 的资源错误（`RESOURCE_PERMISSION_DENIED` / `RESOURCE_NOT_FOUND` 等）。
   */
  open(session: IHostSession, uri: string): Promise<IWireResourceMetadata>;
  /** 句柄释放（`bridge:resource` release；幂等；无在册句柄即无操作）。 */
  release(sessionId: string, uri: string): void;
  /** 协议路径读（`IResourceBackend.read` 的全作用域承载；platform 委托平台后端）。 */
  read(request: IResourceReadRequest): Promise<IResourceReadResult>;
  /** Bridge 会话关闭级联：关闭该会话的原生读会话（核心级联释放句柄）。幂等。 */
  closeBridgeSession(sessionId: string): void;
  /** 在册句柄数（诊断面）。 */
  readonly handleCount: number;
}

/** 受管访问依赖。 */
export interface IManagedResourceAccessDeps {
  /** chips-resource 句柄正式面（资源域装载闸交付的类型化消费面）。 */
  readonly native: INativeResourceModule;
  /** platform 作用域后端（壳页与脚本装载路径，行为零漂移）。 */
  readonly platform: IResourceBackend;
  /** 会话权限快照查询（宿主运行时会话登记表；权限链第①级判定输入）。 */
  readonly sessionPermissionsOf: SessionPermissionsOf;
  /**
   * Bridge 会话标识词法（宿主运行时 `sessionSourceId` 单点；协议路径的读会话键与句柄
   * 控制面同键，禁在词法外再造第二会话标识来源）。
   */
  readonly bridgeSessionIdOf: (source: { readonly windowId: number; readonly frameId: number | null }) => string;
}

/** 壳侧会话权限链第①级判定（08 §7 / R19：非 platform 作用域要求 `resources:read` 或 `*`）。 */
export function hasSessionReadPermission(grantedPermissions: ReadonlySet<string> | null): boolean {
  if (grantedPermissions === null) {
    return false;
  }
  return grantedPermissions.has(PLATFORM_WILDCARD_PERMISSION) || grantedPermissions.has(RESOURCES_READ_PERMISSION);
}

/** 与壳侧 `IWireResourceMetadata` 同构的元数据投影（原生核心返回形状单点转换）。 */
function wireMetadataOf(metadata: INativeResourceMetadata): IWireResourceMetadata {
  return {
    uri: metadata.uri,
    size: metadata.size,
    mimeType: metadata.mimeType,
    version: metadata.version,
    scope: metadata.scope,
  };
}

/** 原生资源会话簿记：Bridge 会话 → 原生会话 + 句柄账。 */
interface ISessionRecord {
  readonly nativeSession: number;
  readonly handles: Map<string, number>;
}

/** 构造全作用域资源访问端口。 */
export function createManagedResourceAccess(deps: IManagedResourceAccessDeps): IManagedResourceAccessPort {
  const sessions = new Map<string, ISessionRecord>();

  /** 取（或懒建）Bridge 会话的原生读会话；权限链第①级判定已由调用方完成。 */
  function nativeSessionFor(sessionId: string, owner: string): number {
    const existing = sessions.get(sessionId);
    if (existing !== undefined) {
      return existing.nativeSession;
    }
    const nativeSession = deps.native.resourceOpenSession('window', owner);
    deps.native.resourceGrantSession(nativeSession, [RESOURCES_READ_PERMISSION]);
    sessions.set(sessionId, { nativeSession, handles: new Map() });
    return nativeSession;
  }

  const access: IManagedResourceAccessPort = {
    async open(session, uri) {
      const parsed = parseResourceUri(uri);
      if (!parsed.ok) {
        throw Object.assign(new Error('资源地址无效'), { code: parsed.code, retryable: false });
      }
      if (parsed.scope === 'platform') {
        // 平台作用域：核心无挂载，元数据经平台后端 HEAD 读取得出（行为与旧链路一致；
        // 平台后端按文件直读臂实现，不消费来源会话，载体窗口缺位时以哨兵来源承载）。
        const result = await deps.platform.read({
          uri: parsed.uri,
          session: { windowId: session.windowId ?? 0, frameId: session.frameId },
          method: 'HEAD',
          range: null,
          headers: {},
        });
        const rawType = result.headers['Content-Type'];
        const rawLength = result.headers['Content-Length'];
        return {
          uri: parsed.uri,
          size: rawLength === undefined ? 0 : Number.parseInt(rawLength, 10) || 0,
          mimeType:
            rawType === undefined ? 'application/octet-stream' : (rawType.split(';')[0] ?? 'application/octet-stream'),
          version: '0',
          scope: 'platform',
        };
      }
      // 权限链第①级：壳侧会话快照（08 §7；R19 `resource:read` 目标作用域按限定值匹配的
      // 快照判定——宿主读面统一要求基础 `resources:read`）。
      if (!hasSessionReadPermission(session.grantedPermissions)) {
        throw Object.assign(new Error('插件缺少资源读取权限'), {
          code: 'RESOURCE_PERMISSION_DENIED',
          retryable: false,
          details: { permission: RESOURCES_READ_PERMISSION, missing: [RESOURCES_READ_PERMISSION] },
        });
      }
      // 权威判定与句柄获取在核心一次完成（06 §4.1 会话内读取免重复校验）。
      const nativeSession = nativeSessionFor(session.sessionId, session.pluginId);
      const opened = await deps.native.resourceOpen(parsed.uri, nativeSession);
      const record = sessions.get(session.sessionId);
      record?.handles.set(parsed.uri, opened.handleId);
      return wireMetadataOf(opened.metadata);
    },

    release(sessionId: string, uri: string): void {
      const record = sessions.get(sessionId);
      if (record === undefined) {
        return;
      }
      const handleId = record.handles.get(uri);
      if (handleId === undefined) {
        return;
      }
      record.handles.delete(uri);
      // §11.3 行 5：幂等；归属会话账由绑定层单点清账。
      deps.native.resourceRelease(handleId);
    },

    async read(request) {
      const parsed = parseResourceUri(request.uri);
      if (!parsed.ok) {
        throw Object.assign(new Error('资源地址无效'), { code: parsed.code, retryable: false });
      }
      if (parsed.scope === 'platform') {
        return deps.platform.read(request);
      }
      // 权限链第①级（协议路径按来源帧解析会话，06 §4.1；无法解析即拒绝）。
      const granted = request.session === null ? null : deps.sessionPermissionsOf(request.session);
      if (!hasSessionReadPermission(granted)) {
        throw Object.assign(new Error('插件缺少资源读取权限'), {
          code: 'RESOURCE_PERMISSION_DENIED',
          retryable: false,
          details: { permission: RESOURCES_READ_PERMISSION, missing: [RESOURCES_READ_PERMISSION] },
        });
      }
      const bridgeSessionId = request.session === null ? '' : deps.bridgeSessionIdOf(request.session);
      // 读面原生会话身份：宿主读面统一以宿主身份持有（插件自身作用域的免判自读随内核
      // 权限快照集成翻正，开发日志登记）。
      const nativeSession = nativeSessionFor(bridgeSessionId, 'chips.official.host');
      // 权威判定与句柄获取在核心一次完成；字节读取后即刻释放（协议读为无状态逐请求臂）。
      const opened = await deps.native.resourceOpen(parsed.uri, nativeSession);
      try {
        const headers: Record<string, string> = {
          'Content-Type': opened.metadata.mimeType,
          'Accept-Ranges': 'bytes',
        };
        if (request.range !== null) {
          const size = opened.metadata.size;
          const start = request.range.start;
          const end = request.range.end === null ? size - 1 : Math.min(request.range.end, size - 1);
          if (size === 0 || start < 0 || start >= size || start > end) {
            return {
              status: 416,
              headers: { ...headers, 'Content-Range': `bytes */${String(size)}` },
              body: null,
            };
          }
          const body = await deps.native.resourceRead(opened.handleId, start, end - start + 1);
          headers['Content-Range'] = `bytes ${String(start)}-${String(end)}/${String(size)}`;
          headers['Content-Length'] = String(body.byteLength);
          return { status: 206, headers, body: request.method === 'HEAD' ? null : body };
        }
        headers['Content-Length'] = String(opened.metadata.size);
        if (request.method === 'HEAD') {
          return { status: 200, headers, body: null };
        }
        // 整读：256 KiB 分块循环（§9.3），2 GiB 单资源上限由核心守卫。
        const chunks: Uint8Array[] = [];
        for (;;) {
          const chunk = await deps.native.resourceReadChunk(opened.handleId, READ_CHUNK_MAX_BYTES);
          if (chunk === null) {
            break;
          }
          chunks.push(chunk);
        }
        const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const body = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return { status: 200, headers, body };
      } finally {
        deps.native.resourceRelease(opened.handleId);
      }
    },

    closeBridgeSession(sessionId: string): void {
      const record = sessions.get(sessionId);
      if (record === undefined) {
        return;
      }
      sessions.delete(sessionId);
      // 核心级联释放该会话名下全部句柄与派生（§11.3 行 14）。
      deps.native.resourceCloseSession(record.nativeSession);
    },

    get handleCount(): number {
      let total = 0;
      for (const record of sessions.values()) {
        total += record.handles.size;
      }
      return total;
    },
  };
  return access;
}

/**
 * 全作用域资源后端（`IResourceBackend` 组合视图）：platform 委托平台后端、其余作用域经
 * 受管访问面（句柄正式面）。宿主运行时以本构造替换 platform-only 缺省后端（T5）。
 */
export function createManagedResourceBackend(deps: {
  readonly platform: IResourceBackend;
  readonly access: IManagedResourceAccessPort;
}): IResourceBackend {
  return {
    read(request: IResourceReadRequest): Promise<IResourceReadResult> {
      return deps.access.read(request);
    },
  };
}
