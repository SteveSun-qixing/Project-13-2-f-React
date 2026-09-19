import { describe, expect, it } from 'vitest';

import {
  assertSecureWebPreferences,
  buildWindowWebPreferences,
  isAllowedWindowLoadUrl,
  MAIN_WINDOW_CSP,
  WINDOW_SECURITY_BASELINE,
} from '../src/main/window-security.js';

describe('窗口安全基线', () => {
  it('基线固定关闭 nodeIntegration、开启隔离与沙箱', () => {
    expect(WINDOW_SECURITY_BASELINE.nodeIntegration).toBe(false);
    expect(WINDOW_SECURITY_BASELINE.contextIsolation).toBe(true);
    expect(WINDOW_SECURITY_BASELINE.sandbox).toBe(true);
    expect(WINDOW_SECURITY_BASELINE.webSecurity).toBe(true);
    expect(WINDOW_SECURITY_BASELINE.webviewTag).toBe(false);
  });

  it('构造 webPreferences 时带上 preload、partition 与附加参数', () => {
    const preferences = buildWindowWebPreferences({
      preload: '/app/dist/preload/index.js',
      partition: 'chips-window-1',
      additionalArguments: ['--chips-window-id=1'],
    });
    expect(preferences['preload']).toBe('/app/dist/preload/index.js');
    expect(preferences['partition']).toBe('chips-window-1');
    expect(preferences['additionalArguments']).toEqual(['--chips-window-id=1']);
    expect(preferences['sandbox']).toBe(true);
    expect(Object.isFrozen(preferences)).toBe(true);
  });

  it('缺少 preload 路径时拒绝构造', () => {
    expect(() => buildWindowWebPreferences({ preload: '' })).toThrow('窗口 webPreferences 缺少 preload 路径');
  });

  it('校验基线：任一被覆盖即抛出', () => {
    const preferences = buildWindowWebPreferences({ preload: '/p.js' });
    expect(() => assertSecureWebPreferences(preferences)).not.toThrow();
    expect(() => assertSecureWebPreferences({ ...preferences, sandbox: false })).toThrow(
      '窗口安全基线被破坏：sandbox 必须为 true',
    );
  });
});

describe('窗口加载地址白名单', () => {
  it('只放行 chips-resource 规范 URI', () => {
    expect(isAllowedWindowLoadUrl('chips-resource://platform/shell.html')).toBe(true);
    expect(isAllowedWindowLoadUrl('chips-resource://card-1/a.png')).toBe(true);
    expect(isAllowedWindowLoadUrl('file:///Users/me/a.html')).toBe(false);
    expect(isAllowedWindowLoadUrl('https://example.com')).toBe(false);
    expect(isAllowedWindowLoadUrl('/Users/me/a.html')).toBe(false);
  });

  it('主窗口 CSP 覆盖资源协议与脚本源', () => {
    expect(MAIN_WINDOW_CSP).toContain("script-src 'self' chips-resource:");
    expect(MAIN_WINDOW_CSP).toContain("object-src 'none'");
    expect(MAIN_WINDOW_CSP).not.toContain("'unsafe-eval'");
  });
});
