/**
 * Slide 编辑器类型定义
 * 定义整个编辑器中使用的核心类型
 */
import type {
  SlideDeck,
  Slide,
  SlideElement,
  TextElement,
  PictureElement,
  TableElement,
  ChartElement,
  GroupElement,
  SlideAnimation,
  SlideLayoutInfo,
} from "../../engine/pptx-engine/src/index";

export type {
  SlideElement,
  TextElement,
  PictureElement,
  TableElement,
  ChartElement,
  GroupElement,
  SlideAnimation,
};
import type { RenderSlide, RenderNode } from "../../engine/pptx-render/src/index";

/** 演示文稿状态 */
export interface DeckState {
  deck: SlideDeck | null;
  archive: import("../../engine/pptx-engine/src/zip").PackageArchive | null;
  slides: Slide[];
  currentSlideIndex: number;
  selectedElementIds: string[];
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
  filePath: string | null;
}

/** 演示文稿操作结果 */
export interface DeckOperationResult {
  success: boolean;
  error?: string;
}

/** 元素编辑状态 */
export interface ElementEditState {
  elementId: string | null;
  element: SlideElement | null;
  elementType: ElementType | null;
  isEditing: boolean;
}

/** 元素类型枚举 */
export type ElementType =
  | "text"
  | "shape"
  | "picture"
  | "table"
  | "chart"
  | "group"
  | "unknown";

/** 幻灯片缩略图信息 */
export interface SlideThumbnail {
  index: number;
  slide: Slide;
  renderSlide: RenderSlide | null;
  isSelected: boolean;
  isCurrent: boolean;
}

/** 面板状态 */
export interface PanelState {
  isOutlineVisible: boolean;
  isAnimationVisible: boolean;
  isPropertiesVisible: boolean;
  activePanel: "outline" | "animation" | "properties" | null;
}

/** 工具栏状态 */
export interface ToolbarState {
  activeTool: ToolType;
  zoomLevel: number;
  isGridVisible: boolean;
  isRulerVisible: boolean;
}

/** 工具类型 */
export type ToolType =
  | "select"
  | "text"
  | "shape"
  | "line"
  | "pen"
  | "highlight"
  | "eraser";

/** 幻灯片播放状态 */
export interface SlidePlayState {
  isPlaying: boolean;
  currentSlideIndex: number;
  isFullscreen: boolean;
  isSpeakerMode: boolean;
  animationStep: number;
}

/** PPTX 解析选项 */
export interface PptxParseOptions {
  fitWidthPx: number;
  slideNo?: number;
}

/** 幻灯片大纲项 */
export interface OutlineItem {
  id: string;
  title: string;
  level: number;
  slideIndex: number;
  hasContent: boolean;
}

/** 动画时间轴项 */
export interface AnimationItem {
  id: string;
  elementId: string;
  elementName: string;
  animation: SlideAnimation;
  trigger: string;
  delay: number;
  duration: number;
}

/** 属性面板数据 */
export interface PropertyPanelData {
  fill: Record<string, unknown>;
  stroke: Record<string, unknown>;
  text: Record<string, unknown>;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** 选择框信息 */
export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** 撤销/重做栈 */
export interface HistoryState {
  past: DeckState[];
  future: DeckState[];
}

/** 拖拽状态 */
export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  elementId: string | null;
}

/** 缩放状态 */
export interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
  fitMode: "width" | "height" | "actual" | "fit";
}

/** 幻灯片布局选项 */
export interface LayoutOption {
  layout: SlideLayoutInfo;
  name: string;
  isSelected: boolean;
}

/** 文件操作结果 */
export interface FileOperationResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
