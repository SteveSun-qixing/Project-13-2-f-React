/**
 * 网页嵌入面：srcdoc 组装（安全语义保留）与视口同步协议 DOM 实现。
 *
 * 旧 `resource-loader.ts` 的 srcdoc 安全语义与视口同步语义按矩阵 L38 口径保留：
 * - srcdoc 臂经 `<base href="{受管包目录 URI}">` 让嵌套页相对引用由帧内资源协议解析；
 * - 视口载荷经 postMessage 下发 + 同源可达文档直写（CSS 变量、data 属性、全局键、
 *   viewport-change 事件），旧桥脚本的 vh 单位改写 / 视口度量覆写 / 内容高度回报
 *   逐行保留；
 * - `file://`、裸路径与旧 Bridge `file.read` 协议耦合整体废弃（R13、R17）。
 */

import {
  CONTENT_HEIGHT_MESSAGE_TYPE,
  VIEWPORT_EVENT,
  VIEWPORT_GLOBAL_KEY,
  VIEWPORT_MESSAGE_TYPE,
  normalizeViewportPayload,
  type IWebpageViewportPayload,
} from './config';

/** 解析受管基址下的包内相对路径为 `chips-resource://` URI；非受管结果返回 `null`。 */
export function resolveCardResourceUri(baseUri: string, relativePath: string): string | null {
  if (relativePath.length === 0 || relativePath.startsWith('/') || relativePath.includes('\\')) {
    return null;
  }
  // 穿段路径在资源协议侧属 RESOURCE_PATH_INVALID；解析前先拒绝，不依赖 URL 归一。
  if (/(^|\/)\.\.(\/|$)/.test(relativePath)) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(relativePath, baseUri);
  } catch {
    return null;
  }

  // 作用域由平台分配：插件只消费帧注入基址（08 §8.3 规则 4），非受管协议一律拒绝。
  if (resolved.protocol !== 'chips-resource:') {
    return null;
  }
  return resolved.toString();
}

/** 转义 HTML 属性值敏感字符。 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 防止脚本内容提前终止 `<script>` 标签。 */
function escapeScriptContent(value: string): string {
  return value.replace(/<\/script/gi, '<\\/script');
}

