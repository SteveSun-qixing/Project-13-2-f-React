import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_HEIGHT_MESSAGE_TYPE,
  DEFAULT_CONTENT,
  VIEWPORT_EVENT,
  VIEWPORT_GLOBAL_KEY,
  VIEWPORT_MESSAGE_TYPE,
  createViewportPayload,
  normalizeViewportPayload,
} from '../src/config';
import {
  applyViewportPayloadToDocument,
  createSrcDocDocument,
  createViewportBridgeScript,
  escapeHtmlAttribute,
  isLikelyBlockedDocument,
  measureDocumentHeight,
  publishViewportToFrame,
  resolveCardResourceUri,
} from '../src/embed';

const VIEWPORT = createViewportPayload(640, 1463, 1463, DEFAULT_CONTENT, true);

describe('resolveCardResourceUri', () => {
  it('经受管基址解析包内相对路径为 chips-resource URI', () => {
    expect(resolveCardResourceUri('chips-resource://card-7f3a/', 'web-bundle/index.html')).toBe(
      'chips-resource://card-7f3a/web-bundle/index.html',
    );
    expect(resolveCardResourceUri('chips-resource://card-7f3a/', 'web-bundle/')).toBe(
      'chips-resource://card-7f3a/web-bundle/',
    );
  });

  it('拒绝非受管基址与绝对/穿段路径', () => {
    expect(resolveCardResourceUri('about:blank', 'web-bundle/index.html')).toBeNull();
    expect(resolveCardResourceUri('http://localhost:3000/', 'web-bundle/index.html')).toBeNull();
    expect(resolveCardResourceUri('chips-resource://card-7f3a/', 'https://a.com/x')).toBeNull();
    expect(resolveCardResourceUri('chips-resource://card-7f3a/', '../.card/metadata.yaml')).toBeNull();
    expect(resolveCardResourceUri('chips-resource://card-7f3a/', '')).toBeNull();
  });
});

describe('escapeHtmlAttribute', () => {
  it('转义属性敏感字符', () => {
    expect(escapeHtmlAttribute('a&"b<c>d')).toBe('a&amp;&quot;b&lt;c&gt;d');
  });
});

describe('createViewportBridgeScript', () => {
  it('携带协议常量与归一载荷，且不含可逃逸的脚本结束标记', () => {
    const script = createViewportBridgeScript(VIEWPORT);
    expect(script).toContain(JSON.stringify(VIEWPORT_MESSAGE_TYPE));
    expect(script).toContain(JSON.stringify(CONTENT_HEIGHT_MESSAGE_TYPE));
    expect(script).toContain(JSON.stringify(VIEWPORT_EVENT));
    expect(script).toContain(JSON.stringify(VIEWPORT_GLOBAL_KEY));
    expect(script).toContain('"version":1');
    expect(script).toContain('"width":640');
    // 脚本内容不得携带可提前终止标签的结束标记（escapeScriptContent 防逃逸）
    expect(script).not.toContain('</script');
  });

  it('载荷异常时按归一钳位注入', () => {
    const script = createViewportBridgeScript({ width: -5, displayMode: 'stretch' });
    expect(script).toContain('"displayMode":"fixed"');
    expect(script).toContain('"width":0');
  });
});

describe('createSrcDocDocument', () => {
  it('已有 head 时把 base 与视口桥注入 head 起始处', () => {
    const doc = createSrcDocDocument(
      '<!doctype html><html><head><title>t</title></head><body><main>x</main></body></html>',
      'chips-resource://card-7f3a/web-bundle/',
      VIEWPORT,
    );
    expect(doc).toContain('<head><base href="chips-resource://card-7f3a/web-bundle/" /><script>');
    expect(doc).toContain('<title>t</title>');
    expect(doc).toContain('<main>x</main>');
  });

  it('无 head 的 html 文档自动补 head', () => {
    const doc = createSrcDocDocument('<html><body>x</body></html>', 'chips-resource://card-7f3a/b/');
    expect(doc).toContain('<html><head><base href="chips-resource://card-7f3a/b/" />');
    expect(doc).toContain('</head><body>x</body>');
  });

  it('纯片段包一层完整文档', () => {
    const doc = createSrcDocDocument('<p>hello</p>', 'chips-resource://card-7f3a/b/');
    expect(doc).toBe(
      '<!doctype html><html><head><base href="chips-resource://card-7f3a/b/" />' +
        '</head><body><p>hello</p></body></html>',
    );
  });

  it('baseHref 中的引号被转义，初始视口缺省时不注入桥脚本', () => {
    const doc = createSrcDocDocument('<p>x</p>', 'chips-resource://card-7f3a/a"b/');
    expect(doc).toContain('<base href="chips-resource://card-7f3a/a&quot;b/" />');
    expect(doc).not.toContain('<script>');
  });
});

