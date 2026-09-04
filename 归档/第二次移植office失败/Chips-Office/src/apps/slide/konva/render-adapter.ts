/**
 * Konva 适配器 - 将 RenderTree 映射到 Konva 节点
 * 提供高性能的 Canvas 渲染能力
 */
import type {
  RenderNode,
  RenderSlide,
  ShapeRenderNode,
  PictureRenderNode,
  GroupRenderNode,
  TableRenderNode,
  ChartRenderNode,
  ChipRenderNode,
  RenderFill,
  RenderStroke,
  RenderShadow,
  RenderTextLayout,
  TextLine,
  GlyphRun,
  TableCellRender,
} from "../../../engine/pptx-render/src/index";

/** Konva 节点属性映射选项 */
export interface KonvaNodeOptions {
  /** 是否可交互 */
  interactive?: boolean;
  /** 是否可选中 */
  selectable?: boolean;
  /** 是否可拖拽 */
  draggable?: boolean;
  /** 节点 ID 前缀 */
  idPrefix?: string;
}

/** 颜色格式转换 */
export function normalizeColor(color: string): string {
  if (!color || color === "none" || color === "transparent") {
    return "transparent";
  }
  if (!color.startsWith("#") && !color.startsWith("rgb") && !color.startsWith("rgba")) {
    return `#${color}`;
  }
  return color;
}

/** 将 RenderFill 转换为 Konva 填充配置 */
export function resolveFillConfig(fill: RenderFill | undefined): {
  fill?: string;
  fillEnabled?: boolean;
  fillPatternImage?: HTMLImageElement;
  fillPatternScaleX?: number;
  fillPatternScaleY?: number;
  fillRadialGradientStartPointX?: number;
  fillRadialGradientStartPointY?: number;
  fillRadialGradientEndPointX?: number;
  fillRadialGradientEndPointY?: number;
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndRadius?: number;
  /** Konva 渐变色停止点为 [offset, color, ...] 交错数组（与 konva ShapeConfig 类型一致） */
  fillRadialGradientColorStops?: Array<number | string>;
  fillLinearGradientStartPointX?: number;
  fillLinearGradientStartPointY?: number;
  fillLinearGradientEndPointX?: number;
  fillLinearGradientEndPointY?: number;
  /** Konva 渐变色停止点为 [offset, color, ...] 交错数组（与 konva ShapeConfig 类型一致） */
  fillLinearGradientColorStops?: Array<number | string>;
  opacity?: number;
} {
  if (!fill) {
    return { fillEnabled: false };
  }

  switch (fill.kind) {
    case "none":
      return { fillEnabled: false };
    case "solid":
      return { fill: normalizeColor(fill.color), fillEnabled: true };
    case "gradient":
      if (fill.radial) {
        const cx = fill.center?.x ?? 0.5;
        const cy = fill.center?.y ?? 0.5;
        return {
          fillEnabled: true,
          fillRadialGradientStartPointX: cx,
          fillRadialGradientStartPointY: cy,
          fillRadialGradientEndPointX: cx,
          fillRadialGradientEndPointY: cy,
          fillRadialGradientStartRadius: 0,
          fillRadialGradientEndRadius: 1,
          fillRadialGradientColorStops: flattenGradientStops(fill.stops),
        };
      }
      return {
        fillEnabled: true,
        fillLinearGradientStartPointX: 0,
        fillLinearGradientStartPointY: 0,
        fillLinearGradientEndPointX: Math.cos((fill.angleDeg * Math.PI) / 180),
        fillLinearGradientEndPointY: Math.sin((fill.angleDeg * Math.PI) / 180),
        fillLinearGradientColorStops: flattenGradientStops(fill.stops),
      };
    case "image":
      if (fill.dataUrl) {
        return {
          fillEnabled: true,
          opacity: fill.alpha,
        };
      }
      return { fillEnabled: false };
    case "pattern":
      return { fillEnabled: true, fill: normalizeColor(fill.bg) };
    default:
      return { fillEnabled: false };
  }
}

/** 将渐变停止点转换为 Konva 格式（[offset, color, ...] 交错数组） */
function flattenGradientStops(
  stops: Array<{ pos: number; color: string }>,
): Array<number | string> {
  const result: Array<number | string> = [];
  for (const stop of stops) {
    result.push(stop.pos, normalizeColor(stop.color));
  }
  return result;
}