/** 嵌套页内视口同步桥脚本（vh 单位改写、视口度量覆写、内容高度回报）。 */
export function createViewportBridgeScript(payload: unknown): string {
  const initialPayload = JSON.stringify(normalizeViewportPayload(payload)).replace(/</g, '\\u003c');

  return escapeScriptContent(
    [
      '(function () {',
      `  var VIEWPORT_MESSAGE_TYPE = ${JSON.stringify(VIEWPORT_MESSAGE_TYPE)};`,
      `  var VIEWPORT_EVENT = ${JSON.stringify(VIEWPORT_EVENT)};`,
      `  var CONTENT_HEIGHT_MESSAGE_TYPE = ${JSON.stringify(CONTENT_HEIGHT_MESSAGE_TYPE)};`,
      `  var GLOBAL_KEY = ${JSON.stringify(VIEWPORT_GLOBAL_KEY)};`,
      "  var VIRTUAL_VH_CSS_VAR = '--chips-webpage-card-virtual-vh';",
      "  var viewportHeightUnitPattern = /(-?\\d*\\.?\\d+)(dvh|svh|lvh|vh)\\b/gi;",
      `  var initialPayload = ${initialPayload};`,
      '  var viewportState = null;',
      '  var rewriteFrame = 0;',
      '  function asNumber(value) {',
      "    return typeof value === 'number' && isFinite(value) ? Math.max(0, Math.round(value)) : 0;",
      '  }',
      '  function normalizePayload(payload) {',
      '    return {',
      '      version: 1,',
      "      displayMode: payload && payload.displayMode === 'free' ? 'free' : 'fixed',",
      "      fixedRatio: '7:16',",
      '      width: asNumber(payload && payload.width),',
      '      height: asNumber(payload && payload.height),',
      '      baseHeight: asNumber(payload && payload.baseHeight),',
      '      maxHeight: asNumber(payload && payload.maxHeight),',
      '      scrollMode: Boolean(payload && payload.scrollMode),',
      '    };',
      '  }',
      '  function convertViewportHeightUnits(value) {',
      "    if (typeof value !== 'string' || value.indexOf('vh') === -1 || value.indexOf(VIRTUAL_VH_CSS_VAR) !== -1) {",
      '      return value;',
      '    }',
      '    return value.replace(viewportHeightUnitPattern, function (_match, amount) {',
      "      return 'calc(var(' + VIRTUAL_VH_CSS_VAR + ', 1vh) * ' + amount + ')';",
      '    });',
      '  }',
      '  function rewriteStyleDeclaration(style) {',
      '    if (!style) {',
      '      return;',
      '    }',
      '    for (var index = 0; index < style.length; index += 1) {',
      '      var propertyName = style[index];',
      '      var propertyValue = style.getPropertyValue(propertyName);',
      '      var nextValue = convertViewportHeightUnits(propertyValue);',
      '      if (nextValue !== propertyValue) {',
      '        style.setProperty(propertyName, nextValue, style.getPropertyPriority(propertyName));',
      '      }',
      '    }',
      '  }',
      '  function rewriteCssRules(rules) {',
      '    if (!rules) {',
      '      return;',
      '    }',
      '    for (var index = 0; index < rules.length; index += 1) {',
      '      var rule = rules[index];',
      '      if (rule && rule.style) {',
      '        rewriteStyleDeclaration(rule.style);',
      '      }',
      '      if (rule && rule.cssRules) {',
      '        try {',
      '          rewriteCssRules(rule.cssRules);',
      '        } catch (_error) {',
      '          void _error;',
      '        }',
      '      }',
      '    }',
      '  }',
      '  function rewriteAccessibleStylesheets() {',
      '    var styleSheets = document.styleSheets;',
      '    for (var index = 0; index < styleSheets.length; index += 1) {',
      '      try {',
      '        rewriteCssRules(styleSheets[index].cssRules);',
      '      } catch (_error) {',
      '        void _error;',
      '      }',
      '    }',
      '  }',
      '  function rewriteInlineViewportUnits(rootNode) {',
      '    if (!rootNode) {',
      '      return;',
      '    }',
      '    if (rootNode.style) {',
      '      rewriteStyleDeclaration(rootNode.style);',
      '    }',
      "    if (typeof rootNode.querySelectorAll !== 'function') {",
      '      return;',
      '    }',
      "    var nodes = rootNode.querySelectorAll('[style]');",
      '    for (var index = 0; index < nodes.length; index += 1) {',
      '      rewriteStyleDeclaration(nodes[index].style);',
      '    }',
      '  }',
      '  function rewriteViewportUnits() {',
      '    rewriteAccessibleStylesheets();',
      '    rewriteInlineViewportUnits(document.documentElement);',
      '  }',
      '  function scheduleViewportUnitRewrite() {',
      '    if (rewriteFrame) {',
      '      return;',
      '    }',
      "    var schedule = typeof window.requestAnimationFrame === 'function'",
      '      ? function (callback) { return window.requestAnimationFrame(callback); }',
      '      : function (callback) { return window.setTimeout(callback, 0); };',
      '    rewriteFrame = schedule(function () {',
      '      rewriteFrame = 0;',
      '      rewriteViewportUnits();',
      '    });',
      '  }',
      '  function tryDefineWindowMetric(name, getter) {',
      '    try {',
      "      Object.defineProperty(window, name, {",
      '        configurable: true,',
      '        enumerable: true,',
      '        get: getter,',
      '      });',
      '    } catch (_error) {',
      '      void _error;',
      '    }',
      '  }',
      '  function installViewportMetricOverrides() {',
      "    tryDefineWindowMetric('innerHeight', function () {",
      '      return viewportState ? viewportState.height : 0;',
      '    });',
      "    tryDefineWindowMetric('outerHeight', function () {",
      '      return viewportState ? viewportState.height : 0;',
      '    });',
      '    try {',
      '      var root = document.documentElement;',
      '      if (root) {',
      "        Object.defineProperty(root, 'clientHeight', {",
      '          configurable: true,',
      '          get: function () {',
      '            return viewportState ? viewportState.height : 0;',
      '          },',
      '        });',
      '      }',
      '    } catch (_error) {',
      '      void _error;',
      '    }',
      '  }',
      '  function dispatchVirtualResize() {',
      '    try {',
      '      var EventCtor = window.Event;',
      "      if (typeof EventCtor === 'function') {",
      "        window.dispatchEvent(new EventCtor('resize'));",
      '      }',
      '    } catch (_error) {',
      '      void _error;',
      '    }',
      '  }',
      '  function applyPayload(payload) {',
      '    var nextPayload = normalizePayload(payload || initialPayload);',
      '    var previousWidth = viewportState ? viewportState.width : 0;',
      '    var previousHeight = viewportState ? viewportState.height : 0;',
      '    viewportState = nextPayload;',
      '    var root = document.documentElement;',
      '    if (root && root.style) {',
      "      root.style.setProperty('--chips-webpage-card-viewport-width', nextPayload.width + 'px');",
      "      root.style.setProperty('--chips-webpage-card-viewport-height', nextPayload.height + 'px');",
      "      root.style.setProperty('--chips-webpage-card-base-height', nextPayload.baseHeight + 'px');",
      "      root.style.setProperty('--chips-webpage-card-max-height', nextPayload.maxHeight + 'px');",
      "      root.style.setProperty(VIRTUAL_VH_CSS_VAR, (Math.max(1, nextPayload.height) / 100) + 'px');",
      "      root.style.setProperty('--chips-webpage-card-scroll-mode', nextPayload.scrollMode ? '1' : '0');",
      "      root.setAttribute('data-chips-webpage-card-display-mode', nextPayload.displayMode);",
      "      root.setAttribute('data-chips-webpage-card-fixed-ratio', nextPayload.fixedRatio);",
      "      root.setAttribute('data-chips-webpage-card-scroll-mode', nextPayload.scrollMode ? 'true' : 'false');",
      '    }',
      '    window[GLOBAL_KEY] = nextPayload;',
      '    scheduleViewportUnitRewrite();',
      '    try {',
      '      var CustomEventCtor = window.CustomEvent;',
      "      if (typeof CustomEventCtor === 'function') {",
      "        window.dispatchEvent(new CustomEventCtor(VIEWPORT_EVENT, { detail: nextPayload }));",
      '      }',
      '    } catch (_error) {',
      '      void _error;',
      '    }',
      '    if (nextPayload.width !== previousWidth || nextPayload.height !== previousHeight) {',
      '      dispatchVirtualResize();',
      '    }',
      '  }',
      '  function measureHeight() {',
      '    var root = document.documentElement;',
      '    var body = document.body;',
      '    return Math.max(',
      '      root && root.scrollHeight ? root.scrollHeight : 0,',
      '      root && root.offsetHeight ? root.offsetHeight : 0,',
      '      root && root.clientHeight ? root.clientHeight : 0,',
      '      body && body.scrollHeight ? body.scrollHeight : 0,',
      '      body && body.offsetHeight ? body.offsetHeight : 0,',
      '      body && body.clientHeight ? body.clientHeight : 0',
      '    );',
      '  }',
      '  function reportHeight() {',
      '    try {',
      '      if (!window.parent || window.parent === window) {',
      '        return;',
      '      }',
      '      window.parent.postMessage({',
      '        type: CONTENT_HEIGHT_MESSAGE_TYPE,',
      '        payload: {',
      '          version: 1,',
      '          contentHeight: measureHeight(),',
      '        },',
      "      }, '*');",
      '    } catch (_error) {',
      '      void _error;',
      '    }',
      '  }',
      "  window.addEventListener('message', function (event) {",
      '    var data = event && event.data;',
      '    if (!data || data.type !== VIEWPORT_MESSAGE_TYPE) {',
      '      return;',
      '    }',
      '    applyPayload(data.payload || initialPayload);',
      '    reportHeight();',
      '  });',
      "  if (typeof ResizeObserver === 'function') {",
      '    var resizeObserver = new ResizeObserver(function () {',
      '      scheduleViewportUnitRewrite();',
      '      reportHeight();',
      '    });',
      '    resizeObserver.observe(document.documentElement);',
      '    if (document.body) {',
      '      resizeObserver.observe(document.body);',
      '    }',
      '  }',
      '  try {',
      '    var mutationObserver = new MutationObserver(function () {',
      '      scheduleViewportUnitRewrite();',
      '      reportHeight();',
      '    });',
      '    mutationObserver.observe(document.documentElement, {',
      '      childList: true,',
      '      subtree: true,',
      '      attributes: true,',
      '      characterData: true,',
      '    });',
      '  } catch (_error) {',
      '    void _error;',
      '  }',
      '  installViewportMetricOverrides();',
      "  window.addEventListener('load', function () {",
      '    scheduleViewportUnitRewrite();',
      '    reportHeight();',
      '  });',
      "  if (document.readyState === 'complete' || document.readyState === 'interactive') {",
      '    window.setTimeout(function () {',
      '      scheduleViewportUnitRewrite();',
      '      reportHeight();',
      '    }, 0);',
      '  } else {',
      "    document.addEventListener('DOMContentLoaded', function () {",
      '      scheduleViewportUnitRewrite();',
      '      reportHeight();',
      '    }, { once: true });',
      '  }',
      '  applyPayload(initialPayload);',
      '  reportHeight();',
      '})();',
    ].join('\n'),
  );
}

