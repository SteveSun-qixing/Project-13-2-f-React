/**
 * 受控文档帧：承载图片模式与 HTML 模式区域。
 *
 * 契约：《08-@chips-ui共享层使用指南》§2.2；沙箱基线见《05-渲染引擎设计》§四
 * （固定 `sandbox="allow-scripts"`、`referrerpolicy="no-referrer"`、不授予任何 `allow` 特性）。
 * `autoHeight` 向 `srcDoc` 注入高度上报脚本，经 postMessage 回传并按上报值显示（含上限系数）。
 */

import { Spin, theme } from '@chips/antd';
import React from 'react';
import type { CSSProperties } from 'react';

import type { EmbeddedDocumentFrameProps } from './types';

/** 高度上报消息类型（帧内脚本与宿主约定）。 */
const HEIGHT_REPORT_TYPE = 'chips.embedded-frame:height';

/** 等待首帧上报的收敛时限；超时后按已测量或上限显示，不再等待。 */
const SETTLE_TIMEOUT_MS = 3_000;

/** 渲染帧沙箱基线与 referrer 策略（《05-渲染引擎设计》§4.2）。 */
const FRAME_SANDBOX = 'allow-scripts';

/** 注入高度上报脚本（请求动画帧 + ResizeObserver + load/resize 事件三重触发）。 */
function buildHeightReporterScript(): string {
  const script = [
    '(function () {',
    '  var lastHeight = -1;',
    '  function measure() {',
    '    var root = document.documentElement;',
    '    var body = document.body;',
    '    return Math.max(',
    '      root ? root.scrollHeight || 0 : 0,',
    '      body ? body.scrollHeight || 0 : 0',
    '    );',
    '  }',
    '  function report() {',
    '    var height = measure();',
    '    if (height > 0 && height !== lastHeight) {',
    '      lastHeight = height;',
    `      window.parent.postMessage({ type: '${HEIGHT_REPORT_TYPE}', height: height }, '*');`,
    '    }',
    '  }',
    '  function reportNextFrame() {',
    '    window.requestAnimationFrame(report);',
    '  }',
    '  report();',
    "  window.addEventListener('load', function () { window.setTimeout(report, 0); });",
    "  window.addEventListener('resize', reportNextFrame);",
    "  if (typeof ResizeObserver === 'function') {",
    '    var observer = new ResizeObserver(reportNextFrame);',
    '    if (document.documentElement) { observer.observe(document.documentElement); }',
    '    if (document.body) { observer.observe(document.body); }',
    '  }',
    '})();',
  ].join('');
  return `<script>${script}</script>`;
}

/** 把高度上报脚本插入 `srcDoc`（优先插在 `</body>` 前）。 */
function injectHeightReporter(srcDoc: string): string {
  const scriptTag = buildHeightReporterScript();
  if (/<\/body>/i.test(srcDoc)) {
    return srcDoc.replace(/<\/body>/i, `${scriptTag}</body>`);
  }
  return `${srcDoc}${scriptTag}`;
}

/** 解析 `16:9` 形式的比例；非法返回 `null`。 */
function parseRatio(ratio: string | undefined): string | null {
  if (ratio === undefined) {
    return null;
  }
  const match = /^(\d+):(\d+)$/.exec(ratio);
  if (match === null) {
    return null;
  }
  return `${match[1]} / ${match[2]}`;
}

/**
 * 沙箱基线收口：只接受 `allow-scripts`，其余取值（含空串与多值组合）一律回到基线，
 * 禁止 `allow-same-origin`、`allow-top-navigation` 等能力（《05-渲染引擎设计》§4.2）。
 */
function normalizeSandbox(sandbox: string | undefined): string {
  return sandbox === FRAME_SANDBOX ? sandbox : FRAME_SANDBOX;
}

type FrameStatus = 'loading' | 'ready' | 'error';

