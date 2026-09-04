import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Spin, Empty } from "antd";
import { FileImageOutlined } from "@ant-design/icons";
import type { PDFPageProxy } from "pdfjs-dist";
import { usePdf } from "../hooks/usePdf";

const THUMBNAIL_SCALE = 0.2;
const THUMBNAIL_WIDTH = 150;

interface ThumbnailCacheEntry {
  canvas: HTMLCanvasElement;
  promise: Promise<void>;
}

const thumbnailCache = new Map<number, ThumbnailCacheEntry>();

function renderThumbnail(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE, rotation: 0 });
    const scale = THUMBNAIL_WIDTH / viewport.width;
    const finalViewport = page.getViewport({ scale, rotation: 0 });

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("无法获取画布上下文"));
      return;
    }

    canvas.width = Math.floor(finalViewport.width);
    canvas.height = Math.floor(finalViewport.height);

    page.render({
      canvasContext: ctx,
      viewport: finalViewport,
      intent: "display",
      canvas,
    }).promise
      .then(() => resolve())
      .catch(reject);
  });
}

interface ThumbnailItemProps {
  pageIndex: number;
  pageNumber: number;
  isCurrent: boolean;
  onSelect: (pageNumber: number) => void;
}

const ThumbnailItem = memo(function ThumbnailItem({
  pageIndex,
  pageNumber,
  isCurrent,
  onSelect,
}: ThumbnailItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const { doc } = usePdf();

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!doc || !canvasRef.current) return;

      const cached = thumbnailCache.get(pageIndex);
      if (cached) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(cached.canvas, 0, 0);
        }
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setHasError(false);

        const pdfDoc = doc as { getPage: (index: number) => Promise<PDFPageProxy> };
        const page = await pdfDoc.getPage(pageIndex + 1);

        if (cancelled) return;

        const canvas = document.createElement("canvas");
        await renderThumbnail(page, canvas);

        if (cancelled) return;

        thumbnailCache.set(pageIndex, { canvas, promise: Promise.resolve() });

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.drawImage(canvas, 0, 0);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error(`缩略图渲染失败 (页码 ${pageNumber}):`, error);
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex, pageNumber]);

  const handleClick = useCallback(() => {
    onSelect(pageNumber);
  }, [onSelect, pageNumber]);

  return (
    <div
      className={`pdf-thumbnail-item ${isCurrent ? "pdf-thumbnail-item--current" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        padding: 8,
        cursor: "pointer",
        borderRadius: 4,
        backgroundColor: isCurrent ? "#e6f4ff" : "transparent",
        border: isCurrent ? "2px solid #1677ff" : "2px solid transparent",
        transition: "all 0.2s ease",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          position: "relative",
          width: THUMBNAIL_WIDTH,
          minHeight: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
          boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
          borderRadius: 2,
        }}
      >
        {isLoading && <Spin size="small" />}
        {hasError && (
          <div style={{ color: "#999", textAlign: "center", padding: 16 }}>
            <FileImageOutlined style={{ fontSize: 24, marginBottom: 4 }} />
            <div style={{ fontSize: 12 }}>加载失败</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            maxWidth: "100%",
          }}
        />
      </div>
      <div
        style={{
          textAlign: "center",
          marginTop: 4,
          fontSize: 12,
          color: isCurrent ? "#1677ff" : "#666",
          fontWeight: isCurrent ? 600 : 400,
        }}
      >
        {pageNumber}
      </div>
    </div>
  );
});

export const ThumbnailSidebar = memo(function ThumbnailSidebar() {
  const { doc, numPages, currentPage, status, showThumbnails, goToPage } = usePdf();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(THUMBNAIL_WIDTH);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleSelectPage = useCallback(
    (pageNumber: number) => {
      goToPage(pageNumber);
    },
    [goToPage],
  );

  if (!showThumbnails) {
    return null;
  }

  if (status === "idle" || status === "loading") {
    return (
      <div
        className="pdf-thumbnail-sidebar"
        style={{
          width: THUMBNAIL_WIDTH + 32,
          minWidth: THUMBNAIL_WIDTH + 32,
          borderRight: "1px solid #f0f0f0",
          backgroundColor: "#fafafa",
          overflow: "auto",
        }}
      >
        <div
          style={{
            padding: "16px 8px",
            textAlign: "center",
            color: "#999",
          }}
        >
          <Spin size="small" />
          <div style={{ marginTop: 8, fontSize: 12 }}>加载中...</div>
        </div>
      </div>
    );
  }

  if (!doc || numPages === 0) {
    return (
      <div
        className="pdf-thumbnail-sidebar"
        style={{
          width: THUMBNAIL_WIDTH + 32,
          minWidth: THUMBNAIL_WIDTH + 32,
          borderRight: "1px solid #f0f0f0",
          backgroundColor: "#fafafa",
          overflow: "auto",
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无页面"
          style={{ marginTop: 32 }}
        />
      </div>
    );
  }

  const pages = Array.from({ length: numPages }, (_, i) => ({
    pageIndex: i,
    pageNumber: i + 1,
  }));

  return (
    <div
      className="pdf-thumbnail-sidebar"
      ref={containerRef}
      style={{
        width: THUMBNAIL_WIDTH + 32,
        minWidth: THUMBNAIL_WIDTH + 32,
        maxWidth: THUMBNAIL_WIDTH + 32,
        borderRight: "1px solid #f0f0f0",
        backgroundColor: "#fafafa",
        overflowY: "auto",
        overflowX: "hidden",
      }}
      role="list"
      aria-label="页面缩略图"
    >
      <div
        style={{
          padding: "8px 0",
        }}
      >
        {pages.map(({ pageIndex, pageNumber }) => (
          <ThumbnailItem
            key={pageIndex}
            pageIndex={pageIndex}
            pageNumber={pageNumber}
            isCurrent={currentPage === pageNumber}
            onSelect={handleSelectPage}
          />
        ))}
      </div>
    </div>
  );
});
