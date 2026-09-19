/**
 * 公开入口导出面与文档规定的测试组合路径（02-SDK-API规范 §2.1、§2.2、§3.2、§3.4、§7.2、§7.3）。
 *
 * 分工：主入口的六个值导出与依赖边界由 `src/index.test.ts` 断言，`src/generated` 契约常量的
 * 引用路径由 `tests/generated-contracts.test.ts` 断言；本文件补 `@chips/sdk/testing` 入口
 * （§2.2 末段固定的四个值导出）的导出面，以及「插件代码只依赖主入口 + 测试代码用 testing
 * 入口装配 Mock」这条 §7.3 规定的端到端路径。入口的类型面由本文件的 `import type` 消费点
 * 承担：`IMockBridge`、`IMockBridgeOptions`、`IMockResourceInit`、`IMockCall` 必须可从入口
 * 取到，否则包级 `typecheck` 失败。
 *
 * 绕开的口径（工单 009 登记）：§2.1 的第三个入口 `@chips/sdk/scaffold` 未在本包 `exports`
 * 中声明（模板与生成器由 `tools/scaffold` 承载）。§3.2、§3.3 的 `CapabilityInput` /
 * `CapabilityOutput` 编译期映射已由主入口导出；本文件的插件示例仍按显式契约接口
 * `IFileReadInput` / `IFileReadOutput` 注解，以固定校验 §2.2 全部 `I*Input` / `I*Output`
 * 契约名的导出面，运行时形状与 §3.2、§7.3 示例一致。
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as testing from '../src/testing/index.js';
import {
  assertChipsError,
  createMockBridge,
  installMockBridge,
  uninstallMockBridge,
} from '../src/testing/index.js';
import { assertChipsError as assertChipsErrorImpl } from '../src/testing/assert-chips-error.js';
import { createMockBridge as createMockBridgeImpl } from '../src/testing/mock-bridge.js';
import {
  installMockBridge as installMockBridgeImpl,
  uninstallMockBridge as uninstallMockBridgeImpl,
} from '../src/testing/install-mock-bridge.js';
import { ChipsError, chips, createClient, isChipsError } from '../src/index.js';
import type {
  IFileReadInput,
  IFileReadOutput,
  IResourceHandle,
  ISubscription,
} from '../src/index.js';
import type {
  IMockBridge,
  IMockBridgeOptions,
  IMockCall,
  IMockResourceInit,
} from '../src/testing/index.js';
import { SDK_BRIDGE_UNAVAILABLE } from '../src/errors.js';
import { mountWindow, windowHost } from './helpers/window.js';

/** §7.3 资源夹具示例的封面 URI、夹具与装配选项。 */
const COVER_URI = 'chips-resource://card-7f3a/cover.png';
const COVER_FIXTURE: IMockResourceInit = {
  data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  mimeType: 'image/png',
  version: '1',
};
const RESOURCE_OPTIONS: IMockBridgeOptions = { resources: { [COVER_URI]: COVER_FIXTURE } };

/**
 * 被测插件代码：只从主入口取客户端与契约类型，运行期不感知 Mock（§2.1、§7.1）。
 */
const pluginUnderTest = {
  /**
   * §3.2 完整示例 `readMetadata`：类型化 `request` 后返回文件文本内容。
   *
   * @param path - 包内相对路径
   * @returns 文件文本内容
   */
  async readMetadata(path: string): Promise<string> {
    const input: IFileReadInput = { path, encoding: 'utf-8' };
    const output: IFileReadOutput = await chips.request<IFileReadOutput>('file:read', input);
    return output.content;
  },

  /**
   * §3.4 完整示例 `openCover`：同步取句柄、首次 `metadata()` 打开、`finally` 释放。
   *
   * @param uri - `chips-resource://` URI
   * @returns 资源字节长度
   */
  async coverSize(uri: string): Promise<number> {
    const handle: IResourceHandle = chips.resource(uri);
    try {
      const metadata = await handle.metadata();
      return metadata.size;
    } finally {
      handle.release();
    }
  },

  /**
   * §3.1 的订阅面：把 handler 交给 `subscribe`，返回可退订句柄。
   *
   * @param handler - 载荷回调
   * @returns 订阅句柄
   */
  watchDocument(handler: (payload: unknown) => void): ISubscription {
    return chips.subscribe('document:changed', handler);
  },
};

/** 本文件用例挂载的 `window` 恢复函数。 */
let restoreWindow: (() => void) | undefined;

/**
 * 挂载 `window` 并把 Mock 安装到 `window.chips`。
 *
 * §7.3 示例在 `describe` 体内安装，依赖 jsdom 常驻的 `window`；本包测试不引入 DOM 实现，
 * 因此按用例挂载并在 `afterEach` 还原为「无 window」原判据。
 *
 * @param bridge - 要安装的 Mock；省略时由 `installMockBridge` 新建
 * @returns 已安装的 Mock Bridge
 */