export const EmbeddedDocumentFrame: React.FC<EmbeddedDocumentFrameProps> = ({
  title,
  src,
  srcDoc,
  ratio,
  autoHeight = false,
  maxHeightFactor,
  scope,
  surfaceId,
  sandbox,
  onActivate,
  onFrameReady,
  onFrameError,
}) => {
  const { token } = theme.useToken();
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = React.useState<FrameStatus>('loading');
  const [measuredHeight, setMeasuredHeight] = React.useState<number | null>(null);
  const [settled, setSettled] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState(0);

  const effectiveSrcDoc = React.useMemo(
    () => (autoHeight && srcDoc !== undefined ? injectHeightReporter(srcDoc) : srcDoc),
    [autoHeight, srcDoc]
  );
  const documentSource = src ?? effectiveSrcDoc;
  const useSrcDoc = src === undefined && effectiveSrcDoc !== undefined;

  React.useEffect(() => {
    setStatus('loading');
    setMeasuredHeight(null);
    setSettled(false);
  }, [documentSource]);

  React.useEffect(() => {
    if (!autoHeight) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setSettled(true);
    }, SETTLE_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [autoHeight, documentSource]);

  React.useEffect(() => {
    if (!autoHeight) {
      return undefined;
    }
    const container = containerRef.current;
    if (container === null) {
      return undefined;
    }
    const updateWidth = (): void => {
      setContainerWidth(container.clientWidth);
    };
    updateWidth();
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(updateWidth) : undefined;
    observer?.observe(container);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [autoHeight]);

  React.useEffect(() => {
    if (!autoHeight) {
      return undefined;
    }
    const handleMessage = (event: MessageEvent): void => {
      const frame = frameRef.current;
      if (frame === null || event.source !== frame.contentWindow) {
        return;
      }
      const data = event.data as { type?: unknown; height?: unknown } | undefined;
      if (data === undefined || data.type !== HEIGHT_REPORT_TYPE) {
        return;
      }
      const height = data.height;
      if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
        return;
      }
      setMeasuredHeight(Math.round(height));
      setSettled(true);
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [autoHeight]);

  const containerStyle = React.useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      position: 'relative',
      width: '100%',
      overflow: 'hidden',
      background: 'transparent',
    };
    if (!autoHeight) {
      const aspectRatio = parseRatio(ratio);
      return aspectRatio === null ? base : { ...base, aspectRatio };
    }
    const cap =
      maxHeightFactor !== undefined && containerWidth > 0
        ? maxHeightFactor * containerWidth
        : Number.POSITIVE_INFINITY;
    const height =
      measuredHeight === null
        ? Number.isFinite(cap)
          ? cap
          : undefined
        : Math.min(measuredHeight, cap);
    return height === undefined ? base : { ...base, height: `${Math.round(height)}px` };
  }, [autoHeight, containerWidth, maxHeightFactor, measuredHeight, ratio]);

  // 等待态收口：标准模式以帧加载完成为收敛点；`autoHeight` 以首次高度上报为收敛点，
  // 上报缺失时由收敛时限兜底退出等待（失败态始终以 `加载失败` 占位说明）。
  const waiting = autoHeight ? !settled : status === 'loading';
  const overlayVisible = status === 'error' || waiting;

  const handleLoad = React.useCallback((): void => {
    setStatus('ready');
    onFrameReady?.();
  }, [onFrameReady]);

  const handleError = React.useCallback((): void => {
    setStatus('error');
    onFrameError?.();
  }, [onFrameError]);

  // 帧导航失败由浏览器以不可冒泡的 `error` 事件投递在 iframe 元素自身，
  // React 不为 iframe 代理该事件，故直接挂载原生监听器（随源变化与卸载重建）。
  React.useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) {
      return undefined;
    }
    frame.addEventListener('error', handleError);
    return () => {
      frame.removeEventListener('error', handleError);
    };
  }, [handleError, documentSource]);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLIFrameElement>): void => {
      event.stopPropagation();
      onActivate?.();
    },
    [onActivate]
  );

  return (
    <div ref={containerRef} style={containerStyle}>
      <iframe
        ref={frameRef}
        title={title ?? '嵌入式文档'}
        {...(useSrcDoc ? { srcDoc: effectiveSrcDoc } : { src })}
        sandbox={normalizeSandbox(sandbox)}
        referrerPolicy="no-referrer"
        data-chips-embedded-frame={scope ?? 'embedded-document-frame'}
        {...(surfaceId === undefined ? {} : { 'data-chips-surface-id': surfaceId })}
        style={{
          display: status === 'ready' ? 'block' : 'none',
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
        }}
        onLoad={handleLoad}
        onClick={handleClick}
      />
      {overlayVisible ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: autoHeight ? 'transparent' : token.colorBgLayout,
          }}
        >
          {status === 'error' ? (
            <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
              加载失败
            </span>
          ) : (
            <Spin />
          )}
        </div>
      ) : null}
    </div>
  );
};

export type { EmbeddedDocumentFrameProps } from './types';
