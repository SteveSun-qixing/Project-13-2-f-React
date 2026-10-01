/**
 * 资源打开路由服务经真实运行时路由的全链锁单测（14-资源打开与默认处理器契约 §2.2、
 * §4.3、§4.5、§4.6、§4.7、§5.5、§6.2；08-权限系统设计 §7）。
 *
 * @remarks
 * - 消费方零改动的验收形制（同 G6 第一批 photo-viewer dialog 验证）：以真实运行时
 *   （`createHostRuntime` + 会话供给替身）走完整路由管线（注册表命中 → 权限判定 →
 *   Schema 准入 → 执行 → 错误归一），既有调用形状 `chips.request('resource:open',
 *   IResourceOpenRequest)` 原样穿透真实路由放行。
 * - 端口全部注入替身（离线可测；`resource:opened` 信封与顺序锁在投递替身上断言）。
 */

import { describe, expect, it } from 'vitest';

import { createResourceOpenService } from '../src/capabilities/resource-open/service.js';
import { createResourceOpenCapabilityDescriptors } from '../src/capabilities/resource-open/descriptors.js';
import type { IResourceOpenCapabilityContext } from '../src/capabilities/resource-open/service.js';
import type {
  IResourceOpenContext,
  IResourceOpenLaunchArgs,
  IResourceOpenedPayload,
} from '../src/capabilities/resource-open/context.js';
import type { IResourceOpenResult } from '../src/capabilities/resource-open/context.js';
import type { IHandlerDeclaration } from '../src/capabilities/resource-open/resolve-handler.js';
import type { IResourceOpenFallbackPort, IServiceInstancePort } from '../src/capabilities/resource-open/ports.js';
import type { IBridgeResponse } from '../src/protocol/wire.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { IHostSessionGrant, IHostSessionProvisioner } from '../src/runtime/capability/session.js';
import { createHostRuntime } from '../src/runtime/host-runtime.js';
import type { IPlatformHostChannel } from '../src/runtime/contracts.js';
import type { IPalHost } from '../src/platform/contracts/index.js';
import { createFakePalHost } from './helpers/fake-pal-host.js';

/** 应用实例投递替身（记录事件与投递顺序，可编程失败）。 */
function createAppInstanceFake(input: {
  readonly state?: 'absent' | 'active';
  readonly launchError?: Error;
  readonly openFileError?: Error;
  readonly openFileMissing?: boolean;
}): {
  state(pluginId: string): 'absent' | 'active';
  launch(pluginId: string, args: IResourceOpenLaunchArgs): Promise<{ readonly windowId: number | null }>;
  openFile(pluginId: string, uri: string): Promise<void>;
  publishOpened(pluginId: string, context: IResourceOpenContext): void;
  readonly calls: { readonly op: string; readonly pluginId: string; readonly detail?: unknown }[];
} {
  const calls: { op: string; pluginId: string; detail?: unknown }[] = [];
  return {
    calls,
    state: () => input.state ?? 'absent',
    launch(pluginId, args) {
      calls.push({ op: 'launch', pluginId, detail: args });
      if (input.launchError !== undefined) {
        return Promise.reject(input.launchError);
      }
      return Promise.resolve({ windowId: 42 });
    },
    openFile(pluginId, uri) {
      calls.push({ op: 'openFile', pluginId, detail: uri });
      if (input.openFileMissing === true) {
        throw Object.assign(new Error('未实现 openFile'), { code: 'APP_OPEN_FILE_UNSUPPORTED', retryable: false });
      }
      if (input.openFileError !== undefined) {
        return Promise.reject(input.openFileError);
      }
      return Promise.resolve(undefined);
    },
    publishOpened(pluginId, context) {
      calls.push({ op: 'publishOpened', pluginId, detail: context });
    },
  };
}

/** 服务实例投递替身。 */
function createServiceInstanceFake(input: { readonly handleFileError?: Error } = {}): IServiceInstancePort & {
  readonly calls: { readonly pluginId: string; readonly uri: string }[];
} {
  const calls: { pluginId: string; uri: string }[] = [];
  return {
    calls,
    handleFile(pluginId, uri) {
      calls.push({ pluginId, uri });
      if (input.handleFileError !== undefined) {
        return Promise.reject(input.handleFileError);
      }
      return Promise.resolve(undefined);
    },
  };
}