function installMock(bridge?: IMockBridge): IMockBridge {
  restoreWindow = mountWindow();
  return installMockBridge(bridge);
}

/** 还原 `window` 环境；用例内提前卸载时使用。 */
function releaseWindow(): void {
  restoreWindow?.();
  restoreWindow = undefined;
}

/** 取 Promise 的拒绝原因；未拒绝时断言失败。 */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('预期调用被拒绝');
    },
    (error: unknown) => error,
  );
}

/** 取 `assertChipsError` 失败时的消息文本。 */
function assertFailureMessage(run: () => void): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('预期断言失败，但未抛出');
}

afterEach(() => {
  uninstallMockBridge();
  releaseWindow();
});

describe('@chips/sdk/testing 入口值导出面（§2.1、§2.2 末段）', () => {
  it('值导出恰好为文档列出的四项，且无默认导出', () => {
    expect(Object.keys(testing).sort()).toEqual([
      'assertChipsError',
      'createMockBridge',
      'installMockBridge',
      'uninstallMockBridge',
    ]);
    expect('default' in testing).toBe(false);
    expect(typeof testing.assertChipsError).toBe('function');
    expect(typeof testing.createMockBridge).toBe('function');
    expect(typeof testing.installMockBridge).toBe('function');
    expect(typeof testing.uninstallMockBridge).toBe('function');
  });

  it('入口导出即各实现模块本身，未经二次包装', () => {
    expect(testing.assertChipsError).toBe(assertChipsErrorImpl);
    expect(testing.createMockBridge).toBe(createMockBridgeImpl);
    expect(testing.installMockBridge).toBe(installMockBridgeImpl);
    expect(testing.uninstallMockBridge).toBe(uninstallMockBridgeImpl);
  });

  it('testing 入口不导出主入口值、契约常量与 Mock 内部码表', () => {
    const entry = testing as Record<string, unknown>;
    for (const name of [
      'chips',
      'createClient',
      'ChipsBridge',
      'ChipsError',
      'isChipsError',
      'toChipsError',
      'MOCK_ERROR_CODES',
      'mockError',
      'MockResourceHandle',
      'Capability',
      'CAPABILITY_IDS',
      'ERROR_CODES',
      'PLATFORM_VERSION',
    ]) {
      expect(entry[name], name).toBeUndefined();
    }
  });
});

