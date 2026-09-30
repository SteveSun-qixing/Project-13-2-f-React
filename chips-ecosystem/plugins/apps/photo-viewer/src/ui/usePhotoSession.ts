import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { chips } from '@chips/sdk';
import type { IDialogOpenOutput, IDialogSaveOutput, IResourceHandle, IResourceOpenContext } from '@chips/sdk';
import { normalizeImageExtension, resolveFileName, SUPPORTED_IMAGE_EXTENSIONS, type ImageDimensions } from '../viewer/image-viewer';
import { inferImageMimeTypeFromPath, resolveImageQueue, SUPPORTED_OPEN_EXTENSIONS, type ImageQueue, type QueueImage } from '../viewer/openQueue';
import { APP_PLUGIN_ID } from '../commands/appCommands';

/**
 * 查看会话：打开投递消费与舞台状态编排。
 *
 * 正式面（《14-资源打开与默认处理器契约》）：
 * - 运行中投递经 `resource:opened` 标准事件送达（§5.5，UI 经 `chips.subscribe`），
 *   初始投递上下文随 `ctx.args.resourceOpen` 送达主逻辑，窗口运行时的初始上下文通道
 *   未交付前界面以空态如实呈现、不伪造内容；
 * - 字节读取经 `chips.resource(uri)` 句柄（06-资源协议规范；>8MiB 按《15-文件处理契约》§五
 *   降级 `stream()`），远程 http(s) 引用交 `<img>` 原生加载；
 * - 打开臂经 `chips.request('resource:open', …)` 请求 image 槽位，宿主路由未就绪时行内
 *   简体中文提示，不伪造成功（工单063）；保存副本经 `dialog:save` + `file:write`
 *   （临时文件 + 原子替换在能力侧完成）。
 */

/** 舞台反馈条消息。 */
export interface ViewerFeedback {
  readonly tone: 'info' | 'success' | 'error';
  readonly message: string;
}

/** 当前图片加载状态。 */
export interface SessionLoadStatus {
  readonly state: 'idle' | 'loading' | 'loaded' | 'error';
  readonly message: string | null;
}

/** 相机动作通道（舞台向会话登记，工具栏与键盘消费；ref 通道防渲染循环）。 */
export interface PhotoViewerCameraActions {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWindow: () => void;
  actualSize: () => void;
  rotateClockwise: () => void;
  rotateCounterclockwise: () => void;
}

interface ImageCacheEntry {
  readonly url: string;
  readonly bytes: Uint8Array;
}

const FEEDBACK_AUTO_CLEAR_MS = 2400;
const IMMERSIVE_REVEAL_RESET_MS = 2000;

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'UNKNOWN';
}

function isRemoteHttpUri(uri: string): boolean {
  return /^https?:/i.test(uri.trim());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function readHandleBytes(handle: IResourceHandle): Promise<Uint8Array> {
  try {
    return await handle.read();
  } catch (error) {
    if (errorCode(error) !== 'RESOURCE_TOO_LARGE') {
      throw error;
    }
    // 《15-文件处理契约》§五：>8MiB 资源降级流式读取，不在界面层设 8MiB 上限。
    const reader = handle.stream().getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }
}

function readOpenedContext(payload: unknown): IResourceOpenContext | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record['pluginId'] !== APP_PLUGIN_ID) {
    return null;
  }
  const context = record['context'];
  if (typeof context !== 'object' || context === null) {
    return null;
  }
  const candidate = context as Record<string, unknown>;
  if (typeof candidate['uri'] !== 'string' || candidate['uri'].trim().length === 0) {
    return null;
  }
  return context as IResourceOpenContext;
}