/** 降级替身（记录 external / shell 调用，可编程失败）。 */
function createFallbackFake(
  input: { readonly openExternalError?: Error; readonly openPathError?: Error } = {},
): IResourceOpenFallbackPort & {
  readonly calls: { readonly op: string; readonly detail: unknown }[];
} {
  const calls: { op: string; detail: unknown }[] = [];
  return {
    calls,
    openExternal(uri) {
      calls.push({ op: 'openExternal', detail: uri });
      if (input.openExternalError !== undefined) {
        return Promise.reject(input.openExternalError);
      }
      return Promise.resolve(undefined);
    },
    openWithSystemDefault(target) {
      calls.push({ op: 'openWithSystemDefault', detail: target });
      if (input.openPathError !== undefined) {
        return Promise.reject(input.openPathError);
      }
      return Promise.resolve(undefined);
    },
  };
}

/** 组装真实运行时 + 路由服务描述符（端口注入，离线全链）。 */
async function startRoute(input: {
  readonly catalog?: readonly IHandlerDeclaration[];
  readonly preferences?: Readonly<Record<string, string>>;
  readonly documentProbe?: (
    scope: string,
  ) => { readonly form: 'directory'; readonly path: string } | { readonly form: 'archive' } | null;
  readonly grantedPermissions?: readonly string[];
  readonly appInstances?: ReturnType<typeof createAppInstanceFake>;
  readonly serviceInstances?: IServiceInstancePort;
  readonly fallback?: IResourceOpenFallbackPort;
}): Promise<{
  route: (capabilityId: string, reqInput: unknown, requestId?: string) => Promise<IBridgeResponse>;
  appInstances: ReturnType<typeof createAppInstanceFake>;
  serviceInstances: IServiceInstancePort;
  fallback: IResourceOpenFallbackPort;
  runtime: ReturnType<typeof createHostRuntime>;
  shutdown: () => Promise<void>;
}> {
  const appInstances = input.appInstances ?? createAppInstanceFake({});
  const serviceInstances = input.serviceInstances ?? createServiceInstanceFake({});
  const fallback = input.fallback ?? createFallbackFake({});
  const service = createResourceOpenService({
    catalog: { snapshot: () => Promise.resolve(input.catalog ?? []) },
    preferences: { defaults: () => Promise.resolve(input.preferences ?? {}) },
    appInstances,
    serviceInstances,
    fallback,
    ...(input.documentProbe === undefined ? {} : { documentScopes: { probe: input.documentProbe } }),
  });
  const descriptors: readonly IHostCapabilityDescriptor[] = createResourceOpenCapabilityDescriptors(service);
  const grant: IHostSessionGrant = {
    pluginId: 'test.caller',
    grantedPermissions: input.grantedPermissions ?? ['*'],
  };
  const provisioner: IHostSessionProvisioner = { provision: () => grant };
  const channel: IPlatformHostChannel = { pushSessionPermissions: () => undefined };
  const runtime = createHostRuntime({ capabilities: descriptors, sessionProvisioner: provisioner });
  const host: IPalHost = createFakePalHost();
  await runtime.start(host, channel);
  return {
    appInstances,
    serviceInstances,
    fallback,
    runtime,
    route: (capabilityId, reqInput, requestId = 'route-1') =>
      runtime.ipc.handleRequest(
        { windowId: 7, frameId: null },
        { requestId, capabilityId, ...(reqInput === undefined ? {} : { input: reqInput }) },
      ),
    shutdown: () => runtime.shutdown(),
  };
}

const PNG_URI = 'chips-resource://card-abc/images/photo.png';

