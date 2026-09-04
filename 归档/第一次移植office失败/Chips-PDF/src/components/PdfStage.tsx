import { useEffect, useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button } from "antd";
import { HighlightOutlined, StrikethroughOutlined, UnderlineOutlined } from "@ant-design/icons";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentViewer } from "../pdf/use-document-viewer";
import type { StampPreview } from "../pdf/use-document-viewer";
import { visibleFormWidgets, type FormWidget } from "../pdf/form-catalog";
import type { SearchMatch } from "../pdf/search";
import { PdfPageView } from "./PdfPageView";
import { MarkupOverlay, SearchHighlightOverlay } from "./MarkupOverlay";
import { DrawLayer, NotePin } from "./DrawLayer";
import { FormLayer } from "./FormLayer";
import { LinkLayer } from "./LinkLayer";
import { NoteMargin } from "./NoteMargin";
import { formatMessage } from "../lib/messages";

/** 页面盒子：宽高随缩放/旋转经 CSS 变量写入 */
function PageBox({
  width,
  height,
  className,
  children,
}: {
  width: number;
  height: number;
  className: string;
  children: ReactNode;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--page-width", `${width}px`);
    el.style.setProperty("--page-height", `${height}px`);
  }, [width, height]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** 印章预览图层（水印/页眉页脚在保存前以位图预览呈现） */
function StampPreviewLayer({
  previews,
  pageHeight,
}: {
  previews: StampPreview[];
  pageHeight: number;
}): ReactElement | null {
  if (previews.length === 0) return null;
  return (
    <div className="pdf-stamp-preview-layer">
      {previews.map((s, i) => (
        <StampPreviewImg key={i} preview={s} pageHeight={pageHeight} />
      ))}
    </div>
  );
}

function StampPreviewImg({
  preview,
  pageHeight,
}: {
  preview: StampPreview;
  pageHeight: number;
}): ReactElement {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 印章矩形为 PDF 坐标 [x1,y1,x2,y2]（y 向上）；显示坐标 y 向下，顶边 = 页高 - y2
    const x1 = preview.rect[0];
    const y2 = preview.rect[3];
    const w = preview.rect[2] - preview.rect[0];
    const h = preview.rect[3] - preview.rect[1];
    el.style.setProperty("--stamp-left", `${x1}px`);
    el.style.setProperty("--stamp-top", `${pageHeight - y2}px`);
    el.style.setProperty("--stamp-width", `${w}px`);
    el.style.setProperty("--stamp-height", `${h}px`);
    el.style.setProperty("--stamp-opacity", String(preview.opacity ?? 1));
  }, [preview, pageHeight]);
  return (
    <img
      ref={ref}
      className="pdf-stamp-preview"
      src={`data:image/png;base64,${preview.image}`}
      alt=""
      draggable={false}
    />
  );
}

/** 选区浮动标记条（高亮/下划线/删除线） */
function SelectionMarkupBar({
  x,
  y,
  onPick,
}: {
  x: number;
  y: number;
  onPick: (type: "highlight" | "underline" | "strikeout") => void;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--bar-left", `${x}px`);
    el.style.setProperty("--bar-top", `${y}px`);
  }, [x, y]);
  return (
    <div
      ref={ref}
      className="pdf-selection-bar"
      role="toolbar"
      aria-label={formatMessage("pdf.markup.highlight")}
    >
      <Button size="small" type="text" icon={<HighlightOutlined />} onClick={() => onPick("highlight")}>
        {formatMessage("pdf.markup.highlight")}
      </Button>
      <Button size="small" type="text" icon={<UnderlineOutlined />} onClick={() => onPick("underline")}>
        {formatMessage("pdf.markup.underline")}
      </Button>
      <Button size="small" type="text" icon={<StrikethroughOutlined />} onClick={() => onPick("strikeout")}>
        {formatMessage("pdf.markup.strikeout")}
      </Button>
    </div>
  );
}

