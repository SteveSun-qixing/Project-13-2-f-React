import { useEffect, useRef, useState, memo } from "react";
import { Spin } from "antd";
import type { PDFPageProxy } from "pdfjs-dist";
import type { PageSize } from "../types";
import { usePdf } from "../hooks/usePdf";

interface PdfPageProps {
  pageIndex: number;
  pageNumber: number;
  pageSize: PageSize;
  containerWidth: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export const PdfPage = memo(function PdfPage({
  pageIndex,
  pageNumber,
  pageSize,
  containerWidth,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const { doc, zoom, rotation, searchResults, searchCurrentIndex } = usePdf();

  useEffect(() => {
    let cancelled = false;
    let currentPage: PDFPageProxy | null = null;

    const renderPage = async () => {
      if (!doc || !canvasRef.current) return;

      try {
        setIsRendering(true);
        setRenderError(null);

        const pdfDoc = doc as { getPage: (index: number) => Promise<PDFPageProxy> };
        currentPage = await pdfDoc.getPage(pageIndex + 1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setRenderError("无法获取画布上下文");
          return;
        }

        let scale = zoom.scale;
        if (zoom.mode === "fit-width" && containerWidth > 0) {
          scale = containerWidth / pageSize.width;
        } else if (zoom.mode === "fit-page") {
          const containerHeight = window.innerHeight - 200;
          scale = Math.min(containerWidth / pageSize.width, containerHeight / pageSize.height);
        }

        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

        const totalRotation = (rotation + (currentPage.rotate ?? 0)) % 360;
        const viewport = currentPage.getViewport({ scale, rotation: totalRotation });

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        await currentPage.render({
          canvasContext: ctx,
          viewport,
          intent: "display",
          canvas,
        }).promise;

        if (cancelled) return;

        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = "";
          textLayerRef.current.style.width = `${viewport.width}px`;
          textLayerRef.current.style.height = `${viewport.height}px`;

          const textContent = await currentPage.getTextContent();

          if (!cancelled) {
            textContent.items.forEach((item) => {
              if ("str" in item && item.str) {
                const tx = item.transform;
                const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * scale;

                const div = document.createElement("span");
                div.textContent = item.str;
                div.style.position = "absolute";
                div.style.left = `${tx[4] * scale}px`;
                div.style.top = `${tx[5] * scale}px`;
                div.style.fontSize = `${fontSize}px`;
                div.style.fontFamily = "sans-serif";
                div.style.transformOrigin = "0% 0%";
                div.style.whiteSpace = "pre";

                if ("width" in item && item.width) {
                  div.style.width = `${item.width * scale}px`;
                }

                textLayerRef.current?.appendChild(div);
              }
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error(`页面 ${pageNumber} 渲染失败:`, error);
          setRenderError(error instanceof Error ? error.message : "渲染失败");
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex, pageNumber, pageSize, containerWidth, zoom, rotation]);

  return (
    <div
      className="pdf-page"
      data-page-index={pageIndex}
      style={{
        position: "relative",
        marginBottom: 16,
        backgroundColor: "#fff",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        width: "fit-content",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          color: "#666",
          fontSize: 12,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "2px 8px",
          borderRadius: 4,
        }}
      >
        {pageNumber} / {doc ? (doc as { numPages?: number }).numPages : "?"}
      </div>

      {isRendering && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 5,
          }}
        >
          <Spin size="small" />
        </div>
      )}

      {renderError && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            color: "#ff4d4f",
            fontSize: 14,
          }}
        >
          {renderError}
        </div>
      )}

      <canvas ref={canvasRef} className="pdf-page__canvas" />

      <div
        ref={textLayerRef}
        className="pdf-page__text-layer"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "hidden",
          pointerEvents: "none",
          opacity: 0.3,
          lineHeight: 1,
        }}
      />
    </div>
  );
});