describe('resource:open 经真实路由放行（消费方调用形状零改动）', () => {
  it('photo-viewer 既有调用形状（intent + resource.uri/mimeType/fileName）穿透路由命中 app', async () => {
    const env = await startRoute({
      catalog: [
        {
          pluginId: 'chips.official.photo-viewer',
          name: '图片查看器',
          role: 'app',
          tier: 'primary',
          extensions: ['.png'],
          mimeTypes: ['image/png'],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    try {
      // 既有真调形状（plugins/apps/photo-viewer/src/ui/usePhotoSession.ts requestOpenResource）。
      const response = await env.route('resource:open', {
        intent: 'view',
        resource: { uri: PNG_URI, mimeType: 'image/png', fileName: 'photo.png' },
      });
      expect(response.ok).toBe(true);
      const result = (response as { ok: true; result: IResourceOpenResult }).result;
      expect(result.mode).toBe('app');
      expect(result.pluginId).toBe('chips.official.photo-viewer');
      expect(result.slot).toBe('mime:image/png');
      expect(result.windowId).toBe(42);
      expect(result.resolved).toEqual({
        uri: PNG_URI,
        mimeType: 'image/png',
        extension: '.png',
        fileName: 'photo.png',
      });
      // 新建实例：launch 携带 §5.1 启动参数；新建实例不发布 resource:opened（§5.5）。
      expect(env.appInstances.calls).toEqual([
        {
          op: 'launch',
          pluginId: 'chips.official.photo-viewer',
          detail: {
            source: 'file-association',
            files: [PNG_URI],
            resourceOpen: {
              intent: 'view',
              origin: 'in-app',
              uri: PNG_URI,
              mimeType: 'image/png',
              extension: '.png',
              fileName: 'photo.png',
              slot: 'mime:image/png',
            },
          },
        },
      ]);
    } finally {
      await env.shutdown();
    }
  });

  it('运行中实例：resource:opened 先于 openFile（§5.5 顺序锁）；事件信封 payload = { pluginId, context }', async () => {
    const appInstances = createAppInstanceFake({ state: 'active' });
    const env = await startRoute({
      catalog: [
        {
          // uvf 兜底声明的 7z 归档槽位：扩展名 canonical 在册、MIME 面候勘（14.03 §3.5），
          // 请求 MIME 落 octet-stream 跳过 M1/M2，按 E1 扩展名槽位命中（§4.1 规则）。
          pluginId: 'chips.official.uvf',
          name: '万能文件查看器',
          role: 'app',
          tier: 'fallback',
          extensions: ['.7z'],
          mimeTypes: [],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      appInstances,
    });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: 'chips-resource://card-abc/notes/archive.7z', fileName: 'archive.7z' },
      });
      expect(response.ok).toBe(true);
      const result = (response as { ok: true; result: IResourceOpenResult }).result;
      expect(result.mode).toBe('app');
      expect(result.slot).toBe('ext:.7z');
      const ops = appInstances.calls.map((call) => call.op);
      expect(ops).toEqual(['publishOpened', 'openFile']);
      const opened = appInstances.calls[0]?.detail as IResourceOpenContext;
      expect(opened).toEqual({
        intent: 'view',
        origin: 'in-app',
        uri: 'chips-resource://card-abc/notes/archive.7z',
        mimeType: 'application/octet-stream',
        extension: '.7z',
        fileName: 'archive.7z',
        slot: 'ext:.7z',
      });
      // 信封形态（05 §4.4 / 14 §5.5）：payload = { pluginId, context } 双成员。
      const payload: IResourceOpenedPayload = { pluginId: 'chips.official.uvf', context: opened };
      expect(payload.pluginId).toBe('chips.official.uvf');
      expect(payload.context.uri).toBe('chips-resource://card-abc/notes/archive.7z');
      expect(payload.context.slot).toBe('ext:.7z');
    } finally {
      await env.shutdown();
    }
  });

  it('service 角色命中：handleFile 投递、结果无 windowId', async () => {
    const serviceInstances = createServiceInstanceFake();
    const env = await startRoute({
      catalog: [
        {
          pluginId: 'chips.service.convert',
          name: '格式转换',
          role: 'service',
          tier: 'primary',
          extensions: ['.xyz'],
          mimeTypes: [],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      serviceInstances,
    });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: 'chips-resource://card-abc/file.xyz' },
      });
      expect(response.ok).toBe(true);
      const result = (response as { ok: true; result: IResourceOpenResult }).result;
      expect(result.mode).toBe('service');
      expect(result.pluginId).toBe('chips.service.convert');
      expect(result.windowId).toBeUndefined();
      expect(serviceInstances.calls).toEqual([
        { pluginId: 'chips.service.convert', uri: 'chips-resource://card-abc/file.xyz' },
      ]);
    } finally {
      await env.shutdown();
    }
  });

  it('launch 失败按原错误码拒绝且不改投其他候选（§4.3/§4.7）', async () => {
    const appInstances = createAppInstanceFake({
      launchError: Object.assign(new Error('内核依赖缺失'), {
        code: 'KERNEL_DEPENDENCY_MISSING',
        retryable: false,
      }),
    });
    const env = await startRoute({
      catalog: [
        {
          pluginId: 'app.primary',
          name: '专用',
          role: 'app',
          tier: 'primary',
          extensions: ['.bin'],
          mimeTypes: [],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          pluginId: 'app.backup',
          name: '兜底',
          role: 'app',
          tier: 'fallback',
          extensions: ['.bin'],
          mimeTypes: [],
          installedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      appInstances,
    });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: 'chips-resource://card-abc/blob.bin', fileName: 'blob.bin' },
      });
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.code).toBe('KERNEL_DEPENDENCY_MISSING');
      }
      // 只投递了一次（选定处理器），未改投 fallback 候选。
      expect(appInstances.calls.map((call) => call.op)).toEqual(['launch']);
    } finally {
      await env.shutdown();
    }
  });

  it('运行中实例未实现 openFile → APP_OPEN_FILE_UNSUPPORTED（§10）', async () => {
    const appInstances = createAppInstanceFake({ state: 'active', openFileMissing: true });
    const env = await startRoute({
      catalog: [
        {
          pluginId: 'app.viewer',
          name: '查看器',
          role: 'app',
          tier: 'primary',
          extensions: ['.txt'],
          mimeTypes: [],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      appInstances,
    });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: 'chips-resource://card-abc/a.txt', fileName: 'a.txt' },
      });
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.code).toBe('APP_OPEN_FILE_UNSUPPORTED');
      }
      // §5.5：事件先到；投递失败不回滚通知。
      expect(appInstances.calls.map((call) => call.op)).toEqual(['publishOpened', 'openFile']);
    } finally {
      await env.shutdown();
    }
  });
});

