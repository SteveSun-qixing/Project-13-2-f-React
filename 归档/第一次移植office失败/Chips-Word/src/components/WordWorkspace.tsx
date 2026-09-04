import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { editorExtensions } from "../editor/extensions";
import { cleanPastedHtml } from "../editor/paste-cleanup";
import { syncPageGaps } from "../editor/page-gap-sync";
import { useWordRuntime } from "../app/AppRuntimeProvider";
import { formatMessage } from "../lib/messages";
import { buildSectionCss, DocumentStage } from "./DocumentStage";
import { WordToolbar } from "./WordToolbar";
import { StatusBar, countEditorWords } from "./StatusBar";
import "./word-workspace.css";

export function WordWorkspace(): React.ReactElement {
  const runtime = useWordRuntime();
  const [pageCount, setPageCount] = useState(1);
  const [wordCount, setWordCount] = useState(0);

  const handleCreate = useCallback(
    ({ editor: created }: { editor: Editor }): void => {
      runtime.registerEditor(created);
    },
    [runtime],
  );

  const handleDestroy = useCallback((): void => {
    runtime.registerEditor(null);
  }, [runtime]);

  const handleUpdate = useCallback((): void => {
    runtime.markDirty();
  }, [runtime]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: { type: "doc", content: [{ type: "docParagraph" }] },
    editorProps: {
      // Word 默认开启拼写检查
      attributes: { class: "doc-page", spellcheck: "true" },
      transformPastedHTML: cleanPastedHtml,
    },
    onCreate: handleCreate,
    onDestroy: handleDestroy,
    onUpdate: handleUpdate,
  });

  // 空文档占位内容也不进入脏状态：装载完成后的首次事务由文档内容触发

  const sections = runtime.sections;
  const zoom = runtime.zoom;
  const hasDocument = Boolean(runtime.docState) && runtime.loadPhase === "ready";

  // 分页同步：内容/缩放/字体就绪后重建页间隙，并推导页数与字数
  useEffect(() => {
    const current = editor;
    if (!current || !hasDocument) return;
    let timer: number | undefined;
    const run = () => {
      const slices = syncPageGaps(current, sections, zoom / 100);
      setPageCount(Math.max(1, slices.length));
      setWordCount(countEditorWords(current));
    };
    timer = window.setTimeout(run, 220);
    const onTransaction = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 220);
    };
    current.on("transaction", onTransaction);
    window.addEventListener("resize", onTransaction);
    void document.fonts?.ready.then(() => onTransaction());
    return () => {
      window.clearTimeout(timer);
      current.off("transaction", onTransaction);
      window.removeEventListener("resize", onTransaction);
    };
  }, [editor, hasDocument, sections, zoom]);

  const sectionCss = useMemo(() => buildSectionCss(sections.map((s) => s.settings)), [sections]);

  const handleDropFile = useCallback(
    (file: File): void => {
      void runtime.openDroppedFile(file);
    },
    [runtime],
  );

  return (
    <div className="word-workspace">
      <WordToolbar
        editor={editor}
        disabled={!hasDocument}
        blocks={runtime.docState?.parsed.blocks ?? []}
        numbering={runtime.docState?.parsed.numbering ?? new Map()}
      />
      <DocumentStage
        editor={editor}
        docCss={runtime.docCss}
        sectionCss={sectionCss}
        zoom={zoom}
        loading={runtime.loadPhase === "loading"}
        loadError={runtime.loadError}
        hasDocument={hasDocument}
        onRetry={() => {
          void runtime.retryLastOpen();
        }}
        onOpenOther={() => {
          void runtime.openDocumentFromDialog();
        }}
        onClose={runtime.closeDocument}
        onDropFile={handleDropFile}
      />
      <StatusBar
        wordCount={wordCount}
        pageCount={pageCount}
        zoom={zoom}
        dirty={runtime.dirty}
        fileName={runtime.docState?.fileName ?? null}
        saving={runtime.saving}
        onZoomIn={runtime.zoomIn}
        onZoomOut={runtime.zoomOut}
        onZoomReset={runtime.zoomReset}
        onZoomChange={runtime.setZoom}
      />
    </div>
  );
}
