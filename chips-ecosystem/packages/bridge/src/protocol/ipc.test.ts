import { describe, expect, it } from 'vitest';
import { ChipsError, type IChipsError } from './errors.js';
import {
  EVENT_CHANNEL_PREFIX,
  IPC_CHANNELS,
  assertEventPayload,
  assertStructuredCloneable,
  decodeBridgeRequest,
  decodeBridgeResponse,
  decodeEventControlRequest,
  decodeEventControlResponse,
  decodeResourceControlRequest,
  decodeResourceControlResponse,
  decodeSessionPermissionsUpdate,
  encodeBridgeResponse,
  encodeEventControlFailure,
  encodeEventControlSuccess,
  encodeResourceControlFailure,
  encodeResourceControlSuccess,
  estimateSerializedBytes,
  eventChannel,
} from './ipc.js';
import { EVENT_PAYLOAD_MAX_BYTES } from './events.js';

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    expect.unreachable('应当抛出 ChipsError');
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe('通道常量', () => {
  it('通道名固定且事件通道带统一前缀', () => {
    expect(IPC_CHANNELS.bridgeRequest).toBe('bridge:request');
    expect(IPC_CHANNELS.bridgeResource).toBe('bridge:resource');
    expect(IPC_CHANNELS.eventControl).toBe('event:control');
    expect(IPC_CHANNELS.sessionPermissions).toBe('session:permissions');
    expect(EVENT_CHANNEL_PREFIX).toBe('event:');
    expect(eventChannel('file:changed')).toBe('event:file:changed');
  });
});

describe('assertStructuredCloneable', () => {
  it('接受 JSON 值、Uint8Array 与 ArrayBuffer', () => {
    expect(() =>
      assertStructuredCloneable({
        text: 'x',
        count: 1,
        flag: true,
        nothing: null,
        missing: undefined,
        list: [1, 'a', { nested: true }],
        bytes: new Uint8Array([1, 2]),
        buffer: new ArrayBuffer(4),
      })
    ).not.toThrow();
  });

  it('拒绝函数、Symbol、bigint 与类实例', () => {
    expectCode(() => assertStructuredCloneable(() => undefined), 'BRIDGE_INTERNAL');
    expectCode(() => assertStructuredCloneable(Symbol('x')), 'BRIDGE_INTERNAL');
    expectCode(() => assertStructuredCloneable(1n), 'BRIDGE_INTERNAL');
    expectCode(() => assertStructuredCloneable(new Date()), 'BRIDGE_INTERNAL');
    expectCode(() => assertStructuredCloneable(new Error('x')), 'BRIDGE_INTERNAL');
    expectCode(() => assertStructuredCloneable(new Map()), 'BRIDGE_INTERNAL');
    expectCode(() => assertStructuredCloneable({ deep: [new Set()] }), 'BRIDGE_INTERNAL');
  });

  it('允许自定义错误码与文案', () => {
    expectCode(
      () =>
        assertStructuredCloneable(() => undefined, {
          code: 'EVENT_PAYLOAD_UNSUPPORTED',
          message: '不可克隆',
        }),
      'EVENT_PAYLOAD_UNSUPPORTED'
    );
  });
});

describe('estimateSerializedBytes 与 assertEventPayload', () => {
  it('二进制按字节数计、字符串按 UTF-8 计', () => {
    expect(estimateSerializedBytes(new Uint8Array(10))).toBe(10);
    expect(estimateSerializedBytes(new ArrayBuffer(7))).toBe(7);
    expect(estimateSerializedBytes('中')).toBe(5);
    expect(estimateSerializedBytes(null)).toBe(4);
    expect(estimateSerializedBytes(123)).toBe(3);
    expect(estimateSerializedBytes(true)).toBe(4);
    expect(estimateSerializedBytes([1])).toBeGreaterThan(3);
    expect(estimateSerializedBytes({ a: 1 })).toBeGreaterThan(3);
  });

  it('超限载荷返回 EVENT_PAYLOAD_TOO_LARGE', () => {
    expectCode(
      () => assertEventPayload(new Uint8Array(EVENT_PAYLOAD_MAX_BYTES + 1)),
      'EVENT_PAYLOAD_TOO_LARGE'
    );
  });

  it('不可克隆载荷返回 EVENT_PAYLOAD_UNSUPPORTED', () => {
    expectCode(() => assertEventPayload({ handler: () => undefined }), 'EVENT_PAYLOAD_UNSUPPORTED');
  });

  it('合法载荷通过', () => {
    expect(() => assertEventPayload({ uri: 'chips-resource://card-1/a.png' })).not.toThrow();
  });
});

