import { useEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";
import { App as AntdApp, Menu, Result, Spin } from "antd";
import { DeleteOutlined, ReloadOutlined, RotateRightOutlined } from "@ant-design/icons";
import { useDocumentViewer } from "../pdf/use-document-viewer";
import { useViewerBridgeRef } from "../commands/viewer-bridge";
import { PdfToolbar, PdfStatusBar } from "./PdfToolbar";
import { PdfStage } from "./PdfStage";
import { SidebarPanel } from "./SidebarPanel";
import { StampDialog } from "./StampDialog";
import { applyElementBox } from "./geometry-style";
import { formatMessage } from "../lib/messages";

const THUMB_RASTER_W = 132;

const TOOL_LABEL_KEYS: Record<string, string> = {
  ink: "pdf.tool.ink",
  rect: "pdf.tool.rect",
  ellipse: "pdf.tool.ellipse",
  line: "pdf.tool.line",
  arrow: "pdf.tool.arrow",
  note: "pdf.tool.note",
};

/** 缩略图右键菜单（固定定位到指针位置） */
function ThumbContextMenu({
  x,
  y,
  onRotate,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
}): ReactElement {
  useEffect(() => {
    const close = (): void => onClose();
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [onClose]);
  return (
    <div className="pdf-thumb-menu" role="menu">
      <Menu
        inlineIndent={12}
        selectable={false}
        onClick={({ key }) => {
          if (key === "rotate") onRotate();
          if (key === "delete") onDelete();
        }}
        items={[
          { key: "rotate", icon: <RotateRightOutlined />, label: formatMessage("pdf.thumb.rotate") },
          { key: "delete", icon: <DeleteOutlined />, label: formatMessage("pdf.thumb.delete"), danger: true },
        ]}
      />
    </div>
  );
}

function ThumbMenuHost({ menu, onRotate, onDelete, onClose }: {
  menu: { x: number; y: number; origIdx: number };
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
}): ReactElement {
  const ref = useMenuPosition(menu.x, menu.y);
  return (
    <div ref={ref} className="pdf-thumb-menu-anchor">
      <ThumbContextMenu x={menu.x} y={menu.y} onRotate={onRotate} onDelete={onDelete} onClose={onClose} />
    </div>
  );
}

function useMenuPosition(x: number, y: number): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    applyElementBox(el, { left: x, top: y, width: 0, height: 0 });
  }, [x, y]);
  return ref;
}