describe('主入口客户端与 testing 入口 Mock 的端到端路径（§7.3）', () => {
  it('类型化 request 命中桩，calls 记录能力 ID 与输入', async () => {
    const bridge = installMock();
    bridge.handle('file:read', () => ({ content: 'name: 示例卡片', encoding: 'utf-8' }));
    await expect(pluginUnderTest.readMetadata('.card/metadata.yaml')).resolves.toBe(
      'name: 示例卡片',
    );
    const calls: readonly IMockCall[] = bridge.calls;
    expect(calls).toEqual([
      { capabilityId: 'file:read', input: { path: '.card/metadata.yaml', encoding: 'utf-8' } },
    ]);
    expect(bridge.calls[0]?.capabilityId).toBe('file:read');
  });

  it('未登记桩时按 BRIDGE_CAPABILITY_NOT_FOUND 拒绝，只按 code 分支即可还原语义', async () => {
    installMock();
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('a.txt'));
    assertChipsError(caught, 'BRIDGE_CAPABILITY_NOT_FOUND');
    expect(caught).toBeInstanceOf(ChipsError);
    expect(isChipsError(caught)).toBe(true);
    expect(caught.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    expect(caught.retryable).toBe(false);
    expect(caught.details).toEqual({ capabilityId: 'file:read' });
  });

  it('桩抛 ChipsError 时同实例透传到插件代码，错误码不匹配时断言按码报错', async () => {
    const bridge = installMock();
    const denied = new ChipsError({
      code: 'BRIDGE_PERMISSION_DENIED',
      message: '缺少文件读取权限',
      retryable: false,
    });
    bridge.handle('file:read', () => {
      throw denied;
    });
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('.card/metadata.yaml'));
    assertChipsError(caught, 'BRIDGE_PERMISSION_DENIED');
    expect(caught).toBe(denied);
    // §7.2「assertChipsError」行：失败消息同时给出期望与实际错误码
    const message = assertFailureMessage(() => assertChipsError(caught, 'RESOURCE_NOT_FOUND'));
    expect(message).toContain('期望错误码 RESOURCE_NOT_FOUND');
    expect(message).toContain('实际错误码 BRIDGE_PERMISSION_DENIED');
  });

  it('订阅面经默认客户端联动 Mock，dispose 后不再收到派发', () => {
    const bridge = installMock();
    const received: unknown[] = [];
    const subscription = pluginUnderTest.watchDocument((payload) => received.push(payload));
    bridge.emit('document:changed', { documentId: 'a1B2c3D4e5' });
    expect(received).toEqual([{ documentId: 'a1B2c3D4e5' }]);
    expect(bridge.subscriptionCount('document:changed')).toBe(1);
    subscription.dispose();
    bridge.emit('document:changed', { documentId: 'Z9y8X7' });
    expect(received).toHaveLength(1);
    expect(bridge.subscriptionCount('document:changed')).toBe(0);
  });

  it('默认客户端与注入客户端共用同一 Mock 订阅表（§3.2 注入行）', () => {
    const bridge = installMock();
    const injected = createClient({ bridge });
    const subscription = injected.subscribe('document:changed', () => undefined);
    pluginUnderTest.watchDocument(() => undefined);
    expect(bridge.subscriptionCount('document:changed')).toBe(2);
    subscription.dispose();
    expect(bridge.subscriptionCount('document:changed')).toBe(1);
  });

  it('资源夹具按 §7.3 示例给出元数据，插件 release 后同句柄不再可读', async () => {
    const bridge = installMock(createMockBridge(RESOURCE_OPTIONS));
    await expect(pluginUnderTest.coverSize(COVER_URI)).resolves.toBe(4);
    const handle = chips.resource(COVER_URI);
    await expect(handle.metadata()).resolves.toEqual({
      uri: COVER_URI,
      size: 4,
      mimeType: 'image/png',
      version: '1',
      scope: 'memory',
    });
    handle.release();
    const caught: unknown = await rejection(handle.read());
    assertChipsError(caught, 'RESOURCE_HANDLE_RELEASED');
    expect(caught.details).toEqual({ uri: COVER_URI });
    // §7.2「calls」行：resource() 不经能力通道，全部资源访问都不产生调用记录
    expect(bridge.calls).toEqual([]);
  });

  it('未登记资源的读取按 RESOURCE_NOT_FOUND 拒绝', async () => {
    installMock(createMockBridge(RESOURCE_OPTIONS));
    const missing = chips.resource('chips-resource://card-7f3a/none.png');
    const caught: unknown = await rejection(missing.read());
    assertChipsError(caught, 'RESOURCE_NOT_FOUND');
    expect(caught.details).toEqual({ uri: 'chips-resource://card-7f3a/none.png' });
  });

  it('URI 语法非法时 resource 同步抛 ChipsError，插件按 §3.4 的 catch 分支处理', () => {
    installMock();
    let caught: unknown;
    try {
      chips.resource('chips-resource://card-7f3a/images/photo.jpg?v=2');
    } catch (error) {
      caught = error;
    }
    assertChipsError(caught, 'RESOURCE_INVALID_URI');
    expect(caught).toBeInstanceOf(ChipsError);
    expect(caught.details).toMatchObject({ uri: 'chips-resource://card-7f3a/images/photo.jpg?v=2' });
  });

  it('§7.3 的 afterEach reset 惯用法：清空桩与记录后同一调用按未登记拒绝', async () => {
    const bridge = installMock();
    bridge.handle('file:read', () => ({ content: 'name: 示例卡片', encoding: 'utf-8' }));
    await expect(pluginUnderTest.readMetadata('.card/metadata.yaml')).resolves.toBe(
      'name: 示例卡片',
    );
    bridge.reset();
    expect(bridge.calls).toEqual([]);
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('.card/metadata.yaml'));
    assertChipsError(caught, 'BRIDGE_CAPABILITY_NOT_FOUND');
  });

  it('createClient 注入 Mock 后无需 window 即跑通三个方法面', async () => {
    expect(windowHost()).toBeUndefined();
    const mock = createMockBridge(RESOURCE_OPTIONS);
    mock.handle('file:read', () => ({ content: '注入客户端', encoding: 'utf-8' }));
    const client = createClient({ bridge: mock });
    await expect(client.request<IFileReadOutput>('file:read', { path: 'a.txt' })).resolves.toEqual(
      { content: '注入客户端', encoding: 'utf-8' },
    );
    expect(client.resource(COVER_URI).state).toBe('open');
    const received: unknown[] = [];
    client.subscribe('document:changed', (payload) => received.push(payload)).dispose();
    mock.emit('document:changed', { documentId: 'a1B2' });
    expect(received).toEqual([]);
    expect(mock.calls).toEqual([{ capabilityId: 'file:read', input: { path: 'a.txt' } }]);
  });

  it('卸载后默认客户端拒绝 SDK_BRIDGE_UNAVAILABLE，注入客户端仍走同一 Mock', async () => {
    const bridge = installMock();
    bridge.handle('file:read', () => ({ content: '仍可读', encoding: 'utf-8' }));
    const injected = createClient({ bridge });
    uninstallMockBridge();
    releaseWindow();
    expect(windowHost()).toBeUndefined();
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('a.txt'));
    assertChipsError(caught, SDK_BRIDGE_UNAVAILABLE);
    await expect(injected.request<IFileReadOutput>('file:read')).resolves.toEqual({
      content: '仍可读',
      encoding: 'utf-8',
    });
  });
});