describe('bridge:request / bridge:response 编解码', () => {
  it('解码请求：保留 input、省略 undefined input', () => {
    expect(decodeBridgeRequest({ requestId: 'r1', capabilityId: 'file:read', input: {} })).toEqual({
      requestId: 'r1',
      capabilityId: 'file:read',
      input: {},
    });
    expect(decodeBridgeRequest({ requestId: 'r1', capabilityId: 'system:info' })).toEqual({
      requestId: 'r1',
      capabilityId: 'system:info',
    });
  });

  it('请求结构非法返回 BRIDGE_INTERNAL', () => {
    expectCode(() => decodeBridgeRequest(null), 'BRIDGE_INTERNAL');
    expectCode(() => decodeBridgeRequest({ capabilityId: 'a:b' }), 'BRIDGE_INTERNAL');
    expectCode(() => decodeBridgeRequest({ requestId: 'r1' }), 'BRIDGE_INTERNAL');
    expectCode(() => decodeBridgeRequest({ requestId: 'r1', capabilityId: '' }), 'BRIDGE_INTERNAL');
  });

  it('横切 traceId 随请求帧透传（工单046 段一）', () => {
    expect(
      decodeBridgeRequest({
        requestId: 'r1',
        capabilityId: 'file:read',
        input: { path: '/x' },
        traceId: 't-chain-1',
      })
    ).toEqual({
      requestId: 'r1',
      capabilityId: 'file:read',
      input: { path: '/x' },
      traceId: 't-chain-1',
    });
    // 缺省不造键：无 traceId 的请求解码后不含该字段。
    expect(
      Object.prototype.hasOwnProperty.call(
        decodeBridgeRequest({ requestId: 'r1', capabilityId: 'system:info' }),
        'traceId'
      )
    ).toBe(false);
  });

  it('traceId 存在但非法（空串/非字符串）返回 BRIDGE_INTERNAL', () => {
    expectCode(
      () => decodeBridgeRequest({ requestId: 'r1', capabilityId: 'a:b', traceId: '' }),
      'BRIDGE_INTERNAL'
    );
    expectCode(
      () => decodeBridgeRequest({ requestId: 'r1', capabilityId: 'a:b', traceId: 7 }),
      'BRIDGE_INTERNAL'
    );
  });

  it('编码响应：错误归一为普通对象', () => {
    const error = new ChipsError({
      code: 'BRIDGE_TIMEOUT',
      message: '超时',
      retryable: true,
    });
    const encoded = encodeBridgeResponse({ requestId: 'r1', ok: false, error: error.toPlain() });
    expect(encoded).toEqual({
      requestId: 'r1',
      ok: false,
      error: { code: 'BRIDGE_TIMEOUT', message: '超时', retryable: true },
    });
  });

  it('编码响应时校验结果可克隆，不可克隆结果抛错', () => {
    expect(
      encodeBridgeResponse({ requestId: 'r1', ok: true, result: new Uint8Array([1]) })
    ).toEqual({ requestId: 'r1', ok: true, result: new Uint8Array([1]) });
    expectCode(
      () => encodeBridgeResponse({ requestId: 'r1', ok: true, result: { fn: () => undefined } }),
      'BRIDGE_INTERNAL'
    );
  });

  it('解码响应：成功与失败分支', () => {
    expect(decodeBridgeResponse({ requestId: 'r1', ok: true, result: 42 })).toEqual({
      requestId: 'r1',
      ok: true,
      result: 42,
    });
    expect(
      decodeBridgeResponse({
        requestId: 'r1',
        ok: false,
        error: { code: 'FILE_NOT_FOUND', message: '文件不存在', retryable: false },
      })
    ).toMatchObject({ requestId: 'r1', ok: false });
  });

  it('解码响应结构非法返回 BRIDGE_INTERNAL', () => {
    expectCode(() => decodeBridgeResponse('x'), 'BRIDGE_INTERNAL');
    expectCode(() => decodeBridgeResponse({ requestId: 'r1', ok: 'yes' }), 'BRIDGE_INTERNAL');
    expectCode(
      () => decodeBridgeResponse({ requestId: 'r1', ok: false, error: { message: 'x' } }),
      'BRIDGE_INTERNAL'
    );
  });
});