/** 组装 srcdoc 文档：`<base>` 与视口桥注入（属性与脚本内容双重转义）。 */
export function createSrcDocDocument(
  htmlText: string,
  baseHref: string,
  initialViewport?: IWebpageViewportPayload,
): string {
  const baseTag = `<base href="${escapeHtmlAttribute(baseHref)}" />`;
  const viewportBridge = initialViewport
    ? `<script>${createViewportBridgeScript(initialViewport)}</script>`
    : '';
  if (/<head[\s>]/i.test(htmlText)) {
    return htmlText.replace(/<head([^>]*)>/i, `<head$1>${baseTag}${viewportBridge}`);
  }

  if (/<html[\s>]/i.test(htmlText)) {
    return htmlText.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}${viewportBridge}</head>`);
  }

  return `<!doctype html><html><head>${baseTag}${viewportBridge}</head><body>${htmlText}</body></html>`;
}

function setViewportCssVariable(style: CSSStyleDeclaration, name: string, value: number): void {
  style.setProperty(name, `${Math.max(0, Math.round(value))}px`);
}

/** 把归一视口载荷直写可达文档（CSS 变量、data 属性、全局键、viewport-change 事件）。 */
export function applyViewportPayloadToDocument(
  doc: Document,
  payload: IWebpageViewportPayload,
): void {
  const normalizedPayload = normalizeViewportPayload(payload);
  const root = doc.documentElement;
  if (!root) {
    return;
  }

  setViewportCssVariable(root.style, '--chips-webpage-card-viewport-width', normalizedPayload.width);
  setViewportCssVariable(root.style, '--chips-webpage-card-viewport-height', normalizedPayload.height);
  setViewportCssVariable(root.style, '--chips-webpage-card-base-height', normalizedPayload.baseHeight);
  setViewportCssVariable(root.style, '--chips-webpage-card-max-height', normalizedPayload.maxHeight);
  root.style.setProperty('--chips-webpage-card-scroll-mode', normalizedPayload.scrollMode ? '1' : '0');
  root.setAttribute('data-chips-webpage-card-display-mode', normalizedPayload.displayMode);
  root.setAttribute('data-chips-webpage-card-fixed-ratio', normalizedPayload.fixedRatio);
  root.setAttribute('data-chips-webpage-card-scroll-mode', normalizedPayload.scrollMode ? 'true' : 'false');

  const frameWindow = doc.defaultView;
  if (!frameWindow) {
    return;
  }

  (frameWindow as { [VIEWPORT_GLOBAL_KEY]?: IWebpageViewportPayload })[VIEWPORT_GLOBAL_KEY] =
    normalizedPayload;
  try {
    const CustomEventCtor =
      typeof frameWindow.CustomEvent === 'function'
        ? frameWindow.CustomEvent
        : typeof CustomEvent === 'function'
          ? CustomEvent
          : undefined;
    if (CustomEventCtor) {
      frameWindow.dispatchEvent(new CustomEventCtor(VIEWPORT_EVENT, { detail: normalizedPayload }));
    }
  } catch {
    // 极简环境下自定义事件派发失败可忽略。
  }
}

/** 向嵌套帧下发视口载荷：postMessage 协议臂 + 同源可达文档直写臂。 */
export function publishViewportToFrame(
  frame: HTMLIFrameElement,
  payload: IWebpageViewportPayload,
): void {
  const normalizedPayload = normalizeViewportPayload(payload);

  try {
    if (frame.contentDocument) {
      applyViewportPayloadToDocument(frame.contentDocument, normalizedPayload);
    }
  } catch {
    // 跨源文档只能接收 postMessage。
  }

  try {
    frame.contentWindow?.postMessage({
      type: VIEWPORT_MESSAGE_TYPE,
      payload: normalizedPayload,
    }, '*');
  } catch {
    // 嵌套帧尚未就绪时忽略。
  }
}

/** 取文档各量测值最大值（同源可达文档的内容高度）。 */
export function measureDocumentHeight(doc: Document): number {
  const documentElement = doc.documentElement as
    | (HTMLElement & { scrollHeight?: number; offsetHeight?: number; clientHeight?: number })
    | null;
  const body = doc.body as
    | (HTMLElement & { scrollHeight?: number; offsetHeight?: number; clientHeight?: number })
    | null;

  return Math.max(
    documentElement?.scrollHeight ?? 0,
    documentElement?.offsetHeight ?? 0,
    documentElement?.clientHeight ?? 0,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    body?.clientHeight ?? 0,
  );
}

/** about:blank 空文档判定：iframe 加载被目标站拒绝时的可观测形态。 */
export function isLikelyBlockedDocument(doc: Document): boolean {
  const body = doc.body as { textContent?: string | null; childElementCount?: number } | null;
  const bodyText = body?.textContent?.trim() ?? '';
  const bodyChildCount = body?.childElementCount ?? 0;
  return doc.URL === 'about:blank' && bodyText.length === 0 && bodyChildCount === 0;
}
