import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { GlobalOutlined, theme } from '@chips/ui';
import { chips } from '@chips/sdk';
import {
  analyzeWebpageUrl,
  calculateFixedViewportHeight,
  calculateViewportLayout,
  CONTENT_HEIGHT_MESSAGE_TYPE,
  createViewportPayload,
  EMBED_DETECTION_TIMEOUT_MS,
  FALLBACK_WIDTH,
  getBundleEntryPath,
  getBundleRootPath,
  MEASURE_INTERVAL_MS,
  MIN_FREE_VIEWPORT_HEIGHT,
  readContent,
  type IWebpageContent,
  type IWebpageViewportPayload,
} from './config';
import {
  createSrcDocDocument,
  isLikelyBlockedDocument,
  measureDocumentHeight,
  publishViewportToFrame,
  resolveCardResourceUri,
} from './embed';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 来源双臂（旧功能覆盖矩阵 L38 重写口径）：
 * - url 臂：合法 http(s) 地址直载于收紧沙箱嵌套帧；
 * - bundle 臂：经帧注入受管基址解析包内入口 → SDK `chips` 客户端真调用 `resource:read`
 *   读取入口文本组装 srcdoc（`<base>` 指向包目录，帧内资源协议解析相对引用）；
 *   读取通道不可用（渲染帧内平台不注入 `window.chips`，08 §5.4）或被拒绝时回退
 *   帧内资源协议 src 臂；仍不可达时以加载超时/失败语义呈现诚实简体中文状态。
 *
 * 视口同步：视口载荷经 postMessage 下发 + 同源可达文档直写；嵌套页内容高度回报驱动
 * free 模式高度展开（上限为宽度 20 倍，超高转滚动）、fixed 模式固定宽:高 7:16 窗内滚动。
 */

const EMPTY_TEXT = '暂无网页内容';
const LOADING_TEXT = '网页加载中…';
const EMBED_BLOCKED_TEXT = '该网页禁止被 iframe 嵌入。';
const LOAD_FAILED_TEXT = '网页加载失败。';
const INVALID_URL_TEXT = '网页地址不合法。';
const BUNDLE_FAILED_TEXT = '网页包加载失败。';

/** 沙箱收紧基线（旧值原样保留：无 allow-same-origin / allow-modals / allow-top-navigation）。 */
const FRAME_SANDBOX = 'allow-scripts allow-forms allow-popups';

interface IWebpageResourceReadOutput {
  readonly uri: string;
  readonly mimeType: string;
  readonly size: number;
  readonly data: Uint8Array;
}

type FrameSource = { kind: 'src'; value: string } | { kind: 'srcdoc'; value: string };

interface IViewportOutcome {
  status: 'ready' | 'error';
  errorText: string;
  height: number;
  scrollMode: boolean;
}

function clampPositiveNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function getMeasureRootWidth(target: HTMLElement | null): number {
  if (!target) {
    return FALLBACK_WIDTH;
  }

  return Math.max(
    1,
    Math.round(target.getBoundingClientRect().width || target.clientWidth || FALLBACK_WIDTH),
  );
}

function getRuntimeViewportHeight(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const candidates: number[] = [];
  try {
    if (window.top && typeof window.top.innerHeight === 'number') {
      candidates.push(window.top.innerHeight);
    }
  } catch {
    // 跨源访问失败时回退本帧量测。
  }

  candidates.push(
    window.screen?.availHeight ?? 0,
    window.screen?.height ?? 0,
    window.innerHeight,
  );

  for (const candidate of candidates) {
    const normalized = clampPositiveNumber(candidate);
    if (normalized > 0) {
      return normalized;
    }
  }

  return 0;
}

function calculateProtocolViewportHeight(width: number, displayMode: IWebpageContent['display_mode']): number {
  const fixedHeight = calculateFixedViewportHeight(width);
  if (displayMode === 'fixed') {
    return fixedHeight;
  }

  const runtimeViewportHeight = getRuntimeViewportHeight();
  if (runtimeViewportHeight <= 0) {
    return fixedHeight;
  }

  return Math.max(MIN_FREE_VIEWPORT_HEIGHT, Math.min(fixedHeight, runtimeViewportHeight));
}

