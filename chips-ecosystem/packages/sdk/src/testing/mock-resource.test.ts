import { describe, expect, it } from 'vitest';
import { ChipsError } from '../errors.js';
import type { IResourceHandle } from '../types/bridge.js';
import { createMockBridge } from './mock-bridge.js';
import { MOCK_ERROR_CODES } from './codes.js';

/** 取 Promise 的拒绝原因；未拒绝时断言失败。 */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('预期调用被拒绝');
    },
    (error: unknown) => error,
  );
}

/** 同步调用并取抛出的 ChipsError 错误码；未抛错时返回 `undefined`，断言随之失败。 */
function thrownCode(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof ChipsError ? error.code : undefined;
  }
}

/** 以夹具建桥并取句柄。 */
function handleWithFixture(data: Uint8Array | string, uri = 'chips-resource://workspace/a.card') {
  const bridge = createMockBridge({ resources: { [uri]: { data } } });
  return { bridge, handle: bridge.resource(uri) };
}

describe('Mock 资源 URI 语法校验', () => {
  it('合法 URI 可创建句柄并保持原始地址', () => {
    const { handle } = handleWithFixture(new Uint8Array([0x89, 0x50]));
    expect(handle.uri).toBe('chips-resource://workspace/a.card');
    expect(handle.state).toBe('open');
  });

  it('协议前缀不合法时同步抛 RESOURCE_INVALID_URI', () => {
    const bridge = createMockBridge();
    for (const uri of ['file:///tmp/a.card', 'http://host/a', 'workspace/a.card', '']) {
      expect(thrownCode(() => bridge.resource(uri)), uri).toBe(MOCK_ERROR_CODES.invalidUri);
    }
  });

  it('作用域段、路径段与百分号编码的非法形状一律 RESOURCE_INVALID_URI', () => {
    const bridge = createMockBridge();
    const invalid = [
      'chips-resource://Workspace/a.card',
      'chips-resource://a card/x',
      'chips-resource://workspace',
      'chips-resource://workspace/',
      'chips-resource://workspace//a.card',
      'chips-resource://workspace/../etc/passwd',
      'chips-resource://workspace/./a.card',
      'chips-resource://workspace/a\\b.card',
      'chips-resource://workspace/a#frag',
      'chips-resource://workspace/%zz.card',
      'chips-resource://workspace/%2e%2e/etc',
      'chips-resource://workspace/a.card?mode=view',
      'chips-resource://workspace/a%2F../b.card',
    ];
    for (const uri of invalid) {
      expect(thrownCode(() => bridge.resource(uri)), uri).toBe(MOCK_ERROR_CODES.invalidUri);
    }
  });

  it('控制字符按语法非法处理', () => {
    const bridge = createMockBridge();
    expect(thrownCode(() => bridge.resource('chips-resource://workspace/a\ncard'))).toBe(
      MOCK_ERROR_CODES.invalidUri,
    );
  });

  it('external 作用域保留查询串，受管作用域的裸查询串被拒', async () => {
    // 合法形态取自 06-资源协议规范 2.1 与 2.7
    const legal: readonly string[] = [
      'chips-resource://external/https/example.com/a.json?page=1',
      'chips-resource://external/http/api.example.com:8080/v1/items?page=2',
    ];
    for (const uri of legal) {
      const bridge = createMockBridge({ resources: { [uri]: { data: 'x' } } });
      const metadata = await bridge.resource(uri).metadata();
      expect(metadata.uri).toBe(uri);
    }
    // 受管作用域出现裸 `?` 即 RESOURCE_INVALID_URI（2.5 节），字面 `?` 须写成 `%3F`
    expect(() =>
      createMockBridge().resource('chips-resource://card-7f3a/images/photo.jpg?v=2'),
    ).toThrowError(ChipsError);
    const handle = createMockBridge({
      resources: { 'chips-resource://card-7f3a/images/a%3Fb.png': { data: 'x' } },
    }).resource('chips-resource://card-7f3a/images/a%3Fb.png');
    expect(handle.uri).toBe('chips-resource://card-7f3a/images/a%3Fb.png');
  });

  it('空查询串先于作用域判定被拒，查询串为空的判据对所有作用域生效', () => {
    const bridge = createMockBridge();
    // 06-资源协议规范 2.1 的 `[?<query>]` 是可选整组：出现 `?` 就必须带非空查询串，
    // 2.5 节另把受管作用域的裸 `?` 判为 RESOURCE_INVALID_URI。
    // Mock 把「查询串为空」排在作用域段判定之前，因此 external 作用域的尾部裸 `?` 同样被拒。
    const caught: unknown = (() => {
      try {
        bridge.resource('chips-resource://workspace/a.card?');
        return undefined;
      } catch (error) {
        return error;
      }
    })();
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe(MOCK_ERROR_CODES.invalidUri);
    expect((caught as ChipsError).details).toEqual({
      uri: 'chips-resource://workspace/a.card?',
      reason: '查询串为空',
    });
    expect(
      thrownCode(() => bridge.resource('chips-resource://external/https/example.com/a.json?')),
    ).toBe(MOCK_ERROR_CODES.invalidUri);
  });

  it('details 携带 uri 与拒绝原因，供按 code 分支后定位', () => {
    const bridge = createMockBridge();
    const caught: unknown = (() => {
      try {
        bridge.resource('chips-resource://workspace/../etc');
        return undefined;
      } catch (error) {
        return error;
      }
    })();
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe(MOCK_ERROR_CODES.invalidUri);
    expect((caught as ChipsError).details).toEqual({
      uri: 'chips-resource://workspace/../etc',
      reason: '路径段为空或为点段',
    });
  });
});