describe('bridge:resource 编解码', () => {
  const metadata = {
    uri: 'chips-resource://card-1/a.png',
    size: 4,
    mimeType: 'image/png',
    version: 'v1',
    scope: 'document',
  } as const;

  it('解码资源控制请求', () => {
    expect(
      decodeResourceControlRequest({ requestId: 'r1', operation: 'open', uri: metadata.uri })
    ).toEqual({ requestId: 'r1', operation: 'open', uri: metadata.uri });
    expect(
      decodeResourceControlRequest({ requestId: 'r1', operation: 'release', uri: metadata.uri })
        .operation
    ).toBe('release');
  });

  it('资源控制请求非法返回 BRIDGE_INTERNAL', () => {
    expectCode(() => decodeResourceControlRequest({}), 'BRIDGE_INTERNAL');
    expectCode(
      () => decodeResourceControlRequest({ requestId: 'r1', operation: 'write', uri: 'x' }),
      'BRIDGE_INTERNAL'
    );
    expectCode(
      () => decodeResourceControlRequest({ requestId: 'r1', operation: 'open', uri: '' }),
      'BRIDGE_INTERNAL'
    );
  });

  it('编码资源控制成功与失败并以普通对象承载错误', () => {
    expect(encodeResourceControlSuccess('r1', metadata)).toEqual({
      requestId: 'r1',
      ok: true,
      metadata,
    });
    expect(encodeResourceControlSuccess('r1', null).metadata).toBeNull();
    const failure = encodeResourceControlFailure('r1', new Error('boom'));
    expect(failure).toMatchObject({ requestId: 'r1', ok: false });
    expect(failure.ok === false ? failure.error.code : '').toBe('BRIDGE_INTERNAL');
    const passthrough = encodeResourceControlFailure(
      'r1',
      new ChipsError({ code: 'RESOURCE_NOT_FOUND', message: '资源不存在' })
    );
    expect(passthrough.ok === false ? passthrough.error.code : '').toBe('RESOURCE_NOT_FOUND');
  });

  it('解码资源控制响应', () => {
    expect(decodeResourceControlResponse({ requestId: 'r1', ok: true, metadata })).toEqual({
      requestId: 'r1',
      ok: true,
      metadata,
    });
    expect(decodeResourceControlResponse({ requestId: 'r1', ok: true, metadata: null })).toEqual({
      requestId: 'r1',
      ok: true,
      metadata: null,
    });
    expect(
      decodeResourceControlResponse({
        requestId: 'r1',
        ok: false,
        error: { code: 'RESOURCE_BUSY', message: '占用', retryable: true },
      })
    ).toMatchObject({ requestId: 'r1', ok: false });
  });

  it('资源控制响应结构非法返回 BRIDGE_INTERNAL', () => {
    expectCode(() => decodeResourceControlResponse({ requestId: 'r1' }), 'BRIDGE_INTERNAL');
    expectCode(
      () => decodeResourceControlResponse({ requestId: 'r1', ok: true, metadata: { uri: 1 } }),
      'BRIDGE_INTERNAL'
    );
    expectCode(
      () => decodeResourceControlResponse({ requestId: 'r1', ok: false, error: {} }),
      'BRIDGE_INTERNAL'
    );
  });
});

