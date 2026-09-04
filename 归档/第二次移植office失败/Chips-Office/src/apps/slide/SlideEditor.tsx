/**
 * Slide 编辑器主组件
 * 完整的 PPTX 演示文稿编辑器界面
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout, Spin, message, Splitter } from "antd";
import { SlideStage } from "./components/Stage";
import { SlidePanel } from "./components/SlidePanel";
import { Toolbar } from "./components/Toolbar";
import { OutlinePanel } from "./components/OutlinePanel";
import { AnimationPanel } from "./components/AnimationPanel";
import { ElementEditor } from "./components/ElementEditor";
import { useDeck } from "./hooks/useDeck";
import type {
  ToolType,
  SlideThumbnail,
  ElementType,
  PptxParseOptions,
  ZoomState,
} from "./types";
import type { SlideElement } from "../../engine/pptx-engine/src/index";
import type { Client } from "chips-sdk";

/** PPTX 文件的 MIME 类型 */
const PPTX_BLOB_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export interface SlideEditorProps {
  /** Chips SDK 客户端 */
  client?: Client;
  /** 初始文件数据 */
  initialData?: ArrayBuffer | Blob;
  /** 初始文件名 */
  fileName?: string;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 保存回调 */
  onSave?: (data: Blob) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

/** 默认解析选项 */
const DEFAULT_PARSE_OPTIONS: PptxParseOptions = {
  fitWidthPx: 960,
};

/** 编辑器主组件 */
export const SlideEditor: React.FC<SlideEditorProps> = ({
  client,
  initialData,
  fileName,
  readOnly = false,
  onLoad,
  onSave,
  onError,
}) => {
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [activeRightPanel, setActiveRightPanel] = useState<"outline" | "animation" | "properties" | null>(null);

  const deck = useDeck(client);

  // 加载初始数据（loadFile 由 useDeck 稳定导出，避免整个 deck 对象变化导致重复加载）
  useEffect(() => {
    if (initialData) {
      deck.loadFile(initialData, fileName).then((result) => {
        if (result.success) {
          onLoad?.();
        } else {
          message.error(result.error || "加载文件失败");
          onError?.(result.error || "加载文件失败");
        }
      });
    }
  }, [initialData, fileName, deck.loadFile, onLoad, onError]);

  // 监听容器大小变化
  useEffect(() => {
    const container = mainAreaRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // 解析选项
  const parseOptions = useMemo<PptxParseOptions>(() => ({
    ...DEFAULT_PARSE_OPTIONS,
    fitWidthPx: containerSize.width - 40,
  }), [containerSize.width]);

  // 当前幻灯片渲染数据
  const currentRenderSlide = useMemo(() => {
    return deck.getCurrentRenderSlide(parseOptions);
  }, [deck, parseOptions]);

  // 缩略图列表
  const thumbnails = useMemo<SlideThumbnail[]>(() => {
    return deck.getSlideThumbnails({ ...parseOptions, fitWidthPx: 160 });
  }, [deck, parseOptions]);

  // 当前选中的元素
  const selectedElement = useMemo<SlideElement | null>(() => {
    if (deck.selectedElementIds.length === 0) return null;
    const currentSlide = deck.getCurrentSlide();
    if (!currentSlide) return null;

    const elementId = deck.selectedElementIds[0];
    return currentSlide.elements.find((el) => el.id === elementId) ?? null;
  }, [deck.selectedElementIds, deck]);

  // 选中元素的类型
  const selectedElementType = useMemo<ElementType | null>(() => {
    if (!selectedElement) return null;
    return selectedElement.type as ElementType;
  }, [selectedElement]);

  // 处理器
  const handleThumbnailClick = useCallback((index: number) => {
    deck.goToSlide(index);
  }, [deck]);

  const handleThumbnailDoubleClick = useCallback((index: number) => {
    deck.goToSlide(index);
  }, [deck]);

  const handleSelectElement = useCallback((elementId: string, addToSelection: boolean) => {
    deck.selectElement(elementId, addToSelection);
  }, [deck]);

  const handleClearSelection = useCallback(() => {
    deck.clearSelection();
  }, [deck]);

  const handleElementDrag = useCallback((elementId: string, x: number, y: number) => {
    deck.markDirty();
  }, [deck]);

  const handleZoomChange = useCallback((zoom: number, fitMode?: ZoomState["fitMode"]) => {
    deck.setZoom(zoom, fitMode);
  }, [deck]);

  const handleToolChange = useCallback((tool: ToolType) => {
    setActiveTool(tool);
  }, []);

  const handleSave = useCallback(async () => {
    if (deck.isSaving) return;
    const result = await deck.saveFile();
    if (result.success && result.bytes) {
      onSave?.(new Blob([new Uint8Array(result.bytes)], { type: PPTX_BLOB_MIME }));
    }
  }, [deck, onSave]);

  const handleDelete = useCallback(() => {
    deck.markDirty();
  }, [deck]);

  const handlePropertyChange = useCallback((property: string, value: unknown) => {
    deck.markDirty();
  }, [deck]);

  const handleTextChange = useCallback((text: string) => {
    deck.markDirty();
  }, [deck]);

  // 右面板内容
  const rightPanelContent = useMemo(() => {
    if (!activeRightPanel) return null;

    switch (activeRightPanel) {
      case "outline":
        return (
          <OutlinePanel
            slides={deck.slides}
            currentSlideIndex={deck.currentSlideIndex}
            onNavigateToSlide={handleThumbnailClick}
          />
        );
      case "animation":
        return (
          <AnimationPanel
            slides={deck.slides}
            currentSlideIndex={deck.currentSlideIndex}
            readOnly={readOnly}
          />
        );
      case "properties":
        return (
          <ElementEditor
            element={selectedElement}
            elementType={selectedElementType}
            readOnly={readOnly}
            onPropertyChange={handlePropertyChange}
            onTextChange={handleTextChange}
            onDelete={handleDelete}
          />
        );
      default:
        return null;
    }
  }, [
    activeRightPanel,
    deck.slides,
    deck.currentSlideIndex,
    selectedElement,
    selectedElementType,
    readOnly,
    handleThumbnailClick,
    handlePropertyChange,
    handleTextChange,
    handleDelete,
  ]);

  if (deck.isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#f5f5f5",
        }}
      >
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>正在加载演示文稿...</div>
      </div>
    );
  }

  if (deck.error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#fff",
          color: "#f5222d",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>加载失败</div>
          <div>{deck.error}</div>
        </div>
      </div>
    );
  }

  return (
    <Layout style={{ height: "100%", background: "#fff" }}>
      {/* 顶部工具栏 */}
      <Layout.Header
        style={{
          background: "#fff",
          padding: 0,
          height: "auto",
          lineHeight: "normal",
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <Toolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          zoomState={deck.zoomState}
          onZoomChange={handleZoomChange}
          onSave={handleSave}
          onDelete={handleDelete}
          hasSelection={deck.selectedElementIds.length > 0}
          readOnly={readOnly}
          isDirty={deck.isDirty}
        />
      </Layout.Header>

      {/* 中部三栏工作区：左侧缩略图、中央舞台、右侧属性面板，均通过 Splitter 拖拽调整宽度 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Splitter style={{ height: "100%" }}>
          <Splitter.Panel
            defaultSize={200}
            min={160}
            max={400}
            style={{ background: "#fafafa", overflow: "auto" }}
          >
            <SlidePanel
              thumbnails={thumbnails}
              currentSlideIndex={deck.currentSlideIndex}
              isLoading={deck.isLoading}
              readOnly={readOnly}
              thumbnailWidth={160}
              onThumbnailClick={handleThumbnailClick}
              onThumbnailDoubleClick={handleThumbnailDoubleClick}
            />
          </Splitter.Panel>

          <Splitter.Panel
            min="30%"
            style={{ background: "#e0e0e0", overflow: "hidden" }}
          >
            <div
              ref={mainAreaRef}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                padding: 20,
              }}
            >
              <SlideStage
                renderSlide={currentRenderSlide}
                zoomState={deck.zoomState}
                selectedElementIds={deck.selectedElementIds}
                onSelectElement={handleSelectElement}
                onClearSelection={handleClearSelection}
                onElementDrag={handleElementDrag}
                activeTool={activeTool}
                containerWidth={containerSize.width - 40}
                containerHeight={containerSize.height - 40}
                readOnly={readOnly}
              />
            </div>
          </Splitter.Panel>

          {activeRightPanel && (
            <Splitter.Panel
              defaultSize={280}
              min={240}
              max={480}
              style={{ background: "#fff", overflow: "auto" }}
            >
              {rightPanelContent}
            </Splitter.Panel>
          )}
        </Splitter>
      </div>

      {/* 底部状态栏 */}
      <Layout.Footer
        style={{
          background: "#fff",
          padding: "4px 16px",
          borderTop: "1px solid #e8e8e8",
          fontSize: 12,
          color: "#666",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {deck.slides.length > 0
            ? `第 ${deck.currentSlideIndex + 1} 页，共 ${deck.slides.length} 页`
            : "无幻灯片"}
        </span>
        <span>
          {deck.isDirty ? "已修改" : "未修改"}
          {deck.selectedElementIds.length > 0 && ` · 已选择 ${deck.selectedElementIds.length} 个元素`}
        </span>
      </Layout.Footer>
    </Layout>
  );
};