/** 将 RenderStroke 转换为 Konva 描边配置 */
export function resolveStrokeConfig(
  stroke: RenderStroke | undefined,
  nodeWidth: number,
  nodeHeight: number,
): {
  stroke?: string;
  strokeEnabled?: boolean;
  strokeWidth?: number;
  strokeScaleEnabled?: boolean;
  dashEnabled?: boolean;
  dash?: number[];
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "round" | "bevel" | "miter";
} {
  if (!stroke) {
    return { strokeEnabled: false };
  }

  return {
    stroke: normalizeColor(stroke.color),
    strokeEnabled: true,
    strokeWidth: stroke.widthPx,
    strokeScaleEnabled: false,
    dashEnabled: !!stroke.dash && stroke.dash.length > 0,
    dash: stroke.dash,
    lineCap: stroke.cap,
    lineJoin: stroke.join,
  };
}

/** 将 RenderShadow 转换为 Konva 阴影配置 */
export function resolveShadowConfig(
  shadow: RenderShadow | undefined,
): {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowEnabled?: boolean;
  shadowOpacity?: number;
} {
  if (!shadow) {
    return { shadowEnabled: false };
  }

  return {
    shadowColor: normalizeColor(shadow.color),
    shadowBlur: shadow.blurPx,
    shadowOffsetX: shadow.offsetX,
    shadowOffsetY: shadow.offsetY,
    shadowEnabled: true,
    shadowOpacity: 1,
  };
}

/** 单个字形 run 的 Konva 文本配置（坐标相对文本框左上角） */
export interface KonvaTextConfig {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  fontStyle: string;
  textDecoration: string;
  width: number;
  align: "left" | "center" | "right" | "justify";
  letterSpacing?: number;
  kerningEnabled?: boolean;
  rotation?: number;
}