describe('未命中降级（14 §4.6 确定性顺序）', () => {
  it('External 作用域 → mode external，交系统浏览器打开', async () => {
    const fallback = createFallbackFake();
    const env = await startRoute({ fallback });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: 'chips-resource://external/https/example.com/docs' },
      });
      expect(response.ok).toBe(true);
      const result = (response as { ok: true; result: IResourceOpenResult }).result;
      expect(result.mode).toBe('external');
      expect(result.slot).toBeUndefined();
      expect(fallback.calls).toEqual([
        { op: 'openExternal', detail: 'chips-resource://external/https/example.com/docs' },
      ]);
    } finally {
      await env.shutdown();
    }
  });

  it('目录态文档作用域 → mode shell，交系统默认程序打开包根', async () => {
    const fallback = createFallbackFake();
    const env = await startRoute({
      fallback,
      documentProbe: (scope) => (scope === 'card-abc' ? { form: 'directory', path: '/docs/card-abc' } : null),
    });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: 'chips-resource://card-abc/' },
      });
      expect(response.ok).toBe(true);
      const result = (response as { ok: true; result: IResourceOpenResult }).result;
      expect(result.mode).toBe('shell');
      expect(fallback.calls).toEqual([
        { op: 'openWithSystemDefault', detail: { kind: 'document-root', path: '/docs/card-abc' } },
      ]);
    } finally {
      await env.shutdown();
    }
  });

  it('归档成员与 Memory 字节不可回退 → RESOURCE_HANDLER_MISSING（§4.6）', async () => {
    const fallback = createFallbackFake();
    const env = await startRoute({ fallback, documentProbe: () => ({ form: 'archive' }) });
    try {
      const archive = await env.route(
        'resource:open',
        {
          resource: { uri: 'chips-resource://card-abc/cover.png' },
        },
        'miss-archive',
      );
      expect(archive.ok).toBe(false);
      if (!archive.ok) {
        expect(archive.error.code).toBe('RESOURCE_HANDLER_MISSING');
        expect(archive.error.retryable).toBe(false);
      }
      const memory = await env.route(
        'resource:open',
        {
          resource: { uri: 'chips-resource://memory/blob' },
        },
        'miss-memory',
      );
      expect(memory.ok).toBe(false);
      if (!memory.ok) {
        expect(memory.error.code).toBe('RESOURCE_HANDLER_MISSING');
      }
      expect(fallback.calls).toEqual([]);
    } finally {
      await env.shutdown();
    }
  });

  it('系统打开失败 → RESOURCE_HANDLER_MISSING（回退失败语义）', async () => {
    const fallback = createFallbackFake({
      openExternalError: Object.assign(new Error('scheme 不允许'), {
        code: 'SHELL_SCHEME_DENIED',
        retryable: false,
      }),
    });
    const env = await startRoute({ fallback });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: 'chips-resource://external/webdav/host/path' },
      });
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.code).toBe('RESOURCE_HANDLER_MISSING');
        expect(response.error.details).toMatchObject({
          reason: 'system-open-unavailable',
          cause: 'SHELL_SCHEME_DENIED',
        });
      }
    } finally {
      await env.shutdown();
    }
  });
});

