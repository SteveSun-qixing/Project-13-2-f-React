import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  createViewer,
  type FileViewer,
  type PreviewFile,
  type PreviewItem,
  type PreviewPlugin,
  type PreviewToolbarRenderContext,
} from '../engine';
import { createViewerPlugins } from '../domain/engine-plugins';

export interface EngineStageProps {
  /** 引擎队列项：装载完成的预览源（字节 File 或远程 URL）。 */
  items: PreviewItem[];
  initialIndex?: number;
  /** 引擎工具栏上下文变化时回调（缩放、页码、队列与命令支持状态）。 */
  onToolbarContext?: (context: PreviewToolbarRenderContext | null) => void;
  /** 当前文件加载完成回调（回填格式信息面板）。 */
  onFileLoad?: (file: PreviewFile) => void;
  /** 引擎渲染失败回调（引擎内联错误卡之外的上层感知通道）。 */
  onError?: (error: Error, file?: PreviewFile) => void;
}

/**
 * 引擎挂载桥接组件：把查看引擎装载到舞台容器（格式探测路由 → 对应引擎视图），
 * 并经引擎 `toolbar.render` 通道把控制上下文暴露给壳层 antd 工具栏；
 * 引擎内建工具栏仅保留隐藏挂载点（工具栏由壳层承担）。
 */
export function EngineStage({
  items,
  initialIndex = 0,
  onToolbarContext,
  onFileLoad,
  onError,
}: EngineStageProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<FileViewer | null>(null);
  const pluginsRef = useRef<PreviewPlugin[] | null>(null);
  if (pluginsRef.current === null) {
    pluginsRef.current = createViewerPlugins();
  }
  const callbacksRef = useRef({ onToolbarContext, onFileLoad, onError });
  callbacksRef.current = { onToolbarContext, onFileLoad, onError };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let latestToolbarContext: PreviewToolbarRenderContext | null = null;
    let toolbarRenderQueued = false;
    let toolbarMount: HTMLDivElement | null = null;

    const notifyToolbarContext = (): void => {
      toolbarRenderQueued = false;
      callbacksRef.current.onToolbarContext?.(latestToolbarContext);
    };

    const viewer = createViewer({
      container,
      className: 'universal-viewer-engine',
      files: items,
      initialIndex,
      plugins: pluginsRef.current ?? undefined,
      toolbar: {
        render: (context) => {
          latestToolbarContext = context;
          if (!toolbarRenderQueued) {
            toolbarRenderQueued = true;
            queueMicrotask(() => {
              flushSync(notifyToolbarContext);
            });
          }
          if (!toolbarMount) {
            toolbarMount = document.createElement('div');
            toolbarMount.className = 'universal-viewer-engine__toolbar-slot';
            toolbarMount.setAttribute('aria-hidden', 'true');
          }
          return toolbarMount;
        },
      },
      onLoad: (file) => callbacksRef.current.onFileLoad?.(file),
      onError: (error, file) => callbacksRef.current.onError?.(error, file),
    });
    viewerRef.current = viewer;

    return () => {
      viewerRef.current = null;
      latestToolbarContext = null;
      toolbarMount = null;
      toolbarRenderQueued = false;
      callbacksRef.current.onToolbarContext?.(null);
      viewer.destroy();
    };
    // 插件数组固定复用；items 变化时整体重建查看器。
  }, [items, initialIndex]);

  return <div ref={containerRef} data-role="engine-stage" className="universal-viewer-engine__container" />;
}
