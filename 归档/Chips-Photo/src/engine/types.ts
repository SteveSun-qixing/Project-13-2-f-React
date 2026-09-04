export type LayerType =
  | "image"
  | "brush"
  | "pencil"
  | "text"
  | "gradient"
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "right-triangle"
  | "romb"
  | "parallelogram"
  | "trapezoid"
  | "plus"
  | "pentagon"
  | "hexagon"
  | "star"
  | "heart"
  | "cylinder"
  | "human"
  | "tear"
  | "cog"
  | "bezier-curve"
  | "moon"
  | "callout"
  | "polygon";

export const VECTOR_LAYER_TYPES: ReadonlySet<LayerType> = new Set<LayerType>([
  "brush",
  "pencil",
  "text",
  "gradient",
  "line",
  "arrow",
  "rectangle",
  "ellipse",
  "triangle",
  "right-triangle",
  "romb",
  "parallelogram",
  "trapezoid",
  "plus",
  "pentagon",
  "hexagon",
  "star",
  "heart",
  "cylinder",
  "human",
  "tear",
  "cog",
  "bezier-curve",
  "moon",
  "callout",
  "polygon",
]);

export interface LayerFilter {
  id: number;
  name: string;
  params: Record<string, number | string | boolean>;
  disabled?: boolean;
}

export interface PhotoLayer {
  id: number;
  parentId: number;
  name: string;
  type: LayerType | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  widthOriginal: number | null;
  heightOriginal: number | null;
  visible: boolean;
  isVector: boolean;
  opacity: number;
  order: number;
  composition: GlobalCompositeOperation;
  rotate: number;
  color: string | null;
  data: unknown;
  params: Record<string, unknown>;
  status: "draft" | null;
  filters: LayerFilter[];
  canvas: HTMLCanvasElement | null;
}

export type LayerRenderer = (ctx: CanvasRenderingContext2D, layer: PhotoLayer) => void;

export interface Guide {
  id: number;
  axis: "x" | "y";
  position: number;
}

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EngineConfig {
  width: number;
  height: number;
  zoom: number;
  color: string;
  colorSecond: string;
  alpha: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface TextSegmentMeta {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fillColor: string;
  strokeColor: string | null;
  strokeWidth: number;
  kerning: number;
  leading: number;
}

export interface TextSegment {
  text: string;
  meta: TextSegmentMeta;
}

export type TextLine = TextSegment[];

export interface BrushStrokePoint {
  x: number;
  y: number;
  size: number;
}

export type ToolId =
  | "select"
  | "selection"
  | "crop"
  | "brush"
  | "pencil"
  | "erase"
  | "magic-erase"
  | "fill"
  | "gradient"
  | "text"
  | "shape"
  | "clone"
  | "blur-brush"
  | "sharpen-brush"
  | "desaturate-brush"
  | "bulge-pinch"
  | "pick-color"
  | "animation";

export type ToolOptionType = "number" | "select" | "color" | "range" | "toggle";

export interface EffectParamDescriptor {
  key: string;
  label: string;
  type: ToolOptionType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  choices?: ToolOptionChoice[];
}

export interface ToolOptionChoice {
  value: string;
  label: string;
}

export interface ToolOptionDescriptor {
  key: string;
  label: string;
  type: ToolOptionType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  choices?: ToolOptionChoice[];
  visibleWhen?: (options: Record<string, unknown>) => boolean;
}

export interface PointerInfo {
  x: number;
  y: number;
  clickX: number;
  clickY: number;
  lastX: number;
  lastY: number;
  isDrag: boolean;
  isValid: boolean;
  pressure: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  button: number;
  speedAverage: number;
}

export interface EngineSnapshot {
  version: number;
  layers: PhotoLayer[];
  selectedLayerId: number | null;
  config: EngineConfig;
  canUndo: boolean;
  canRedo: boolean;
  activeToolId: ToolId;
  toolOptions: Record<string, Record<string, unknown>>;
  selection: SelectionBounds | null;
  gridVisible: boolean;
  guides: Guide[];
  rulerVisible: boolean;
  mouseWorld: Point | null;
  mouseCanvas: Point | null;
}

export interface ExportLayersMode {
  mode: "all" | "selected" | "separated";
}
