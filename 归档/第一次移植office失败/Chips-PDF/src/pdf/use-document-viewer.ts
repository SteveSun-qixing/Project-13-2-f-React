import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfRuntime } from "../app/PdfRuntimeProvider";
import { MARKUP_COLORS, type LocalMarkup, type MarkupType } from "./annotations";
import type { DrawingInput, LocalDrawing } from "./drawings";
import {
  buildNoteThreads,
  noteReplyTarget,
  pendingNoteKey,
  savedNoteKey,
  type NoteThreadItem,
  type SavedNoteAnnot,
} from "./notes";
import { loadSavedAnnots, type PageSavedAnnots } from "./saved-annotations";
import type { FormValueInput } from "./form-catalog";
import { buildSearchIndex, searchInIndex, type SearchIndex, type SearchMatch } from "./search";
import {
  DEFAULT_HEADER_FOOTER,
  DEFAULT_WATERMARK,
  buildStamps,
  headerFooterUsed,
  type HeaderFooterConfig,
  type WatermarkConfig,
} from "./stamps";
import { rowOfVisIdx, spreadRows, stepPage } from "./spread";
import { MAX_SCALE, MIN_SCALE, ZOOM_STEPS, clampScale, type FitMode, type ViewerTool } from "./view-config";
import { NOTE_MARGIN_W, PAGE_GAP, SCROLL_PAD } from "./view-config";
import { captureViewState, loadViewState, saveViewState, type PdfViewState } from "./view-state";
import type { SavePdfRequest } from "./save-pdf";
import { useVisibleSet } from "./use-visible-set";
import { geomDispSize, selectionQuadsByPage, type PageGeom, type PageSize } from "./geometry";

/** 已保存便签的就地内容改写（保存时按旧内容匹配） */
export interface LocalNoteEdit {
  id: string;
  annot: SavedNoteAnnot;
  contents: string;
}

export interface StampConfig {
  wm: WatermarkConfig | null;
  hf: HeaderFooterConfig | null;
}

export const DEFAULT_STAMP_CONFIG: StampConfig = { wm: DEFAULT_WATERMARK, hf: DEFAULT_HEADER_FOOTER };

export interface StampPreview {
  image: string;
  rect: [number, number, number, number];
  opacity?: number;
}

export interface SelectionPopup {
  x: number;
  y: number;
  /** 原始页下标 → PDF 坐标四点组 */
  quads: Map<number, number[][]>;
}

export type SidebarTab = "thumbs" | "outline" | "search";

let idCounter = 0;
const nextId = (): string => `e${Date.now().toString(36)}-${(idCounter += 1)}`;