/** 单个页面块：canvas + 全部覆盖层 */
function PageBlock({
  viewer,
  origIdx,
  rowIdx,
}: {
  viewer: DocumentViewer;
  origIdx: number;
  rowIdx: number;
}): ReactElement {
  const { doc, scale, formCatalog, visList, markups, savedMarkupModels, searchMatches, searchCur } = viewer;
  const geom = viewer.pageGeom(origIdx);
  const disp = viewer.dispSize(origIdx);
  const visible = viewer.visibleRows.has(rowIdx);

  const markupsForPage = useMemo(
    () => [...savedMarkupModels(origIdx), ...markups.filter((m) => m.pageIndex === origIdx)],
    [markups, origIdx, savedMarkupModels],
  );

  const widgets = useMemo<FormWidget[]>(
    () => visibleFormWidgets(formCatalog, visList).filter((w) => w.pageIndex === origIdx),
    [formCatalog, origIdx, visList],
  );

  const pageMatches = useMemo<SearchMatch[]>(
    () => searchMatches.filter((m) => m.pageIndex === origIdx),
    [origIdx, searchMatches],
  );

  const activeMatch = useMemo<SearchMatch | null>(() => {
    const current = searchMatches[searchCur];
    return current && current.pageIndex === origIdx ? current : null;
  }, [origIdx, searchCur, searchMatches]);

  const threads = useMemo(() => viewer.threadFor(origIdx), [origIdx, viewer]);

  const previews = viewer.stampPreviews.get(origIdx) ?? [];
  const pageDrawings = useMemo(
    () => viewer.drawings.filter((d) => d.input.pageIndex === origIdx),
    [origIdx, viewer.drawings],
  );

  return (
    <PageBox
      width={disp.width * scale}
      height={disp.height * scale}
      className="pdf-page"
    >
      <PdfPageView
        doc={doc as PDFDocumentProxy}
        pageNo={origIdx + 1}
        scale={scale}
        rotationDelta={viewer.rotDelta(origIdx)}
        visible={visible}
      />
      <StampPreviewLayer previews={previews} pageHeight={disp.height} />
      <SearchHighlightOverlay
        rects={pageMatches.flatMap((m) => m.rects)}
        activeRects={activeMatch ? activeMatch.rects : []}
        geom={geom}
        scale={scale}
      />
      <MarkupOverlay markups={markupsForPage} geom={geom} scale={scale} />
      <FormLayer
        widgets={widgets}
        geom={geom}
        scale={scale}
        edits={viewer.formEdits}
        onEdit={viewer.setFormEdit}
      />
      <DrawLayer
        geom={geom}
        scale={scale}
        pageWidth={disp.width}
        pageHeight={disp.height}
        drawings={pageDrawings}
        tool={viewer.tool === "select" ? null : viewer.tool}
        color={viewer.drawColor}
        strokeWidth={2}
        onCommit={viewer.commitDrawing}
        onNoteAt={(at) => viewer.placeNoteAt(origIdx, at)}
      />
      <LinkLayer
        doc={doc as PDFDocumentProxy}
        pageNo={origIdx + 1}
        geom={geom}
        scale={scale}
        onGoToDest={(dest) => void viewer.goToDest(dest)}
        onOpenExternal={(url) => {
          const client = viewer.runtime.client;
          if (!client) return;
          void client.transfer.openExternal(url).catch(() => {});
        }}
      />
      <div className="pdf-note-pin-layer">
        {threads.map((root) => (
          <NotePin
            key={root.key}
            pinKey={root.key}
            at={root.at}
            geom={geom}
            scale={scale}
            color={root.color}
            active={viewer.activeNoteKey === root.key}
            title={`${root.contents}\n${formatMessage("pdf.note.openThread")}`}
            onOpen={(key) => {
              viewer.setActiveNoteKey(key === viewer.activeNoteKey ? null : key);
            }}
          />
        ))}
      </div>
    </PageBox>
  );
}

/** 中央滚动文档视图（连续滚动）+ 选区标记条 + 批注边栏 */
export function PdfStage({ viewer }: { viewer: DocumentViewer }): ReactElement {
  return (
    <div
      className={`pdf-stage${viewer.tool !== "select" ? " pdf-stage-tool-active" : ""}`}
      data-tool={viewer.tool}
      ref={viewer.scrollRef}
      onScroll={viewer.handleScroll}
      onMouseUp={() => viewer.handleStageMouseUp()}
      onMouseDown={(e) => {
        const bar = (e.target as HTMLElement).closest(".pdf-selection-bar");
        if (!bar) viewer.dismissSelPopup();
      }}
    >
      <div className="pdf-scroll-inner">
        {viewer.rows.map((row, rowIdx) => (
          <div key={rowIdx} ref={viewer.setRowRef(rowIdx)} data-idx={rowIdx} className="pdf-row">
            {row.map((origIdx) => (
              <PageBlock key={origIdx} viewer={viewer} origIdx={origIdx} rowIdx={rowIdx} />
            ))}
            {viewer.noteMarginOn ? (
              <NoteMarginContainer
                viewer={viewer}
                pageOrigIdx={row[0] ?? 0}
                threads={row.flatMap((origIdx) => viewer.threadFor(origIdx))}
              />
            ) : null}
          </div>
        ))}
      </div>
      {viewer.selPopup ? (
        <SelectionMarkupBar
          x={viewer.selPopup.x}
          y={viewer.selPopup.y}
          onPick={(type) => viewer.commitMarkup(type)}
        />
      ) : null}
    </div>
  );
}

function NoteMarginContainer({
  viewer,
  pageOrigIdx,
  threads,
}: {
  viewer: DocumentViewer;
  pageOrigIdx: number;
  threads: ReturnType<DocumentViewer["threadFor"]>;
}): ReactElement {
  const geom = viewer.pageGeom(pageOrigIdx);
  return (
    <NoteMargin
      threads={threads}
      pageHeight={geom.ph}
      scale={viewer.scale}
      activeKey={viewer.activeNoteKey}
      draft={viewer.noteDraft !== null}
      noteEditDraft={viewer.noteEditDraft}
      setNoteEditDraft={viewer.setNoteEditDraft}
      editSavedNote={viewer.editSavedNote}
      replyToNote={viewer.replyToNote}
      replyToPending={viewer.replyToPending}
      publishDraft={() => {
        viewer.publishNoteDraft(viewer.noteDraftValue);
        viewer.setNoteDraftValue("");
      }}
      cancelDraft={() => {
        viewer.setNoteDraft(null);
        viewer.setNoteDraftValue("");
      }}
      draftValue={viewer.noteDraftValue}
      setDraftValue={viewer.setNoteDraftValue}
    />
  );
}
