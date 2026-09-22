import { describe, expect, it } from 'vitest';

import {
  assertSecureRenderFrameCsp,
  assertSecureWebPreferences,
  buildWindowWebPreferences,
  createSecureWindowWebPreferences,
  isAllowedWindowLoadUrl,
  MAIN_WINDOW_CSP,
  RENDER_FRAME_CSP,
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

describe('createSecureWindowWebPreferences：唯一构造工厂（工单043-A4 硬闸+显式钉死）', () => {
  it('产物逐项显式钉死基线值：sandbox/contextIsolation/nodeIntegration 不依赖 Electron 默认值', () => {
    const preferences = createSecureWindowWebPreferences({
      preload: '/app/dist/preload/index.js',
      partition: 'chips-window-pal-1',
    });
    expect(preferences['nodeIntegration']).toBe(false);
    expect(preferences['contextIsolation']).toBe(true);
    expect(preferences['sandbox']).toBe(true);
    for (const [key, expected] of Object.entries(WINDOW_SECURITY_BASELINE)) {
      expect(preferences[key], `基线项 ${key} 必须显式钉死`).toBe(expected);
    }
    expect(preferences['preload']).toBe('/app/dist/preload/index.js');
    expect(preferences['partition']).toBe('chips-window-pal-1');
    expect(Object.isFrozen(preferences)).toBe(true);
  });

  it('unsafe shape rejected：任一基线项被危险翻转的形态都过不了 assert 闸', () => {
    const secure = createSecureWindowWebPreferences({ preload: '/p.js' });
    const unsafeShapes: Record<string, unknown>[] = [
      { ...secure, sandbox: false },
      { ...secure, nodeIntegration: true },
      { ...secure, contextIsolation: false },
      { ...secure, webSecurity: false },
      { ...secure, webviewTag: true },
      { ...secure, allowRunningInsecureContent: true },
      { ...secure, experimentalFeatures: true },
      { ...secure, nodeIntegrationInSubFrames: true },
      { ...secure, sandbox: undefined },
      { ...secure, contextIsolation: 'truthy' },
    ];
    for (const shape of unsafeShapes) {
      expect(() => assertSecureWebPreferences(shape)).toThrow(/窗口安全基线被破坏/);
    }
  });

  it('preload 缺位即拒绝构造（工厂不破防）', () => {
    expect(() => createSecureWindowWebPreferences({ preload: '' })).toThrow('窗口 webPreferences 缺少 preload 路径');
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

describe('渲染帧 CSP：唯一交付面 + 硬闸（#190-N-3，比照 A4 母型）', () => {
  it('RENDER_FRAME_CSP 与《05.04》§4.3 渲染帧权威形逐指令一致（卡片帧活臂 frame-src none）', () => {
    expect(RENDER_FRAME_CSP).toBe(
      [
        "default-src 'none'",
        'script-src chips-resource:',
        "style-src chips-resource: 'unsafe-inline'",
        'img-src chips-resource: data:',
        'media-src chips-resource:',
        'font-src chips-resource:',
        "connect-src 'none'",
        "frame-src 'none'",
        "object-src 'none'",
        'base-uri chips-resource:',
        "form-action 'none'",
      ].join('; '),
    );
    // 收紧清单逐值：帧形不得携带主窗口形的任何放宽。
    expect(RENDER_FRAME_CSP).not.toContain("'self'");
    expect(RENDER_FRAME_CSP).toContain("connect-src 'none'");
    expect(RENDER_FRAME_CSP).not.toContain("'unsafe-eval'");
    expect(RENDER_FRAME_CSP.match(/'unsafe-inline'/g)).toHaveLength(1); // 仅 style-src 一处（权威形在册）
    expect(() => assertSecureRenderFrameCsp(RENDER_FRAME_CSP)).not.toThrow();
  });

  it('unsafe shape rejected：主窗口形、缺 connect-src、逐值放宽与权威外追加都被硬闸拒绝', () => {
    const frameCspOf = (overrides: Record<string, string | null>): string =>
      RENDER_FRAME_CSP.split('; ')
        .map((directive) => {
          const name = directive.slice(0, directive.search(/\s/));
          if (name in overrides) {
            return overrides[name];
          }
          return directive;
        })
        .filter((directive) => directive !== null)
        .join('; ');
    // 1) 直接携带主窗口形（帧形收紧前的旧漂移）必红。
    expect(() => assertSecureRenderFrameCsp(MAIN_WINDOW_CSP)).toThrow(/渲染帧 CSP/);
    const unsafeForms: string[] = [
      frameCspOf({ 'default-src': "'self'" }),
      frameCspOf({ 'script-src': "'self' chips-resource:" }),
      frameCspOf({ 'script-src': "chips-resource: 'unsafe-inline'" }),
      frameCspOf({ 'connect-src': null }), // 缺 connect-src 'none'（回落 default-src 即网络直连面）
      frameCspOf({ 'connect-src': "'self'" }),
      frameCspOf({ 'connect-src': 'chips-resource:' }),
      frameCspOf({ 'frame-src': 'chips-resource:' }), // 布局帧臂未随帧种类下发机制落地前不得入活臂
      frameCspOf({ 'img-src': "'self' chips-resource: data:" }),
      frameCspOf({ 'base-uri': "'self'" }),
      frameCspOf({ 'form-action': "'none' https:" }),
    ];
    for (const form of unsafeForms) {
      expect(() => assertSecureRenderFrameCsp(form), form).toThrow(/渲染帧 CSP 被放宽/);
    }
    // 权威形之外的追加指令与重复指令同判漂移拒绝。
    expect(() => assertSecureRenderFrameCsp(`${RENDER_FRAME_CSP}; worker-src 'self'`)).toThrow(
      /权威形之外的指令 worker-src/,
    );
    expect(() => assertSecureRenderFrameCsp(`${RENDER_FRAME_CSP}; script-src 'none'`)).toThrow(/script-src/);
    expect(() => assertSecureRenderFrameCsp('')).toThrow(/缺少权威指令 default-src/);
  });
});