/** 将文本布局转换为 Konva 文本配置数组 */
export function resolveTextConfig(
  textLayout: RenderTextLayout,
  boxWidth: number,
  boxHeight: number,
): KonvaTextConfig[] {
  const configs: KonvaTextConfig[] = [];

  for (const line of textLayout.lines) {
    for (const run of line.runs) {
      if (run.isBullet) {
        continue;
      }

      const fontStyle = [
        run.bold ? "bold" : "",
        run.italic ? "italic" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const textDecoration = [
        run.underline ? "underline" : "",
        run.strike ? "line-through" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const rotation = run.rotate90 ? 90 : run.rotate270 ? -90 : undefined;

      configs.push({
        text: run.text,
        // 引擎的 run.x / run.baselineY 已是文本内容区绝对坐标（text-layout.ts layoutText
        // 把行顶、leadAbove、行 ascent 全部折叠进 baselineY），渲染层只补一次内边距；
        // 不再累加 line.top / line.leadAbove / 行高，否则会二次偏移。
        // leadAbove 缺省即 0（引擎仅在非 0 时写入该字段），且已折叠进 baselineY。
        x: textLayout.insets.l + run.x,
        // Konva Text 以节点顶边定位：基线 → 顶边换算用该 run 字体的真实 ascentPx，
        // 缺省时按排版模型兜底 0.8em（render-tree.ts 对 ascentPx 的约定，
        // 与 HeuristicMetrics 的 ascent = 0.8 × fontSizePx 一致）。
        y: textLayout.insets.t + run.baselineY - (run.ascentPx ?? run.fontSizePx * 0.8),
        fontSize: run.fontSizePx,
        fontFamily: run.fontFamily,
        fill: normalizeColor(run.color),
        fontStyle: fontStyle || "normal",
        textDecoration,
        width: run.widthPx,
        align: line.align ?? "left",
        letterSpacing: run.letterSpacingPx,
        kerningEnabled: !run.kerningOff,
        ...(rotation !== undefined ? { rotation } : {}),
      });
    }
  }

  return configs;
}

/** 计算多边形点 */
export function calculatePolygonPoints(
  points: number[],
  width: number,
  height: number,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    result.push(points[i] * width, points[i + 1] * height);
  }
  return result;
}

/** 创建 Konva 形状节点配置 */
export function createShapeNodeConfig(
  node: ShapeRenderNode,
  options?: KonvaNodeOptions,
): Record<string, unknown> {
  const { box } = node;
  const fillConfig = resolveFillConfig(node.fill);
  const strokeConfig = resolveStrokeConfig(node.stroke, box.w, box.h);
  const shadowConfig = resolveShadowConfig(node.shadow);

  const config: Record<string, unknown> = {
    id: `${options?.idPrefix ?? "node"}_${node.id}`,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    rotation: box.rotationDeg ?? 0,
    scaleX: box.flipH ? -1 : 1,
    scaleY: box.flipV ? -1 : 1,
    ...fillConfig,
    ...strokeConfig,
    ...shadowConfig,
    cornerRadius: node.cornerRadiusPx,
    draggable: options?.draggable ?? false,
  };

  if (node.line) {
    config.points = node.line.points;
    if (node.line.bezier) {
      config.bezier = true;
    }
  }

  if (node.polygonPoints) {
    config.points = calculatePolygonPoints(node.polygonPoints, box.w, box.h);
    config.closed = true;
  }

  if (node.pathData) {
    config.data = node.pathData;
    config.width = box.w;
    config.height = box.h;
  }

  return config;
}

/** 创建 Konva 图片节点配置 */
export function createPictureNodeConfig(
  node: PictureRenderNode,
  options?: KonvaNodeOptions,
): Record<string, unknown> {
  const { box } = node;
  const fillConfig = resolveFillConfig(node.fill);
  const strokeConfig = resolveStrokeConfig(node.stroke, box.w, box.h);
  const shadowConfig = resolveShadowConfig(node.shadow);

  const config: Record<string, unknown> = {
    id: `${options?.idPrefix ?? "node"}_${node.id}`,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    rotation: box.rotationDeg ?? 0,
    scaleX: box.flipH ? -1 : 1,
    scaleY: box.flipV ? -1 : 1,
    image: node.dataUrl ? undefined : undefined,
    draggable: options?.draggable ?? false,
    ...fillConfig,
    ...strokeConfig,
    ...shadowConfig,
  };

  return config;
}

/** 创建 Konva 组节点配置 */
export function createGroupNodeConfig(
  node: GroupRenderNode,
  options?: KonvaNodeOptions,
): Record<string, unknown> {
  const { box } = node;

  const config: Record<string, unknown> = {
    id: `${options?.idPrefix ?? "node"}_${node.id}`,
    x: box.x,
    y: box.y,
    rotation: box.rotationDeg ?? 0,
    scaleX: box.flipH ? -1 : 1,
    scaleY: box.flipV ? -1 : 1,
    draggable: options?.draggable ?? false,
    clipX: 0,
    clipY: 0,
    clipWidth: box.w,
    clipHeight: box.h,
  };

  return config;
}

/** 创建 Konva 表格节点配置 */
export function createTableNodeConfig(
  node: TableRenderNode,
  options?: KonvaNodeOptions,
): Record<string, unknown> {
  const { box } = node;

  const config: Record<string, unknown> = {
    id: `${options?.idPrefix ?? "node"}_${node.id}`,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    draggable: options?.draggable ?? false,
  };

  return config;
}

/** 创建 Konva 图表节点配置 */
export function createChartNodeConfig(
  node: ChartRenderNode,
  options?: KonvaNodeOptions,
): Record<string, unknown> {
  const { box } = node;

  const config: Record<string, unknown> = {
    id: `${options?.idPrefix ?? "node"}_${node.id}`,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    draggable: options?.draggable ?? false,
  };

  return config;
}

/** 创建 Konva 占位符节点配置 */
export function createChipNodeConfig(
  node: ChipRenderNode,
  options?: KonvaNodeOptions,
): Record<string, unknown> {
  const { box } = node;

  const config: Record<string, unknown> = {
    id: `${options?.idPrefix ?? "node"}_${node.id}`,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    text: node.label,
    fontSize: 14,
    fontFamily: "Arial",
    fill: "#E0E0E0",
    stroke: "#999999",
    strokeWidth: 1,
    align: "center",
    verticalAlign: "middle",
    draggable: false,
  };

  return config;
}

/** 根据节点类型创建对应的 Konva 配置 */
export function createNodeConfig(
  node: RenderNode,
  options?: KonvaNodeOptions,
): Record<string, unknown> | null {
  switch (node.type) {
    case "shape":
    case "text":
      return createShapeNodeConfig(node, options);
    case "picture":
      return createPictureNodeConfig(node, options);
    case "group":
      return createGroupNodeConfig(node, options);
    case "table":
      return createTableNodeConfig(node, options);
    case "chart":
      return createChartNodeConfig(node, options);
    case "placeholder-chip":
      return createChipNodeConfig(node, options);
    default:
      return null;
  }
}

/** 检查节点是否可交互 */
export function isNodeInteractive(node: RenderNode): boolean {
  return !node.decoration && !node.background;
}

/** 检查节点是否可选中 */
export function isNodeSelectable(node: RenderNode): boolean {
  return isNodeInteractive(node);
}

/** 获取节点的边界框 */
export function getNodeBounds(node: RenderNode): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: node.box.x,
    y: node.box.y,
    width: node.box.w,
    height: node.box.h,
  };
}