export interface PhotoSession {
  readonly queue: ImageQueue | null;
  readonly queueTitle: string | null;
  readonly currentIndex: number;
  readonly currentImage: QueueImage | null;
  readonly currentSrc: string | null;
  readonly loadStatus: SessionLoadStatus;
  readonly dimensions: ImageDimensions | null;
  readonly isImageLoaded: boolean;
  readonly byteSize: number | null;
  readonly feedback: ViewerFeedback | null;
  readonly bridgeReady: boolean;
  readonly immersive: boolean;
  readonly chromeVisible: boolean;
  readonly filmstripVisible: boolean;
  readonly infoPanelOpen: boolean;
  readonly registerCameraActions: (actions: PhotoViewerCameraActions | null) => void;
  readonly cameraActionsRef: MutableRefObject<PhotoViewerCameraActions | null>;
  readonly goTo: (index: number) => void;
  readonly previous: () => void;
  readonly next: () => void;
  readonly first: () => void;
  readonly last: () => void;
  readonly reloadCurrent: () => void;
  readonly handleImageLoad: (dimensions: ImageDimensions) => void;
  readonly handleImageError: () => void;
  readonly openImageFile: () => Promise<void>;
  readonly saveCopy: () => Promise<void>;
  readonly requestOpenResource: (path: string) => Promise<void>;
  readonly toggleImmersive: () => void;
  readonly toggleFilmstrip: () => void;
  readonly toggleInfoPanel: () => void;
  /** 胶片条缩略图读取（命中字节缓存时返回展示 URL）；`thumbVersion` 推动缩略图刷新。 */
  readonly getThumbUrl: (uri: string) => string | null;
  readonly thumbVersion: number;
  /** 沉浸模式下指针/键盘活动唤出浮层控件。 */
  readonly notifyPointerActivity: () => void;
}

