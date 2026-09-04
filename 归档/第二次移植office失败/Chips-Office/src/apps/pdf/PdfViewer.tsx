import { useEffect, useMemo, useRef, useState } from "react";
import { Spin, Card, Button, Result } from "antd";
import { FilePdfOutlined, ReloadOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { PdfPage } from "./components/Page";
import { ThumbnailSidebar } from "./components/ThumbnailSidebar";
import { Toolbar } from "./components/Toolbar";
import { SearchPanel } from "./components/SearchPanel";
import { usePdf } from "./hooks/usePdf";
import type { PageSize } from "./types";

export interface PdfViewerProps {
  onOpenFile?: () => void;
}

export function PdfViewer({ onOpenFile }: PdfViewerProps) {
  const {
    status,
    errorMessage,
    numPages,
    currentPage,
    pageSizes,
    closeDocument,
    toggleSearch,
  } = usePdf();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const pageContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        toggleSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleSearch]);

  useEffect(() => {
    if (pageContainerRef.current && status === "ready") {
      const currentPageElement = pageContainerRef.current.querySelector(
        `[data-page-index="${currentPage - 1}"]`,
      );
      if (currentPageElement) {
        currentPageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [currentPage, status]);

  if (status === "idle") {
    return (
      <div
        className="pdf-viewer pdf-viewer--idle"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          minHeight: 400,
        }}
      >
        <Result
          icon={<FilePdfOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />}
          title="未打开文档"
          subTitle="请打开一个 PDF 文件开始查看"
          extra={
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              size="large"
              onClick={onOpenFile}
            >
              打开 PDF 文件
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        className="pdf-viewer pdf-viewer--loading"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <Spin size="large" tip="正在加载 PDF 文档..." />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="pdf-viewer pdf-viewer--error"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <Result
          status="error"
          title="加载失败"
          subTitle={errorMessage || "无法加载 PDF 文档"}
          extra={[
            <Button key="retry" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
              重试
            </Button>,
            <Button key="close" onClick={closeDocument}>
              关闭
            </Button>,
          ]}
        />
      </div>
    );
  }

  if (status === "password") {
    return (
      <div
        className="pdf-viewer pdf-viewer--password"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <Result
          status="warning"
          title="文档已加密"
          subTitle="此 PDF 文档受密码保护，请输入密码"
          extra={
            <Card style={{ maxWidth: 320 }}>
              <p>密码输入功能待实现</p>
              <Button onClick={closeDocument}>取消</Button>
            </Card>
          }
        />
      </div>
    );
  }

  const pages = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => ({
      pageIndex: i,
      pageNumber: i + 1,
      pageSize: pageSizes[i] || { width: 0, height: 0 },
    }));
  }, [numPages, pageSizes]);

  return (
    <div
      className="pdf-viewer"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "#525659",
      }}
    >
      <div
        style={{
          padding: "8px 16px",
          backgroundColor: "#f5f5f5",
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <Toolbar onOpenFile={onOpenFile} />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <ThumbnailSidebar />

        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "auto",
            padding: "24px 48px",
          }}
        >
          <div
            ref={pageContainerRef}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minHeight: "100%",
            }}
          >
            {pages.map(({ pageIndex, pageNumber, pageSize }) => (
              <PdfPage
                key={pageIndex}
                pageIndex={pageIndex}
                pageNumber={pageNumber}
                pageSize={pageSize}
                containerWidth={containerWidth - 96}
              />
            ))}
          </div>
        </div>

        <SearchPanel />
      </div>
    </div>
  );
}

export { usePdf };
