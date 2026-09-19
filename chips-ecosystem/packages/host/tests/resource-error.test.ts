import { describe, expect, it } from 'vitest';

import {
  isResourceErrorCode,
  needsCorsHeader,
  resourceErrorMessage,
  resourceErrorStatus,
  RESOURCE_SECURITY_HEADERS,
} from '../src/protocol/resource-error.js';

describe('资源错误映射', () => {
  it('已登记错误码映射到既定 HTTP 状态', () => {
    expect(resourceErrorStatus('RESOURCE_INVALID_URI')).toBe(400);
    expect(resourceErrorStatus('RESOURCE_PATH_INVALID')).toBe(400);
    expect(resourceErrorStatus('RESOURCE_PERMISSION_DENIED')).toBe(403);
    expect(resourceErrorStatus('RESOURCE_NOT_FOUND')).toBe(404);
    expect(resourceErrorStatus('RESOURCE_ALREADY_EXISTS')).toBe(409);
    expect(resourceErrorStatus('RESOURCE_TOO_LARGE')).toBe(413);
    expect(resourceErrorStatus('RESOURCE_NOT_SUPPORTED')).toBe(501);
    expect(resourceErrorStatus('RESOURCE_NETWORK_FAILED')).toBe(502);
    expect(resourceErrorStatus('RESOURCE_INTERNAL')).toBe(500);
  });

  it('未登记错误码按内部错误兜底', () => {
    expect(isResourceErrorCode('NOT_A_CODE')).toBe(false);
    expect(resourceErrorStatus('NOT_A_CODE')).toBe(500);
    expect(resourceErrorMessage('NOT_A_CODE')).toBe('资源读取失败');
  });

  it('错误文案为简体中文且不含内部标识', () => {
    for (const code of ['RESOURCE_INVALID_URI', 'RESOURCE_NOT_FOUND', 'RESOURCE_PERMISSION_DENIED'] as const) {
      expect(resourceErrorMessage(code)).not.toContain('RESOURCE_');
      expect(resourceErrorMessage(code).length).toBeGreaterThan(0);
    }
  });

  it('固定安全头包含 nosniff 与 no-store', () => {
    expect(RESOURCE_SECURITY_HEADERS).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
  });
});

describe('needsCorsHeader', () => {
  it('模块脚本、字体与媒体需要 CORS', () => {
    expect(needsCorsHeader('text/javascript; charset=utf-8')).toBe(true);
    expect(needsCorsHeader('application/javascript')).toBe(true);
    expect(needsCorsHeader('application/json')).toBe(true);
    expect(needsCorsHeader('application/wasm')).toBe(true);
    expect(needsCorsHeader('font/woff2')).toBe(true);
    expect(needsCorsHeader('audio/mpeg')).toBe(true);
    expect(needsCorsHeader('video/mp4')).toBe(true);
  });

  it('图片、HTML 与未知类型不附加 CORS', () => {
    expect(needsCorsHeader('image/png')).toBe(false);
    expect(needsCorsHeader('text/html')).toBe(false);
    expect(needsCorsHeader(undefined)).toBe(false);
  });
});