describe('授权拒绝路径（08 §7 / R19）', () => {
  it('无 resources:read 会话 → BRIDGE_PERMISSION_DENIED（能力面权限链）', async () => {
    const env = await startRoute({
      grantedPermissions: [],
      catalog: [
        {
          pluginId: 'app.photo',
          name: '图片查看器',
          role: 'app',
          tier: 'primary',
          extensions: ['.png'],
          mimeTypes: [],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    try {
      const response = await env.route('resource:open', {
        intent: 'view',
        resource: { uri: PNG_URI },
      });
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
        expect(response.error.details).toMatchObject({ capabilityId: 'resource:open', permission: 'resources:read' });
      }
    } finally {
      await env.shutdown();
    }
  });

  it('resources:read 在册会话放行（限定值目标 resource.uri 在注册面声明）', async () => {
    const env = await startRoute({
      grantedPermissions: ['resources:read'],
      catalog: [
        {
          pluginId: 'app.photo',
          name: '图片查看器',
          role: 'app',
          tier: 'primary',
          extensions: ['.png'],
          mimeTypes: ['image/png'],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: PNG_URI, mimeType: 'image/png' },
      });
      expect(response.ok).toBe(true);
    } finally {
      await env.shutdown();
    }
  });

  it('非 chips-resource URI / payload 超限 / 未知字段 → BRIDGE_INVALID_INPUT（§2.2 约束）', async () => {
    const env = await startRoute({});
    try {
      const badUri = await env.route(
        'resource:open',
        {
          resource: { uri: 'file:///etc/passwd' },
        },
        'bad-uri',
      );
      expect(badUri.ok).toBe(false);
      if (!badUri.ok) {
        expect(badUri.error.code).toBe('BRIDGE_INVALID_INPUT');
      }
      const bigPayload = await env.route(
        'resource:open',
        {
          resource: { uri: PNG_URI, payload: { blob: 'x'.repeat(70000) } },
        },
        'big-payload',
      );
      expect(bigPayload.ok).toBe(false);
      if (!bigPayload.ok) {
        expect(bigPayload.error.code).toBe('BRIDGE_INVALID_INPUT');
      }
      const unknownField = await env.route(
        'resource:open',
        {
          origin: 'frame',
          resource: { uri: PNG_URI },
        },
        'unknown-field',
      );
      expect(unknownField.ok).toBe(false);
      if (!unknownField.ok) {
        expect(unknownField.error.code).toBe('BRIDGE_INVALID_INPUT');
      }
    } finally {
      await env.shutdown();
    }
  });

  it('偏好生效：platform.fileOpen.defaults 有效偏好改选处理器（§4.2 → 组内排序）', async () => {
    const appInstances = createAppInstanceFake({});
    const env = await startRoute({
      catalog: [
        {
          pluginId: 'app.primary',
          name: '专用',
          role: 'app',
          tier: 'primary',
          extensions: ['.png'],
          mimeTypes: ['image/png'],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          pluginId: 'app.other',
          name: '改选目标',
          role: 'app',
          tier: 'fallback',
          extensions: ['.png'],
          mimeTypes: [],
          installedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      preferences: { 'ext:.png': 'app.other' },
      appInstances,
    });
    try {
      const response = await env.route('resource:open', {
        resource: { uri: PNG_URI, fileName: 'photo.png' },
      });
      expect(response.ok).toBe(true);
      const result = (response as { ok: true; result: IResourceOpenResult }).result;
      expect(result.pluginId).toBe('app.other');
      expect(result.slot).toBe('ext:.png');
    } finally {
      await env.shutdown();
    }
  });
});

describe('resource:list-handlers 槽位视图（§6.2 免权限只读编目）', () => {
  it('免权限会话可调用；视图结构离线可测', async () => {
    const env = await startRoute({
      grantedPermissions: [],
      catalog: [
        {
          pluginId: 'app.photo',
          name: '图片查看器',
          role: 'app',
          tier: 'primary',
          extensions: ['.png'],
          mimeTypes: ['image/png'],
          installedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      preferences: { 'ext:.png': 'app.photo' },
    });
    try {
      const response = await env.route('resource:list-handlers', {}, 'slots-1');
      expect(response.ok).toBe(true);
      const slots = (response as { ok: true; result: { slots: unknown[] } }).result.slots;
      expect(Array.isArray(slots)).toBe(true);
      const extSlot = slots.find((slot) => (slot as { slot: string }).slot === 'ext:.png') as {
        defaultPluginId: string | null;
        handlers: { pluginId: string; isPreferred: boolean }[];
      };
      expect(extSlot.defaultPluginId).toBe('app.photo');
      expect(extSlot.handlers[0]).toMatchObject({
        pluginId: 'app.photo',
        isPreferred: true,
        role: 'app',
        tier: 'primary',
      });
    } finally {
      await env.shutdown();
    }
  });

  it('服务上下文逐字段如实传递（signal / deadline / sessionId / callerId）', async () => {
    let captured: IResourceOpenCapabilityContext | undefined;
    const service = createResourceOpenService({
      catalog: { snapshot: () => Promise.resolve([]) },
      preferences: { defaults: () => Promise.resolve({}) },
      appInstances: createAppInstanceFake({}),
      serviceInstances: createServiceInstanceFake(),
      fallback: createFallbackFake(),
    });
    const wrapped = createResourceOpenCapabilityDescriptors({
      executeOpen: (input, ctx) => {
        captured = ctx;
        return service.executeOpen(input, ctx);
      },
      executeListHandlers: (ctx) => service.executeListHandlers(ctx),
    });
    const grant: IHostSessionGrant = { pluginId: 'test.caller', grantedPermissions: ['*'] };
    const runtime = createHostRuntime({
      capabilities: wrapped,
      sessionProvisioner: { provision: () => grant },
    });
    const host: IPalHost = createFakePalHost();
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    try {
      await runtime.ipc.handleRequest(
        { windowId: 3, frameId: null },
        {
          requestId: 'ctx-1',
          capabilityId: 'resource:open',
          input: { resource: { uri: 'chips-resource://memory/x' } },
        },
      );
      expect(captured).not.toBeNull();
      expect(captured?.sessionId).toBe('session:3:main');
      expect(captured?.callerId).toBe('test.caller');
      expect(typeof captured?.signal.addEventListener).toBe('function');
      expect(typeof captured?.deadline).toBe('number');
    } finally {
      await runtime.shutdown();
    }
  });
});
