import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chips } from '@chips/sdk';
import type { IDialogOpenOutput, IResourceOpenContext } from '@chips/sdk';
import type { PreviewFile, PreviewItem } from '../engine';
import { isPreviewableTarget } from '../domain/open-targets';
import { loadViewerFile, toPreviewItems, type LoadedViewerFile } from '../domain/source-loader';
import { resolveFileName } from '../domain/file-kind';
import { resolveViewerTarget, type ViewerQueueItem, type ViewerTarget } from '../domain/viewer-target';
import { APP_PLUGIN_ID } from '../commands/appCommands';

/**
 * 查看会话：打开投递消费、资源读取与舞台状态编排。
 *
 * 正式面（《14-资源打开与默认处理器契约》）：
 * - 运行中投递经 `resource:opened` 标准事件送达（§5.5，UI 经 `chips.subscribe`），
 *   初始投递上下文随 `ctx.args.resourceOpen` 送达主逻辑，窗口运行时的初始上下文通道
 *   未交付前界面以空态如实呈现、不伪造内容；
 * - 字节读取经 `chips.resource(uri)` 句柄（06-资源协议规范；>8MiB 按《15-文件处理契约》§五
 *   降级 `stream()`），远程 http(s) 引用交引擎按 URL 直接加载；
 * - 打开臂经 `chips.request('resource:open', …)` 请求路由（本应用为 fallback 层，路由结果
 *   由平台裁决），宿主路由未就绪时行内简体中文提示，不伪造成功（工单060 族）；
 * - 装载前经领域层 `isPreviewableTarget` 预判：无任何预览插件路径的格式给出壳层兜底信息卡
 *   （§8.4），DWG 等元数据兜底格式仍交引擎按引擎臂裁决渲染。
 */

/** 舞台反馈条消息。 */
export interface ViewerFeedback {
  readonly tone: 'info' | 'success' | 'error';
  readonly message: string;
}

/** 资源装载状态（字节读取链路；引擎内渲染错误由引擎内联状态卡呈现）。 */
export interface SessionLoadStatus {
  readonly state: 'idle' | 'loading' | 'ready' | 'error';
  readonly message: string | null;
}

/** 壳层兜底卡状态：已识别但无预览插件的格式。 */
export interface UnsupportedState {
  readonly fileName: string;
  readonly format: string;
  readonly mimeType: string;
}

const FEEDBACK_AUTO_CLEAR_MS = 2400;

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'UNKNOWN';
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

function normalizeFormat(fileName: string, mimeType: string): string {
  const index = fileName.lastIndexOf('.');
  if (index >= 0 && index < fileName.length - 1) {
    return fileName.slice(index + 1).toUpperCase();
  }
  return mimeType.length > 0 ? mimeType : '未知';
}

export interface ViewerSession {
  readonly target: ViewerTarget | null;
  readonly loadedFiles: readonly LoadedViewerFile[];
  readonly previewItems: PreviewItem[];
  readonly initialIndex: number;
  readonly loadStatus: SessionLoadStatus;
  readonly feedback: ViewerFeedback | null;
  readonly bridgeReady: boolean;
  readonly unsupported: UnsupportedState | null;
  readonly infoPanelOpen: boolean;
  /** 引擎最近一次装载完成的文件（格式信息面板数据源）。 */
  readonly currentFile: PreviewFile | null;
  readonly handleEngineLoad: (file: PreviewFile) => void;
  readonly reloadCurrent: () => void;
  readonly retryLoad: () => void;
  readonly openFile: () => Promise<void>;
  readonly requestOpenResource: (path: string) => Promise<void>;
  readonly toggleInfoPanel: () => void;
}