describe('event:control 编解码', () => {
  it('解码订阅控制请求', () => {
    expect(
      decodeEventControlRequest({ controlId: 'c1', action: 'subscribe', eventId: 'file:changed' })
    ).toEqual({ controlId: 'c1', action: 'subscribe', eventId: 'file:changed' });
  });

  it('订阅控制请求非法返回 BRIDGE_INTERNAL', () => {
    expectCode(() => decodeEventControlRequest(null), 'BRIDGE_INTERNAL');
    expectCode(
      () => decodeEventControlRequest({ action: 'subscribe', eventId: 'a:b' }),
      'BRIDGE_INTERNAL'
    );
    expectCode(
      () => decodeEventControlRequest({ controlId: 'c1', action: 'add', eventId: 'a:b' }),
      'BRIDGE_INTERNAL'
    );
    expectCode(
      () => decodeEventControlRequest({ controlId: 'c1', action: 'subscribe', eventId: '' }),
      'BRIDGE_INTERNAL'
    );
  });

  it('编码回执成功与失败', () => {
    expect(encodeEventControlSuccess('c1')).toEqual({ controlId: 'c1', ok: true });
    expect(
      encodeEventControlFailure('c1', { code: 'EVENT_NOT_REGISTERED', message: '未登记' })
    ).toEqual({
      controlId: 'c1',
      ok: false,
      error: { code: 'EVENT_NOT_REGISTERED', message: '未登记', retryable: false },
    });
    expect(encodeEventControlFailure('c1', 'bad').ok).toBe(false);
  });

  it('解码订阅回执', () => {
    expect(decodeEventControlResponse({ controlId: 'c1', ok: true })).toEqual({
      controlId: 'c1',
      ok: true,
    });
    const failure = decodeEventControlResponse({
      controlId: 'c1',
      ok: false,
      error: { code: 'EVENT_SUBSCRIBE_DENIED', message: '不可见', retryable: false },
    });
    expect(failure.ok === false ? failure.error.code : '').toBe('EVENT_SUBSCRIBE_DENIED');
  });

  it('订阅回执结构非法返回 BRIDGE_INTERNAL', () => {
    expectCode(() => decodeEventControlResponse({ ok: true }), 'BRIDGE_INTERNAL');
    expectCode(() => decodeEventControlResponse({ controlId: 'c1', ok: 'yes' }), 'BRIDGE_INTERNAL');
    expectCode(
      () => decodeEventControlResponse({ controlId: 'c1', ok: false, error: null }),
      'BRIDGE_INTERNAL'
    );
  });
});

describe('session:permissions 解码', () => {
  it('合法推送解码为规范化结构', () => {
    expect(
      decodeSessionPermissionsUpdate({
        sessionId: 's1',
        grantedPermissions: ['resources:read'],
        permissionVersion: 2,
      })
    ).toEqual({
      sessionId: 's1',
      grantedPermissions: ['resources:read'],
      permissionVersion: 2,
    });
  });

  it('字段非法时返回 undefined（丢弃推送）', () => {
    expect(decodeSessionPermissionsUpdate(null)).toBeUndefined();
    expect(
      decodeSessionPermissionsUpdate({
        sessionId: '',
        grantedPermissions: [],
        permissionVersion: 0,
      })
    ).toBeUndefined();
    expect(
      decodeSessionPermissionsUpdate({
        sessionId: 's1',
        grantedPermissions: [1],
        permissionVersion: 0,
      })
    ).toBeUndefined();
    expect(
      decodeSessionPermissionsUpdate({
        sessionId: 's1',
        grantedPermissions: [],
        permissionVersion: -1,
      })
    ).toBeUndefined();
    expect(
      decodeSessionPermissionsUpdate({
        sessionId: 's1',
        grantedPermissions: [],
        permissionVersion: 1.5,
      })
    ).toBeUndefined();
  });

  it('错误结构类型别名可用于普通对象', () => {
    const plain: IChipsError = { code: 'A_B', message: '文案' };
    expect(plain.code).toBe('A_B');
  });
});