describe('Mock 资源元数据与字节读取', () => {
  it('字节夹具的 size 等于字节长度，MIME 与版本取夹具值', async () => {
    // 夹具取自 02-SDK-API规范 7.3 的资源夹具示例
    const bridge = createMockBridge({
      resources: {
        'chips-resource://card-7f3a/cover.png': {
          data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          mimeType: 'image/png',
          version: '3',
        },
      },
    });
    const handle = bridge.resource('chips-resource://card-7f3a/cover.png');
    await expect(handle.metadata()).resolves.toEqual({
      uri: 'chips-resource://card-7f3a/cover.png',
      size: 4,
      mimeType: 'image/png',
      version: '3',
      scope: 'memory',
    });
    await expect(handle.read()).resolves.toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  });

  it('文本夹具按 UTF-8 字节计长，MIME 与版本取缺省值', async () => {
    const { handle } = handleWithFixture('薯片');
    const metadata = await handle.metadata();
    expect(metadata.size).toBe(6);
    expect(metadata.mimeType).toBe('application/octet-stream');
    expect(metadata.version).toBe('1');
  });

  it('read 返回夹具字节', async () => {
    const { handle } = handleWithFixture(new Uint8Array([1, 2, 3]));
    await expect(handle.read()).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it('read 的文本夹具结果与字节读互不干扰，改返回值不污染夹具', async () => {
    const { handle } = handleWithFixture(new Uint8Array([1, 2, 3]));
    const first = await handle.read();
    first[0] = 99;
    await expect(handle.read()).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it('未登记资源的 metadata 与 read 拒绝 RESOURCE_NOT_FOUND', async () => {
    const bridge = createMockBridge();
    const handle = bridge.resource('chips-resource://workspace/missing.card');
    expect((await rejection(handle.metadata())) as ChipsError).toMatchObject({
      code: MOCK_ERROR_CODES.notFound,
    });
    expect((await rejection(handle.read())) as ChipsError).toMatchObject({
      details: { uri: 'chips-resource://workspace/missing.card' },
    });
  });

  it('readRange 按偏移取片段', async () => {
    const { handle } = handleWithFixture(new Uint8Array([10, 11, 12, 13, 14]));
    await expect(handle.readRange(1, 3)).resolves.toEqual(new Uint8Array([11, 12, 13]));
    await expect(handle.readRange(0, 5)).resolves.toEqual(new Uint8Array([10, 11, 12, 13, 14]));
  });

  it('readRange 越界或参数非法时拒绝 BRIDGE_INVALID_INPUT', async () => {
    const { handle } = handleWithFixture(new Uint8Array([10, 11]));
    for (const [offset, length] of [
      [0, 3],
      [1, 2],
      [-1, 1],
      [0, 0],
      [1.5, 1],
    ] as const) {
      const error = (await rejection(handle.readRange(offset, length))) as ChipsError;
      expect(error.code, `${offset}+${length}`).toBe(MOCK_ERROR_CODES.invalidInput);
    }
  });

  it('stream 逐块产出整个资源内容', async () => {
    const { handle } = handleWithFixture(new Uint8Array([7, 8, 9]));
    const reader = handle.stream().getReader();
    const { value, done } = await reader.read();
    expect(done).toBe(false);
    expect(value).toEqual(new Uint8Array([7, 8, 9]));
    await expect(reader.read()).resolves.toMatchObject({ done: true });
  });

  it('stream 在未登记资源时以 RESOURCE_NOT_FOUND 失败', async () => {
    const bridge = createMockBridge();
    const reader = bridge.resource('chips-resource://workspace/none.card').stream().getReader();
    const caught: unknown = await reader.read().then(
      () => undefined,
      (error: unknown) => error,
    );
    expect((caught as ChipsError).code).toBe(MOCK_ERROR_CODES.notFound);
  });
});

describe('Mock 资源句柄生命周期', () => {
  it('release 幂等，释放后除 uri 与 state 外一律 RESOURCE_HANDLE_RELEASED', async () => {
    const { handle } = handleWithFixture(new Uint8Array([1]));
    handle.release();
    handle.release();
    expect(handle.state).toBe('released');
    expect(handle.uri).toBe('chips-resource://workspace/a.card');
    for (const promise of [handle.metadata(), handle.read(), handle.readRange(0, 1)]) {
      expect(((await rejection(promise)) as ChipsError).code).toBe(MOCK_ERROR_CODES.handleReleased);
    }
    // stream() 与平台一致地同步返回流对象，终态以流的错误端呈现（06-资源协议规范 6.2）
    expect(((await rejection(handle.stream().getReader().read())) as ChipsError).code).toBe(
      MOCK_ERROR_CODES.handleReleased,
    );
    expect(() => handle.onInvalidate(() => undefined)).toThrowError(ChipsError);
  });

  it('失效后 metadata 拒绝 RESOURCE_HANDLE_INVALIDATED', async () => {
    const { bridge, handle } = handleWithFixture(new Uint8Array([1]));
    const reasons: string[] = [];
    handle.onInvalidate((reason) => reasons.push(reason));
    bridge.invalidate('chips-resource://workspace/a.card', 'source-changed');
    expect(handle.state).toBe('invalidated');
    expect(reasons).toEqual(['source-changed']);
    expect(((await rejection(handle.metadata())) as ChipsError).code).toBe(
      MOCK_ERROR_CODES.handleInvalidated,
    );
    expect(((await rejection(handle.read())) as ChipsError).code).toBe(
      MOCK_ERROR_CODES.handleInvalidated,
    );
  });

  it('invalidate 同步派发全部 onInvalidate 回调且只派发一次', () => {
    const { bridge, handle } = handleWithFixture('data');
    const first: string[] = [];
    const second: string[] = [];
    handle.onInvalidate((reason) => first.push(reason));
    handle.onInvalidate((reason) => second.push(reason));
    bridge.invalidate('chips-resource://workspace/a.card', 'session-closed');
    bridge.invalidate('chips-resource://workspace/a.card', 'scope-revoked');
    expect(first).toEqual(['session-closed']);
    expect(second).toEqual(['session-closed']);
  });

  it('同一 handler 多次订阅失效通知各自独立，dispose 后不再收到', () => {
    const { bridge, handle } = handleWithFixture('data');
    let count = 0;
    const handler = (): void => {
      count += 1;
    };
    const subscription = handle.onInvalidate(handler);
    handle.onInvalidate(handler);
    subscription.dispose();
    subscription.dispose();
    bridge.invalidate('chips-resource://workspace/a.card', 'scope-revoked');
    expect(count).toBe(1);
  });

  it('失效后注册 onInvalidate 在下一微任务回调一次', async () => {
    const { bridge, handle } = handleWithFixture('data');
    bridge.invalidate('chips-resource://workspace/a.card', 'scope-revoked');
    const reasons: string[] = [];
    const subscription = handle.onInvalidate((reason) => reasons.push(reason));
    expect(reasons).toEqual([]);
    subscription.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(reasons).toEqual(['scope-revoked']);
  });

  it('release 后不再接收失效通知', () => {
    const { bridge, handle } = handleWithFixture('data');
    const reasons: string[] = [];
    handle.onInvalidate((reason) => reasons.push(reason));
    handle.release();
    bridge.invalidate('chips-resource://workspace/a.card', 'source-changed');
    expect(reasons).toEqual([]);
    expect(handle.state).toBe('released');
  });

  it('invalidate 不影响其它 URI 的句柄', async () => {
    const bridge = createMockBridge({
      resources: {
        'chips-resource://workspace/a.card': { data: 'a' },
        'chips-resource://workspace/b.card': { data: 'b' },
      },
    });
    const target = bridge.resource('chips-resource://workspace/a.card');
    const other = bridge.resource('chips-resource://workspace/b.card');
    bridge.invalidate('chips-resource://workspace/a.card', 'source-changed');
    expect(target.state).toBe('invalidated');
    expect(other.state).toBe('open');
    await expect(other.metadata()).resolves.toMatchObject({ size: 1 });
  });

  it('未创建句柄的 URI 调用 invalidate 无副作用', async () => {
    const bridge = createMockBridge({
      resources: { 'chips-resource://workspace/a.card': { data: 'a' } },
    });
    expect(() =>
      bridge.invalidate('chips-resource://workspace/none.card', 'source-changed'),
    ).not.toThrow();
    // 无句柄可失效不影响资源本身仍可读
    await expect(bridge.resource('chips-resource://workspace/a.card').read()).resolves.toEqual(
      new TextEncoder().encode('a'),
    );
  });

  it('同一 URI 的多个句柄一起失效', () => {
    const bridge = createMockBridge({
      resources: { 'chips-resource://workspace/a.card': { data: 'a' } },
    });
    const first = bridge.resource('chips-resource://workspace/a.card');
    const second = bridge.resource('chips-resource://workspace/a.card');
    second.release();
    bridge.invalidate('chips-resource://workspace/a.card', 'source-changed');
    expect(first.state).toBe('invalidated');
    expect(second.state).toBe('released');
  });

  it('失效回调中新建的同 URI 句柄不受本次失效影响', () => {
    const bridge = createMockBridge({
      resources: { 'chips-resource://workspace/a.card': { data: 'a' } },
    });
    const first = bridge.resource('chips-resource://workspace/a.card');
    let reopened: IResourceHandle | undefined;
    first.onInvalidate(() => {
      reopened = bridge.resource('chips-resource://workspace/a.card');
    });
    // 失效后不可续期，恢复路径是再次 resource(uri) 取新句柄（06-资源协议规范 6.3、6.5）：
    // 本次 invalidate 只覆盖派发前已 open 的句柄，回调内新建的句柄保持 open 等下一次失效
    bridge.invalidate('chips-resource://workspace/a.card', 'source-changed');
    expect(first.state).toBe('invalidated');
    expect(reopened?.state).toBe('open');
    bridge.invalidate('chips-resource://workspace/a.card', 'scope-revoked');
    expect(reopened?.state).toBe('invalidated');
  });

  it('reset 不回滚已创建句柄的状态', async () => {
    const bridge = createMockBridge({
      resources: { 'chips-resource://workspace/a.card': { data: 'a' } },
    });
    const handle = bridge.resource('chips-resource://workspace/a.card');
    handle.release();
    bridge.reset();
    expect(handle.state).toBe('released');
    expect(((await rejection(handle.metadata())) as ChipsError).code).toBe(
      MOCK_ERROR_CODES.handleReleased,
    );
  });
});
