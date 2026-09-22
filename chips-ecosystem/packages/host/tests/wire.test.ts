import { describe, expect, it } from 'vitest';

import {
  isBridgeRequest,
  isBridgeResponse,
  isEventControlRequest,
  isEventControlResponse,
  isEventEnvelope,
  isResourceControlRequest,
  isResourceControlResponse,
  isSessionPermissionsUpdate,
  isWireChipsError,
  toWireError,
} from '../src/protocol/wire.js';

describe('IPC 消息守卫', () => {
  it('接受合法能力调用请求，拒绝缺少关联键的负载', () => {
    expect(isBridgeRequest({ requestId: 'r1', capabilityId: 'system:info' })).toBe(true);
    expect(isBridgeRequest({ requestId: '', capabilityId: 'system:info' })).toBe(false);
    expect(isBridgeRequest({ capabilityId: 'system:info' })).toBe(false);
    expect(isBridgeRequest(null)).toBe(false);
    expect(isBridgeRequest([])).toBe(false);
  });

  it('请求帧横切 traceId：可选但出现即须非空字符串（工单046 段一）', () => {
    expect(isBridgeRequest({ requestId: 'r1', capabilityId: 'system:info', traceId: 't-1' })).toBe(true);
    expect(isBridgeRequest({ requestId: 'r1', capabilityId: 'system:info', traceId: '' })).toBe(false);
    expect(isBridgeRequest({ requestId: 'r1', capabilityId: 'system:info', traceId: 5 })).toBe(false);
  });

  it('事件信封横切关联键：可选但出现即须非空字符串', () => {
    expect(
      isEventEnvelope({ eventId: 'window:closed', payload: {}, emittedAt: 1, traceId: 't-1', requestId: 'r-1' }),
    ).toBe(true);
    expect(isEventEnvelope({ eventId: 'window:closed', payload: {}, emittedAt: 1, traceId: '' })).toBe(false);
    expect(isEventEnvelope({ eventId: 'window:closed', payload: {}, emittedAt: 1, requestId: 9 })).toBe(false);
  });

  it('区分能力调用响应成功与失败形态', () => {
    expect(isBridgeResponse({ requestId: 'r1', ok: true, result: { platform: 'darwin' } })).toBe(true);
    expect(
      isBridgeResponse({ requestId: 'r1', ok: false, error: { code: 'BRIDGE_INTERNAL', message: '内部错误' } }),
    ).toBe(true);
    expect(isBridgeResponse({ requestId: 'r1', ok: false, error: { code: '', message: 'x' } })).toBe(false);
    expect(isBridgeResponse({ requestId: 'r1', ok: true })).toBe(false);
    expect(isBridgeResponse({ requestId: 'r1', ok: 'yes', result: 1 })).toBe(false);
  });

  it('校验资源控制请求与响应', () => {
    expect(isResourceControlRequest({ requestId: 'r1', operation: 'open', uri: 'chips-resource://platform/a' })).toBe(
      true,
    );
    expect(isResourceControlRequest({ requestId: 'r1', operation: 'delete', uri: 'x' })).toBe(false);
    expect(isResourceControlRequest({ requestId: 'r1', operation: 'open' })).toBe(false);
    expect(isResourceControlResponse({ requestId: 'r1', ok: true, metadata: null })).toBe(true);
    expect(
      isResourceControlResponse({
        requestId: 'r1',
        ok: true,
        metadata: { uri: 'x', size: 1, mimeType: 'text/plain', version: '1', scope: 'platform' },
      }),
    ).toBe(true);
    expect(isResourceControlResponse({ requestId: 'r1', ok: false, error: { code: 'c', message: 'm' } })).toBe(true);
    expect(isResourceControlResponse({ requestId: 'r1', ok: false, error: null })).toBe(false);
  });

  it('校验事件控制消息', () => {
    expect(isEventControlRequest({ controlId: 'c1', action: 'subscribe', eventId: 'window:closed' })).toBe(true);
    expect(isEventControlRequest({ controlId: 'c1', action: 'emit', eventId: 'x' })).toBe(false);
    expect(isEventControlResponse({ controlId: 'c1', ok: true })).toBe(true);
    expect(
      isEventControlResponse({
        controlId: 'c1',
        ok: false,
        error: { code: 'EVENT_NOT_REGISTERED', message: '未登记' },
      }),
    ).toBe(true);
    expect(isEventControlResponse({ controlId: 'c1' })).toBe(false);
  });

  it('校验事件信封与会话权限快照', () => {
    expect(isEventEnvelope({ eventId: 'window:closed', payload: {}, emittedAt: 1 })).toBe(true);
    expect(isEventEnvelope({ eventId: 'window:closed', emittedAt: 1 })).toBe(false);
    expect(
      isSessionPermissionsUpdate({ sessionId: 's1', grantedPermissions: ['resources:read'], permissionVersion: 2 }),
    ).toBe(true);
    expect(isSessionPermissionsUpdate({ sessionId: 's1', grantedPermissions: [1], permissionVersion: 2 })).toBe(false);
    expect(isSessionPermissionsUpdate({ sessionId: 's1', grantedPermissions: [], permissionVersion: '2' })).toBe(false);
  });

  it('校验错误形状', () => {
    expect(isWireChipsError({ code: 'BRIDGE_INTERNAL', message: '内部错误' })).toBe(true);
    expect(isWireChipsError({ code: 'x', message: 'y', retryable: true, details: { a: 1 } })).toBe(true);
    expect(isWireChipsError({ code: 'x', message: 'y', retryable: 'true' })).toBe(false);
    expect(isWireChipsError(undefined)).toBe(false);
  });
});

describe('toWireError', () => {
  it('保留已登记错误码与 retryable', () => {
    const error = toWireError({
      code: 'RESOURCE_NOT_FOUND',
      message: '资源不存在',
      retryable: true,
      details: { a: 1 },
    });
    expect(error).toEqual({
      code: 'RESOURCE_NOT_FOUND',
      message: '资源不存在',
      retryable: true,
      details: { a: 1 },
    });
  });

  it('把带 code 的 Error 归一为协议错误', () => {
    const error = Object.assign(new Error('读取失败'), { code: 'RESOURCE_INTERNAL' });
    expect(toWireError(error)).toEqual({ code: 'RESOURCE_INTERNAL', message: '读取失败', retryable: false });
  });

  it('未识别异常归一为 BRIDGE_INTERNAL，不泄露原始信息', () => {
    expect(toWireError(new Error('内部细节')).code).toBe('BRIDGE_INTERNAL');
    expect(toWireError('字符串异常')).toEqual({
      code: 'BRIDGE_INTERNAL',
      message: '宿主内部错误',
      retryable: false,
    });
  });
});
