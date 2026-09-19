import { describe, expect, it } from 'vitest';

import { createHostAssembly } from '../src/main/runtime-provider.js';
import { createFakePalHost } from './helpers/fake-pal-host.js';
import { createFakeRuntime } from './helpers/fake-runtime.js';

describe('createHostAssembly', () => {
  it('接受完整装配并原样返回', () => {
    const runtime = createFakeRuntime();
    const assembly = createHostAssembly({
      createPalHost: () => createFakePalHost(),
      createRuntime: () => runtime.runtime,
    });
    expect(typeof assembly.createPalHost).toBe('function');
    expect(typeof assembly.createRuntime).toBe('function');
  });

  it('缺少构造方法时抛出启动错误', () => {
    expect(() =>
      createHostAssembly({
        createPalHost: undefined as never,
        createRuntime: () => createFakeRuntime().runtime,
      }),
    ).toThrow('平台装配缺少 createPalHost / createRuntime');
    expect(() =>
      createHostAssembly({
        createPalHost: () => createFakePalHost(),
        createRuntime: undefined as never,
      }),
    ).toThrow('平台装配缺少 createPalHost / createRuntime');
  });
});
