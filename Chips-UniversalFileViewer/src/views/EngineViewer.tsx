import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createViewer } from "../viewer-engine";
import "../viewer-engine/style.css";
import type {
  FileViewer as EngineFileViewer,
  PreviewFile,
  PreviewItem,
  PreviewPlugin,
  PreviewToolbarRenderContext,
} from "../viewer-engine";
import { createViewerPlugins } from "../utils/engine-plugins";

export interface EngineViewerProps {
  items: PreviewItem[];
  initialIndex?: number;
  /** 引擎工具栏上下文变化时回调（含缩放、页码、队列、命令支持状态）。 */
  onToolbarContext?: (context: PreviewToolbarRenderContext | null) => void;
  /** 当前文件加载完成回调。 */
  onFileLoad?: (file: PreviewFile) => void;
  onError?: (error: Error, file?: PreviewFile) => void;
}

/**
 * 引擎挂载桥接组件：把 open-file-viewer core 装载到容器 DOM，
 * 并通过引擎 toolbar.render 通道向 antd 工具栏暴露控制上下文。
 */
export function EngineViewer({
  items,
  initialIndex = 0,
  onToolbarContext,
  onFileLoad,
  onError,
}: EngineViewerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<EngineFileViewer | null>(null);
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

    const notifyToolbarContext = () => {
      toolbarRenderQueued = false;
      callbacksRef.current.onToolbarContext?.(latestToolbarContext);
    };

    const viewer = createViewer({
      container,
      className: "universal-viewer-engine",
      files: items,
      initialIndex,
      locale: "zh-CN",
      theme: "light",
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
            toolbarMount = document.createElement("div");
            toolbarMount.className = "universal-viewer-engine__toolbar-slot";
            toolbarMount.setAttribute("aria-hidden", "true");
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

  return <div ref={containerRef} className="universal-viewer-engine__container" />;
}