export function useDocumentViewer() {
  const runtime = usePdfRuntime();
  const { doc, sizes, baseRots, status, formCatalog, outline, encrypted } = runtime;

  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [spread, setSpread] = useState<1 | 2>(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [sidebar, setSidebar] = useState<SidebarTab | null>("thumbs");
  const [tool, setToolState] = useState<ViewerTool>("select");
  const [drawColor, setDrawColor] = useState<[number, number, number]>([0.86, 0.22, 0.18]);
  const [markups, setMarkups] = useState<LocalMarkup[]>([]);
  const [drawings, setDrawings] = useState<LocalDrawing[]>([]);
  const [noteEdits, setNoteEdits] = useState<LocalNoteEdit[]>([]);
  const [formEdits, setFormEdits] = useState<Map<string, FormValueInput>>(new Map());
  const [rotations, setRotations] = useState<Map<number, number>>(new Map());
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [stampCfg, setStampCfg] = useState<StampConfig | null>(null);
  const [stampDialogOpen, setStampDialogOpen] = useState(false);
  const [savedAnnots, setSavedAnnots] = useState<Map<number, PageSavedAnnots>>(new Map());
  const [activeNoteKey, setActiveNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ origIdx: number; at: [number, number] } | null>(null);
  const [noteEditDraft, setNoteEditDraft] = useState<{ key: string; contents: string } | null>(null);
  const [selPopup, setSelPopup] = useState<SelectionPopup | null>(null);
  const [noteDraftValue, setNoteDraftValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [searchCur, setSearchCur] = useState(0);
  const [searchBusy, setSearchBusy] = useState(false);
  const [thumbMenu, setThumbMenu] = useState<{ x: number; y: number; origIdx: number } | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [stampPreviews, setStampPreviews] = useState<Map<number, StampPreview[]>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const fitModeRef = useRef<FitMode>("width");
  const pendingViewRestoreRef = useRef<PdfViewState | null>(null);
  const searchIndexRef = useRef<{ doc: PDFDocumentProxy; promise: Promise<SearchIndex> } | null>(null);
  const viewStateTimerRef = useRef<number | null>(null);
  const zoomScrollRef = useRef<number | null>(null);
  const currentPageRef = useRef(1);

  // ── 页面几何 ──────────────────────────────────────────────

  const visList = useMemo(
    () => sizes.map((_, i) => i).filter((i) => !deleted.has(i)),
    [sizes, deleted],
  );
  const rows = useMemo(() => spreadRows(visList, spread), [visList, spread]);

  const rotDelta = useCallback((origIdx: number) => rotations.get(origIdx) ?? 0, [rotations]);

  const pageGeom = useCallback(
    (origIdx: number): PageGeom => {
      const s = sizes[origIdx] ?? { width: 595, height: 842 };
      return { pw: s.width, ph: s.height, rot: (baseRots[origIdx] ?? 0) + rotDelta(origIdx) };
    },
    [sizes, baseRots, rotDelta],
  );

  const dispSize = useCallback(
    (origIdx: number): PageSize => geomDispSize(pageGeom(origIdx)),
    [pageGeom],
  );

  const rowSize = useCallback(
    (row: number[]): PageSize => {
      const dims = row.map((i) => dispSize(i));
      return {
        width: dims.reduce((w, d) => w + d.width, 0) + (dims.length - 1) * PAGE_GAP,
        height: Math.max(...dims.map((d) => d.height), 0),
      };
    },
    [dispSize],
  );

  const rowTop = useCallback(
    (rowIdx: number): number => {
      let y = PAGE_GAP;
      for (let i = 0; i < rowIdx; i++) y += rowSize(rows[i] ?? []).height * scale + PAGE_GAP;
      return y;
    },
    [rows, rowSize, scale],
  );

  const noteMarginOn = useMemo(
    () =>
      tool === "note" ||
      noteDraft !== null ||
      drawings.some((d) => d.input.kind === "note") ||
      [...savedAnnots.values()].some((a) => a.notes.length > 0),
    [tool, noteDraft, drawings, savedAnnots],
  );

  const { visible: visibleRows, setItemRef: setRowRef } = useVisibleSet(
    scrollRef,
    rows.length,
    "800px 0px",
  );
  const { visible: visibleThumbs, setItemRef: setThumbRef } = useVisibleSet(
    thumbsRef,
    rows.length,
    "400px 0px",
    sidebar === "thumbs",
  );

  // ── 滚动定位与当前页跟踪 ─────────────────────────────────

  const captureAndSaveViewState = useCallback(() => {
    const el = scrollRef.current;
    const path = runtime.filePath ?? runtime.target?.sourceId ?? "";
    if (!el || !path || rows.length === 0) return;
    const rowHeights = rows.map((r) => rowSize(r).height * scale);
    const rowPages = rows.map((r) => visList.indexOf(r[0] ?? 0) + 1);
    saveViewState(
      path,
      captureViewState({
        scrollTop: el.scrollTop,
        rowHeights,
        rowPages,
        gap: PAGE_GAP,
        scale,
        fitMode: fitModeRef.current,
      }),
    );
  }, [rows, rowSize, scale, visList, runtime.filePath, runtime.target]);

  const scheduleViewStateSave = useCallback(() => {
    if (viewStateTimerRef.current !== null) return;
    viewStateTimerRef.current = window.setTimeout(() => {
      viewStateTimerRef.current = null;
      captureAndSaveViewState();
    }, 500);
  }, [captureAndSaveViewState]);

  const goToOffset = useCallback((top: number): void => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, top - SCROLL_PAD);
  }, []);

  const goToPage = useCallback(
    (page: number, frac = 0): void => {
      if (rows.length === 0) return;
      const clamped = Math.min(Math.max(1, page), Math.max(visList.length, 1));
      const visIdx = clamped - 1;
      const rowIdx = rowOfVisIdx(visIdx, spread);
      const rowHeight = rowSize(rows[rowIdx] ?? []).height * scale;
      goToOffset(rowTop(rowIdx) + frac * rowHeight);
      currentPageRef.current = clamped;
      setCurrentPage(clamped);
      setPageInput(String(clamped));
    },
    [goToOffset, rowSize, rowTop, rows, scale, spread, visList],
  );

  const nextPage = useCallback((): void => {
    goToPage(stepPage(visList, spread, currentPageRef.current, 1));
  }, [goToPage, spread, visList]);

  const prevPage = useCallback((): void => {
    goToPage(stepPage(visList, spread, currentPageRef.current, -1));
  }, [goToPage, spread, visList]);

  const handleScroll = useCallback((): void => {
    const el = scrollRef.current;
    if (!el || rows.length === 0) return;
    const y = el.scrollTop;
    let rowIdx = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rowTop(i) <= y) rowIdx = i;
      else break;
    }
    const first = rows[rowIdx]?.[0];
    if (first !== undefined) {
      const page = visList.indexOf(first) + 1;
      if (page !== currentPageRef.current) {
        currentPageRef.current = page;
        setCurrentPage(page);
        setPageInput(String(page));
      }
    }
    scheduleViewStateSave();
  }, [rows, rowTop, scheduleViewStateSave, visList]);

  // 当前页随页数收敛
  useEffect(() => {
    if (currentPageRef.current > visList.length && visList.length > 0) {
      currentPageRef.current = visList.length;
      setCurrentPage(visList.length);
      setPageInput(String(visList.length));
    }
  }, [visList.length]);

  // 当前页缩略图跟随主视口
  useEffect(() => {
    if (sidebar !== "thumbs") return;
    const thumbEl = thumbsRef.current?.querySelector<HTMLElement>(`[data-idx="${currentPage - 1}"]`);
    thumbEl?.scrollIntoView({ block: "nearest" });
  }, [currentPage, sidebar]);

  // ── 缩放（锚定当前视口内容点） ────────────────────────────

  const anchorZoomScroll = useCallback(
    (nextScale: number): void => {
      const el = scrollRef.current;
      if (!el || scale <= 0 || rows.length === 0 || nextScale === scale) return;
      const y = el.scrollTop;
      let rowIdx = 0;
      for (let i = 0; i < rows.length; i++) {
        if (rowTop(i) <= y) rowIdx = i;
        else break;
      }
      let top = PAGE_GAP;
      for (let i = 0; i < rowIdx; i++) top += rowSize(rows[i] ?? []).height * nextScale + PAGE_GAP;
      const within = y - rowTop(rowIdx);
      const rowH = rowSize(rows[rowIdx] ?? []).height;
      const content = Math.min(Math.max(within, 0), rowH * scale);
      zoomScrollRef.current = top + (content / scale) * nextScale + (within - content);
    },
    [rows, rowSize, rowTop, scale],
  );

  useEffect(() => {
    if (zoomScrollRef.current === null) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = zoomScrollRef.current;
    zoomScrollRef.current = null;
  }, [scale]);

  const applyScale = useCallback(
    (nextScale: number): void => {
      const clamped = clampScale(nextScale);
      anchorZoomScroll(clamped);
      fitModeRef.current = null;
      setFitMode(null);
      setScale(clamped);
    },
    [anchorZoomScroll],
  );

  const zoomIn = useCallback((): void => {
    const next = ZOOM_STEPS.find((s) => s > scale + 1e-6);
    applyScale(next ?? MAX_SCALE);
  }, [applyScale, scale]);

  const zoomOut = useCallback((): void => {
    const below = ZOOM_STEPS.filter((s) => s < scale - 1e-6);
    applyScale(below.length > 0 ? (below[below.length - 1] ?? MIN_SCALE) : MIN_SCALE);
  }, [applyScale, scale]);

  const zoomReset = useCallback((): void => {
    applyScale(1);
  }, [applyScale]);

  const setFit = useCallback((mode: Exclude<FitMode, null>): void => {
    fitModeRef.current = mode;
    setFitMode(mode);
  }, []);

  const recomputeFit = useCallback((): void => {
    const mode = fitModeRef.current;
    const el = scrollRef.current;
    if (!mode || !el || rows.length === 0) return;
    const dims = rows.map((r) => rowSize(r));
    const maxW = Math.max(...dims.map((s) => s.width), 1);
    const availW = el.clientWidth - SCROLL_PAD * 2 - (noteMarginOn ? NOTE_MARGIN_W + PAGE_GAP : 0);
    const next =
      mode === "width"
        ? clampScale(availW / maxW)
        : clampScale(
            Math.min(
              availW / maxW,
              (el.clientHeight - PAGE_GAP * 2) / Math.max(...dims.map((s) => s.height), 1),
            ),
          );
    anchorZoomScroll(next);
    setScale(next);
  }, [anchorZoomScroll, noteMarginOn, rows, rowSize]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recomputeFit);
    ro.observe(el);
    recomputeFit();
    return () => ro.disconnect();
  }, [recomputeFit]);

  // ── 视图状态还原（打开文档后一次性） ─────────────────────

  useEffect(() => {
    if (runtime.status !== "loading") return;
    const path = runtime.filePath ?? runtime.target?.sourceId ?? "";
    pendingViewRestoreRef.current = loadViewState(path);
  }, [runtime.status, runtime.filePath, runtime.target]);

  useEffect(() => {
    if (status !== "ready" || !doc || rows.length === 0) return;
    const saved = pendingViewRestoreRef.current;
    pendingViewRestoreRef.current = null;
    if (!saved) return;
    if (saved.fitMode === null) {
      setScale(clampScale(saved.scale));
      fitModeRef.current = null;
      setFitMode(null);
    } else {
      fitModeRef.current = saved.fitMode;
      setFitMode(saved.fitMode);
    }
    const timer = window.setTimeout(() => goToPage(saved.page, saved.frac), 30);
    return () => window.clearTimeout(timer);
  }, [doc, goToPage, rows.length, status]);

  // ── 工具与批注状态 ───────────────────────────────────────

  const setTool = useCallback((next: ViewerTool): void => {
    setToolState(next);
    if (next !== "note") setNoteDraft(null);
  }, []);

  const resetEdits = useCallback((): void => {
    setMarkups([]);
    setDrawings([]);
    setNoteEdits([]);
    setFormEdits(new Map());
    setRotations(new Map());
    setDeleted(new Set());
    setStampCfg(null);
    setSelPopup(null);
    setActiveNoteKey(null);
    setNoteDraft(null);
    setNoteEditDraft(null);
  }, []);

  // ── 保存链路 ─────────────────────────────────────────────

  const buildSaveRequest = useCallback((): SavePdfRequest => {
    const stamps = stampCfg
      ? buildStamps(
          visList.map((origIdx, i) => ({
            origIdx,
            pw: (sizes[origIdx] ?? { width: 0, height: 0 }).width,
            ph: (sizes[origIdx] ?? { width: 0, height: 0 }).height,
            displayNo: i + 1,
          })),
          stampCfg.wm,
          stampCfg.hf,
        )
      : [];
    return {
      markups: markups.map(({ id: _id, ...input }) => input),
      drawings: drawings.map((d) => d.input),
      noteEdits: noteEdits.map((e) => ({
        pageIndex: e.annot.pageIndex,
        objNum: e.annot.objNum,
        rect: e.annot.rect,
        oldContents: e.annot.contents,
        contents: e.contents,
      })),
      formValues: [...formEdits.values()],
      stamps,
      rotations: [...rotations].map(([pageIndex, delta]) => ({ pageIndex, delta })),
      deletedPages: [...deleted],
    };
  }, [deleted, drawings, formEdits, markups, noteEdits, rotations, sizes, stampCfg, visList]);

  const buildSaveRequestRef = useRef(buildSaveRequest);
  buildSaveRequestRef.current = buildSaveRequest;

  const handleSaved = useCallback(async (): Promise<void> => {
    resetEdits();
    await runtime.reload();
  }, [resetEdits, runtime]);

  const saveDocument = useCallback(async (): Promise<void> => {
    setSaveBusy(true);
    try {
      const result = await runtime.persist(buildSaveRequestRef.current(), "save");
      if (result !== "cancelled") await handleSaved();
    } finally {
      setSaveBusy(false);
    }
  }, [handleSaved, runtime]);

  const saveDocumentAs = useCallback(async (): Promise<void> => {
    setSaveBusy(true);
    try {
      const result = await runtime.persist(buildSaveRequestRef.current(), "save-as");
      if (result === "written") await handleSaved();
      else if (result === "downloaded") resetEdits();
    } finally {
      setSaveBusy(false);
    }
  }, [handleSaved, resetEdits, runtime]);

  const dirty = useMemo(
    () =>
      markups.length > 0 ||
      drawings.length > 0 ||
      noteEdits.length > 0 ||
      formEdits.size > 0 ||
      rotations.size > 0 ||
      deleted.size > 0 ||
      stampCfg !== null,
    [
      deleted.size,
      drawings.length,
      formEdits.size,
      markups.length,
      noteEdits.length,
      rotations.size,
      stampCfg,
    ],
  );

  // ── 选区标记 ─────────────────────────────────────────────

  const handleStageMouseUp = useCallback((): void => {
    if (tool !== "select") return;
    const el = scrollRef.current;
    if (!el || doc === null) return;
    const geoms = visList.map((i) => pageGeom(i));
    const quads = selectionQuadsByPage(el, geoms, scale);
    if (!quads) {
      setSelPopup(null);
      return;
    }
    const sel = window.getSelection();
    const rect = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    setSelPopup({
      x: rect ? rect.left : 0,
      y: rect ? rect.bottom + 8 : 0,
      quads,
    });
  }, [doc, pageGeom, scale, tool, visList]);

  const commitMarkup = useCallback(
    (type: MarkupType): void => {
      if (!selPopup) return;
      const next: LocalMarkup[] = [];
      for (const [pageIndex, quads] of selPopup.quads) {
        next.push({ id: nextId(), pageIndex, type, color: MARKUP_COLORS[type], quads });
      }
      if (next.length > 0) setMarkups((prev) => [...prev, ...next]);
      setSelPopup(null);
      window.getSelection()?.removeAllRanges();
    },
    [selPopup],
  );

  const dismissSelPopup = useCallback((): void => {
    setSelPopup((prev) => (prev === null ? prev : null));
  }, []);

  // ── 绘图与便签 ───────────────────────────────────────────

  const commitDrawing = useCallback((input: DrawingInput): void => {
    setDrawings((prev) => [...prev, { id: nextId(), input }]);
  }, []);

  const placeNoteAt = useCallback((origIdx: number, at: [number, number]): void => {
    setNoteDraft({ origIdx, at });
    setActiveNoteKey(null);
  }, []);

  const publishNoteDraft = useCallback(
    (contents: string): void => {
      if (!noteDraft || !contents.trim()) return;
      const localId = nextId();
      commitDrawing({
        kind: "note",
        pageIndex: noteDraft.origIdx,
        color: drawColor,
        at: noteDraft.at,
        contents: contents.trim(),
        createdMs: Date.now(),
        localId,
      });
      setActiveNoteKey(pendingNoteKey(localId));
      setNoteDraft(null);
    },
    [commitDrawing, drawColor, noteDraft],
  );

  const replyToNote = useCallback(
    (annot: SavedNoteAnnot, contents: string): void => {
      if (!contents.trim()) return;
      commitDrawing({
        kind: "note",
        pageIndex: annot.pageIndex,
        color: drawColor,
        at: [annot.rect[0], Math.max(annot.rect[1], annot.rect[3])],
        contents: contents.trim(),
        createdMs: Date.now(),
        replyToSaved: noteReplyTarget(annot),
      });
    },
    [commitDrawing, drawColor],
  );

  const replyToPending = useCallback(
    (pendingId: string, contents: string): void => {
      if (!contents.trim()) return;
      const parent = drawings.find(
        (d) => d.id === pendingId && d.input.kind === "note",
      );
      const parentAt =
        parent && parent.input.kind === "note" ? parent.input.at : ([0, 0] as [number, number]);
      commitDrawing({
        kind: "note",
        pageIndex: parent && parent.input.kind === "note" ? parent.input.pageIndex : 0,
        color: drawColor,
        at: parentAt,
        contents: contents.trim(),
        createdMs: Date.now(),
        replyToLocalId: pendingId,
      });
    },
    [commitDrawing, drawings],
  );

  const editSavedNote = useCallback((annot: SavedNoteAnnot, contents: string): void => {
    setNoteEdits((prev) => {
      const others = prev.filter((e) => e.annot.objNum !== annot.objNum);
      return contents === annot.contents ? others : [...others, { id: nextId(), annot, contents }];
    });
  }, []);

  const threadFor = useCallback(
    (page: number): NoteThreadItem[] =>
      buildNoteThreads(
        savedAnnots.get(page)?.notes ?? [],
        drawings
          .filter((d) => d.input.kind === "note" && d.input.pageIndex === page)
          .map((d) => ({ id: d.id, input: d.input as Extract<DrawingInput, { kind: "note" }> })),
      ),
    [drawings, savedAnnots],
  );

  // ── 已保存批注的按页懒加载 ───────────────────────────────

  useEffect(() => {
    if (!doc) {
      setSavedAnnots((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    const visiblePages = new Set<number>();
    for (const rowIdx of visibleRows) {
      for (const origIdx of rows[rowIdx] ?? []) visiblePages.add(origIdx);
    }
    const missing = [...visiblePages].filter((p) => !savedAnnots.has(p));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const additions = await Promise.all(
        missing.map(async (p) => [p, await loadSavedAnnots(doc, p)] as const),
      );
      if (cancelled) return;
      setSavedAnnots((prev) => {
        const next = new Map(prev);
        for (const [p, annots] of additions) next.set(p, annots);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, rows, savedAnnots, visibleRows]);

  /** 已保存标记 → 渲染模型（带默认色回退） */
  const savedMarkupModels = useCallback(
    (page: number): LocalMarkup[] =>
      (savedAnnots.get(page)?.markups ?? []).map((m) => ({
        id: savedNoteKey(m.objNum),
        pageIndex: m.pageIndex,
        type: m.type,
        quads: m.quads,
        color: MARKUP_COLORS[m.type],
      })),
    [savedAnnots],
  );

  // ── 印章预览（可见页范围） ───────────────────────────────

  useEffect(() => {
    if (
      !stampCfg ||
      (!stampCfg.wm?.text.trim() && (!stampCfg.hf || !headerFooterUsed(stampCfg.hf)))
    ) {
      setStampPreviews((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    const visiblePages = new Set<number>();
    for (const rowIdx of visibleRows) {
      for (const origIdx of rows[rowIdx] ?? []) visiblePages.add(origIdx);
    }
    const entries = [...visiblePages]
      .filter((i) => sizes[i] !== undefined)
      .map((origIdx) => ({
        origIdx,
        pw: (sizes[origIdx] ?? { width: 0, height: 0 }).width,
        ph: (sizes[origIdx] ?? { width: 0, height: 0 }).height,
        displayNo: visList.indexOf(origIdx) + 1,
      }));
    const map = new Map<number, StampPreview[]>();
    for (const s of buildStamps(entries, stampCfg.wm, stampCfg.hf)) {
      const list = map.get(s.pageIndex);
      const item: StampPreview = { image: s.image, rect: s.rect, opacity: s.opacity };
      if (list) list.push(item);
      else map.set(s.pageIndex, [item]);
    }
    setStampPreviews(map);
  }, [rows, sizes, stampCfg, visList, visibleRows]);

  // ── 页面操作 ─────────────────────────────────────────────

  const rotatePage = useCallback((origIdx: number, delta: number): void => {
    setRotations((prev) => {
      const next = new Map(prev);
      next.set(origIdx, ((((next.get(origIdx) ?? 0) + delta) % 360) + 360) % 360);
      return next;
    });
  }, []);

  const deletePage = useCallback((origIdx: number): void => {
    setDeleted((prev) => {
      if (prev.has(origIdx) || sizes.length - prev.size <= 1) return prev;
      const next = new Set(prev);
      next.add(origIdx);
      return next;
    });
  }, [sizes.length]);

  // ── 表单 ─────────────────────────────────────────────────

  const setFormEdit = useCallback((value: FormValueInput): void => {
    setFormEdits((prev) => {
      const next = new Map(prev);
      next.set(value.name, value);
      return next;
    });
  }, []);

  // ── 搜索 ─────────────────────────────────────────────────

  const ensureSearchIndex = useCallback(async (): Promise<SearchIndex | null> => {
    if (!doc) return null;
    if (searchIndexRef.current?.doc === doc) return searchIndexRef.current.promise;
    const promise = buildSearchIndex(doc);
    searchIndexRef.current = { doc, promise };
    return promise;
  }, [doc]);

  const jumpToMatch = useCallback(
    (matches: SearchMatch[], cur: number): void => {
      const match = matches[cur];
      if (!match) return;
      const visIdx = visList.indexOf(match.pageIndex);
      if (visIdx < 0) return;
      const rowIdx = rowOfVisIdx(visIdx, spread);
      let offset = 0;
      const rect = match.rects[0];
      if (rect) {
        const g = pageGeom(match.pageIndex);
        const topInView = g.ph - (rect[1] + rect[3]);
        offset = Math.max(0, topInView * scale - 80);
      }
      goToOffset(rowTop(rowIdx) + offset);
      currentPageRef.current = visIdx + 1;
      setCurrentPage(visIdx + 1);
      setPageInput(String(visIdx + 1));
    },
    [goToOffset, pageGeom, rowTop, scale, spread, visList],
  );

  const runSearch = useCallback(
    async (query: string): Promise<void> => {
      setSearchQuery(query);
      if (!query.trim()) {
        setSearchMatches([]);
        setSearchCur(0);
        return;
      }
      setSearchBusy(true);
      try {
        const index = await ensureSearchIndex();
        if (!index) return;
        const matches = searchInIndex(index, query);
        setSearchMatches(matches);
        setSearchCur(matches.length > 0 ? 0 : -1);
        if (matches.length > 0) jumpToMatch(matches, 0);
      } finally {
        setSearchBusy(false);
      }
    },
    [ensureSearchIndex, jumpToMatch],
  );

  const searchNext = useCallback((): void => {
    if (searchMatches.length === 0) return;
    const next = (searchCur + 1) % searchMatches.length;
    setSearchCur(next);
    jumpToMatch(searchMatches, next);
  }, [jumpToMatch, searchCur, searchMatches]);

  const searchPrev = useCallback((): void => {
    if (searchMatches.length === 0) return;
    const prev = (searchCur - 1 + searchMatches.length) % searchMatches.length;
    setSearchCur(prev);
    jumpToMatch(searchMatches, prev);
  }, [jumpToMatch, searchCur, searchMatches]);

  const searchJumpTo = useCallback(
    (index: number): void => {
      const match = searchMatches[index];
      if (!match) return;
      setSearchCur(index);
      jumpToMatch(searchMatches, index);
    },
    [jumpToMatch, searchMatches],
  );

  const toggleFind = useCallback((): void => {
    setSidebar((prev) => (prev === "search" ? null : "search"));
  }, []);

  const toggleSidebar = useCallback((): void => {
    setSidebar((prev) => (prev === null ? "thumbs" : null));
  }, []);

  // ── 目的地跳转（书签/内链） ──────────────────────────────

  const goToDest = useCallback(
    async (dest: unknown): Promise<void> => {
      if (!doc) return;
      try {
        let explicit: unknown = dest;
        if (typeof dest === "string") explicit = await doc.getDestination(dest);
        if (!Array.isArray(explicit) || explicit.length === 0) return;
        const ref = explicit[0];
        if (ref && typeof ref === "object" && "num" in (ref as Record<string, unknown>)) {
          const pageIndex = await doc.getPageIndex(ref as Parameters<typeof doc.getPageIndex>[0]);
          goToPage(pageIndex + 1);
        }
      } catch {
        // 无效目的地：忽略
      }
    },
    [doc, goToPage],
  );

  const openOutlineNode = useCallback(
    (node: { url?: string; dest?: unknown }): void => {
      if (node.url) {
        const client = runtime.client;
        if (!client) return;
        void client.transfer.openExternal(node.url).catch(() => {});
      } else if (node.dest !== undefined && node.dest !== null) {
        void goToDest(node.dest);
      }
    },
    [goToDest, runtime.client],
  );

  // ── 命令桥 ───────────────────────────────────────────────

  const bridge = useMemo(
    () => ({
      hasDocument: () => doc !== null,
      openDocument: () => runtime.openFromDialog(),
      saveDocument: (): Promise<void> => saveDocument(),
      saveDocumentAs: (): Promise<void> => saveDocumentAs(),
      zoomIn,
      zoomOut,
      zoomReset,
      nextPage,
      prevPage,
      toggleFind,
      toggleSidebar,
      setTool,
    }),
    [
      doc,
      nextPage,
      prevPage,
      runtime,
      saveDocument,
      saveDocumentAs,
      setTool,
      toggleFind,
      toggleSidebar,
      zoomIn,
      zoomOut,
      zoomReset,
    ],
  );

  return {
    runtime,
    doc,
    status,
    errorMessage: runtime.errorMessage,
    formCatalog,
    outline,
    encrypted,
    scale,
    fitMode,
    spread,
    setSpread,
    currentPage,
    pageInput,
    setPageInput,
    goToPage,
    nextPage,
    prevPage,
    sidebar,
    setSidebar,
    toggleSidebar,
    toggleFind,
    tool,
    setTool,
    setNoteDraft,
    drawColor,
    setDrawColor,
    visList,
    rows,
    visibleRows,
    setRowRef,
    visibleThumbs,
    setThumbRef,
    thumbsRef,
    scrollRef,
    pageGeom,
    dispSize,
    rotDelta,
    handleScroll,
    handleStageMouseUp,
    selPopup,
    dismissSelPopup,
    commitMarkup,
    noteDraftValue,
    setNoteDraftValue,
    markups,
    drawings,
    commitDrawing,
    noteMarginOn,
    noteDraft,
    placeNoteAt,
    publishNoteDraft,
    activeNoteKey,
    setActiveNoteKey,
    noteEditDraft,
    setNoteEditDraft,
    replyToNote,
    replyToPending,
    editSavedNote,
    threadFor,
    savedAnnots,
    savedMarkupModels,
    formEdits,
    setFormEdit,
    rotatePage,
    deletePage,
    thumbMenu,
    setThumbMenu,
    stampCfg,
    setStampCfg,
    stampDialogOpen,
    setStampDialogOpen,
    stampPreviews,
    searchQuery,
    searchMatches,
    searchCur,
    searchBusy,
    runSearch,
    searchNext,
    searchPrev,
    searchJumpTo,
    dirty,
    saveBusy,
    saveDocument,
    saveDocumentAs,
    goToDest,
    openOutlineNode,
    zoomIn,
    zoomOut,
    zoomReset,
    setFit,
    applyScale,
    bridge,
    totalSourcePages: sizes.length,
  };
}

export type DocumentViewer = ReturnType<typeof useDocumentViewer>;
