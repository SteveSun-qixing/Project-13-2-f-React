import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { AnnotationMode, TextLayer } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/**
 * 单页：可见时渲染 canvas + 文本层（选择/复制），移出视口后释放位图。
 * 缩放/旋转的就地重渲染期间保留旧画布，避免页面闪白。
 */
export function PdfPageView({
  doc,
  pageNo,
  scale,
  rotationDelta,
  visible,
}: {
  doc: PDFDocumentProxy;
  pageNo: number;
  scale: number;
  rotationDelta: number;
  visible: boolean;
}): ReactElement {
  const holderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    if (!visible) {
      holder.replaceChildren();
      return;
    }
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    void (async () => {
      const page = await doc.getPage(pageNo);
      if (cancelled) return;
      const viewport = page.getViewport({ scale, rotation: (page.rotate + rotationDelta) % 360 });
      // hi-dpi 屏幕封顶 2x：更高的位图只增加内存，没有可见收益
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.className = "pdf-page-canvas";
      renderTask = page.render({
        canvas,
        viewport,
        // 表单控件由 FormLayer 以 HTML 呈现；排除其已保存外观流，避免重载后值被绘制两次
        annotationMode: AnnotationMode.ENABLE_FORMS,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      try {
        await renderTask.promise;
      } catch {
        return;
      }
      if (cancelled) return;
      const textDiv = document.createElement("div");
      textDiv.className = "textLayer";
      holder.replaceChildren(canvas, textDiv);
      const textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textDiv,
        viewport,
      });
      try {
        await textLayer.render();
      } catch {
        // 已取消
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNo, scale, rotationDelta, visible]);
  return <div ref={holderRef} className="pdf-page-content" />;
}

/** 页面占位（未渲染前保持正确尺寸） */
export function PagePlaceholder({ text }: { text: string }): ReactElement {
  return <div className="pdf-page-placeholder">{text}</div>;
}