export function useViewerSession(): ViewerSession {
  const [target, setTarget] = useState<ViewerTarget | null>(null);
  const [initialIndex, setInitialIndex] = useState(0);
  const [loadedFiles, setLoadedFiles] = useState<readonly LoadedViewerFile[]>([]);
  const [loadStatus, setLoadStatus] = useState<SessionLoadStatus>({ state: 'idle', message: null });
  const [feedback, setFeedback] = useState<ViewerFeedback | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [unsupported, setUnsupported] = useState<UnsupportedState | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<PreviewFile | null>(null);

  const targetRef = useRef<ViewerTarget | null>(null);
  const loadTokenRef = useRef(0);

  const notifyFeedback = useCallback((next: ViewerFeedback | null): void => {
    setFeedback(next);
  }, []);

  // ---------- 装载链路（预判 → 读取 → 引擎队列） ----------

  const loadTarget = useCallback(
    async (nextTarget: ViewerTarget): Promise<void> => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;

      setTarget(nextTarget);
      targetRef.current = nextTarget;
      setUnsupported(null);
      setCurrentFile(null);
      setLoadStatus({ state: 'loading', message: null });

      // 装载前预判：fallback 兜底不算可用预览路径（领域层 open-targets 契约）。
      const previewable: ViewerQueueItem[] = [];
      for (const item of nextTarget.items) {
        const supported = await isPreviewableTarget(item.uri, {
          fileName: item.fileName,
          ...(item.mimeType === undefined ? {} : { mimeType: item.mimeType }),
        });
        if (supported) {
          previewable.push(item);
        }
      }
      if (loadTokenRef.current !== token) {
        return;
      }
      if (previewable.length === 0) {
        const first = nextTarget.items[0];
        setLoadedFiles([]);
        setInitialIndex(0);
        setLoadStatus({
          state: 'error',
          message: `没有可用的预览路径：${first?.fileName ?? '未知文件'}`,
        });
        const mimeType = first?.mimeType ?? '';
        setUnsupported({
          fileName: first?.fileName ?? '未知文件',
          format: normalizeFormat(first?.fileName ?? '', mimeType),
          mimeType: mimeType.length > 0 ? mimeType : '未声明',
        });
        return;
      }

      const loaded: LoadedViewerFile[] = [];
      try {
        for (const item of previewable) {
          loaded.push(await loadViewerFile(item));
        }
      } catch (error) {
        if (loadTokenRef.current !== token) {
          return;
        }
        setLoadedFiles([]);
        const message = `文件资源读取失败（${errorCode(error)}）`;
        setLoadStatus({ state: 'error', message });
        notifyFeedback({ tone: 'error', message });
        return;
      }
      if (loadTokenRef.current !== token) {
        return;
      }
      // 过滤不可预览项后修正初始位置：主资源命中项优先，失守时回退首项。
      const mainItem = nextTarget.items[nextTarget.initialIndex];
      const mappedIndex = mainItem === undefined ? 0 : previewable.indexOf(mainItem);
      setInitialIndex(mappedIndex >= 0 ? mappedIndex : 0);
      setLoadedFiles(loaded);
      setLoadStatus({ state: 'ready', message: null });
    },
    [notifyFeedback],
  );

  const applyContext = useCallback(
    (context: IResourceOpenContext): void => {
      const nextTarget = resolveViewerTarget(context);
      if (nextTarget === null) {
        notifyFeedback({ tone: 'error', message: '打开投递缺少可读取的资源入口' });
        return;
      }
      void loadTarget(nextTarget);
    },
    [loadTarget, notifyFeedback],
  );

  // ---------- 打开投递消费（《14》§5.5） ----------

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

  const retryLoad = useCallback((): void => {
    const current = targetRef.current;
    if (current !== null) {
      void loadTarget(current);
    }
  }, [loadTarget]);

  const reloadCurrent = useCallback((): void => {
    const current = targetRef.current;
    if (current !== null) {
      void loadTarget(current);
    }
  }, [loadTarget]);

  // ---------- 打开臂（resource:open 正式面 + 诚实降级） ----------

  const requestOpenResource = useCallback(
    async (path: string): Promise<void> => {
      notifyFeedback({ tone: 'info', message: '正在请求打开文件…' });
      try {
        const fileName = resolveFileName(path);
        await chips.request('resource:open', {
          intent: 'view',
          resource: {
            uri: path,
            ...(fileName.length > 0 ? { fileName } : {}),
          },
        });
        notifyFeedback({ tone: 'info', message: '已提交打开请求，等待系统路由投递' });
      } catch (error) {
        notifyFeedback({
          tone: 'error',
          message: `暂时无法打开文件：资源打开路由未就绪（${errorCode(error)}）`,
        });
      }
    },
    [notifyFeedback],
  );

  const openFile = useCallback(async (): Promise<void> => {
    let picked: IDialogOpenOutput;
    try {
      picked = await chips.request<IDialogOpenOutput>('dialog:open', {
        title: '选择文件',
        multiple: false,
      });
    } catch (error) {
      notifyFeedback({
        tone: 'error',
        message: `暂时无法打开文件：文件选择通道未就绪（${errorCode(error)}）`,
      });
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
  }, [notifyFeedback, requestOpenResource]);

  const toggleInfoPanel = useCallback((): void => {
    setInfoPanelOpen((current) => !current);
  }, []);

  const handleEngineLoad = useCallback((file: PreviewFile): void => {
    setCurrentFile(file);
  }, []);

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

  const previewItems = useMemo(() => toPreviewItems(loadedFiles), [loadedFiles]);

  return {
    target,
    loadedFiles,
    previewItems,
    initialIndex,
    loadStatus,
    feedback,
    bridgeReady,
    unsupported,
    infoPanelOpen,
    currentFile,
    handleEngineLoad,
    reloadCurrent,
    retryLoad,
    openFile,
    requestOpenResource,
    toggleInfoPanel,
  };
}