/** 文档场景：工具栏 + 侧栏 + 中央滚动视图 + 状态栏 + 印章对话框 + 缩略图菜单 */
export function DocumentScene(): ReactElement {
  const viewer = useDocumentViewer();
  const { message } = AntdApp.useApp();
  const bridgeRef = useViewerBridgeRef();

  useEffect(() => {
    bridgeRef.current = viewer.bridge;
    return () => {
      bridgeRef.current = null;
    };
  }, [bridgeRef, viewer.bridge]);

  const ready = viewer.status === "ready" && viewer.doc !== null;
  const scalePercent = useMemo(() => Math.round(viewer.scale * 100), [viewer.scale]);

  if (viewer.status === "loading") {
    return (
      <div className="pdf-document-scene">
        <div className="pdf-document-loading">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (viewer.status === "error") {
    return (
      <div className="pdf-document-scene">
        <Result
          status="error"
          title={formatMessage("pdf.message.loadError")}
          subTitle={viewer.errorMessage ?? undefined}
          extra={
            <button
              type="button"
              className="pdf-error-retry"
              onClick={() => void viewer.runtime.reload()}
            >
              <ReloadOutlined /> {formatMessage("pdf.message.retry")}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="pdf-document-scene">
      <PdfToolbar
        hasDocument={ready}
        busy={viewer.saveBusy}
        currentPage={viewer.currentPage}
        pageCount={viewer.visList.length}
        pageInput={Number(viewer.pageInput) || 1}
        onPageInput={(value) => {
          if (value === null) return;
          viewer.setPageInput(String(value));
          viewer.goToPage(value);
        }}
        onPrevPage={viewer.prevPage}
        onNextPage={viewer.nextPage}
        scalePercent={scalePercent}
        onZoomOut={viewer.zoomOut}
        onZoomIn={viewer.zoomIn}
        onZoomReset={viewer.zoomReset}
        fitMode={viewer.fitMode}
        onFitWidth={() => viewer.setFit("width")}
        onFitPage={() => viewer.setFit("page")}
        onRotateLeft={() => {
          const origIdx = viewer.visList[viewer.currentPage - 1];
          if (origIdx !== undefined) viewer.rotatePage(origIdx, -90);
        }}
        onRotateRight={() => {
          const origIdx = viewer.visList[viewer.currentPage - 1];
          if (origIdx !== undefined) viewer.rotatePage(origIdx, 90);
        }}
        sidebarOpen={viewer.sidebar !== null}
        onToggleSidebar={viewer.toggleSidebar}
        onToggleFind={viewer.toggleFind}
        tool={viewer.tool}
        onToolChange={viewer.setTool}
        drawColor={viewer.drawColor}
        onDrawColor={viewer.setDrawColor}
        spread={viewer.spread}
        onSpreadChange={viewer.setSpread}
        onStamp={() => viewer.setStampDialogOpen(true)}
        onSave={() => void viewer.saveDocument()}
        onSaveAs={() => void viewer.saveDocumentAs()}
        dirty={viewer.dirty}
      />
      <div className="pdf-document-body">
        <SidebarPanel
          open={viewer.sidebar !== null}
          tab={viewer.sidebar ?? "thumbs"}
          onTabChange={(tab) => viewer.setSidebar(tab)}
          doc={viewer.doc}
          pageCount={viewer.visList.length}
          currentPage={viewer.currentPage}
          rotDelta={viewer.rotDelta}
          visibleThumbs={viewer.visibleThumbs}
          thumbsRef={viewer.thumbsRef}
          setThumbRef={viewer.setThumbRef}
          thumbRasterW={THUMB_RASTER_W}
          onThumbClick={(page) => viewer.goToPage(page)}
          onThumbContextMenu={(e, origIdx) => {
            e.preventDefault();
            viewer.setThumbMenu({ x: e.clientX, y: e.clientY, origIdx });
          }}
          outline={viewer.outline}
          onOutlineNode={viewer.openOutlineNode}
          searchQuery={viewer.searchQuery}
          searchBusy={viewer.searchBusy}
          searchMatches={viewer.searchMatches}
          searchCur={viewer.searchCur}
          onSearch={(query) => void viewer.runSearch(query)}
          onSearchJump={viewer.searchJumpTo}
        />
        {ready ? (
          <PdfStage viewer={viewer} />
        ) : (
          <div className="pdf-document-empty">
            <Spin />
          </div>
        )}
        {viewer.thumbMenu ? (
          <ThumbMenuHost
            menu={viewer.thumbMenu}
            onRotate={() => {
              if (viewer.thumbMenu) {
                viewer.rotatePage(viewer.thumbMenu.origIdx, 90);
                message.success(formatMessage("pdf.message.pageRotated"));
              }
              viewer.setThumbMenu(null);
            }}
            onDelete={() => {
              if (viewer.thumbMenu) {
                if (viewer.visList.length <= 1) {
                  message.warning(formatMessage("pdf.message.lastPage"));
                } else {
                  viewer.deletePage(viewer.thumbMenu.origIdx);
                  message.success(
                    formatMessage("pdf.message.pageDeleted", { page: viewer.thumbMenu.origIdx + 1 }),
                  );
                }
              }
              viewer.setThumbMenu(null);
            }}
            onClose={() => viewer.setThumbMenu(null)}
          />
        ) : null}
      </div>
      <PdfStatusBar
        currentPage={viewer.currentPage}
        pageCount={viewer.visList.length}
        scalePercent={scalePercent}
        toolLabel={
          viewer.tool === "select"
            ? ""
            : formatMessage(TOOL_LABEL_KEYS[viewer.tool] ?? "pdf.tool.ink")
        }
        dirty={viewer.dirty}
        fileName={viewer.runtime.fileName}
      />
      <StampDialog
        open={viewer.stampDialogOpen}
        config={viewer.stampCfg}
        onCancel={() => viewer.setStampDialogOpen(false)}
        onApply={(config) => {
          viewer.setStampCfg(config);
          viewer.setStampDialogOpen(false);
          message.success(formatMessage("pdf.message.stampApplied"));
        }}
        onClear={() => {
          viewer.setStampCfg(null);
          viewer.setStampDialogOpen(false);
          message.success(formatMessage("pdf.message.stampCleared"));
        }}
      />
    </div>
  );
}
