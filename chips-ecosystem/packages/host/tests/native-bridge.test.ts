import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  NATIVE_BRIDGE_ABI_VERSION,
  NATIVE_BRIDGE_REQUIRED_EXPORTS,
  defaultNativeBridgeModulePath,
  dispatchNativeBridgeRequest,
  loadNativeBridgeBinding,
  type INativeBridge,
  type INativeBridgeAvailable,
} from '../src/main/native-bridge.js';

const requireCjs = createRequire(import.meta.url);

/** available 夹具的替身模块视图（调用记录面）。 */
interface IFixtureModule {
  __calls: {
    kind: string;
    registration?: unknown;
    capabilityId?: unknown;
    sessionId?: unknown;
    request?: unknown;
  }[];
}

/** 测试夹具目录（`require` 直接加载 CJS 替身，模拟 `.node` 边界）。 */
const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/native-binding/${name}`, import.meta.url));

/** 读取 available 夹具的底层替身模块（与桥面共用同一模块实例）。 */
function fixtureModule(): IFixtureModule {
  return requireCjs(fixturePath('available.js')) as IFixtureModule;
}

/** `@chips/native` ABI 清单（导出面与版本事实源，三方一致锁消费面）。 */
function readNativeManifest(): { abiVersion: number; exports: { name: string }[] } {
  const manifestPath = fileURLToPath(new URL('../../native/abi/export-surface.json', import.meta.url));
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as { abiVersion: number; exports: { name: string }[] };
}

/** `@chips/native` 类型声明原文（JS 侧函数面事实源）。 */
function readNativeDeclaration(): string {
  const declarationPath = fileURLToPath(new URL('../../native/types/chips-native.d.ts', import.meta.url));
  return readFileSync(declarationPath, 'utf8');
}

function availableBinding(): INativeBridgeAvailable {
  const binding = loadNativeBridgeBinding(fixturePath('available.js'));
  if (binding.status !== 'available') {
    throw new Error(`夹具应装载为可用面，实际 ${binding.status}:${binding.detail}`);
  }
  return binding;
}

describe('native-bridge：§8.6 导出名消费镜像三方锁（宿主视图 ↔ ABI 清单 ↔ .d.ts）', () => {
  it('宿主期望 ABI 与 export-surface.json 的 abiVersion 等值', () => {
    expect(readNativeManifest().abiVersion).toBe(NATIVE_BRIDGE_ABI_VERSION);
  });

  it('宿主必备消费面（元信息 2 + Bridge 域 4）逐项登记于 ABI 清单', () => {
    const names = readNativeManifest().exports.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining([...NATIVE_BRIDGE_REQUIRED_EXPORTS]));
    expect(names.filter((name) => name.startsWith('bridge'))).toEqual([
      'bridgeRegister',
      'bridgeUnregister',
      'bridgeRequest',
      'bridgeCancelSession',
    ]);
  });

  it('.d.ts 函数面声明与宿主消费镜像逐项一致（INativeBridge 四方法 + 元信息两项）', () => {
    const declaration = readNativeDeclaration();
    for (const name of NATIVE_BRIDGE_REQUIRED_EXPORTS) {
      expect(declaration).toContain(`export function ${name}(`);
    }
  });

  it('契约 §5.3 的 INativeBridge 方法名与消费镜像逐项一致（面漂移即翻红）', () => {
    const probe = availableBinding().bridge as unknown as Record<string, unknown>;
    expect(Object.keys(probe).sort()).toEqual(
      ['bridgeRegister', 'bridgeUnregister', 'bridgeRequest', 'bridgeCancelSession'].sort(),
    );
  });
});

describe('native-bridge：defaultNativeBridgeModulePath 产物落位推导', () => {
  it('自 platformRoot（dist/renderer）上溯两级进 native/', () => {
    expect(defaultNativeBridgeModulePath(join('/app', 'dist', 'renderer'))).toBe(
      resolve('/app', 'native', 'chips-native.node'),
    );
  });
});

describe('native-bridge：装载闸（fail-closed 四分面）', () => {
  it('可用面：元信息快照 + 类型化桥面交付', () => {
    const binding = availableBinding();
    expect(binding.coreVersion).toBe('0.1.0');
    expect(binding.abiVersion).toBe(NATIVE_BRIDGE_ABI_VERSION);
    expect(typeof binding.bridge.bridgeRegister).toBe('function');
    expect(binding.modulePath).toBe(fixturePath('available.js'));
  });

  it('产物不存在：module-missing 且回显路径', () => {
    const binding = loadNativeBridgeBinding('/tmp/chips-native-025-不存在.node');
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('module-missing');
      expect(binding.modulePath).toBe('/tmp/chips-native-025-不存在.node');
    }
  });

  it('旧构建产物缺能力执行导出：surface-mismatch 且逐项点名', () => {
    const binding = loadNativeBridgeBinding(fixturePath('stale-no-bridge.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      for (const name of ['bridgeRegister', 'bridgeUnregister', 'bridgeRequest', 'bridgeCancelSession']) {
        expect(binding.detail).toContain(name);
      }
    }
  });

  it('加载抛错：load-failed 且携带简体中文诊断', () => {
    const binding = loadNativeBridgeBinding(fixturePath('broken.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('load-failed');
      expect(binding.detail).toContain('模拟原生产物损坏');
    }
  });

  it('导出不是对象：load-failed', () => {
    const binding = loadNativeBridgeBinding(fixturePath('not-object.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('load-failed');
    }
  });

  it('ABI 版本漂移与非法取值：abi-mismatch', () => {
    const drifted = loadNativeBridgeBinding(fixturePath('abi-mismatch.js'));
    expect(drifted.status).toBe('unavailable');
    if (drifted.status === 'unavailable') {
      expect(drifted.reason).toBe('abi-mismatch');
      expect(drifted.detail).toContain('不等');
    }
    const fraction = loadNativeBridgeBinding(fixturePath('abi-fraction.js'));
    expect(fraction.status).toBe('unavailable');
    if (fraction.status === 'unavailable') {
      expect(fraction.reason).toBe('abi-mismatch');
    }
  });

  it('元信息调用抛错或取值非法：surface-mismatch', () => {
    const throwing = loadNativeBridgeBinding(fixturePath('version-throws.js'));
    expect(throwing.status).toBe('unavailable');
    if (throwing.status === 'unavailable') {
      expect(throwing.reason).toBe('surface-mismatch');
      expect(throwing.detail).toContain('元信息导出调用失败');
    }
    const invalid = loadNativeBridgeBinding(fixturePath('version-invalid.js'));
    expect(invalid.status).toBe('unavailable');
    if (invalid.status === 'unavailable') {
      expect(invalid.reason).toBe('surface-mismatch');
      expect(invalid.detail).toContain('coreVersion');
    }
  });

  it('同一路径重复装载复用同一内核模块（Node 模块缓存，§5.4 进程级单例语义）', () => {
    const module = fixtureModule();
    module.__calls.length = 0;
    const first = availableBinding();
    const second = availableBinding();
    first.bridge.bridgeCancelSession(1);
    second.bridge.bridgeCancelSession(2);
    expect(module.__calls.map((call) => call.sessionId)).toEqual([1, 2]);
  });
});

describe('native-bridge：类型化桥面透传（§5.3 消费链）', () => {
  it('register / unregister / cancelSession 原样转发参数', () => {
    const binding = availableBinding();
    const module = fixtureModule();
    module.__calls.length = 0;
    const registration = {
      descriptor: { id: 'probe:echo', schema: { type: 'object' }, permissions: [] },
      owner: 'chips.official.host',
      timeoutMs: 30_000,
      concurrency: 'parallel' as const,
      maxQueue: 32,
      handler: (_input: unknown, _ctx: unknown): Promise<unknown> => Promise.resolve(null),
    };
    binding.bridge.bridgeRegister(registration);
    binding.bridge.bridgeUnregister('probe:echo');
    binding.bridge.bridgeCancelSession(7);
    expect(module.__calls).toEqual([
      { kind: 'register', registration },
      { kind: 'unregister', capabilityId: 'probe:echo' },
      { kind: 'cancel-session', sessionId: 7 },
    ]);
  });

  it('内核注册前置拒绝按 §8.5 同构形状原样上抛（不吞码、不改写、不吞异常）', () => {
    const bridge: INativeBridge = availableBinding().bridge;
    let thrown: unknown;
    try {
      bridge.bridgeRegister({
        descriptor: { id: 'probe:reject', schema: {}, permissions: [] },
        owner: 'chips.official.host',
        timeoutMs: 30_000,
        concurrency: 'parallel',
        maxQueue: 32,
        handler: () => Promise.resolve(null),
      });
    } catch (error) {
      thrown = error;
    }
    // 等价复现工单 025 实测内核行为：提供方激活通道（bridgeActivateProvider，RFC-026
    // §五.3 裁定名）落地前，注册以 KERNEL_INVALID_TRANSITION 拒绝且形状原样传播。
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toMatchObject({
      code: 'KERNEL_INVALID_TRANSITION',
      retryable: false,
      details: { capabilityId: 'probe:reject' },
    });
  });
});

describe('native-bridge：dispatchNativeBridgeRequest（§5.3 适配层归一）', () => {
  it('成功路径返回 ok 信封并透传结果', async () => {
    const binding = availableBinding();
    const response = await dispatchNativeBridgeRequest(binding.bridge, {
      requestId: 'r-echo',
      capabilityId: 'probe:echo',
      sessionId: 7,
      input: { documentId: 'd1' },
    });
    expect(response).toEqual({ requestId: 'r-echo', ok: true, result: { echo: { documentId: 'd1' } } });
  });

  it('ChipsError 同构拒绝：code / retryable / details 原样透传（§8.5）', async () => {
    const bridge = availableBinding().bridge;
    const response = await dispatchNativeBridgeRequest(bridge, {
      requestId: 'r-code',
      capabilityId: 'probe:echo',
      sessionId: 7,
      input: {},
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toEqual({
        code: 'BRIDGE_SESSION_UNKNOWN',
        message: '来源会话无法解析或已关闭，调用被拒绝',
        retryable: false,
        details: { capabilityId: 'probe:echo', sessionId: 7 },
      });
    }
  });

  it('非该形状的异常归一为 BRIDGE_INTERNAL（桥接内部错误，不回收堆栈）', async () => {
    const bridge = availableBinding().bridge;
    const response = await dispatchNativeBridgeRequest(bridge, {
      requestId: 'r-plain',
      capabilityId: 'probe:echo',
      sessionId: 7,
      input: {},
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toEqual({
        code: 'BRIDGE_INTERNAL',
        message: '桥接内部错误',
        retryable: false,
      });
    }
  });
});