function calculateInitialLayoutHeight(width: number, displayMode: IWebpageContent['display_mode']): number {
  if (displayMode === 'fixed') {
    return calculateFixedViewportHeight(width);
  }

  return MIN_FREE_VIEWPORT_HEIGHT;
}

function getAccessibleFrameDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument ?? null;
  } catch {
    return null;
  }
}

function useContainerWidth(targetRef: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    const update = (): void => {
      setWidth(getMeasureRootWidth(target));
    };

    update();
    if (typeof ResizeObserver !== 'function') {
      return;
    }

    const observer = new ResizeObserver(() => update());
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [targetRef]);

  return width;
}

export interface IWebpageViewProps {
  /** 节点内容原始值（《01-卡片文件格式》§6.5 平铺字段）；缺失或非法时回退默认内容（08 §7.1 规则 2）。 */
  content: unknown;
}

/**
 * 查看态 React 组件：由 `renderView` 挂载；bundle 入口读取经 SDK `chips` 客户端
 * 真调用 `resource:read`，失败回退帧内资源协议 src 臂，不伪造成功。
 */
export function WebpageView({ content }: IWebpageViewProps): ReactElement {
  const { token } = theme.useToken();
  const resolvedContent = useMemo(() => readContent(content), [content]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const width = useContainerWidth(rootRef);

  const hasUrlSource = resolvedContent.source_type === 'url' && resolvedContent.source_url.length > 0;
  const hasBundleSource = resolvedContent.source_type === 'bundle' && resolvedContent.bundle_root.length > 0;
  const urlAnalysis = useMemo(
    () => (hasUrlSource ? analyzeWebpageUrl(resolvedContent.source_url) : null),
    [hasUrlSource, resolvedContent.source_url],
  );

  const baseHeight = calculateInitialLayoutHeight(width, resolvedContent.display_mode);
  const protocolViewportHeight = calculateProtocolViewportHeight(width, resolvedContent.display_mode);
  const [outcome, setOutcome] = useState<IViewportOutcome | null>(null);
  const [bundleFrame, setBundleFrame] = useState<FrameSource | null>(null);
  const baseHeightRef = useRef(baseHeight);
  const viewportPayloadRef = useRef<IWebpageViewportPayload | null>(null);

  useEffect(() => {
    baseHeightRef.current = baseHeight;
  }, [baseHeight]);

  // bundle 双臂：受管基址解析（同步判定）→ resource:read 读取（srcdoc 臂）→ src 臂回退。
  const bundleResolution = useMemo(() => {
    if (!hasBundleSource) {
      return null;
    }
    const entryRelative = getBundleEntryPath(resolvedContent);
    const entryUri = entryRelative ? resolveCardResourceUri(document.baseURI, entryRelative) : null;
    const rootRelative = getBundleRootPath(resolvedContent);
    const dirUri = rootRelative
      ? resolveCardResourceUri(document.baseURI, `${rootRelative}/`) ?? entryUri
      : entryUri;
    return { entryUri, dirUri };
  }, [hasBundleSource, resolvedContent]);

  useEffect(() => {
    if (!bundleResolution?.entryUri || !bundleResolution.dirUri) {
      setBundleFrame(null);
      return;
    }

    let cancelled = false;
    setOutcome(null);
    const entryUri = bundleResolution.entryUri;
    const dirUri = bundleResolution.dirUri;
    chips
      .request<IWebpageResourceReadOutput>('resource:read', { uri: entryUri })
      .then((output) => {
        if (cancelled) {
          return;
        }
        const htmlText = new TextDecoder().decode(output.data);
        setBundleFrame({
          kind: 'srcdoc',
          value: createSrcDocDocument(htmlText, dirUri, viewportPayloadRef.current ?? undefined),
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setBundleFrame({ kind: 'src', value: entryUri });
      });

    return () => {
      cancelled = true;
    };
  }, [bundleResolution]);

  const urlFrame = useMemo<FrameSource | null>(() => {
    if (!urlAnalysis?.openable) {
      return null;
    }
    return { kind: 'src', value: urlAnalysis.normalizedUrl };
  }, [urlAnalysis]);

  const frameSource = hasBundleSource ? bundleFrame : urlFrame;

  // 视口载荷：free 模式外层可按内容高度展开，但嵌套页始终接收稳定协议视口，避免量测反馈回路。
  const viewportPayload = useMemo(
    () =>
      createViewportPayload(
        width,
        protocolViewportHeight,
        baseHeight,
        resolvedContent,
        outcome?.status === 'ready' ? outcome.scrollMode : false,
      ),
    [baseHeight, outcome, protocolViewportHeight, resolvedContent, width],
  );
  viewportPayloadRef.current = viewportPayload;

  const publishViewport = React.useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) {
      return;
    }
    publishViewportToFrame(frame, viewportPayloadRef.current ?? createViewportPayload(
      width,
      protocolViewportHeight,
      baseHeight,
      resolvedContent,
      false,
    ));
  }, [baseHeight, protocolViewportHeight, resolvedContent, width]);

  useEffect(() => {
    setOutcome(null);
  }, [frameSource]);

  // 视口载荷变化时向下发臂补发（load 臂由 iframe onLoad 直接承担）。
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !frameSource) {
      return;
    }
    publishViewportToFrame(frame, viewportPayload);
  }, [frameSource, viewportPayload]);

  // 量测与内容高度回报：同源可达文档直测、嵌套页回报、观测器与轮询兜底（旧量测语义保留）。
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !frameSource) {
      return;
    }
    const frameElement = frame;

    let intervalId = 0;
    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frameWindow: Window | null = null;
    let loadTimeoutId = 0;

    const clearLoadTimeout = (): void => {
      if (loadTimeoutId) {
        window.clearTimeout(loadTimeoutId);
        loadTimeoutId = 0;
      }
    };

    const clearObservers = (): void => {
      clearLoadTimeout();
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      if (frameWindow) {
        frameWindow.removeEventListener('resize', applyFrameResize);
      }
      intervalId = 0;
      mutationObserver = null;
      resizeObserver = null;
      frameWindow = null;
    };

    const applyUnmeasurableFallback = (): void => {
      setOutcome({
        status: 'ready',
        errorText: '',
        height: baseHeight,
        scrollMode: true,
      });
    };

    function applyMeasurement(reportedHeight?: number): void {
      const accessibleDocument = getAccessibleFrameDocument(frameElement);
      if (
        accessibleDocument &&
        resolvedContent.source_type === 'url' &&
        isLikelyBlockedDocument(accessibleDocument)
      ) {
        setOutcome({
          status: 'error',
          errorText: EMBED_BLOCKED_TEXT,
          height: baseHeight,
          scrollMode: false,
        });
        return;
      }

      const measuredHeight =
        typeof reportedHeight === 'number' && Number.isFinite(reportedHeight)
          ? reportedHeight
          : accessibleDocument
            ? measureDocumentHeight(accessibleDocument)
            : 0;

      if (!accessibleDocument && measuredHeight <= 0) {
        applyUnmeasurableFallback();
        return;
      }
      const nextLayout = calculateViewportLayout(measuredHeight, width, resolvedContent, baseHeight);

      setOutcome({
        status: 'ready',
        errorText: '',
        height: nextLayout.height,
        scrollMode: nextLayout.scrollMode,
      });
    }

    const applyFrameResize = (): void => {
      applyMeasurement();
    };

    const attachToFrameDocument = (): void => {
      clearObservers();
      const accessibleDocument = getAccessibleFrameDocument(frameElement);
      if (!accessibleDocument) {
        applyUnmeasurableFallback();
        return;
      }

      applyMeasurement();
      if (resolvedContent.display_mode === 'fixed') {
        return;
      }

      try {
        mutationObserver = new MutationObserver(() => applyMeasurement());
        mutationObserver.observe(accessibleDocument.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      } catch {
        mutationObserver = null;
      }

      try {
        if (typeof ResizeObserver === 'function') {
          resizeObserver = new ResizeObserver(() => applyMeasurement());
          resizeObserver.observe(accessibleDocument.documentElement);
          if (accessibleDocument.body) {
            resizeObserver.observe(accessibleDocument.body);
          }
        }
      } catch {
        resizeObserver = null;
      }

      try {
        frameWindow = frameElement.contentWindow;
        frameWindow?.addEventListener('resize', applyFrameResize);
      } catch {
        frameWindow = null;
      }

      intervalId = window.setInterval(() => applyMeasurement(), MEASURE_INTERVAL_MS);
    };

    const handleWindowMessage = (event: MessageEvent): void => {
      if (event.source !== frameElement.contentWindow) {
        return;
      }

      const data = event.data as {
        type?: unknown;
        payload?: { contentHeight?: unknown } | null;
      } | null;
      if (!data || data.type !== CONTENT_HEIGHT_MESSAGE_TYPE) {
        return;
      }

      const reportedHeight = data.payload?.contentHeight;
      if (typeof reportedHeight !== 'number' || !Number.isFinite(reportedHeight) || reportedHeight <= 0) {
        return;
      }

      applyMeasurement(reportedHeight);
    };

    const handleLoad = (): void => {
      attachToFrameDocument();
    };
    const handleError = (): void => {
      clearObservers();
      setOutcome({
        status: 'error',
        errorText: LOAD_FAILED_TEXT,
        height: baseHeight,
        scrollMode: false,
      });
    };

    frameElement.addEventListener('load', handleLoad);
    frameElement.addEventListener('error', handleError);
    window.addEventListener('message', handleWindowMessage);

    loadTimeoutId = window.setTimeout(() => {
      setOutcome({
        status: 'error',
        errorText: resolvedContent.source_type === 'url' ? EMBED_BLOCKED_TEXT : LOAD_FAILED_TEXT,
        height: baseHeight,
        scrollMode: false,
      });
    }, EMBED_DETECTION_TIMEOUT_MS);

    return () => {
      frameElement.removeEventListener('load', handleLoad);
      frameElement.removeEventListener('error', handleError);
      window.removeEventListener('message', handleWindowMessage);
      clearObservers();
    };
  }, [baseHeight, frameSource, resolvedContent, width]);

  // 展示状态推导：空态 / 非法地址 / 包入口不可解析为同步判定，其余以量测结果收敛。
  const urlInvalid = hasUrlSource && !urlAnalysis?.openable;
  const bundleUnresolvable = hasBundleSource && !bundleResolution?.entryUri;
  const errorText = urlInvalid
    ? INVALID_URL_TEXT
    : bundleUnresolvable
      ? BUNDLE_FAILED_TEXT
      : outcome?.status === 'error'
        ? outcome.errorText
        : '';
  const isEmpty = !hasUrlSource && !hasBundleSource;
  const isReady = !errorText && outcome?.status === 'ready';
  const isLoading = !isEmpty && !errorText && !isReady;
  const displayHeight = outcome ? outcome.height : baseHeight;
  const scrollLocked = outcome?.status === 'ready' && outcome.scrollMode;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '28px 24px',
    textAlign: 'center',
    boxSizing: 'border-box',
    zIndex: 2,
    pointerEvents: 'none',
  };

  if (isEmpty) {
    return (
      <div
        data-chips-webpage-view="true"
        style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
      >
        <div
          style={{
            minHeight: 180,
            width: '100%',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: token.marginXXS + 4,
            textAlign: 'center',
            color: token.colorTextSecondary,
            boxSizing: 'border-box',
          }}
        >
          <GlobalOutlined aria-hidden="true" style={{ fontSize: 42, lineHeight: 1, color: token.colorTextQuaternary }} />
          <span style={{ fontSize: token.fontSize, lineHeight: 1.6 }}>{EMPTY_TEXT}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-chips-webpage-view="true"
      ref={rootRef}
      style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
    >
      <div
        data-chips-webpage-viewport="true"
        className={scrollLocked ? 'chips-webpage-card__viewport--scroll' : undefined}
        style={{
          position: 'relative',
          width: '100%',
          height: `${displayHeight}px`,
          overflow: 'hidden',
          border: 0,
          borderRadius: 0,
          background: 'transparent',
          boxSizing: 'border-box',
        }}
      >
        {errorText ? (
          <div style={{ ...overlayStyle, color: token.colorError, fontSize: token.fontSizeSM }}>
            {errorText}
          </div>
        ) : frameSource ? (
          <iframe
            ref={iframeRef}
            title="网页内容"
            sandbox={FRAME_SANDBOX}
            loading="lazy"
            {...(frameSource.kind === 'srcdoc'
              ? { srcDoc: frameSource.value }
              : { src: frameSource.value })}
            onLoad={publishViewport}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 0,
              background: 'transparent',
            }}
          />
        ) : null}

        {isLoading ? (
          <div style={{ ...overlayStyle, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            {LOADING_TEXT}
          </div>
        ) : null}
      </div>
    </div>
  );
}