describe('applyViewportPayloadToDocument', () => {
  it('写入 CSS 变量、data 属性、全局键并派发 viewport-change 事件', () => {
    const listener = vi.fn();
    // 载荷直写派发在文档默认视图（window）上
    window.addEventListener(VIEWPORT_EVENT, listener as EventListener);
    try {
      applyViewportPayloadToDocument(document, VIEWPORT);
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--chips-webpage-card-viewport-width')).toBe('640px');
      expect(root.style.getPropertyValue('--chips-webpage-card-viewport-height')).toBe('1463px');
      expect(root.style.getPropertyValue('--chips-webpage-card-base-height')).toBe('1463px');
      expect(root.style.getPropertyValue('--chips-webpage-card-max-height')).toBe('1463px');
      expect(root.style.getPropertyValue('--chips-webpage-card-scroll-mode')).toBe('1');
      expect(root.getAttribute('data-chips-webpage-card-display-mode')).toBe('fixed');
      expect(root.getAttribute('data-chips-webpage-card-fixed-ratio')).toBe('7:16');
      expect(root.getAttribute('data-chips-webpage-card-scroll-mode')).toBe('true');
      expect((window as unknown as Record<string, unknown>)[VIEWPORT_GLOBAL_KEY]).toEqual(VIEWPORT);
      expect(listener).toHaveBeenCalledTimes(1);
      expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual(VIEWPORT);
    } finally {
      document.removeEventListener(VIEWPORT_EVENT, listener as EventListener);
      delete (window as unknown as Record<string, unknown>)[VIEWPORT_GLOBAL_KEY];
      const root = document.documentElement;
      for (const name of [
        '--chips-webpage-card-viewport-width',
        '--chips-webpage-card-viewport-height',
        '--chips-webpage-card-base-height',
        '--chips-webpage-card-max-height',
        '--chips-webpage-card-scroll-mode',
      ]) {
        root.style.removeProperty(name);
      }
      for (const name of [
        'data-chips-webpage-card-display-mode',
        'data-chips-webpage-card-fixed-ratio',
        'data-chips-webpage-card-scroll-mode',
      ]) {
        root.removeAttribute(name);
      }
    }
  });

  it('缺 documentElement 或 window 时静默返回', () => {
    const doc = document.implementation.createHTMLDocument('');
    expect(() => applyViewportPayloadToDocument(doc, VIEWPORT)).not.toThrow();
  });
});

describe('publishViewportToFrame', () => {
  it('向帧窗口下发视口消息并直写可达文档', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage').mockReturnValue(undefined);
      publishViewportToFrame(frame, VIEWPORT);
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({ type: VIEWPORT_MESSAGE_TYPE, payload: VIEWPORT }, '*');
      // 同源可达文档已直写全局键
      expect(
        (frame.contentWindow as unknown as Record<string, unknown>)[VIEWPORT_GLOBAL_KEY],
      ).toEqual(VIEWPORT);
    } finally {
      frame.remove();
    }
  });

  it('帧未就绪（contentWindow 为空）时静默返回', () => {
    const frame = document.createElement('iframe');
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: null });
    expect(() => publishViewportToFrame(frame, VIEWPORT)).not.toThrow();
  });
});

describe('measureDocumentHeight 与封禁页判定', () => {
  it('取文档各量测值最大值', () => {
    expect(measureDocumentHeight(document)).toBeGreaterThanOrEqual(0);
    const doc = document.implementation.createHTMLDocument('');
    expect(measureDocumentHeight(doc)).toBeGreaterThanOrEqual(0);
  });

  it('about:blank 空文档判为疑似被拒嵌入页', () => {
    const blank = document.implementation.createHTMLDocument('');
    Object.defineProperty(blank, 'URL', { configurable: true, value: 'about:blank' });
    expect(isLikelyBlockedDocument(blank)).toBe(true);
    const withContent = document.implementation.createHTMLDocument('');
    withContent.body.appendChild(withContent.createElement('p'));
    Object.defineProperty(withContent, 'URL', { configurable: true, value: 'about:blank' });
    expect(isLikelyBlockedDocument(withContent)).toBe(false);
    const remote = document.implementation.createHTMLDocument('');
    Object.defineProperty(remote, 'URL', { configurable: true, value: 'https://a.com/' });
    expect(isLikelyBlockedDocument(remote)).toBe(false);
  });
});

describe('normalizeViewportPayload 兜底', () => {
  it('非对象输入回退 fixed 归零载荷', () => {
    expect(normalizeViewportPayload('x')).toEqual({
      version: 1,
      displayMode: 'fixed',
      fixedRatio: '7:16',
      width: 0,
      height: 0,
      baseHeight: 0,
      maxHeight: 0,
      scrollMode: false,
    });
  });
});