export function usePhotoSession(): PhotoSession {
  const [queue, setQueue] = useState<ImageQueue | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<SessionLoadStatus>({ state: 'idle', message: null });
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [byteSize, setByteSize] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<ViewerFeedback | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [chromeRevealed, setChromeRevealed] = useState(false);
  const [filmstripVisible, setFilmstripVisible] = useState(true);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [thumbVersion, setThumbVersion] = useState(0);

  const cacheRef = useRef<Map<string, ImageCacheEntry>>(new Map());
  const cameraActionsRef = useRef<PhotoViewerCameraActions | null>(null);
  const queueRef = useRef<ImageQueue | null>(null);
  const currentIndexRef = useRef(0);
  const currentImageRef = useRef<QueueImage | null>(null);
  const isImageLoadedRef = useRef(false);
  const chromeRevealTimerRef = useRef<number | null>(null);

  const currentImage = queue !== null && currentIndex >= 0 && currentIndex < queue.images.length
    ? (queue.images[currentIndex] ?? null)
    : null;
  currentImageRef.current = currentImage;
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  isImageLoadedRef.current = isImageLoaded;

  const registerCameraActions = useCallback((actions: PhotoViewerCameraActions | null): void => {
    cameraActionsRef.current = actions;
  }, []);

  // ---------- 队列消费 ----------

  const applyContext = useCallback((context: IResourceOpenContext): void => {
    const nextQueue = resolveImageQueue(context);
    if (nextQueue === null) {
      setFeedback({ tone: 'error', message: '打开投递缺少可读取的资源入口' });
      return;
    }
    setQueue(nextQueue);
    setCurrentIndex(nextQueue.initialIndex);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription: { dispose(): void } | null = null;
    try {
      subscription = chips.subscribe('resource:opened', (payload: unknown) => {
        if (cancelled) {
          return;
        }
        const context = readOpenedContext(payload);
        if (context !== null) {
          applyContext(context);
        }
      });
      if (!cancelled) {
        setBridgeReady(true);
      }
    } catch {
      // SDK_BRIDGE_UNAVAILABLE 等：窗口桥接未就绪，界面以空态如实呈现，不伪造内容。
      if (!cancelled) {
        setBridgeReady(false);
      }
    }
    return () => {
      cancelled = true;
      subscription?.dispose();
    };
  }, [applyContext]);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const entry of cache.values()) {
        URL.revokeObjectURL(entry.url);
      }
      cache.clear();
      if (chromeRevealTimerRef.current !== null) {
        window.clearTimeout(chromeRevealTimerRef.current);
      }
    };
  }, []);

  // ---------- 字节读取与展示 ----------

  const ensureImageEntry = useCallback(async (uri: string): Promise<ImageCacheEntry> => {
    const cached = cacheRef.current.get(uri);
    if (cached !== undefined) {
      return cached;
    }
    const handle = chips.resource(uri);
    try {
      const bytes = await readHandleBytes(handle);
      const mimeType = inferImageMimeTypeFromPath(uri);
      // Uint8Array 是 Blob 合法的二进制视图；此处的类型收窄仅为跨 lib 的 ArrayBufferLike 泛型差异。
      const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType ?? 'application/octet-stream' });
      const entry: ImageCacheEntry = { url: URL.createObjectURL(blob), bytes };
      cacheRef.current.set(uri, entry);
      setThumbVersion((version) => version + 1);
      return entry;
    } finally {
      handle.release();
    }
  }, []);

  const getThumbUrl = useCallback((uri: string): string | null => {
    return cacheRef.current.get(uri)?.url ?? null;
  }, []);

  const readRemoteBytes = useCallback(async (uri: string): Promise<Uint8Array> => {
    const response = await fetch(uri);
    if (!response.ok) {
      throw Object.assign(new Error(`远程图片响应异常：HTTP ${response.status}`), { code: 'REMOTE_HTTP_ERROR' });
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }, []);

  useEffect(() => {
    if (!currentImage) {
      setCurrentSrc(null);
      setLoadStatus({ state: 'idle', message: null });
      setDimensions(null);
      setIsImageLoaded(false);
      setByteSize(null);
      return;
    }

    const extension = normalizeImageExtension(currentImage.uri);
    if (extension.length > 0 && !SUPPORTED_IMAGE_EXTENSIONS.includes(extension)) {
      // 《03-查看器设计》§8.1：识别而不支持解码时给出明确反馈，不静默失败。
      setCurrentSrc(null);
      setIsImageLoaded(false);
      setByteSize(null);
      setLoadStatus({ state: 'error', message: `暂不支持预览 ${extension} 格式：该格式由万能文件查看器兜底` });
      setFeedback({ tone: 'error', message: `暂不支持预览 ${extension} 格式：该格式由万能文件查看器兜底` });
      return;
    }

    if (isRemoteHttpUri(currentImage.uri)) {
      setCurrentSrc(currentImage.uri);
      setByteSize(null);
      setIsImageLoaded(false);
      setLoadStatus({ state: 'loading', message: null });
      return;
    }

    let cancelled = false;
    setIsImageLoaded(false);
    setDimensions(null);
    setLoadStatus({ state: 'loading', message: null });
    void ensureImageEntry(currentImage.uri)
      .then((entry) => {
        if (cancelled) {
          return;
        }
        setCurrentSrc(entry.url);
        setByteSize(entry.bytes.byteLength);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setCurrentSrc(null);
        setByteSize(null);
        const message = `图片资源读取失败（${errorCode(error)}）`;
        setLoadStatus({ state: 'error', message });
        setFeedback({ tone: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [currentImage, ensureImageEntry, reloadToken]);

  // 相邻图片预热（胶片条缩略图与翻页即点即显；失败不阻塞查看）。
  useEffect(() => {
    if (!queue || queue.images.length <= 1) {
      return;
    }
    for (const neighborIndex of [currentIndex - 1, currentIndex + 1]) {
      if (neighborIndex < 0 || neighborIndex >= queue.images.length) {
        continue;
      }
      const neighbor = queue.images[neighborIndex];
      if (!neighbor || isRemoteHttpUri(neighbor.uri) || cacheRef.current.has(neighbor.uri)) {
        continue;
      }
      void ensureImageEntry(neighbor.uri).catch(() => undefined);
    }
  }, [queue, currentIndex, ensureImageEntry]);

  // ---------- 查看动作 ----------

  const goTo = useCallback((index: number): void => {
    const target = queueRef.current;
    if (!target || target.images.length === 0) {
      return;
    }
    const bounded = Math.min(target.images.length - 1, Math.max(0, index));
    setCurrentIndex(bounded);
  }, []);

  const previous = useCallback((): void => {
    goTo(currentIndexRef.current - 1);
  }, [goTo]);

  const next = useCallback((): void => {
    goTo(currentIndexRef.current + 1);
  }, [goTo]);

  const first = useCallback((): void => {
    goTo(0);
  }, [goTo]);

  const last = useCallback((): void => {
    const target = queueRef.current;
    if (target) {
      goTo(target.images.length - 1);
    }
  }, [goTo]);

  const reloadCurrent = useCallback((): void => {
    const image = currentImageRef.current;
    if (!image || isRemoteHttpUri(image.uri)) {
      return;
    }
    const cached = cacheRef.current.get(image.uri);
    if (cached !== undefined) {
      URL.revokeObjectURL(cached.url);
      cacheRef.current.delete(image.uri);
    }
    setReloadToken((token) => token + 1);
  }, []);

  const handleImageLoad = useCallback((loadedDimensions: ImageDimensions): void => {
    setDimensions(loadedDimensions);
    setIsImageLoaded(true);
    setLoadStatus({ state: 'loaded', message: null });
    setFeedback((current) => (current !== null && current.tone === 'error' ? null : current));
  }, []);

  const handleImageError = useCallback((): void => {
    setIsImageLoaded(false);
    const message = '图片解码失败：文件可能已损坏或格式不受支持';
    setLoadStatus({ state: 'error', message });
    setFeedback({ tone: 'error', message });
  }, []);

  // ---------- 打开臂与保存副本（正式面 + 诚实降级） ----------

  const requestOpenResource = useCallback(async (path: string): Promise<void> => {
    setFeedback({ tone: 'info', message: '正在请求打开图片…' });
    try {
      const mimeType = inferImageMimeTypeFromPath(path);
      const fileName = resolveFileName(path);
      await chips.request('resource:open', {
        intent: 'view',
        resource: {
          uri: path,
          ...(mimeType === undefined ? {} : { mimeType }),
          ...(fileName.length > 0 ? { fileName } : {}),
        },
      });
      setFeedback({ tone: 'info', message: '已提交打开请求，等待系统路由投递' });
    } catch (error) {
      setFeedback({ tone: 'error', message: `图片暂时无法打开：资源打开通道未就绪（${errorCode(error)}）` });
    }
  }, []);

  const openImageFile = useCallback(async (): Promise<void> => {
    let picked: IDialogOpenOutput;
    try {
      picked = await chips.request<IDialogOpenOutput>('dialog:open', {
        title: '选择图片',
        multiple: false,
        filters: [{ name: '图片', extensions: [...SUPPORTED_OPEN_EXTENSIONS] }],
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: `图片暂时无法打开：资源打开通道未就绪（${errorCode(error)}）` });
      return;
    }
    if (picked.canceled) {
      return;
    }
    const path = picked.paths[0];
    if (path === undefined || path.trim().length === 0) {
      return;
    }
    await requestOpenResource(path.trim());
  }, [requestOpenResource]);

  const saveCopy = useCallback(async (): Promise<void> => {
    const image = currentImageRef.current;
    if (!image) {
      setFeedback({ tone: 'error', message: '当前没有已加载的图片' });
      return;
    }
    try {
      const picked = await chips.request<IDialogSaveOutput>('dialog:save', {
        title: '保存图片副本',
        defaultPath: image.fileName,
        filters: [{ name: '图片', extensions: [...SUPPORTED_OPEN_EXTENSIONS] }],
      });
      if (picked.canceled || picked.path === null) {
        setFeedback({ tone: 'info', message: '已取消保存副本' });
        return;
      }
      const cached = cacheRef.current.get(image.uri);
      const bytes =
        cached !== undefined
          ? cached.bytes
          : isRemoteHttpUri(image.uri)
            ? await readRemoteBytes(image.uri)
            : (await ensureImageEntry(image.uri)).bytes;
      await chips.request('file:write', { path: picked.path, data: bytesToBase64(bytes), encoding: 'base64' });
      setFeedback({ tone: 'success', message: '图片副本已保存' });
    } catch (error) {
      setFeedback({ tone: 'error', message: `暂时无法保存副本（${errorCode(error)}）` });
    }
  }, [ensureImageEntry, readRemoteBytes]);

  // ---------- 沉浸模式与界面开关 ----------

  const revealChrome = useCallback((): void => {
    setChromeRevealed(true);
    if (chromeRevealTimerRef.current !== null) {
      window.clearTimeout(chromeRevealTimerRef.current);
    }
    chromeRevealTimerRef.current = window.setTimeout(() => {
      chromeRevealTimerRef.current = null;
      setChromeRevealed(false);
    }, IMMERSIVE_REVEAL_RESET_MS);
  }, []);

  const toggleImmersive = useCallback((): void => {
    setImmersive((current) => !current);
    setChromeRevealed(false);
  }, []);

  const toggleFilmstrip = useCallback((): void => {
    setFilmstripVisible((current) => !current);
  }, []);

  const toggleInfoPanel = useCallback((): void => {
    setInfoPanelOpen((current) => !current);
  }, []);

  // ---------- 键盘（《03-查看器设计》§10.1） ----------

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing || event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape') {
        if (immersive) {
          setImmersive(false);
          setChromeRevealed(false);
        } else if (infoPanelOpen) {
          setInfoPanelOpen(false);
        }
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (hasModifier && !event.altKey && (event.key === 'o' || event.key === 'O')) {
        event.preventDefault();
        void openImageFile();
        return;
      }
      if (hasModifier && !event.altKey && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        void saveCopy();
        return;
      }

      if (immersive) {
        revealChrome();
      }

      const actions = cameraActionsRef.current;
      if (isImageLoadedRef.current && actions !== null) {
        if (event.key === '+' || event.key === '=') {
          actions.zoomIn();
          return;
        }
        if (event.key === '-') {
          actions.zoomOut();
          return;
        }
        if (event.key === '0') {
          actions.fitToWindow();
          return;
        }
        if (event.key === '1') {
          actions.actualSize();
          return;
        }
      }

      if (event.key === 'f' || event.key === 'F') {
        toggleImmersive();
        return;
      }

      const queueLength = queueRef.current?.images.length ?? 0;
      if (queueLength <= 1) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIndexRef.current - 1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIndexRef.current + 1);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        goTo(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        goTo(queueLength - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goTo, immersive, infoPanelOpen, openImageFile, revealChrome, saveCopy, toggleImmersive]);

  // ---------- 反馈条自动消退（错误保留，须显式处置） ----------

  useEffect(() => {
    if (!feedback || feedback.tone === 'error') {
      return;
    }
    const timer = window.setTimeout(() => {
      setFeedback((current) => (current !== null && current.tone !== 'error' ? null : current));
    }, FEEDBACK_AUTO_CLEAR_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [feedback]);

  const queueTitle = queue !== null ? (queue.title ?? currentImage?.fileName ?? null) : null;

  return {
    queue,
    queueTitle,
    currentIndex,
    currentImage,
    currentSrc,
    loadStatus,
    dimensions,
    isImageLoaded,
    byteSize,
    feedback,
    bridgeReady,
    immersive,
    chromeVisible: !immersive || chromeRevealed,
    filmstripVisible,
    infoPanelOpen,
    registerCameraActions,
    cameraActionsRef,
    goTo,
    previous,
    next,
    first,
    last,
    reloadCurrent,
    handleImageLoad,
    handleImageError,
    openImageFile,
    saveCopy,
    requestOpenResource,
    toggleImmersive,
    toggleFilmstrip,
    toggleInfoPanel,
    getThumbUrl,
    thumbVersion,
    notifyPointerActivity: revealChrome,
  };
}
